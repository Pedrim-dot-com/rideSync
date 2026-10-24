import { client } from "../../shared/supabase";
import { trackingSchema } from "./types";
export async function getTracking(tripId: string) {
  const { data, error } = await client().rpc("tracking_snapshot", {
    p_trip_id: tripId,
  });
  if (error) throw error;
  return { ...trackingSchema.parse(data), fetchedAt: performance.now() };
}
export async function startTrip(tripId: string, revision: number) {
  const { data, error } = await client().rpc("start_trip", {
    p_trip_id: tripId,
    p_expected_revision: revision,
  });
  if (error) throw error;
  return data;
}
export async function finishTrip(tripId: string, revision: number) {
  const { error } = await client().rpc("finish_trip", {
    p_trip_id: tripId,
    p_expected_revision: revision,
  });
  if (error) throw error;
}
export async function startSharing(sessionId: string) {
  const { data, error } = await client().rpc("start_location_sharing", {
    p_session_id: sessionId,
  });
  if (error) throw error;
  return data;
}
export async function stopSharing(sessionId: string, shareId: string) {
  const { error } = await client().rpc("stop_location_sharing", {
    p_session_id: sessionId,
    p_share_id: shareId,
  });
  if (error) throw error;
}
export async function publishLocation(
  sessionId: string,
  shareId: string,
  position: GeolocationPosition,
) {
  const { coords } = position;
  const { error } = await client().rpc("publish_rider_location", {
    p_session_id: sessionId,
    p_share_id: shareId,
    p_latitude: coords.latitude,
    p_longitude: coords.longitude,
    p_accuracy_m: coords.accuracy,
    p_heading:
      coords.heading !== null &&
      Number.isFinite(coords.heading) &&
      coords.heading >= 0 &&
      coords.heading < 360
        ? coords.heading
        : null,
    p_recorded_at: new Date(position.timestamp).toISOString(),
  });
  if (error) throw error;
}
