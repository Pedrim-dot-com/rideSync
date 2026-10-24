import { useMutation, useQueryClient } from "@tanstack/react-query";
import { groupError } from "./api";
import {
  groupInviteLabels,
  respondGroupInvite,
  useGroupInvites,
  type ReceivedGroupInvite,
} from "./invitations-api";
function GroupInviteCard({
  invite,
  userId,
  onOpenGroup,
}: {
  invite: ReceivedGroupInvite;
  userId: string;
  onOpenGroup?: (id: string) => void;
}) {
  const cache = useQueryClient();
  const mutation = useMutation({
    mutationFn: (accept: boolean) =>
      respondGroupInvite(invite.invitation_id, accept),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["group-invites", userId] });
      void cache.invalidateQueries({ queryKey: ["group-memberships", userId] });
      void cache.invalidateQueries({ queryKey: ["group-members"] });
    },
    onError: () => {
      void cache.invalidateQueries({ queryKey: ["group-invites", userId] });
    },
  });
  return (
    <li className="notification-card">
      <span className="eyebrow">
        CONVITE DE GRUPO · {groupInviteLabels[invite.status]}
      </span>
      <h3>{invite.group_name}</h3>
      <p>{invite.inviter_name} convidou-te para este grupo.</p>
      {invite.status === "pending" ? (
        <>
          <p>
            Este convite já foi aprovado pela direção. Ao aceitar, passas a
            membro deste grupo.
          </p>
          <p>
            Responde até{" "}
            <time dateTime={invite.expires_at}>
              {new Date(invite.expires_at).toLocaleString("pt-PT")}
            </time>
            .
          </p>
          <div className="actions">
            <button
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(true)}
            >
              Aceitar convite de grupo
            </button>
            <button
              className="secondary"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(false)}
            >
              Recusar convite de grupo
            </button>
          </div>
        </>
      ) : (
        <p>
          {invite.status === "accepted"
            ? "Convite aceite. Consulta a tua inscrição em O meu grupo."
            : groupInviteLabels[invite.status]}
        </p>
      )}
      {onOpenGroup && (
        <button
          className="text-button"
          onClick={() => onOpenGroup(invite.group_id)}
        >
          Ver grupo {invite.group_name}
        </button>
      )}
      {mutation.isPending && <p role="status">A responder ao convite…</p>}
      {mutation.isSuccess && (
        <p role="status">
          {mutation.variables
            ? "Convite aceite. Já pertences ao grupo."
            : "Convite recusado."}
        </p>
      )}
      {mutation.isError && (
        <p className="error" role="alert">
          {groupError(mutation.error)}
        </p>
      )}
    </li>
  );
}
export function ReceivedGroupInvitations({
  userId,
  onOpenGroup,
}: {
  userId: string;
  onOpenGroup?: (id: string) => void;
}) {
  const query = useGroupInvites(userId);
  return (
    <section
      className="received-group-invitations"
      aria-label="Convites de grupos recebidos"
    >
      <h2>Convites de grupos</h2>
      <p>Podes aceitar ou recusar mais tarde, até à data de expiração.</p>
      {query.isPending && <p role="status">A carregar convites de grupos…</p>}
      {query.isError && (
        <div role="alert">
          <p className="error">
            Não foi possível atualizar os convites de grupos.
          </p>
          <button className="secondary" onClick={() => void query.refetch()}>
            Tentar novamente
          </button>
        </div>
      )}
      {query.data?.length === 0 && (
        <p className="empty">Não tens convites de grupos recebidos.</p>
      )}
      <ul className="notification-list">
        {query.data?.map((invite) => (
          <GroupInviteCard
            key={invite.invitation_id}
            invite={invite}
            userId={userId}
            onOpenGroup={onOpenGroup}
          />
        ))}
      </ul>
    </section>
  );
}
