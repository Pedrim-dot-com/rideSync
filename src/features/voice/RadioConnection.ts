import type {
  LocalAudioTrack,
  Room,
  RemoteTrackPublication,
  RemoteParticipant,
} from "livekit-client";
import {
  roomName,
  voiceAccessSchema,
  voiceAction,
  type VoiceSnapshot,
} from "./api";
export type RadioStatus =
  "off" | "connecting" | "listening" | "speaking" | "audio-blocked" | "error";
// All media decisions are derived from the authorized DB snapshot, never from
// participant metadata, Presence, data packets, or a claimed client-side role.
export class RadioConnection {
  private room: Room | null = null;
  private mic: LocalAudioTrack | null = null;
  private generation = 0;
  private micGeneration = 0;
  private currentRoom = "";
  private desired = false;
  private pendingMic = false;
  private snapshot: VoiceSnapshot | null = null;
  private lastSnapshot = 0;
  private nodes = new Set<HTMLMediaElement>();
  constructor(
    private tripId: string,
    private userId: string,
    private audio: HTMLElement,
    private status: (status: RadioStatus, error?: unknown) => void,
  ) {}
  get enabled() {
    return this.desired;
  }
  async prepareMicrophone() {
    const generation = ++this.micGeneration;
    this.pendingMic = true;
    try {
      const { createLocalAudioTrack } = await import("livekit-client");
      const mic = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      if (generation !== this.micGeneration) {
        mic.stop();
        throw new DOMException("Cancelled", "AbortError");
      }
      this.mic?.stop();
      this.mic = mic;
    } catch (error) {
      this.pendingMic = false;
      throw error;
    }
  }
  cancelMicrophone() {
    this.micGeneration++;
    this.pendingMic = false;
    this.mic?.stop();
    this.mic = null;
  }
  async enable(snapshot: VoiceSnapshot) {
    this.desired = true;
    this.snapshot = snapshot;
    this.lastSnapshot = performance.now();
    await this.connect();
  }
  update(snapshot: VoiceSnapshot) {
    this.snapshot = snapshot;
    this.lastSnapshot = performance.now();
    if (snapshot.status !== "active") {
      this.close();
      return;
    }
    if (snapshot.speaker_id !== this.userId && !this.pendingMic)
      this.cancelMicrophone();
    this.filterSubscriptions();
    if (
      this.desired &&
      !snapshot.settling &&
      snapshot.room_epoch &&
      roomName(this.tripId, snapshot.room_epoch) !== this.currentRoom
    )
      void this.connect();
  }
  completeIntent() {
    this.pendingMic = false;
    if (this.snapshot?.speaker_id !== this.userId) this.cancelMicrophone();
  }
  checkFreshness() {
    const elapsed = performance.now() - this.lastSnapshot;
    const floorExpired =
      this.snapshot?.speaker_until &&
      elapsed >=
        Date.parse(this.snapshot.speaker_until) -
          Date.parse(this.snapshot.server_now);
    if (this.desired && (elapsed > 12000 || floorExpired)) {
      this.close();
      this.status("error", new Error("Voice authorization expired"));
    }
  }
  async resumeAudio() {
    try {
      await this.room?.startAudio();
      if (this.room?.canPlaybackAudio)
        this.status(
          this.snapshot?.speaker_id === this.userId && this.mic
            ? "speaking"
            : "listening",
        );
    } catch (error) {
      this.status("audio-blocked", error);
    }
  }
  private clearAudio() {
    for (const node of this.nodes) {
      node.pause();
      node.srcObject = null;
      node.remove();
    }
    this.nodes.clear();
  }
  private filterPublication(
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ) {
    const allow =
      publication.kind === "audio" &&
      publication.source === "microphone" &&
      participant.identity === this.snapshot?.speaker_id &&
      this.snapshot.ready &&
      performance.now() - this.lastSnapshot < 12000;
    publication.setSubscribed(Boolean(allow));
    if (!allow && publication.track) {
      for (const node of publication.track.detach()) {
        node.pause();
        node.srcObject = null;
        node.remove();
        this.nodes.delete(node);
      }
    }
  }
  private filterSubscriptions() {
    if (!this.snapshot?.speaker_id) this.clearAudio();
    this.room?.remoteParticipants.forEach((p) =>
      p.trackPublications.forEach((pub) => this.filterPublication(pub, p)),
    );
  }
  private async connect() {
    const epoch = this.snapshot?.room_epoch;
    if (!this.desired || !epoch || this.snapshot?.settling) return;
    const expected = roomName(this.tripId, epoch);
    if (this.currentRoom === expected) return;
    const generation = ++this.generation;
    this.currentRoom = expected;
    this.clearAudio();
    const previous = this.room;
    this.room = null;
    await previous?.disconnect(false);
    this.status("connecting");
    let room: Room | undefined;
    try {
      const [{ Room, RoomEvent, Track }, access] = await Promise.all([
        import("livekit-client"),
        voiceAction(this.tripId, "join").then((value) =>
          voiceAccessSchema.parse(value),
        ),
      ]);
      if (generation !== this.generation || !this.desired) return;
      if (access.room !== expected) {
        this.currentRoom = "";
        this.status("connecting");
        return;
      }
      room = new Room({
        adaptiveStream: false,
        dynacast: true,
        reconnectPolicy: { nextRetryDelayInMs: () => null },
      });
      this.room = room;
      room.on(RoomEvent.TrackPublished, (pub, p) =>
        this.filterPublication(pub, p),
      );
      room.on(RoomEvent.TrackSubscribed, (track, pub, p) => {
        if (
          generation !== this.generation ||
          p.identity !== this.snapshot?.speaker_id ||
          !this.snapshot.ready ||
          track.kind !== "audio" ||
          pub.source !== "microphone"
        ) {
          pub.setSubscribed(false);
          return;
        }
        const node = track.attach();
        node.setAttribute("playsinline", "");
        this.nodes.add(node);
        this.audio.append(node);
        void node.play().catch(() => this.status("audio-blocked"));
      });
      room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        if (room && !room.canPlaybackAudio) this.status("audio-blocked");
      });
      room.on(RoomEvent.Disconnected, () => {
        if (generation === this.generation && this.desired) {
          this.close();
          this.status("error", new Error("Disconnected"));
        }
      });
      await room.connect(access.url, access.token, { autoSubscribe: false });
      if (generation !== this.generation || !this.desired) {
        await room.disconnect();
        return;
      }
      this.filterSubscriptions();
      if (this.snapshot?.speaker_id === this.userId && this.mic) {
        await room.localParticipant.publishTrack(this.mic, {
          source: Track.Source.Microphone,
        });
        this.status("speaking");
      } else this.status("listening");
      void room.startAudio().catch(() => this.status("audio-blocked"));
    } catch (error) {
      if (generation === this.generation) {
        this.close();
        this.status("error", error);
      } else await room?.disconnect();
    }
  }
  close() {
    this.desired = false;
    this.currentRoom = "";
    this.generation++;
    this.cancelMicrophone();
    this.clearAudio();
    const room = this.room;
    this.room = null;
    void room?.disconnect();
    this.status("off");
  }
}
