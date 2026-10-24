import { ReceivedGroupInvitations } from "../groups/ReceivedGroupInvitations";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { participationError } from "./participation-api";
import {
  respondReceivedInvitation,
  useNotifications,
  type ReceivedInvitation,
} from "./notifications-api";
const labels = {
  pending: "Por responder",
  accepted: "Aceite",
  declined: "Recusado",
  used: "Já utilizado",
  revoked: "Revogado",
  expired: "Expirado",
  unavailable: "Viagem indisponível",
  joined: "Já participas nesta viagem",
};
const date = (value: string) =>
  new Date(value).toLocaleString("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  });
function InvitationNotification({
  invitation,
  userId,
  onAccepted,
}: {
  invitation: ReceivedInvitation;
  userId: string;
  onAccepted: (id: string) => void;
}) {
  const cache = useQueryClient();
  const response = useMutation({
    mutationFn: (accept: boolean) =>
      respondReceivedInvitation(invitation.receipt_id, accept),
    onSuccess: (tripId) => {
      void cache.invalidateQueries({ queryKey: ["notifications", userId] });
      void cache.invalidateQueries({ queryKey: ["trips", userId] });
      if (tripId) onAccepted(tripId);
    },
    onError: () => {
      void cache.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });
  // Server status is authoritative, including expiry, on each refresh/response.
  const pending = invitation.status === "pending";
  const status = invitation.status;
  return (
    <li className="notification-card">
      <span className="eyebrow">CONVITE · {labels[status]}</span>
      <h2>{invitation.title}</h2>
      <p>{invitation.inviter_name} convidou-te para uma viagem.</p>
      <p>
        Partida:{" "}
        <time dateTime={invitation.departure_at}>
          {date(invitation.departure_at)}
        </time>
      </p>
      {pending ? (
        <>
          <p>
            Responde até{" "}
            <time dateTime={invitation.expires_at}>
              {date(invitation.expires_at)}
            </time>
            . Podes voltar aqui mais tarde.
          </p>
          <p className="muted">
            Ao aceitar, o grupo poderá ver o teu nome, nickname e a mota
            escolhida para esta viagem.
          </p>
          <div className="actions">
            <button
              disabled={response.isPending}
              onClick={() => response.mutate(true)}
            >
              Aceitar convite
            </button>
            <button
              className="secondary"
              disabled={response.isPending}
              onClick={() => response.mutate(false)}
            >
              Recusar convite
            </button>
          </div>
        </>
      ) : (
        <p role="status">
          {response.isSuccess && !response.data
            ? "Convite recusado"
            : labels[status]}
          .
        </p>
      )}
      {invitation.trip_id && (
        <button
          className="secondary"
          onClick={() => onAccepted(invitation.trip_id!)}
        >
          Ver viagem
        </button>
      )}
      {response.isPending && <p role="status">A responder ao convite…</p>}
      {response.isError && (
        <p role="alert" className="error">
          {participationError(response.error)}
        </p>
      )}
    </li>
  );
}
export function Notifications({
  userId,
  onAccepted,
  onOpenGroup,
}: {
  userId: string;
  onAccepted: (id: string) => void;
  onOpenGroup?: (id: string) => void;
}) {
  const query = useNotifications(userId);
  return (
    <section className="panel notifications-panel">
      <span className="eyebrow">
        <Bell size={16} aria-hidden="true" /> O TEU GRUPO
      </span>
      <h1>Notificações</h1>
      <p>
        Convites para viagens e grupos. Podes responder mais tarde, enquanto
        estiverem válidos. Os convites de viagem ficam guardados ao abrir o link
        com sessão iniciada.
      </p>
      <h2>Convites de viagens</h2>
      {query.isPending && <p role="status">A carregar notificações…</p>}
      {query.isError && (
        <div role="alert">
          <p className="error">
            Não foi possível atualizar as notificações. Verifica a ligação e
            tenta novamente.
          </p>
          <button className="secondary" onClick={() => void query.refetch()}>
            Tentar novamente
          </button>
        </div>
      )}
      {query.data?.length === 0 && (
        <p className="empty">
          Ainda não tens convites de viagem guardados. Abre um link de viagem
          para o guardar aqui.
        </p>
      )}
      <ul className="notification-list">
        {query.data?.map((invitation) => (
          <InvitationNotification
            key={invitation.receipt_id}
            invitation={invitation}
            userId={userId}
            onAccepted={onAccepted}
          />
        ))}
      </ul>
      <ReceivedGroupInvitations userId={userId} onOpenGroup={onOpenGroup} />
    </section>
  );
}
