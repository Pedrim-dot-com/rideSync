import type { Database } from "../../shared/database.generated";
type Functions = Database["public"]["Functions"];
// Supabase's generator omits nullability for SQL function arguments/results.
// Add only the nullable values verified by the migration and remote smoke tests.
type Nullable<T, K extends keyof T> = Omit<T, K> & { [P in K]: T[P] | null };
export type TripMember = Nullable<
  Functions["list_trip_members"]["Returns"][number],
  "username" | "motorcycle_brand" | "motorcycle_model"
>;
export type TripInvitation = Nullable<
  Functions["list_trip_invitations"]["Returns"][number],
  "response" | "used_at" | "revoked_at"
>;
export type ParticipationFunctions = {
  list_trip_members: Omit<Functions["list_trip_members"], "Returns"> & {
    Returns: TripMember[];
  };
  list_trip_invitations: Omit<Functions["list_trip_invitations"], "Returns"> & {
    Returns: TripInvitation[];
  };
  respond_trip_invitation: Omit<
    Functions["respond_trip_invitation"],
    "Returns"
  > & {
    Returns: string | null;
  };
  set_trip_motorcycle: Omit<Functions["set_trip_motorcycle"], "Args"> & {
    Args: Nullable<Functions["set_trip_motorcycle"]["Args"], "p_motorcycle_id">;
  };
};
