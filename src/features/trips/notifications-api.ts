import { useQuery } from "@tanstack/react-query";
import { client } from "../../shared/supabase";
export type InvitationStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "used"
  | "revoked"
  | "expired"
  | "unavailable"
  | "joined";
export type ReceivedInvitation = {
  receipt_id: string;
  title: string;
  departure_at: string;
  inviter_name: string;
  expires_at: string;
  received_at: string;
  status: InvitationStatus;
  trip_id: string | null;
};
// Migration 006 contract; the generated snapshot is refreshed after remote approval.
export type NotificationFunctions = {
  remember_trip_invitation: { Args: { p_token: string }; Returns: string };
  list_received_trip_invitations: {
    Args: Record<string, never>;
    Returns: ReceivedInvitation[];
  };
  respond_received_trip_invitation: {
    Args: { p_receipt_id: string; p_accept: boolean };
    Returns: string | null;
  };
};
export async function rememberTripInvitation(token: string) {
  const { data, error } = await client().rpc("remember_trip_invitation", {
    p_token: token,
  });
  if (error) throw error;
  if (!data) throw new Error("Missing receipt");
  return data;
}
export async function respondReceivedInvitation(
  receiptId: string,
  accept: boolean,
) {
  const { data, error } = await client().rpc(
    "respond_received_trip_invitation",
    { p_receipt_id: receiptId, p_accept: accept },
  );
  if (error) throw error;
  return data;
}
export function useNotifications(userId?: string) {
  return useQuery({
    queryKey: ["notifications", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await client().rpc(
        "list_received_trip_invitations",
        {},
      );
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });
}
