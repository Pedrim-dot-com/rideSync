import { useState } from "react";
import type { TrackingController } from "./useTracking";
import { elapsedLabel, positionAge, trackingError } from "./types";
export function TrackingControls({
  tracking,
  owner,
  hasRoute,
}: {
  tracking: TrackingController;
  owner: boolean;
  hasRoute: boolean;
}) {
  const { query, data, active, gps, mutation, now, positions, connection } =
    tracking;
  const [confirm, setConfirm] = useState(false);
  const session = data?.session;
  return (
    <section
      className="panel tracking-controls"
      aria-labelledby="tracking-title"
    >
      <h2 id="tracking-title">Acompanhar a viagem</h2>
      {query.isPending && <p role="status">A carregar estado da viagem…</p>}
      {query.isError && (
        <div role="alert">
          <p>{trackingError(query.error)}</p>
          <button className="secondary" onClick={() => void query.refetch()}>
            Atualizar viagem
          </button>
        </div>
      )}
      {data && !session && (
        <>
          <p>
            O tempo começa quando o organizador inicia a viagem. A localização
            só é partilhada com a tua autorização.
          </p>
          {!hasRoute && <p>Calcula o percurso antes de iniciar.</p>}
          {owner && ["draft", "planned"].includes(data.status) && (
            <button
              disabled={!hasRoute || mutation.isPending}
              onClick={() => mutation.mutate("start")}
            >
              Iniciar viagem
            </button>
          )}
        </>
      )}
      {session && (
        <>
          <p className="trip-timer">
            <span>{session.ended_at ? "Tempo total" : "Tempo decorrido"}</span>
            <strong
              aria-label={
                session.ended_at
                  ? "Tempo total da viagem"
                  : "Tempo decorrido da viagem"
              }
            >
              {elapsedLabel(
                session.started_at,
                session.ended_at ?? new Date(now).toISOString(),
              )}
            </strong>
          </p>
          <p>
            Início: {new Date(session.started_at).toLocaleString("pt-PT")}
            {session.ended_at
              ? ` · Fim: ${new Date(session.ended_at).toLocaleString("pt-PT")}`
              : ""}
          </p>
        </>
      )}
      {active && (
        <>
          <p>
            Partilha a tua posição com os participantes confirmados, com a PWA
            visível. Ao parar a partilha ou terminar, a posição é removida. Ao
            trocar de aplicação ou bloquear o ecrã, o GPS pode parar.
          </p>
          <button
            className={gps.consent ? "secondary" : ""}
            onClick={gps.toggle}
          >
            {gps.consent
              ? "Parar partilha GPS"
              : "Partilhar a minha localização"}
          </button>
          <p role="status">
            {!gps.online
              ? "Sem ligação. O envio GPS está suspenso."
              : !gps.visible
                ? "PWA em segundo plano. O envio GPS está suspenso."
                : gps.status || "Localização não partilhada."}
          </p>
          <small>
            {connection === "connected"
              ? "Atualizações em tempo real ligadas."
              : "A restabelecer tempo real; atualização de segurança a cada 10 segundos."}{" "}
            Posições com mais de 30 segundos são assinaladas como antigas.
          </small>
          <ul className="tracking-members">
            {positions.map((p) => (
              <li key={p.user_id}>
                <strong>{p.display_name || "Motard"}</strong> ·{" "}
                {positionAge(p, now) >= 30
                  ? "Posição antiga"
                  : "Última posição"}{" "}
                há {positionAge(p, now)} s · precisão ±{Math.ceil(p.accuracy_m)}{" "}
                m
              </li>
            ))}
          </ul>
          {positions.length === 0 && (
            <p>Ainda não há posições recentes disponíveis.</p>
          )}
          {owner && (
            <button
              className="secondary"
              disabled={mutation.isPending}
              onClick={() => setConfirm(true)}
            >
              Terminar viagem
            </button>
          )}
          {confirm && (
            <div role="alertdialog" aria-labelledby="finish-trip-title">
              <h3 id="finish-trip-title">Terminar esta viagem?</h3>
              <p>
                O tempo fica guardado e a partilha GPS termina para todos os
                participantes.
              </p>
              <div className="actions">
                <button
                  disabled={mutation.isPending}
                  onClick={() => {
                    mutation.mutate("finish", {
                      onSuccess: () => setConfirm(false),
                    });
                  }}
                >
                  Confirmar fim da viagem
                </button>
                <button
                  className="secondary"
                  disabled={mutation.isPending}
                  onClick={() => setConfirm(false)}
                >
                  Continuar viagem
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {session?.ended_at && (
        <p>
          A viagem terminou. O tempo ficou guardado; as posições GPS foram
          removidas.
        </p>
      )}
      {mutation.isPending && <p role="status">A atualizar viagem…</p>}
      {mutation.isError && (
        <p role="alert" className="error">
          {trackingError(mutation.error)}
        </p>
      )}
    </section>
  );
}
