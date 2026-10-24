import { Participation } from "./Participation";
import { TripJourney } from "./TripJourney";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  MapPin,
  Plus,
  Route,
} from "lucide-react";
import {
  changeTripStatus,
  deleteTrip,
  getTrip,
  getTrips,
  saveTrip,
  type TripDetail,
} from "./api";
import { TripEditor } from "./TripEditor";
import type { TripInput } from "./validation";
import type { TripRow, TripStatus } from "../../shared/database.types";
import { errorMessage } from "../../shared/supabase";
const statusLabels: Record<TripStatus, string> = {
  draft: "Rascunho",
  planned: "Planeada",
  active: "Em curso",
  completed: "Concluída",
  cancelled: "Cancelada",
};
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
type Action =
  | {
      kind: "save";
      values: TripInput;
      existing?: { id: string; revision: number };
    }
  | { kind: "status"; trip: TripRow; status: "draft" | "planned" | "cancelled" }
  | { kind: "delete"; trip: TripRow };
export function Trips({
  userId,
  initialTripId,
}: {
  userId: string;
  initialTripId?: string;
}) {
  const cache = useQueryClient();
  const [selected, setSelected] = useState<string | null>(
    initialTripId ?? null,
  );
  const [editor, setEditor] = useState<"new" | TripDetail | null>(null);
  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);
  const [message, setMessage] = useState("");
  const list = useQuery({ queryKey: ["trips", userId], queryFn: getTrips });
  const detail = useQuery({
    queryKey: ["trip", userId, selected],
    queryFn: () => getTrip(selected!),
    enabled: Boolean(selected),
  });
  const mutation = useMutation({
    mutationFn: async (action: Action) => {
      if (action.kind === "save")
        return {
          id: await saveTrip(action.values, action.existing),
          message: "Viagem guardada.",
        };
      if (action.kind === "status") {
        await changeTripStatus(
          action.trip.id,
          action.status,
          action.trip.revision,
        );
        return { id: action.trip.id, message: "Estado da viagem atualizado." };
      }
      await deleteTrip(action.trip.id, action.trip.revision);
      return { id: null, message: "Viagem removida." };
    },
    onSuccess: async (result) => {
      setSelected(result.id);
      setEditor(null);
      setConfirm(null);
      setMessage(result.message);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["trips", userId] }),
        result.id
          ? cache.invalidateQueries({ queryKey: ["trip", userId, result.id] })
          : Promise.resolve(),
      ]);
    },
  });
  function reset() {
    mutation.reset();
    setMessage("");
    setConfirm(null);
  }
  if (editor)
    return (
      <TripEditor
        key={
          editor === "new" ? "new" : `${editor.trip.id}-${editor.trip.revision}`
        }
        detail={editor === "new" ? undefined : editor}
        busy={mutation.isPending}
        error={mutation.error}
        onCancel={() => {
          setEditor(null);
          reset();
        }}
        onSave={(values) =>
          mutation.mutate({
            kind: "save",
            values,
            existing:
              editor === "new"
                ? undefined
                : { id: editor.trip.id, revision: editor.trip.revision },
          })
        }
      />
    );
  const data = detail.data;
  const trip = data?.trip;
  const confirmedCount =
    data?.participants.filter((p) => p.status === "accepted").length ?? 0;
  const isOwner = trip?.created_by === userId;
  const canEdit =
    isOwner && (trip?.status === "draft" || trip?.status === "planned");
  return (
    <>
      {selected ? (
        <>
          <button
            className="text-button"
            disabled={mutation.isPending}
            onClick={() => {
              setSelected(null);
              reset();
            }}
          >
            <ArrowLeft size={17} />
            Todas as viagens
          </button>
          {detail.isPending && <p role="status">A carregar viagem…</p>}
          {detail.isError && (
            <div className="panel" role="alert">
              <p>Esta viagem está indisponível ou não tens acesso.</p>
              <button onClick={() => void detail.refetch()}>
                Tentar novamente
              </button>
            </div>
          )}
          {data && trip && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">O TEU PRÓXIMO CAMINHO</span>
                  <h1>{trip.title}</h1>
                  <p>
                    <CalendarDays size={16} />
                    {formatDate(trip.departure_at)}
                  </p>
                </div>
                <span className={`trip-status status-${trip.status}`}>
                  {statusLabels[trip.status]}
                </span>
              </div>
              <TripJourney
                key={`journey:${trip.id}`}
                detail={data}
                userId={userId}
              />
              <div className="trip-detail-grid">
                <section className="panel">
                  <div className="section-heading">
                    <h2>Itinerário</h2>
                    <span>{data.waypoints.length} pontos</span>
                  </div>
                  <ol className="itinerary">
                    {data.waypoints.map((point, index) => (
                      <li key={point.id}>
                        <span className="point-number">{index + 1}</span>
                        <div>
                          <small>
                            {index === 0
                              ? "ORIGEM"
                              : index === data.waypoints.length - 1
                                ? "DESTINO"
                                : "PARAGEM"}
                          </small>
                          <h3>{point.label}</h3>
                          <p>
                            {point.latitude.toFixed(5)},{" "}
                            {point.longitude.toFixed(5)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
                <aside className="panel route-summary">
                  <Route size={32} />
                  <h2>
                    {data.route ? "Rota calculada" : "Percurso por calcular"}
                  </h2>
                  {data.route ? (
                    <>
                      <p>
                        {(data.route.distance_m / 1000).toLocaleString(
                          "pt-PT",
                          { maximumFractionDigits: 1 },
                        )}{" "}
                        km · {Math.ceil(data.route.duration_s / 60)} min
                      </p>
                      <small>
                        Fonte: {data.route.routing_provider}. Calculada em{" "}
                        {formatDate(data.route.calculated_at)}.
                      </small>
                    </>
                  ) : (
                    <p>
                      Os pontos estão guardados. Calcula o percurso para obter a
                      rota, distância e duração.
                    </p>
                  )}
                  <div className="trip-members">
                    <strong>{confirmedCount}</strong>
                    <span>
                      {confirmedCount === 1
                        ? "participante confirmado"
                        : "participantes confirmados"}
                    </span>
                  </div>
                  <small>
                    O GPS só é partilhado com consentimento durante a viagem.
                  </small>
                </aside>
              </div>
              <Participation
                key={`participants:${trip.id}`}
                detail={data}
                userId={userId}
              />
              {canEdit && (
                <div className="actions trip-actions">
                  <button
                    disabled={mutation.isPending}
                    onClick={() => {
                      reset();
                      setEditor(data);
                    }}
                  >
                    Editar viagem
                  </button>
                  <button
                    className="secondary"
                    disabled={mutation.isPending}
                    onClick={() => {
                      reset();
                      mutation.mutate({
                        kind: "status",
                        trip,
                        status: trip.status === "draft" ? "planned" : "draft",
                      });
                    }}
                  >
                    {trip.status === "draft"
                      ? "Marcar como planeada"
                      : "Voltar a rascunho"}
                  </button>
                  <button
                    className="text-button"
                    disabled={mutation.isPending}
                    onClick={() => {
                      reset();
                      setConfirm("cancel");
                    }}
                  >
                    Cancelar viagem
                  </button>
                </div>
              )}
              {!canEdit && (
                <p className="note">
                  {isOwner
                    ? "O itinerário está bloqueado neste estado."
                    : "Só o organizador pode alterar esta viagem."}
                </p>
              )}
              {isOwner &&
                (trip.status === "draft" || trip.status === "cancelled") && (
                  <button
                    className="text-button danger-text"
                    disabled={mutation.isPending}
                    onClick={() => {
                      reset();
                      setConfirm("delete");
                    }}
                  >
                    Remover viagem
                  </button>
                )}
              {confirm && (
                <section
                  className="panel editor"
                  role="alertdialog"
                  aria-labelledby="trip-confirm-title"
                >
                  <h2 id="trip-confirm-title">
                    {confirm === "delete"
                      ? "Remover viagem permanentemente?"
                      : "Cancelar esta viagem?"}
                  </h2>
                  <p>
                    {confirm === "delete"
                      ? "O itinerário e as participações serão removidos. Esta ação é permanente."
                      : "A viagem fica no histórico e o itinerário deixa de poder ser editado."}
                  </p>
                  <div className="actions">
                    <button
                      disabled={mutation.isPending}
                      onClick={() =>
                        mutation.mutate(
                          confirm === "delete"
                            ? { kind: "delete", trip }
                            : { kind: "status", trip, status: "cancelled" },
                        )
                      }
                    >
                      {confirm === "delete"
                        ? "Confirmar remoção"
                        : "Confirmar cancelamento"}
                    </button>
                    <button
                      className="secondary"
                      disabled={mutation.isPending}
                      onClick={() => setConfirm(null)}
                    >
                      Manter viagem
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <div className="page-heading">
            <div>
              <span className="eyebrow">HÁ SEMPRE UM NOVO CAMINHO</span>
              <h1>Viagens</h1>
              <p>Um destino. As tuas paragens. Boa companhia.</p>
            </div>
            <button
              onClick={() => {
                reset();
                setEditor("new");
              }}
            >
              <Plus size={18} />
              Criar viagem
            </button>
          </div>
          {list.isPending && <p role="status">A carregar viagens…</p>}
          {list.isError && (
            <div className="panel" role="alert">
              <p>{errorMessage(list.error)}</p>
              <button onClick={() => void list.refetch()}>
                Tentar novamente
              </button>
            </div>
          )}
          {list.data?.length === 0 && (
            <div className="panel empty">
              <MapPin size={48} />
              <h2>Para onde vamos?</h2>
              <p>Cria a primeira viagem e guarda o teu itinerário.</p>
              <button
                onClick={() => {
                  reset();
                  setEditor("new");
                }}
              >
                Criar a primeira viagem
              </button>
            </div>
          )}
          <div className="trip-list">
            {list.data?.map((item) => (
              <article className="panel trip-card" key={item.id}>
                <div>
                  <span className={`trip-status status-${item.status}`}>
                    {statusLabels[item.status]}
                  </span>
                  <h2>{item.title}</h2>
                  <p>
                    <CalendarDays size={15} />
                    {formatDate(item.departure_at)}
                  </p>
                  <small>
                    {item.created_by === userId
                      ? "Organizada por ti"
                      : "És participante"}
                  </small>
                </div>
                <button
                  className="secondary"
                  aria-label={`Ver viagem ${item.title}`}
                  onClick={() => {
                    reset();
                    setSelected(item.id);
                  }}
                >
                  Ver viagem
                  <ArrowUpRight size={17} />
                </button>
              </article>
            ))}
          </div>
        </>
      )}
      {message && (
        <p role="status" className="success">
          {message}
        </p>
      )}
      {mutation.isError && (
        <div className="error" role="alert">
          <p>{errorMessage(mutation.error)}</p>
          {selected && (
            <button
              className="secondary"
              onClick={() => {
                reset();
                void detail.refetch();
              }}
            >
              Atualizar dados da viagem
            </button>
          )}
        </div>
      )}
    </>
  );
}
