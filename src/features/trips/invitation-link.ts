const pendingKey = "ridesync-pending-invitation";
const tokenPattern = /^[0-9a-f]{64}$/;
export function invitationLink(token: string) {
  if (!tokenPattern.test(token)) throw new Error("Invalid invitation token");
  const link = new URL("/", window.location.origin);
  link.hash = new URLSearchParams({ invite: token }).toString();
  return link.href;
}
// Capture only invitation fragments. Leave Supabase Auth recovery hashes intact.
// Session storage survives signup/email redirects in this tab, without query URLs.
export function readPendingInvitation() {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  if (fragment.has("invite")) {
    const token = fragment.get("invite") ?? "";
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
    try {
      sessionStorage.removeItem(pendingKey);
      if (tokenPattern.test(token)) sessionStorage.setItem(pendingKey, token);
    } catch {
      /* The in-memory invitation remains usable if storage is disabled. */
    }
    return tokenPattern.test(token) ? token : null;
  }
  try {
    const saved = sessionStorage.getItem(pendingKey);
    return saved && tokenPattern.test(saved) ? saved : null;
  } catch {
    return null;
  }
}
export function clearPendingInvitation() {
  try {
    sessionStorage.removeItem(pendingKey);
  } catch {
    /* Storage may be disabled. */
  }
}
