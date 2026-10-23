import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
const url = import.meta.env.VITE_SUPABASE_URL;
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase =
  url && key && URL.canParse(url) ? createClient<Database>(url, key) : null;
export function client() {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
}
export function errorMessage(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error ? error.code : "";
  if (code === "23505")
    return "Esse nickname já está em uso, ou já existe uma mota principal. Atualiza e tenta novamente.";
  if (code === "40001")
    return "Esta viagem foi alterada entretanto. Atualiza os dados antes de voltar a guardar.";
  if (code === "55000")
    return "Esta operação não está disponível no estado atual da viagem.";
  if (code === "22023" || code === "23514" || code === "23502")
    return "Revê os campos e as coordenadas do itinerário.";
  if (code === "42501") return "Não tens autorização para esta operação.";
  return "Não foi possível concluir. Verifica a ligação e tenta novamente.";
}
