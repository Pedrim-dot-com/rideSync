import { z } from "zod";
const coordinate = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);
export const geometrySchema = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(coordinate).min(2).max(50000),
});
export const routeSchema = z.object({
  geometry: geometrySchema,
  distanceM: z.number().finite().nonnegative(),
  durationS: z.number().finite().nonnegative(),
  provider: z.literal("openrouteservice"),
  calculatedAt: z.iso.datetime(),
});
export type RouteResult = z.infer<typeof routeSchema>;
export type Waypoint = { label: string; latitude: number; longitude: number };
export type Place = { label: string; latitude: number; longitude: number };
export type TripForRouting = {
  id: string;
  createdBy: string;
  status: string;
  revision: number;
  waypoints: Waypoint[];
};
export class MapError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export interface UserContext {
  userId: string;
  consumeQuota: (action: "calculate-route" | "search-places") => Promise<void>;
  getTrip: (id: string) => Promise<TripForRouting>;
  saveRoute: (
    tripId: string,
    revision: number,
    route: RouteResult,
  ) => Promise<void>;
}
export interface RoutingProvider {
  calculate: (
    points: Waypoint[],
    avoidHighways: boolean,
  ) => Promise<RouteResult>;
}
export interface GeocodingProvider {
  search: (text: string, signal?: AbortSignal) => Promise<Place[]>;
}
