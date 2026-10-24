import { z } from "zod";
export class VoiceError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
const input = z
  .object({
    tripId: z.uuid(),
    action: z.enum(["join", "speak", "sos", "stop", "leave", "heartbeat"]),
  })
  .strict();
export type VoiceOperation = {
  operation_id?: string;
  access?: boolean;
  room: string;
  retired_room?: string | null;
  can_publish?: boolean;
};
export type VoiceDeps = {
  origins: () => string[];
  authenticate: (request: Request) => Promise<string>;
  begin: (
    trip: string,
    actor: string,
    action: string,
  ) => Promise<VoiceOperation>;
  finish: (trip: string, op: string, success: boolean) => Promise<boolean>;
  createRoom: (room: string) => Promise<void>;
  deleteRoom: (room: string) => Promise<void>;
  token: (
    room: string,
    actor: string,
    publish: boolean,
  ) => Promise<{ token: string; url: string }>;
};
export function voiceHandler(deps: VoiceDeps) {
  return async (request: Request) => {
    const origin = request.headers.get("Origin");
    const allowed = !origin || deps.origins().includes(origin);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
    };
    if (origin && allowed) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Headers"] =
        "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";
      headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    }
    const reply = (status: number, data: unknown) =>
      new Response(JSON.stringify(data), { status, headers });
    if (!allowed) return reply(403, { code: "ORIGIN_NOT_ALLOWED" });
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method !== "POST")
      return reply(405, { code: "METHOD_NOT_ALLOWED" });
    try {
      const actor = await deps.authenticate(request);
      const body = await request.text();
      if (new TextEncoder().encode(body).length > 2048)
        throw new VoiceError(413, "REQUEST_TOO_LARGE");
      let json: unknown;
      try {
        json = JSON.parse(body);
      } catch {
        throw new VoiceError(400, "INVALID_INPUT");
      }
      const parsed = input.safeParse(json);
      if (!parsed.success) throw new VoiceError(400, "INVALID_INPUT");
      const { tripId, action } = parsed.data;
      const op = await deps.begin(tripId, actor, action);
      if (op.retired_room)
        await deps.deleteRoom(op.retired_room).catch(() => {});
      if (op.access) {
        if (action !== "join") return reply(200, { ok: true, room: op.room });
        await deps.createRoom(op.room);
        return reply(200, {
          ...(await deps.token(op.room, actor, op.can_publish === true)),
          room: op.room,
        });
      }
      if (!op.operation_id) throw new VoiceError(502, "VOICE_UNAVAILABLE");
      try {
        await deps.createRoom(op.room);
        if (!(await deps.finish(tripId, op.operation_id, true)))
          throw new VoiceError(409, "VOICE_CHANGED");
        return reply(200, { ok: true, room: op.room });
      } catch (error) {
        await deps.finish(tripId, op.operation_id, false).catch(() => {});
        await deps.deleteRoom(op.room).catch(() => {});
        throw error;
      }
    } catch (error) {
      return error instanceof VoiceError
        ? reply(error.status, { code: error.code })
        : reply(503, { code: "VOICE_UNAVAILABLE" });
    }
  };
}
