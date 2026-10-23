import { client } from "../../shared/supabase";
export async function getTripMembers(tripId: string) {
  const { data, error } = await client().rpc("list_trip_members", {
    p_trip_id: tripId,
  });
  if (error) throw error;
  return data;
}
export async function getTripInvitations(tripId: string) {
  const { data, error } = await client().rpc("list_trip_invitations", {
    p_trip_id: tripId,
  });
  if (error) throw error;
  return data;
}
export async function createTripInvitation(tripId: string) {
  const { data, error } = await client().rpc("create_trip_invitation", {
    p_trip_id: tripId,
  });
  if (error) throw error;
  if (!data?.[0]) throw new Error("Missing invitation");
  return data[0];
}
export async function revokeTripInvitation(
  tripId: string,
  invitationId: string,
) {
  const { error } = await client().rpc("revoke_trip_invitation", {
    p_trip_id: tripId,
    p_invitation_id: invitationId,
  });
  if (error) throw error;
}
export async function respondTripInvitation(token: string, accept: boolean) {
  const { data, error } = await client().rpc("respond_trip_invitation", {
    p_token: token,
    p_accept: accept,
  });
  if (error) throw error;
  return data;
}
export async function setTripMotorcycle(
  tripId: string,
  motorcycleId: string | null,
) {
  const { error } = await client().rpc("set_trip_motorcycle", {
    p_trip_id: tripId,
    p_motorcycle_id: motorcycleId,
  });
  if (error) throw error;
}
export function participationError(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error ? error.code : "";
  const message =
    error && typeof error === "object" && "message" in error
      ? error.message
      : "";
  if (message === "INVITATION_UNAVAILABLE")
    return "Este convite expirou, foi revogado ou já foi utilizado. Pede um novo link ao organizador.";
  if (message === "ALREADY_PARTICIPATING")
    return "Já participas nesta viagem. Abre-a na lista de viagens.";
  if (message === "INVITATION_RATE_LIMITED")
    return "Atingiste o limite de convites. Tenta novamente amanhã.";
  if (code === "PGRST202" || code === "42883")
    return "A participação em viagens ainda não está disponível. Tenta mais tarde.";
  if (code === "55000")
    return "A participação só pode ser alterada antes do início da viagem.";
  if (code === "42501")
    return "Não tens acesso a esta viagem ou à mota escolhida.";
  return "Não foi possível concluir. Verifica a ligação e tenta novamente.";
}
