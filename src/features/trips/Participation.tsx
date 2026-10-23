import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMotorcycles } from "../../shared/api";
import type { TripDetail } from "./api";
import { invitationLink } from "./invitation-link";
import {
  createTripInvitation,
  getTripInvitations,
  getTripMembers,
  participationError,
  revokeTripInvitation,
  setTripMotorcycle,
} from "./participation-api";
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
export function Participation({
  detail,
  userId,
}: {
  detail: TripDetail;
  userId: string;
}) {
  const trip = detail.trip;
  const cache = useQueryClient();
  const owner = trip.created_by === userId;
  const editable = trip.status === "draft" || trip.status === "planned";
  const own = detail.participants.find(
    (p) => p.user_id === userId && p.status === "accepted",
  );
  const members = useQuery({
    queryKey: ["trip-members", userId, trip.id],
    queryFn: () => getTripMembers(trip.id),
  });
  const bikes = useQuery({
    queryKey: ["motorcycles", userId],
    queryFn: () => getMotorcycles(userId),
    enabled: Boolean(own) && editable,
  });
  const selection = useMutation({
    mutationFn: (bikeId: string | null) => setTripMotorcycle(trip.id, bikeId),
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["trip", userId, trip.id] }),
        cache.invalidateQueries({
          queryKey: ["trip-members", userId, trip.id],
        }),
      ]);
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    selection.mutate(
      String(new FormData(event.currentTarget).get("motorcycle")) || null,
    );
  }
  return (
    <section
      className="panel participation"
      aria-labelledby="participants-title"
    >
      <h2 id="participants-title">Participantes</h2>
      <p>
        Os nomes e a mota escolhida são visíveis apenas aos participantes
        confirmados.
      </p>
      {members.isPending && <p role="status">A carregar participantes…</p>}
      {members.isError && (
        <div role="alert">
          <p>{participationError(members.error)}</p>
          <button className="secondary" onClick={() => void members.refetch()}>
            Atualizar participantes
          </button>
        </div>
      )}
      {members.data?.length === 0 && (
        <p>Ainda não há participantes confirmados.</p>
      )}
      <ul className="participant-list">
        {members.data?.map((member) => (
          <li key={member.user_id}>
            <div>
              <strong>
                {member.display_name || member.username || "Motard"}
                {member.user_id === userId ? " (tu)" : ""}
              </strong>
              <p>
                {member.role === "organizer" ? "Organizador" : "Participante"}
                {member.username ? ` · @${member.username}` : ""}
              </p>
            </div>
            <span>
              {member.motorcycle_brand && member.motorcycle_model
                ? `${member.motorcycle_brand} ${member.motorcycle_model}`
                : "Sem mota escolhida"}
            </span>
          </li>
        ))}
      </ul>
      {own && editable && (
        <form onSubmit={submit} key={own.motorcycle_id ?? "none"}>
          <label>
            A tua mota nesta viagem
            <select
              name="motorcycle"
              defaultValue={own.motorcycle_id ?? ""}
              disabled={bikes.isPending || bikes.isError || selection.isPending}
            >
              <option value="">Sem mota escolhida</option>
              {bikes.data?.map((bike) => (
                <option key={bike.id} value={bike.id}>
                  {bike.brand} {bike.model}
                  {bike.is_primary ? " · Principal" : ""}
                </option>
              ))}
            </select>
          </label>
          {bikes.isPending && <p role="status">A carregar as tuas motas…</p>}
          {bikes.isError && (
            <div role="alert">
              <p>Não foi possível carregar a garagem.</p>
              <button
                type="button"
                className="secondary"
                onClick={() => void bikes.refetch()}
              >
                Atualizar garagem
              </button>
            </div>
          )}
          {bikes.data?.length === 0 && (
            <p>
              Adiciona uma mota na Garagem para a escolher aqui. Também podes
              participar sem mota.
            </p>
          )}
          <button
            disabled={bikes.isPending || bikes.isError || selection.isPending}
          >
            {selection.isPending ? "A guardar…" : "Guardar mota da viagem"}
          </button>
          {selection.isError && (
            <p role="alert" className="error">
              {participationError(selection.error)}
            </p>
          )}
          {selection.isSuccess && (
            <p role="status" className="success">
              Mota da viagem atualizada.
            </p>
          )}
        </form>
      )}
      {!editable && (
        <p className="note">
          A escolha de mota está bloqueada neste estado da viagem.
        </p>
      )}
      {owner && (
        <TripInvitations
          key={trip.id}
          tripId={trip.id}
          userId={userId}
          editable={editable}
        />
      )}
    </section>
  );
}
function TripInvitations({
  tripId,
  userId,
  editable,
}: {
  tripId: string;
  userId: string;
  editable: boolean;
}) {
  const cache = useQueryClient();
  const key = ["trip-invitations", userId, tripId];
  const [link, setLink] = useState<{
    id: string;
    href: string;
    expiresAt: string;
  } | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const invitations = useQuery({
    queryKey: key,
    queryFn: () => getTripInvitations(tripId),
  });
  const mutation = useMutation({
    mutationFn: async (
      action: { kind: "create" } | { kind: "revoke"; id: string },
    ) => {
      setCopyMessage("");
      if (action.kind === "create") {
        const result = await createTripInvitation(tripId);
        setLink({
          id: result.invitation_id,
          href: invitationLink(result.token),
          expiresAt: result.expires_at,
        });
      } else {
        await revokeTripInvitation(tripId, action.id);
        if (action.id === link?.id) setLink(null);
      }
    },
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: key });
    },
  });
  async function copy() {
    try {
      await navigator.clipboard.writeText(link!.href);
      setCopyMessage("Link copiado.");
    } catch {
      setCopyMessage("Seleciona e copia o link no campo acima.");
    }
  }
  return (
    <div className="trip-invitations">
      <h3>Convidar motards</h3>
      <p>
        Cada link permite uma resposta, expira em 48 horas e pode ser usado por
        quem o receber. Partilha-o apenas com a pessoa que queres convidar.
      </p>
      {editable && (
        <button
          disabled={mutation.isPending || invitations.isError}
          onClick={() => mutation.mutate({ kind: "create" })}
        >
          Criar link de convite
        </button>
      )}
      {link && (
        <div className="invitation-link">
          <label>
            Link do convite
            <input
              readOnly
              value={link.href}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <p>
            Válido até {formatDate(link.expiresAt)}. Copia o link agora: não
            será possível recuperá-lo ao sair desta página.
          </p>
          <button className="secondary" onClick={() => void copy()}>
            Copiar link
          </button>
          {copyMessage && <p role="status">{copyMessage}</p>}
        </div>
      )}
      {mutation.isPending && <p role="status">A atualizar convite…</p>}
      {mutation.isError && (
        <p role="alert" className="error">
          {participationError(mutation.error)}
        </p>
      )}
      {invitations.isPending && <p role="status">A carregar convites…</p>}
      {invitations.isError && (
        <div role="alert">
          <p>{participationError(invitations.error)}</p>
          <button
            className="secondary"
            onClick={() => void invitations.refetch()}
          >
            Atualizar convites
          </button>
        </div>
      )}
      {invitations.data?.length === 0 && <p>Ainda não criaste convites.</p>}
      <ul className="invitation-list">
        {invitations.data?.map((invite, index) => {
          const status =
            invite.response === "accepted"
              ? "Aceite"
              : invite.response === "declined"
                ? "Recusado"
                : invite.revoked_at
                  ? "Revogado"
                  : new Date(invite.expires_at).getTime() <= now
                    ? "Expirado"
                    : "Disponível";
          return (
            <li key={invite.invitation_id}>
              <span>
                Convite de {formatDate(invite.created_at)} · {status}
              </span>
              {!invite.used_at && !invite.revoked_at && (
                <button
                  className="text-button"
                  aria-label={`Revogar convite ${index + 1}`}
                  disabled={mutation.isPending}
                  onClick={() =>
                    mutation.mutate({
                      kind: "revoke",
                      id: invite.invitation_id,
                    })
                  }
                >
                  Revogar
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
