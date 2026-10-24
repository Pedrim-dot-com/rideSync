import type { VoiceFunctions } from "../features/voice/api";
import type { GroupFunctions, GroupTables } from "../features/groups/api";
import type { NotificationFunctions } from "../features/trips/notifications-api";
import type { TrackingFunctions } from "../features/tracking/types";
// Domain aliases derived from the generated Supabase schema.
import type { Database as GeneratedDatabase } from "./database.generated";
import type { ParticipationFunctions } from "../features/trips/participation.types";
// Preserve the generated snapshot; SQL RPC nullability is refined separately.
export type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<GeneratedDatabase["public"], "Functions" | "Tables"> & {
    Tables: GeneratedDatabase["public"]["Tables"] & GroupTables;
    Functions: Omit<
      GeneratedDatabase["public"]["Functions"],
      | keyof ParticipationFunctions
      | keyof TrackingFunctions
      | keyof NotificationFunctions
      | keyof GroupFunctions
      | keyof VoiceFunctions
    > &
      ParticipationFunctions &
      TrackingFunctions &
      NotificationFunctions &
      GroupFunctions &
      VoiceFunctions;
  };
};
export type { Json } from "./database.generated";
export type TripRow = Database["public"]["Tables"]["trips"]["Row"];
export type TripStatus = TripRow["status"];
export type WaypointRow = Database["public"]["Tables"]["trip_waypoints"]["Row"];
export type ParticipantRow =
  Database["public"]["Tables"]["trip_participants"]["Row"];
export type RouteRow = Database["public"]["Tables"]["trip_routes"]["Row"];
