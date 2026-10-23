// Domain aliases derived from the generated Supabase schema.
import type { Database as GeneratedDatabase } from "./database.generated";
import type { ParticipationFunctions } from "../features/trips/participation.types";
// Keep the generated remote snapshot intact until migration 004 is authorized.
export type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<GeneratedDatabase["public"], "Functions"> & {
    Functions: GeneratedDatabase["public"]["Functions"] &
      ParticipationFunctions;
  };
};
export type { Json } from "./database.generated";
export type TripRow = Database["public"]["Tables"]["trips"]["Row"];
export type TripStatus = TripRow["status"];
export type WaypointRow = Database["public"]["Tables"]["trip_waypoints"]["Row"];
export type ParticipantRow =
  Database["public"]["Tables"]["trip_participants"]["Row"];
export type RouteRow = Database["public"]["Tables"]["trip_routes"]["Row"];
