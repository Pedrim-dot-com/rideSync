// Domain aliases derived from the generated Supabase schema.
import type { Database } from "./database.generated";
export type { Database, Json } from "./database.generated";
export type TripRow = Database["public"]["Tables"]["trips"]["Row"];
export type TripStatus = TripRow["status"];
export type WaypointRow = Database["public"]["Tables"]["trip_waypoints"]["Row"];
export type ParticipantRow =
  Database["public"]["Tables"]["trip_participants"]["Row"];
export type RouteRow = Database["public"]["Tables"]["trip_routes"]["Row"];
