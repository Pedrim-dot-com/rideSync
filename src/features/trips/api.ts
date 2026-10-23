import { client } from "../../shared/supabase";
import type { TripInput } from "./validation";
export async function getTrips() {
  const { data, error } = await client()
    .from("trips")
    .select("*")
    .order("departure_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function getTrip(id: string) {
  const [trip, points, participants, route] = await Promise.all([
    client().from("trips").select("*").eq("id", id).single(),
    client()
      .from("trip_waypoints")
      .select("*")
      .eq("trip_id", id)
      .order("position"),
    client().from("trip_participants").select("*").eq("trip_id", id),
    client().from("trip_routes").select("*").eq("trip_id", id).maybeSingle(),
  ]);
  if (trip.error) throw trip.error;
  if (points.error) throw points.error;
  if (participants.error) throw participants.error;
  if (route.error) throw route.error;
  return {
    trip: trip.data,
    waypoints: points.data,
    participants: participants.data,
    route: route.data,
  };
}
export type TripDetail = Awaited<ReturnType<typeof getTrip>>;
export async function saveTrip(
  values: TripInput,
  existing?: { id: string; revision: number },
) {
  const args = {
    p_title: values.title,
    p_departure_at: values.departure_at,
    p_waypoints: values.waypoints,
  };
  if (existing) {
    const { error } = await client().rpc("update_trip", {
      ...args,
      p_trip_id: existing.id,
      p_expected_revision: existing.revision,
    });
    if (error) throw error;
    return existing.id;
  }
  const { data, error } = await client().rpc("create_trip", args);
  if (error) throw error;
  return data;
}
export async function changeTripStatus(
  id: string,
  status: "draft" | "planned" | "cancelled",
  revision: number,
) {
  const { error } = await client().rpc("set_trip_status", {
    p_trip_id: id,
    p_status: status,
    p_expected_revision: revision,
  });
  if (error) throw error;
}
export async function deleteTrip(id: string, revision: number) {
  const { error } = await client().rpc("delete_trip", {
    p_trip_id: id,
    p_expected_revision: revision,
  });
  if (error) throw error;
}
