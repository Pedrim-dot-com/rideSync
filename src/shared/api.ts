import { client } from "./supabase";
import type { MotorcycleInput } from "./validation";
export type Motorcycle = MotorcycleInput & {
  id: string;
  user_id: string;
  is_primary: boolean;
};
export type Profile = {
  id: string;
  display_name: string;
  username: string | null;
};
export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await client()
    .from("profiles")
    .select("id,display_name,username")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}
export async function saveProfile(
  userId: string,
  values: { display_name: string; username: string },
) {
  const { data, error } = await client()
    .from("profiles")
    .update(values)
    .eq("id", userId)
    .select("id")
    .single();
  if (error) throw error;
  return data;
}
export async function getMotorcycles(userId: string): Promise<Motorcycle[]> {
  const { data, error } = await client()
    .from("motorcycles")
    .select(
      "id,user_id,brand,model,manufacture_year,engine_cc,color,is_primary",
    )
    .eq("user_id", userId)
    .order("created_at");
  if (error) throw error;
  return data;
}
export async function saveMotorcycle(
  userId: string,
  values: MotorcycleInput,
  id?: string,
) {
  const query = id
    ? client()
        .from("motorcycles")
        .update(values)
        .eq("id", id)
        .eq("user_id", userId)
    : client()
        .from("motorcycles")
        .insert({ ...values, user_id: userId });
  const { error } = await query.select("id").single();
  if (error) throw error;
}
export async function removeMotorcycle(userId: string, id: string) {
  const { error } = await client()
    .from("motorcycles")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .single();
  if (error) throw error;
}
export async function setPrimary(id: string) {
  const { error } = await client().rpc("set_primary_motorcycle", {
    motorcycle_id: id,
  });
  if (error) throw error;
}
