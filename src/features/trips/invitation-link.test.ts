import { afterEach, describe, expect, it } from "vitest";
import {
  clearPendingInvitation,
  invitationLink,
  readPendingInvitation,
} from "./invitation-link";
const token = "a".repeat(64);
afterEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});
describe("invitation link privacy and auth redirects", () => {
  it("uses a fragment, removes it from the address and retains it across redirects in this tab", () => {
    const link = new URL(invitationLink(token));
    expect(link.search).toBe("");
    expect(link.hash).toBe(`#invite=${token}`);
    window.history.replaceState(null, "", link);
    expect(readPendingInvitation()).toBe(token);
    expect(window.location.hash).toBe("");
    expect(readPendingInvitation()).toBe(token);
    clearPendingInvitation();
    expect(readPendingInvitation()).toBeNull();
  });
  it("does not clear a newer link when an older save finishes", () => {
    window.history.replaceState(null, "", `/#invite=${token}`);
    readPendingInvitation();
    const newer = "b".repeat(64);
    window.history.replaceState(null, "", `/#invite=${newer}`);
    readPendingInvitation();
    clearPendingInvitation(token);
    expect(readPendingInvitation()).toBe(newer);
    clearPendingInvitation(newer);
    expect(readPendingInvitation()).toBeNull();
  });
  it("preserves Supabase Auth recovery fragments", () => {
    window.history.replaceState(
      null,
      "",
      "/#access_token=auth-token&type=recovery",
    );
    expect(readPendingInvitation()).toBeNull();
    expect(window.location.hash).toContain("access_token=auth-token");
  });
  it("rejects malformed tokens and clears a previously pending invitation", () => {
    window.history.replaceState(null, "", `/#invite=${token}`);
    readPendingInvitation();
    window.history.replaceState(null, "", "/#invite=not-a-token");
    expect(readPendingInvitation()).toBeNull();
    expect(readPendingInvitation()).toBeNull();
    expect(() => invitationLink("bad")).toThrow("Invalid invitation token");
  });
});
