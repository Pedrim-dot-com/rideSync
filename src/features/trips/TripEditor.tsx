import { PlaceSearch } from "./PlaceSearch";
import { useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  tripSchema,
  fromLocalDatetime,
  toLocalDatetime,
  type TripInput,
} from "./validation";
import type { TripDetail } from "./api";
import { errorMessage } from "../../shared/supabase";
type PointDraft = {
  key: string;
  label: string;
  latitude: string;
  longitude: string;
};
const emptyPoint = (): PointDraft => ({
  key: crypto.randomUUID(),
  label: "",
  latitude: "",
  longitude: "",
});
export function TripEditor({
  detail,
  busy,
  error,
  onSave,
  onCancel,
}: {
  detail?: TripDetail;
  busy: boolean;
  error: unknown;
  onSave: (values: TripInput) => void;
  onCancel: () => void;
}) {
  const [points, setPoints] = useState<PointDraft[]>(() =>
    detail
      ? detail.waypoints.map((p) => ({
          key: p.id,
          label: p.label,
          latitude: String(p.latitude),
          longitude: String(p.longitude),
        }))
      : [emptyPoint(), emptyPoint()],
  );
  const [validation, setValidation] = useState("");
  function change(
    key: string,
    field: "label" | "latitude" | "longitude",
    value: string,
  ) {
    setPoints((current) =>
      current.map((p) => (p.key === key ? { ...p, [field]: value } : p)),
    );
  }
  function move(index: number, delta: number) {
    setPoints((current) => {
      const next = [...current];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const parsed = tripSchema.safeParse({
      title: data.get("title"),
      departure_at: fromLocalDatetime(
        `${data.get("departure_date")}T${data.get("departure_time")}`,
      ),
      waypoints: points,
    });
    if (!parsed.success) {
      setValidation(parsed.error.issues[0].message);
      return;
    }
    setValidation("");
    onSave(parsed.data);
  }
  return (
    <section className="panel trip-editor">
      <span className="eyebrow">O PRÓXIMO CAMINHO</span>
      <h1>{detail ? "Editar viagem" : "Nova viagem"}</h1>
      <p>
        Prepara o itinerário. O cálculo da rota será feito pelo serviço de
        routing.
      </p>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <div className="form-grid">
            <label>
              Título da viagem
              <input
                name="title"
                maxLength={120}
                defaultValue={detail?.trip.title}
                required
              />
            </label>
            <fieldset className="departure-fields">
              <legend>Data e hora de partida</legend>
              <div className="departure-inputs">
                <label>
                  Data de partida
                  <input
                    name="departure_date"
                    type="date"
                    required
                    defaultValue={
                      detail
                        ? toLocalDatetime(detail.trip.departure_at).split(
                            "T",
                          )[0]
                        : ""
                    }
                  />
                </label>
                <label>
                  Hora de partida
                  <input
                    name="departure_time"
                    type="time"
                    step={60}
                    required
                    defaultValue={
                      detail
                        ? toLocalDatetime(detail.trip.departure_at).split(
                            "T",
                          )[1]
                        : ""
                    }
                  />
                </label>
              </div>
              <small>
                Hora local: {Intl.DateTimeFormat().resolvedOptions().timeZone}.
              </small>
            </fieldset>
          </div>
          <h2>Itinerário</h2>
          <p className="coordinate-help">
            Pesquisa um lugar e escolhe uma sugestão, ou preenche as coordenadas
            em graus decimais. Os pontos ainda não são uma rota calculada.
          </p>
          <ol className="waypoint-editor">
            {points.map((point, index) => (
              <li key={point.key}>
                <div className="waypoint-heading">
                  <strong>
                    {index === 0
                      ? "Origem"
                      : index === points.length - 1
                        ? "Destino"
                        : `Paragem ${index}`}
                  </strong>
                  {index > 0 && index < points.length - 1 && (
                    <div className="actions">
                      <button
                        type="button"
                        className="icon-button"
                        disabled={index === 1}
                        aria-label={`Subir paragem ${index}`}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        disabled={index === points.length - 2}
                        aria-label={`Descer paragem ${index}`}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Remover paragem ${index}`}
                        onClick={() =>
                          setPoints((p) =>
                            p.filter((item) => item.key !== point.key),
                          )
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="point-inputs">
                  <PlaceSearch
                    label={`Nome do ponto ${index + 1}`}
                    value={point.label}
                    onChange={(value) => change(point.key, "label", value)}
                    onSelect={(place) =>
                      setPoints((current) =>
                        current.map((p) =>
                          p.key === point.key
                            ? {
                                ...p,
                                label: place.label.slice(0, 120),
                                latitude: String(place.latitude),
                                longitude: String(place.longitude),
                              }
                            : p,
                        ),
                      )
                    }
                  />
                  <label>
                    Latitude do ponto {index + 1}
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min={-90}
                      max={90}
                      value={point.latitude}
                      onChange={(e) =>
                        change(point.key, "latitude", e.target.value)
                      }
                      required
                    />
                  </label>
                  <label>
                    Longitude do ponto {index + 1}
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min={-180}
                      max={180}
                      value={point.longitude}
                      onChange={(e) =>
                        change(point.key, "longitude", e.target.value)
                      }
                      required
                    />
                  </label>
                </div>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="secondary"
            disabled={points.length >= 12}
            onClick={() =>
              setPoints((p) => [
                ...p.slice(0, -1),
                emptyPoint(),
                p[p.length - 1],
              ])
            }
          >
            <Plus size={16} />
            Adicionar paragem
          </button>
          {validation && (
            <p role="alert" className="error">
              {validation}
            </p>
          )}
          {Boolean(error) && (
            <p role="alert" className="error">
              {errorMessage(error)}
            </p>
          )}
          <div className="actions editor-actions">
            <button type="submit">
              {busy ? "A guardar…" : "Guardar viagem"}
            </button>
            <button type="button" className="secondary" onClick={onCancel}>
              Voltar sem guardar
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
