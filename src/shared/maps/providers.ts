import { z } from "zod";
import { client } from "../supabase";
import {
  geometrySchema,
  type RouteResult,
  type Place,
} from "../../../supabase/functions/_shared/contracts";
export type { RouteResult, Place };
export { geometrySchema };
export interface MapStyleProvider {
  getStyleUrl: () => string | null;
}
export const mapTiler: MapStyleProvider = {
  getStyleUrl() {
    const key = import.meta.env.VITE_MAPTILER_API_KEY;
    if (!key) return null;
    try {
      const url = new URL(
        import.meta.env.VITE_MAP_STYLE_URL ||
          "https://api.maptiler.com/maps/streets-v2/style.json",
      );
      if (
        url.protocol !== "https:" ||
        url.hostname !== "api.maptiler.com" ||
        url.username ||
        url.password
      )
        return null;
      url.searchParams.set("key", key);
      return url.toString();
    } catch {
      return null;
    }
  },
};
const messages: Record<string, string> = {
  UNAUTHENTICATED: "Entra novamente na tua conta.",
  FORBIDDEN: "Não tens acesso a esta operação.",
  TRIP_CHANGED:
    "A viagem foi alterada. Atualiza os dados antes de calcular novamente.",
  ITINERARY_LOCKED: "O itinerário está bloqueado neste estado.",
  RATE_LIMITED: "Atingiste o limite de pedidos. Aguarda um minuto.",
  PROVIDER_RATE_LIMITED:
    "O serviço de rotas atingiu o limite de pedidos. Tenta mais tarde.",
  ORIGIN_NOT_ALLOWED: "O serviço ainda não está disponível neste endereço.",
  ROUTING_NOT_CONFIGURED: "O serviço de rotas ainda não está configurado.",
  SERVER_NOT_CONFIGURED: "O serviço de mapas ainda não está disponível.",
  ROUTING_UNAVAILABLE:
    "Não foi possível encontrar um percurso. Revê os pontos e tenta novamente.",
};
export class MapsClientError extends Error {
  constructor(public code: string) {
    super(
      messages[code] ??
        "O serviço de mapas está indisponível. Podes continuar a editar as coordenadas.",
    );
  }
}
export async function callMapFunction(
  name: "calculate-route" | "search-places",
  body: Record<string, unknown>,
  signal?: AbortSignal,
) {
  const { data, error } = await client().functions.invoke(name, {
    body,
    signal,
  });
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (error) {
    let code = "SERVICE_UNAVAILABLE";
    if (error.context instanceof Response) {
      try {
        const result = await error.context.clone().json();
        if (typeof result.code === "string") code = result.code;
      } catch {
        /* Only expose our known error codes. */
      }
    }
    throw new MapsClientError(code);
  }
  return data as unknown;
}
const placesResponse = z.object({
  places: z
    .array(
      z.object({
        label: z.string().min(1).max(300),
        latitude: z.number().finite().min(-90).max(90),
        longitude: z.number().finite().min(-180).max(180),
      }),
    )
    .max(5),
});
export const geocoding = {
  async search(text: string, signal?: AbortSignal): Promise<Place[]> {
    const parsed = placesResponse.safeParse(
      await callMapFunction("search-places", { text }, signal),
    );
    if (!parsed.success)
      throw new MapsClientError("INVALID_GEOCODING_RESPONSE");
    return parsed.data.places;
  },
};
export function externalNavigation(latitude: number, longitude: number) {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return null;
  const google = new URL("https://www.google.com/maps/dir/");
  google.search = new URLSearchParams({
    api: "1",
    destination: `${latitude},${longitude}`,
    travelmode: "driving",
  }).toString();
  const waze = new URL("https://waze.com/ul");
  waze.search = new URLSearchParams({
    ll: `${latitude},${longitude}`,
    navigate: "yes",
  }).toString();
  return { google: google.toString(), waze: waze.toString() };
}
