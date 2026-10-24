import { afterEach, describe, expect, it, vi } from "vitest";
import { RadioConnection } from "./RadioConnection";
import type { VoiceSnapshot } from "./api";
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  mic: vi.fn(),
  rooms: [] as FakeRoom[],
}));
type Handler = (...args: unknown[]) => void;
class FakeRoom {
  handlers = new Map<string, Handler>();
  remoteParticipants = new Map();
  canPlaybackAudio = true;
  localParticipant = { publishTrack: vi.fn().mockResolvedValue(undefined) };
  connect = vi.fn().mockResolvedValue(undefined);
  disconnect = vi.fn().mockResolvedValue(undefined);
  startAudio = vi.fn().mockResolvedValue(undefined);
  constructor() {
    mocks.rooms.push(this);
  }
  on(event: string, handler: Handler) {
    this.handlers.set(event, handler);
    return this;
  }
  emit(event: string, ...args: unknown[]) {
    this.handlers.get(event)?.(...args);
  }
}
vi.mock("livekit-client", () => ({
  Room: FakeRoom,
  RoomEvent: {
    TrackPublished: "published",
    TrackSubscribed: "subscribed",
    AudioPlaybackStatusChanged: "playback",
    Disconnected: "disconnected",
  },
  Track: { Source: { Microphone: "microphone" } },
  createLocalAudioTrack: mocks.mic,
}));
vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  voiceAction: mocks.access,
}));
const snap: VoiceSnapshot = {
  status: "active",
  server_now: new Date().toISOString(),
  room_epoch: "epoch",
  speaker_id: "owner",
  speaker_name: "Organizador",
  speaker_kind: "organizer",
  speaker_until: new Date(Date.now() + 45000).toISOString(),
  ready: true,
  settling: false,
  sos: null,
};
const radios: RadioConnection[] = [];
function setup(user = "rider") {
  mocks.access.mockResolvedValue({
    token: "token",
    url: "wss://project.livekit.cloud",
    room: "ridesync-trip-epoch",
  });
  const status = vi.fn();
  const radio = new RadioConnection(
    "trip",
    user,
    document.createElement("div"),
    status,
  );
  radios.push(radio);
  return { radio, status };
}
afterEach(() => {
  radios.splice(0).forEach((radio) => radio.close());
  mocks.rooms.splice(0);
  vi.resetAllMocks();
  vi.useRealTimers();
});
describe("voice media permissions and cleanup", () => {
  it("listens without requesting microphone and subscribes only to the DB-authorized audio", async () => {
    const { radio } = setup();
    await radio.enable(snap);
    expect(mocks.mic).not.toHaveBeenCalled();
    const room = mocks.rooms[0];
    expect(room.connect).toHaveBeenCalledWith(expect.any(String), "token", {
      autoSubscribe: false,
    });
    const publication = {
      kind: "audio",
      source: "microphone",
      setSubscribed: vi.fn(),
    };
    room.emit("published", publication, { identity: "owner" });
    expect(publication.setSubscribed).toHaveBeenLastCalledWith(true);
    room.emit("published", publication, { identity: "rider" });
    expect(publication.setSubscribed).toHaveBeenLastCalledWith(false);
    room.emit(
      "published",
      { ...publication, source: "screen_share_audio" },
      { identity: "owner" },
    );
    expect(publication.setSubscribed).toHaveBeenLastCalledWith(false);
  });
  it("publishes a microphone only when the caller owns the authorized floor", async () => {
    const mic = { stop: vi.fn() };
    mocks.mic.mockResolvedValue(mic);
    const { radio } = setup("owner");
    await radio.prepareMicrophone();
    await radio.enable(snap);
    radio.completeIntent();
    expect(mocks.rooms[0].localParticipant.publishTrack).toHaveBeenCalledWith(
      mic,
      { source: "microphone" },
    );
    radio.update({
      ...snap,
      speaker_id: null,
      ready: false,
      settling: true,
      sos: {
        user_id: "rider",
        display_name: "Ana",
        reason: "puncture",
        raised_at: snap.server_now,
        expires_at: snap.speaker_until!,
      },
    });
    expect(mic.stop).toHaveBeenCalled();
  });
  it("stops a late microphone permission result after leaving", async () => {
    let resolve!: (value: unknown) => void;
    mocks.mic.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const { radio } = setup();
    const pending = radio.prepareMicrophone();
    await vi.waitFor(() => expect(mocks.mic).toHaveBeenCalled());
    radio.close();
    const mic = { stop: vi.fn() };
    resolve(mic);
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(mic.stop).toHaveBeenCalledOnce();
  });
  it("does not cancel a pending microphone just because the room epoch changes", async () => {
    const { radio } = setup();
    await radio.enable(snap);
    let resolve!: (value: unknown) => void;
    mocks.mic.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const pending = radio.prepareMicrophone();
    await vi.waitFor(() => expect(mocks.mic).toHaveBeenCalled());
    radio.update({
      ...snap,
      room_epoch: "next",
      speaker_id: null,
      ready: false,
      settling: true,
    });
    const mic = { stop: vi.fn() };
    resolve(mic);
    await expect(pending).resolves.toBeUndefined();
    expect(mic.stop).not.toHaveBeenCalled();
  });
  it("closes media on completed trips and on stale authorization", async () => {
    const { radio, status } = setup();
    await radio.enable(snap);
    radio.update({ ...snap, status: "completed" });
    expect(radio.enabled).toBe(false);
    expect(mocks.rooms[0].disconnect).toHaveBeenCalled();
    await radio.enable(snap);
    const now = vi
      .spyOn(performance, "now")
      .mockReturnValue(performance.now() + 13000);
    radio.checkFreshness();
    expect(radio.enabled).toBe(false);
    expect(status).toHaveBeenLastCalledWith("error", expect.any(Error));
    now.mockRestore();
  });
});
