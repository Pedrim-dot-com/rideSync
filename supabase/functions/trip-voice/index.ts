import { createClient } from "@supabase/supabase-js";
import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
} from "livekit-server-sdk";
import { VoiceError, voiceHandler, type VoiceOperation } from "./handler.ts";
function required(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new VoiceError(503, "VOICE_NOT_CONFIGURED");
  return value;
}
function provider() {
  const url = new URL(required("LIVEKIT_URL"));
  if (
    url.protocol !== "wss:" ||
    !url.hostname.endsWith(".livekit.cloud") ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new VoiceError(503, "VOICE_NOT_CONFIGURED");
  return {
    url: url.origin,
    key: required("LIVEKIT_API_KEY"),
    secret: required("LIVEKIT_API_SECRET"),
  };
}
function dbError(error: { code?: string; message?: string }) {
  if (error.code === "42501") throw new VoiceError(403, "FORBIDDEN");
  if (error.message === "RATE_LIMITED")
    throw new VoiceError(429, "RATE_LIMITED");
  if (error.message === "VOICE_BUSY" || error.message === "SOS_ALREADY_ACTIVE")
    throw new VoiceError(409, error.message);
  throw new VoiceError(503, "VOICE_UNAVAILABLE");
}
const admin = () =>
  createClient(
    required("SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
function rooms() {
  const p = provider();
  return new RoomServiceClient(
    p.url.replace("wss:", "https:"),
    p.key,
    p.secret,
    { requestTimeout: 8, failover: false },
  );
}
Deno.serve(
  voiceHandler({
    origins: () =>
      (Deno.env.get("APP_ORIGINS") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    async authenticate(request) {
      const header = request.headers.get("Authorization");
      if (!header?.startsWith("Bearer ") || header.length > 8192)
        throw new VoiceError(401, "UNAUTHENTICATED");
      const { data, error } = await admin().auth.getUser(header.slice(7));
      if (error || !data.user) throw new VoiceError(401, "UNAUTHENTICATED");
      provider();
      return data.user.id;
    },
    async begin(trip, actor, action) {
      const { data, error } = await admin().rpc("begin_trip_voice_operation", {
        p_trip_id: trip,
        p_actor: actor,
        p_action: action,
      });
      if (error) dbError(error);
      return data as VoiceOperation;
    },
    async finish(trip, op, success) {
      const { data, error } = await admin().rpc("finish_trip_voice_operation", {
        p_trip_id: trip,
        p_operation_id: op,
        p_success: success,
      });
      if (error) dbError(error);
      return data === true;
    },
    async createRoom(room) {
      await rooms().createRoom({
        name: room,
        emptyTimeout: 30,
        departureTimeout: 10,
        maxParticipants: 16,
      });
    },
    async deleteRoom(room) {
      await rooms().deleteRoom(room);
    },
    async token(room, actor, publish) {
      const p = provider();
      const token = new AccessToken(p.key, p.secret, {
        identity: actor,
        ttl: 60,
      });
      token.addGrant({
        roomJoin: true,
        room,
        canPublish: publish,
        canPublishSources: [TrackSource.MICROPHONE],
        canSubscribe: true,
        canPublishData: false,
        canUpdateOwnMetadata: false,
      });
      return { token: await token.toJwt(), url: p.url };
    },
  }),
);
