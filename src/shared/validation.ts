import { z } from "zod";
const optionalInteger = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().int().min(min).max(max).nullable(),
  );
export const motorcycleSchema = z.object({
  brand: z.string().trim().min(1, "Indica a marca.").max(80),
  model: z.string().trim().min(1, "Indica o modelo.").max(120),
  manufacture_year: optionalInteger(1885, 2100),
  engine_cc: optionalInteger(1, 10000),
  color: z
    .string()
    .trim()
    .max(60)
    .transform((v) => v || null),
});
export const profileSchema = z.object({
  display_name: z.string().trim().min(1, "Indica o teu nome.").max(80),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9_]{3,30}$/,
      "O nickname deve ter 3–30 letras, números ou underscores.",
    ),
});
export type MotorcycleInput = z.output<typeof motorcycleSchema>;
