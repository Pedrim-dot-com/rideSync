import { z } from "zod";
export const positionSchema = z.object({
  user_id: z.string(),
  display_name: z.string(),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracy_m: z.number().finite().nonnegative(),
  heading: z.number().min(0).lt(360).nullable(),
  recorded_at: z.iso.datetime({ offset: true }),
});
export const trackingSchema = z.object({
  server_now: z.iso.datetime({ offset: true }),
  status: z.string(),
  revision: z.number().int().positive(),
  session: z
    .object({
      id: z.string(),
      started_at: z.iso.datetime({ offset: true }),
      ended_at: z.iso.datetime({ offset: true }).nullable(),
    })
    .nullable(),
  positions: z.array(positionSchema),
});
export type RiderPosition = z.infer<typeof positionSchema>;
export type TrackingSnapshot = z.infer<typeof trackingSchema>;
// The generator omits nullable SQL RPC arguments; preserve the generated schema.
type PublishFunction =
  import("../../shared/database.generated").Database["public"]["Functions"]["publish_rider_location"];
export type TrackingFunctions = {
  publish_rider_location: Omit<PublishFunction, "Args"> & {
    Args: Omit<PublishFunction["Args"], "p_heading"> & {
      p_heading: number | null;
    };
  };
};
export function trackingError(error: unknown) {
  const e = error as { code?: string; message?: string };
  if (e?.message === "ROUTE_REQUIRED")
    return "Calcula o percurso antes de iniciar a viagem.";
  if (e?.code === "PGRST202" || e?.code === "42883")
    return "O acompanhamento de viagens ainda não está disponível. Tenta mais tarde.";
  if (e?.code === "42501")
    return "Não tens autorização para acompanhar ou alterar esta viagem.";
  if (e?.code === "40001")
    return "A viagem foi alterada. Atualiza os dados e tenta novamente.";
  if (e?.code === "55000")
    return "Esta operação não está disponível no estado atual da viagem.";
  if (e?.message === "SHARING_STOPPED")
    return "A partilha expirou. Para retomar, volta a ativar o GPS.";
  return "Não foi possível atualizar a viagem. Verifica a ligação e tenta novamente.";
}
export function elapsedLabel(start: string, end: string) {
  const seconds = Math.max(
    0,
    Math.floor((Date.parse(end) - Date.parse(start)) / 1000),
  );
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((v) => String(v).padStart(2, "0"))
    .join(":");
}
export function positionAge(position: RiderPosition, now: number) {
  return Math.max(
    0,
    Math.floor((now - Date.parse(position.recorded_at)) / 1000),
  );
}
