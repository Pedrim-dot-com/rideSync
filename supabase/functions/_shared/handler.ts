import { z } from "zod";
import {
  MapError,
  type UserContext,
  type RoutingProvider,
  type GeocodingProvider,
} from "./contracts.ts";
type Dependencies = {
  authenticate: (request: Request) => Promise<UserContext>;
  routing: RoutingProvider;
  geocoding: GeocodingProvider;
  allowedOrigins: () => string[];
};
const routeInput = z
  .object({
    tripId: z.uuid(),
    expectedRevision: z.number().int().positive(),
    avoidHighways: z.boolean().default(false),
  })
  .strict();
const searchInput = z
  .object({ text: z.string().trim().min(3).max(120) })
  .strict();
export function mapHandler(
  action: "calculate-route" | "search-places",
  deps: Dependencies,
) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("Origin");
    const allowed = origin === null || deps.allowedOrigins().includes(origin);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
    };
    if (origin && allowed) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Headers"] =
        "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";
      headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    }
    const respond = (status: number, data: unknown) =>
      new Response(JSON.stringify(data), { status, headers });
    if (!allowed) return respond(403, { code: "ORIGIN_NOT_ALLOWED" });
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method !== "POST")
      return respond(405, { code: "METHOD_NOT_ALLOWED" });
    try {
      const user = await deps.authenticate(request);
      if (Number(request.headers.get("Content-Length")) > 4096)
        throw new MapError(413, "REQUEST_TOO_LARGE");
      const body = await request.text();
      if (new TextEncoder().encode(body).length > 4096)
        throw new MapError(413, "REQUEST_TOO_LARGE");
      let input: unknown;
      try {
        input = JSON.parse(body);
      } catch {
        throw new MapError(400, "INVALID_INPUT");
      }
      if (action === "search-places") {
        const parsed = searchInput.safeParse(input);
        if (!parsed.success) throw new MapError(400, "INVALID_INPUT");
        await user.consumeQuota(action);
        const places = await deps.geocoding.search(parsed.data.text);
        return respond(200, { places });
      }
      const parsed = routeInput.safeParse(input);
      if (!parsed.success) throw new MapError(400, "INVALID_INPUT");
      const { tripId, expectedRevision, avoidHighways } = parsed.data;
      const trip = await user.getTrip(tripId);
      if (trip.createdBy !== user.userId) throw new MapError(403, "FORBIDDEN");
      if (!["draft", "planned"].includes(trip.status))
        throw new MapError(409, "ITINERARY_LOCKED");
      if (trip.revision !== expectedRevision)
        throw new MapError(409, "TRIP_CHANGED");
      if (trip.waypoints.length < 2 || trip.waypoints.length > 12)
        throw new MapError(422, "INVALID_ITINERARY");
      await user.consumeQuota(action);
      const route = await deps.routing.calculate(trip.waypoints, avoidHighways);
      await user.saveRoute(tripId, expectedRevision, route);
      return respond(200, { route });
    } catch (error) {
      return error instanceof MapError
        ? respond(error.status, { code: error.code })
        : respond(500, { code: "INTERNAL_ERROR" });
    }
  };
}
