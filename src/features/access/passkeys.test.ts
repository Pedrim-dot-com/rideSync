import { afterEach, describe, it, expect, vi } from "vitest";
import { signInWithPasskey, registerPasskey, removePasskey } from "./passkeys";
const auth = vi.hoisted(() => ({
  signInWithPasskey: vi.fn(),
  registerPasskey: vi.fn(),
  passkey: { delete: vi.fn() },
}));
vi.mock("../../shared/supabase", () => ({ client: () => ({ auth }) }));
afterEach(() => vi.resetAllMocks());
describe("server-verified passkey access", () => {
  it("requires a real Auth session, not just a successful device prompt", async () => {
    auth.signInWithPasskey.mockResolvedValue({
      data: { user: { id: "rider" }, session: null },
      error: null,
    });
    await expect(
      signInWithPasskey(new AbortController().signal),
    ).rejects.toThrow("Missing authenticated session");
  });
  it("propagates backend assertion rejection even if a device has responded", async () => {
    auth.signInWithPasskey.mockResolvedValue({
      data: null,
      error: { code: "invalid_credential" },
    });
    await expect(
      signInWithPasskey(new AbortController().signal),
    ).rejects.toMatchObject({ code: "invalid_credential" });
  });
  it("does not fabricate an enrollment if the server rejects it", async () => {
    auth.registerPasskey.mockResolvedValue({
      data: null,
      error: { code: "webauthn_challenge_expired" },
    });
    await expect(
      registerPasskey(new AbortController().signal),
    ).rejects.toMatchObject({ code: "webauthn_challenge_expired" });
  });
  it("deletes through authenticated Auth API without a client-supplied user identity", async () => {
    auth.passkey.delete.mockResolvedValue({ error: null });
    await removePasskey("key-id");
    expect(auth.passkey.delete).toHaveBeenCalledWith({ passkeyId: "key-id" });
  });
});
