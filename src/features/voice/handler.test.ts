import { describe, expect, it, vi } from "vitest";
import {
  VoiceError,
  voiceHandler,
  type VoiceDeps,
} from "../../../supabase/functions/trip-voice/handler";
const trip = "00000000-0000-4000-8000-000000000001";
function setup() {
  const deps: VoiceDeps = {
    origins: () => ["https://ridesync-8z1.pages.dev"],
    authenticate: vi.fn().mockResolvedValue("verified-user"),
    begin: vi.fn().mockResolvedValue({
      operation_id: "op",
      room: "new-room",
      retired_room: "old-room",
    }),
    finish: vi.fn().mockResolvedValue(true),
    createRoom: vi.fn().mockResolvedValue(undefined),
    deleteRoom: vi.fn().mockResolvedValue(undefined),
    token: vi.fn().mockResolvedValue({
      token: "short-lived-token",
      url: "wss://test.livekit.cloud",
    }),
  };
  return { deps, handler: voiceHandler(deps) };
}
function request(
  body: unknown = { tripId: trip, action: "sos" },
  origin = "https://ridesync-8z1.pages.dev",
) {
  return new Request("https://edge.test/trip-voice", {
    method: "POST",
    headers: { Origin: origin, Authorization: "Bearer test-session" },
    body: JSON.stringify(body),
  });
}
describe("voice Edge authorization and fencing", () => {
  it("rejects a foreign origin before authentication or provider work", async () => {
    const { deps, handler } = setup();
    expect(
      (await handler(request(undefined, "https://foreign.test"))).status,
    ).toBe(403);
    expect(deps.authenticate).not.toHaveBeenCalled();
  });
  it("rejects claimed actor/role/room fields", async () => {
    const { deps, handler } = setup();
    expect(
      (
        await handler(
          request({
            tripId: trip,
            action: "speak",
            actor: "organizer",
            room: "forged",
          }),
        )
      ).status,
    ).toBe(400);
    expect(deps.begin).not.toHaveBeenCalled();
  });
  it("uses only the verified JWT identity for the service operation", async () => {
    const { deps, handler } = setup();
    expect((await handler(request())).status).toBe(200);
    expect(deps.begin).toHaveBeenCalledWith(trip, "verified-user", "sos");
    expect(deps.deleteRoom).toHaveBeenCalledWith("old-room");
    expect(deps.finish).toHaveBeenCalledWith(trip, "op", true);
    expect(deps.token).not.toHaveBeenCalled();
  });
  it("issues listener tokens when the DB has not granted the floor", async () => {
    const { deps, handler } = setup();
    vi.mocked(deps.begin).mockResolvedValue({
      access: true,
      room: "current-room",
      can_publish: false,
    });
    const response = await handler(request({ tripId: trip, action: "join" }));
    expect(response.status).toBe(200);
    expect(deps.token).toHaveBeenCalledWith(
      "current-room",
      "verified-user",
      false,
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("only grants publisher access returned by the authorized DB floor", async () => {
    const { deps, handler } = setup();
    vi.mocked(deps.begin).mockResolvedValue({
      access: true,
      room: "sos-epoch",
      can_publish: true,
    });
    await handler(request({ tripId: trip, action: "join" }));
    expect(deps.token).toHaveBeenCalledWith("sos-epoch", "verified-user", true);
  });
  it("rotates and deletes a failed floor without leaking an upstream error", async () => {
    const { deps, handler } = setup();
    vi.mocked(deps.createRoom).mockRejectedValue(
      new Error("private provider error"),
    );
    const response = await handler(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "VOICE_UNAVAILABLE" });
    expect(deps.finish).toHaveBeenCalledWith(trip, "op", false);
    expect(deps.deleteRoom).toHaveBeenCalledWith("new-room");
    expect(deps.token).not.toHaveBeenCalled();
  });
  it("fails closed when the operation has been replaced", async () => {
    const { deps, handler } = setup();
    vi.mocked(deps.finish).mockResolvedValue(false);
    expect((await handler(request())).status).toBe(409);
    expect(deps.deleteRoom).toHaveBeenCalledWith("new-room");
  });
  it("does not call the media provider or mint tokens for a heartbeat", async () => {
    const { deps, handler } = setup();
    vi.mocked(deps.begin).mockResolvedValue({
      access: true,
      room: "current-room",
    });
    await handler(request({ tripId: trip, action: "heartbeat" }));
    expect(deps.createRoom).not.toHaveBeenCalled();
    expect(deps.token).not.toHaveBeenCalled();
  });
  it("returns a clear configuration error", async () => {
    const { deps, handler } = setup();
    vi.mocked(deps.authenticate).mockRejectedValue(
      new VoiceError(503, "VOICE_NOT_CONFIGURED"),
    );
    const response = await handler(request());
    expect(await response.json()).toEqual({ code: "VOICE_NOT_CONFIGURED" });
    expect(deps.begin).not.toHaveBeenCalled();
  });
});
