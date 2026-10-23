import { z } from "zod";
const coordinate = (min: number, max: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() !== "" ? Number(value) : value,
    z
      .number({ error: "Indica coordenadas numéricas válidas." })
      .finite()
      .min(min)
      .max(max),
  );
export const waypointSchema = z.object({
  label: z.string().trim().min(1, "Dá um nome a cada ponto.").max(120),
  latitude: coordinate(-90, 90),
  longitude: coordinate(-180, 180),
});
export const tripSchema = z.object({
  title: z.string().trim().min(1, "Indica o título da viagem.").max(120),
  departure_at: z.iso.datetime({
    offset: true,
    error: "Indica uma data e hora de partida válidas.",
  }),
  waypoints: z
    .array(waypointSchema)
    .min(2, "Define a origem e o destino.")
    .max(12, "Podes adicionar até 10 paragens."),
});
export type TripInput = z.output<typeof tripSchema>;
export function toLocalDatetime(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
export function fromLocalDatetime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return "";
  const d = new Date(value);
  if (
    !Number.isFinite(d.getTime()) ||
    toLocalDatetime(d.toISOString()) !== value
  )
    return "";
  return d.toISOString();
}
