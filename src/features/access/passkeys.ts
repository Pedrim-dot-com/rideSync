import { client } from "../../shared/supabase";
export function supportsPasskeys() {
  return Boolean(
    window.isSecureContext &&
    window.PublicKeyCredential &&
    navigator.credentials &&
    typeof navigator.credentials.create === "function" &&
    typeof navigator.credentials.get === "function",
  );
}
export async function signInWithPasskey(signal: AbortSignal) {
  const { data, error } = await client().auth.signInWithPasskey({
    options: { signal },
  });
  if (error) throw error;
  if (!data?.session || !data.user)
    throw new Error("Missing authenticated session");
}
export async function registerPasskey(signal: AbortSignal) {
  const { data, error } = await client().auth.registerPasskey({
    options: { signal },
  });
  if (error) throw error;
  if (!data?.id) throw new Error("Missing registered credential");
  return data;
}
export async function listPasskeys() {
  const { data, error } = await client().auth.passkey.list();
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("Invalid passkey list");
  return data;
}
export async function removePasskey(id: string) {
  const { error } = await client().auth.passkey.delete({ passkeyId: id });
  if (error) throw error;
}
export function passkeyError(error: unknown) {
  const e = error as { name?: string; code?: string; status?: number };
  if (
    e?.name === "NotAllowedError" ||
    e?.name === "AbortError" ||
    e?.code === "ERROR_CEREMONY_ABORTED" ||
    e?.code === "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY" ||
    e?.code === "ERROR_AUTHENTICATOR_GENERAL_ERROR"
  )
    return "O pedido foi cancelado ou não foi autorizado. Podes tentar novamente ou usar email e password.";
  if (
    e?.code === "passkey_disabled" ||
    e?.code === "webauthn_disabled" ||
    e?.status === 501 ||
    e?.status === 404
  )
    return "As chaves de acesso ainda não estão disponíveis neste serviço. Usa email e password.";
  if (e?.code === "webauthn_challenge_expired")
    return "O pedido expirou. Tenta novamente para receber um novo pedido de autenticação.";
  return "Não foi possível usar a chave de acesso. Tenta novamente ou entra com email e password.";
}
