import { createClient } from "@supabase/supabase-js";
import { MapError, type UserContext } from "./contracts.ts";
import { openRouteService } from "./providers.ts";
import { mapHandler } from "./handler.ts";
function required(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new MapError(503, "SERVER_NOT_CONFIGURED");
  return value;
}
function dbError(error: { code?: string; message?: string }) {
  if (error.code === "40001") return new MapError(409, "TRIP_CHANGED");
  if (error.code === "55000") return new MapError(409, "ITINERARY_LOCKED");
  if (error.code === "42501") return new MapError(403, "FORBIDDEN");
  if (error.code === "P0001" && error.message === "RATE_LIMITED")
    return new MapError(429, "RATE_LIMITED");
  return new MapError(502, "DATABASE_UNAVAILABLE");
}
async function authenticate(request: Request): Promise<UserContext> {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ") || authorization.length > 8192)
    throw new MapError(401, "UNAUTHENTICATED");
  const db = createClient(
    required("SUPABASE_URL"),
    required("SUPABASE_ANON_KEY"),
    {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data, error } = await db.auth.getUser(authorization.slice(7));
  if (error || !data.user) throw new MapError(401, "UNAUTHENTICATED");
  const userId = data.user.id;
  return {
    userId,
    async consumeQuota(action) {
      const { error } = await db.rpc("consume_map_request", {
        p_action: action,
      });
      if (error) throw dbError(error);
    },
    async getTrip(id) {
      const trip = await db
        .from("trips")
        .select("id,created_by,status,revision")
        .eq("id", id)
        .single();
      if (trip.error || !trip.data) throw new MapError(403, "FORBIDDEN");
      const points = await db
        .from("trip_waypoints")
        .select("label,latitude,longitude")
        .eq("trip_id", id)
        .order("position");
      if (points.error) throw dbError(points.error);
      return {
        id: trip.data.id,
        createdBy: trip.data.created_by,
        status: trip.data.status,
        revision: trip.data.revision,
        waypoints: points.data,
      };
    },
    async saveRoute(tripId, revision, route) {
      const admin = createClient(
        required("SUPABASE_URL"),
        required("SUPABASE_SERVICE_ROLE_KEY"),
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const { error } = await admin.rpc("store_trip_route", {
        p_trip_id: tripId,
        p_actor: userId,
        p_expected_revision: revision,
        p_geometry: route.geometry,
        p_distance_m: route.distanceM,
        p_duration_s: route.durationS,
        p_calculated_at: route.calculatedAt,
      });
      if (error) throw dbError(error);
    },
  };
}
export function serveMapAction(action: "calculate-route" | "search-places") {
  const provider = openRouteService(() => Deno.env.get("ROUTING_API_KEY"));
  Deno.serve(
    mapHandler(action, {
      authenticate,
      routing: provider,
      geocoding: provider,
      allowedOrigins: () =>
        (Deno.env.get("APP_ORIGINS") ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
    }),
  );
}
