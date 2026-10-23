import { z } from "zod";
import {
  MapError,
  routeSchema,
  type RoutingProvider,
  type GeocodingProvider,
} from "./contracts.ts";
const directionsSchema = z.object({
  features: z
    .array(
      z.object({
        geometry: routeSchema.shape.geometry,
        properties: z.object({
          summary: z.object({
            distance: z.number().finite().nonnegative(),
            duration: z.number().finite().nonnegative(),
          }),
        }),
      }),
    )
    .min(1)
    .max(1),
});
const placesSchema = z.object({
  features: z
    .array(
      z.object({
        geometry: z.object({
          type: z.literal("Point"),
          coordinates: z.tuple([
            z.number().finite().min(-180).max(180),
            z.number().finite().min(-90).max(90),
          ]),
        }),
        properties: z.object({ label: z.string().min(1).max(300) }),
      }),
    )
    .max(5),
});
export function openRouteService(
  getKey: () => string | undefined,
  fetcher: typeof fetch = fetch,
): RoutingProvider & GeocodingProvider {
  async function request(
    path: string,
    init: RequestInit,
    signal?: AbortSignal,
  ) {
    const key = getKey();
    if (!key) throw new MapError(503, "ROUTING_NOT_CONFIGURED");
    try {
      const response = await fetcher(
        `https://api.openrouteservice.org${path}`,
        {
          ...init,
          headers: { Authorization: key, ...init.headers },
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
            : AbortSignal.timeout(15000),
        },
      );
      if (response.status === 429)
        throw new MapError(429, "PROVIDER_RATE_LIMITED");
      if (!response.ok)
        throw new MapError(
          response.status >= 500 ? 502 : 422,
          "ROUTING_UNAVAILABLE",
        );
      return await response.json();
    } catch (error) {
      if (error instanceof MapError) throw error;
      throw new MapError(502, "ROUTING_UNAVAILABLE");
    }
  }
  return {
    async calculate(points, avoidHighways) {
      const payload = await request("/v2/directions/driving-car/geojson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinates: points.map((p) => [p.longitude, p.latitude]),
          instructions: false,
          ...(avoidHighways
            ? { options: { avoid_features: ["highways"] } }
            : {}),
        }),
      });
      const result = directionsSchema.safeParse(payload);
      if (!result.success) throw new MapError(502, "INVALID_ROUTING_RESPONSE");
      const feature = result.data.features[0];
      return {
        geometry: feature.geometry,
        distanceM: feature.properties.summary.distance,
        durationS: feature.properties.summary.duration,
        provider: "openrouteservice",
        calculatedAt: new Date().toISOString(),
      };
    },
    async search(text, signal) {
      const query = new URLSearchParams({ text, size: "5", lang: "pt" });
      const payload = await request(
        `/geocode/search?${query}`,
        { method: "GET" },
        signal,
      );
      const result = placesSchema.safeParse(payload);
      if (!result.success)
        throw new MapError(502, "INVALID_GEOCODING_RESPONSE");
      return result.data.features.map((feature) => ({
        label: feature.properties.label,
        latitude: feature.geometry.coordinates[1],
        longitude: feature.geometry.coordinates[0],
      }));
    },
  };
}
