import { useQuery } from "@tanstack/react-query";
import { client } from "../../shared/supabase";
export type GroupInviteStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "revoked"
  | "expired"
  | "joined"
  | "unavailable"
  | "review"
  | "rejected"
  | "left";
export type ReceivedGroupInvite = {
  invitation_id: string;
  group_id: string;
  group_name: string;
  inviter_name: string;
  created_at: string;
  expires_at: string;
  status: GroupInviteStatus;
};
export type SentGroupInvite = {
  invitation_id: string;
  display_name: string;
  username: string | null;
  created_at: string;
  expires_at: string;
  status: GroupInviteStatus;
};
// Migration 010 contracts; refresh the generated snapshot after remote approval.
export type GroupInvitationFunctions = {
  invite_group_member: {
    Args: { p_group_id: string; p_username: string };
    Returns: string;
  };
  review_group_invitation: {
    Args: { p_group_id: string; p_invitation_id: string; p_approve: boolean };
    Returns: undefined;
  };
  list_sent_group_invitations: {
    Args: { p_group_id: string };
    Returns: SentGroupInvite[];
  };
  revoke_group_invitation: {
    Args: { p_group_id: string; p_invitation_id: string };
    Returns: undefined;
  };
  list_received_group_invitations: {
    Args: Record<string, never>;
    Returns: ReceivedGroupInvite[];
  };
  respond_group_invitation: {
    Args: { p_invitation_id: string; p_accept: boolean };
    Returns: string | null;
  };
};
export async function inviteGroupMember(groupId: string, username: string) {
  const { data, error } = await client().rpc("invite_group_member", {
    p_group_id: groupId,
    p_username: username.trim().replace(/^@/, ""),
  });
  if (error) throw error;
  return data;
}
export async function reviewGroupInvite(
  groupId: string,
  id: string,
  approve: boolean,
) {
  const { error } = await client().rpc("review_group_invitation", {
    p_group_id: groupId,
    p_invitation_id: id,
    p_approve: approve,
  });
  if (error) throw error;
}
export async function getSentGroupInvites(groupId: string) {
  const { data, error } = await client().rpc("list_sent_group_invitations", {
    p_group_id: groupId,
  });
  if (error) throw error;
  return data;
}
export async function revokeGroupInvite(groupId: string, id: string) {
  const { error } = await client().rpc("revoke_group_invitation", {
    p_group_id: groupId,
    p_invitation_id: id,
  });
  if (error) throw error;
}
export async function respondGroupInvite(id: string, accept: boolean) {
  const { data, error } = await client().rpc("respond_group_invitation", {
    p_invitation_id: id,
    p_accept: accept,
  });
  if (error) throw error;
  return data;
}
export function useGroupInvites(userId?: string) {
  return useQuery({
    queryKey: ["group-invites", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await client().rpc(
        "list_received_group_invitations",
        {},
      );
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });
}
export const groupInviteLabels: Record<GroupInviteStatus, string> = {
  pending: "Por responder",
  accepted: "Convite aceite",
  declined: "Recusado",
  revoked: "Revogado",
  expired: "Expirado",
  joined: "Já pertence ao grupo",
  unavailable: "Indisponível para entrada",
  review: "Aguarda revisão da direção",
  rejected: "Proposta de convite recusada pela direção",
  left: "Inscrição terminada",
};
