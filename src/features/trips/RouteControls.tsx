import type { RiderPosition } from "../tracking/types";
import { lazy, Suspense, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Route } from "lucide-react";
import { routeSchema } from "../../../supabase/functions/_shared/contracts";
import {
  callMapFunction,
  externalNavigation,
} from "../../shared/maps/providers";
import type { TripDetail } from "./api";
const TripMap = lazy(() => import("./TripMap"));
export function RouteControls({
  detail,
  userId,
  positions = [],
  now = 0,
}: {
  detail: TripDetail;
  userId: string;
  positions?: RiderPosition[];
  now?: number;
}) {
  const cache = useQueryClient();
  const [avoid, setAvoid] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const trip = detail.trip;
  const last = detail.waypoints.at(-1);
  const links = last ? externalNavigation(last.latitude, last.longitude) : null;
  const mutation = useMutation({
    mutationFn: async () => {
      const data = await callMapFunction("calculate-route", {
        tripId: trip.id,
        expectedRevision: trip.revision,
        avoidHighways: avoid,
      });
      const parsed = routeSchema.safeParse(
        data && typeof data === "object" && "route" in data ? data.route : null,
      );
      if (!parsed.success)
        throw new Error("O serviço não devolveu um percurso válido.");
      return parsed.data;
    },
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["trip", userId, trip.id] }),
        cache.invalidateQueries({ queryKey: ["trips", userId] }),
      ]);
    },
  });
  const canCalculate =
    trip.created_by === userId && ["draft", "planned"].includes(trip.status);
  return (
    <section className="route-section">
      <Suspense fallback={<p role="status">A preparar mapa…</p>}>
        <TripMap
          waypoints={detail.waypoints}
          route={detail.route}
          positions={positions}
          userId={userId}
          now={now}
        />
      </Suspense>
      {canCalculate && (
        <div className="route-toolbar">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={avoid}
              disabled={mutation.isPending}
              onChange={(e) => setAvoid(e.target.checked)}
            />
            Evitar autoestradas
          </label>
          <button
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            <Route size={17} />
            {mutation.isPending
              ? "A calcular percurso…"
              : detail.route
                ? "Recalcular percurso"
                : "Calcular percurso"}
          </button>
          <small>
            Perfil automóvel; não é um cálculo especializado para motas.
          </small>
        </div>
      )}
      {mutation.isSuccess && (
        <p role="status" className="success">
          Percurso calculado e guardado.
        </p>
      )}
      {mutation.isError && (
        <p role="alert" className="error">
          {mutation.error instanceof Error
            ? mutation.error.message
            : "Não foi possível calcular o percurso."}
        </p>
      )}
      {links && (
        <div className="external-navigation">
          <button
            type="button"
            className="secondary"
            onClick={() => setShowLinks((v) => !v)}
            aria-expanded={showLinks}
          >
            Abrir navegação
          </button>
          {showLinks && (
            <div className="panel navigation-warning">
              <p>
                Ao abrir outra aplicação, a tua localização pode deixar de ser
                partilhada com o grupo.
              </p>
              <p>
                Estes links abrem o destino e podem não preservar as paragens ou
                o percurso.
              </p>
              <div className="actions">
                <a
                  href={links.google}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google Maps ↗
                </a>
                <a href={links.waze} target="_blank" rel="noopener noreferrer">
                  Waze ↗
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
