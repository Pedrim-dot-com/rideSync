import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { groupError } from "./api";
import {
  getSentGroupInvites,
  groupInviteLabels,
  inviteGroupMember,
  revokeGroupInvite,
  reviewGroupInvite,
} from "./invitations-api";
export function GroupInvitationManager({
  groupId,
  userId,
  leader,
}: {
  groupId: string;
  userId: string;
  leader: boolean;
}) {
  const cache = useQueryClient();
  const [username, setUsername] = useState("");
  const query = useQuery({
    queryKey: ["sent-group-invites", userId, groupId, leader],
    queryFn: () => getSentGroupInvites(groupId),
    refetchInterval: 30000,
  });
  const mutation = useMutation({
    mutationFn: async (
      action:
        | { kind: "send"; username: string }
        | { kind: "revoke"; id: string }
        | { kind: "approve" | "reject"; id: string },
    ) => {
      if (action.kind === "send")
        await inviteGroupMember(groupId, action.username);
      else if (action.kind === "revoke")
        await revokeGroupInvite(groupId, action.id);
      else
        await reviewGroupInvite(groupId, action.id, action.kind === "approve");
      return action.kind;
    },
    onSuccess: (kind) => {
      if (kind === "send") setUsername("");
      void cache.invalidateQueries({ queryKey: ["sent-group-invites"] });
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate({ kind: "send", username });
  }
  return (
    <section className="group-invitation-manager">
      <h2>Convidar pessoas</h2>
      <p>
        Os dirigentes convidam diretamente. Os membros propõem convites, que só
        chegam à pessoa depois da aprovação de um dirigente. Ao aceitar um
        convite aprovado, a pessoa entra no grupo.
      </p>
      <form onSubmit={submit}>
        <label>
          Nickname da pessoa
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            minLength={3}
            maxLength={31}
            pattern="@?[a-zA-Z0-9_]{3,30}"
            placeholder="nickname"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
          />
          <small>
            Usa o nickname exato do Perfil. A pessoa deve estar sem grupo nem
            candidatura pendente. Convites válidos por sete dias.
          </small>
        </label>
        <button disabled={mutation.isPending}>
          {mutation.isPending
            ? "A enviar…"
            : leader
              ? "Enviar convite de grupo"
              : "Propor convite de grupo"}
        </button>
      </form>
      {mutation.isSuccess && (
        <p role="status">
          {mutation.data === "send"
            ? "Pedido de convite registado. Consulta o estado abaixo."
            : mutation.data === "approve"
              ? "Convite aprovado e enviado à pessoa para aceitação."
              : mutation.data === "reject"
                ? "Proposta de convite recusada."
                : "Convite revogado."}
        </p>
      )}
      {mutation.isError && (
        <p className="error" role="alert">
          {groupError(mutation.error)}
        </p>
      )}
      <h3>{leader ? "Convites do grupo" : "Os teus convites enviados"}</h3>
      {query.isPending && <p role="status">A carregar convites…</p>}
      {query.isError && (
        <div role="alert">
          <p className="error">Não foi possível consultar os convites.</p>
          <button className="secondary" onClick={() => void query.refetch()}>
            Tentar novamente
          </button>
        </div>
      )}
      {query.data?.length === 0 && (
        <p className="empty">Ainda não há convites enviados nesta lista.</p>
      )}
      <ul className="group-invite-list">
        {query.data?.map((invite) => (
          <li key={invite.invitation_id}>
            <strong>
              {invite.display_name || invite.username || "Motard"}
            </strong>
            {invite.username && <p>@{invite.username}</p>}
            <p>
              {groupInviteLabels[invite.status]} · Até{" "}
              <time dateTime={invite.expires_at}>
                {new Date(invite.expires_at).toLocaleString("pt-PT")}
              </time>
            </p>
            {leader && invite.status === "review" && (
              <div className="actions">
                <button
                  disabled={mutation.isPending}
                  onClick={() =>
                    mutation.mutate({
                      kind: "approve",
                      id: invite.invitation_id,
                    })
                  }
                  aria-label={`Aprovar convite para ${invite.username || invite.display_name}`}
                >
                  Aprovar convite
                </button>
                <button
                  className="secondary"
                  disabled={mutation.isPending}
                  onClick={() =>
                    mutation.mutate({
                      kind: "reject",
                      id: invite.invitation_id,
                    })
                  }
                >
                  Recusar proposta
                </button>
              </div>
            )}
            {(invite.status === "pending" || invite.status === "review") && (
              <button
                className="secondary"
                disabled={mutation.isPending}
                onClick={() =>
                  mutation.mutate({ kind: "revoke", id: invite.invitation_id })
                }
                aria-label={`Revogar convite para ${invite.username || invite.display_name}`}
              >
                Revogar convite
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
