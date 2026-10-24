import { useQuery } from "@tanstack/react-query";
import type { Database } from "../../shared/database.generated";
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
type Functions = Database["public"]["Functions"];
export type ReceivedInvitation = Omit<
  Functions["list_received_trip_invitations"]["Returns"][number],
  "status" | "trip_id"
> & { status: InvitationStatus; trip_id: string | null };
// Refine SQL status/nullable results and represent a no-argument RPC as {}.
export type NotificationFunctions = {
  remember_trip_invitation: Functions["remember_trip_invitation"];
  list_received_trip_invitations: Omit<
    Functions["list_received_trip_invitations"],
    "Args" | "Returns"
  > & {
    Args: Record<string, never>;
    Returns: ReceivedInvitation[];
  };
  respond_received_trip_invitation: Omit<
    Functions["respond_received_trip_invitation"],
    "Returns"
  > & {
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
