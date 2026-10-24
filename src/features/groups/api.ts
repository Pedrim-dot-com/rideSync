import { z } from "zod";
import { client } from "../../shared/supabase";
export const groupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Indica um nome com pelo menos 3 caracteres.")
    .max(100),
  description: z.string().trim().max(1000),
  legal_name: z.string().trim().max(160),
  registration_number: z.string().trim().max(80),
  headquarters_address: z
    .string()
    .trim()
    .min(3, "Indica a morada pública da sede.")
    .max(240),
  latitude: z.preprocess(
    (value) => (value === "" || value === null ? NaN : value),
    z.coerce.number().finite().min(-90).max(90),
  ),
  longitude: z.preprocess(
    (value) => (value === "" || value === null ? NaN : value),
    z.coerce.number().finite().min(-180).max(180),
  ),
});
export type GroupInput = z.infer<typeof groupSchema>;
export type MotardGroup = GroupInput & {
  id: string;
  revision: number;
  created_at: string;
  updated_at: string;
};
export type GroupMembership = {
  group_id: string;
  user_id: string;
  role: "member" | "leader";
  status: "pending" | "accepted" | "declined" | "left";
  updated_at: string;
};
export type GroupMember = {
  user_id: string;
  display_name: string;
  username: string | null;
  role: "member" | "leader";
  status: "pending" | "accepted";
};
export type GroupAction =
  | "request"
  | "withdraw"
  | "leave"
  | "approve"
  | "reject"
  | "promote"
  | "demote"
  | "remove";
export type GroupFunctions = {
  save_motard_group: {
    Args: {
      p_group_id: string | null;
      p_revision: number | null;
      p_name: string;
      p_description: string;
      p_legal_name: string;
      p_registration_number: string;
      p_address: string;
      p_latitude: number;
      p_longitude: number;
    };
    Returns: string;
  };
  change_group_membership: {
    Args: {
      p_group_id: string;
      p_action: GroupAction;
      p_user_id?: string | null;
    };
    Returns: undefined;
  };
  list_group_members: { Args: { p_group_id: string }; Returns: GroupMember[] };
};
export type GroupTables = {
  motard_groups: {
    Row: MotardGroup;
    Insert: never;
    Update: never;
    Relationships: [];
  };
  group_memberships: {
    Row: GroupMembership;
    Insert: never;
    Update: never;
    Relationships: [];
  };
};
export async function getGroups() {
  const groups: MotardGroup[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client()
      .from("motard_groups")
      .select(
        "id,name,description,legal_name,registration_number,headquarters_address,latitude,longitude,created_at,updated_at,revision",
      )
      .order("name")
      .order("id")
      .range(offset, offset + 499);
    if (error) throw error;
    groups.push(...data);
    if (data.length < 500) return groups;
  }
}
export async function getOwnMemberships(userId: string) {
  const { data, error } = await client()
    .from("group_memberships")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return data;
}
export async function getGroupMembers(id: string) {
  const { data, error } = await client().rpc("list_group_members", {
    p_group_id: id,
  });
  if (error) throw error;
  return data;
}
export async function saveGroup(values: GroupInput, existing?: MotardGroup) {
  const { data, error } = await client().rpc("save_motard_group", {
    p_group_id: existing?.id ?? null,
    p_revision: existing?.revision ?? null,
    p_name: values.name,
    p_description: values.description,
    p_legal_name: values.legal_name,
    p_registration_number: values.registration_number,
    p_address: values.headquarters_address,
    p_latitude: values.latitude,
    p_longitude: values.longitude,
  });
  if (error) throw error;
  return data;
}
export async function changeMembership(
  groupId: string,
  action: GroupAction,
  userId?: string,
) {
  const { error } = await client().rpc("change_group_membership", {
    p_group_id: groupId,
    p_action: action,
    p_user_id: userId ?? null,
  });
  if (error) throw error;
}
export function groupError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? error.message
      : "";
  if (message === "GROUP_LAST_LEADER")
    return "O grupo precisa de pelo menos um dirigente. Promove outro membro antes de sair ou retirar esse cargo.";
  if (message === "GROUP_MEMBERSHIP_EXISTS")
    return "Só podes pertencer a um grupo e ter um pedido pendente. Sai do grupo atual ou retira o pedido antes de continuar.";
  if (message === "GROUP_REQUEST_UNAVAILABLE")
    return "Este pedido já foi respondido. Atualiza os membros.";
  if (message === "GROUP_RATE_LIMITED")
    return "Atingiste o limite de criação de grupos de hoje.";
  const code =
    error && typeof error === "object" && "code" in error ? error.code : "";
  if (code === "40001")
    return "Outro dirigente alterou o grupo. Volta a abrir a edição para atualizar os dados.";
  return "Não foi possível concluir. Verifica a ligação, atualiza os dados e tenta novamente.";
}
