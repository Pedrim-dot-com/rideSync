import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bike, Plus, Star, Pencil, Trash2 } from "lucide-react";
import {
  getMotorcycles,
  saveMotorcycle,
  removeMotorcycle,
  setPrimary,
  type Motorcycle,
} from "../shared/api";
import { motorcycleSchema } from "../shared/validation";
import { errorMessage } from "../shared/supabase";
export function Garage({ userId }: { userId: string }) {
  const cache = useQueryClient();
  const [editing, setEditing] = useState<Motorcycle | null | undefined>(
    undefined,
  );
  const [validation, setValidation] = useState("");
  const [deleting, setDeleting] = useState<Motorcycle | null>(null);
  const key = ["motorcycles", userId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => getMotorcycles(userId),
  });
  const mutation = useMutation({
    mutationFn: async (
      action:
        | {
            kind: "save";
            values: ReturnType<typeof motorcycleSchema.parse>;
            id?: string;
          }
        | { kind: "delete" | "primary"; id: string },
    ) => {
      if (action.kind === "save")
        return saveMotorcycle(userId, action.values, action.id);
      if (action.kind === "delete") return removeMotorcycle(userId, action.id);
      return setPrimary(action.id);
    },
    onSuccess: async () => {
      setEditing(undefined);
      setDeleting(null);
      await cache.invalidateQueries({ queryKey: key });
    },
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = motorcycleSchema.safeParse(
      Object.fromEntries(new FormData(e.currentTarget)),
    );
    if (!parsed.success) {
      setValidation(parsed.error.issues[0].message);
      return;
    }
    setValidation("");
    mutation.mutate({ kind: "save", values: parsed.data, id: editing?.id });
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A TUA COLEÇÃO</span>
          <h1>
            Garagem<span className="count">{query.data?.length ?? "—"}</span>
          </h1>
          <p>Cada aventura começa com a mota certa.</p>
        </div>
        <button
          onClick={() => {
            mutation.reset();
            setValidation("");
            setEditing(null);
          }}
        >
          <Plus size={18} /> Adicionar mota
        </button>
      </div>
      {query.isPending && <p role="status">A carregar a garagem…</p>}
      {query.isError && (
        <div role="alert" className="panel">
          {errorMessage(query.error)}{" "}
          <button onClick={() => void query.refetch()}>Tentar novamente</button>
        </div>
      )}
      {mutation.isError && (
        <p role="alert" className="error">
          {errorMessage(mutation.error)}
        </p>
      )}
      {query.data?.length === 0 && (
        <div className="empty panel">
          <Bike size={52} />
          <h2>O primeiro lugar é teu.</h2>
          <p>Adiciona a tua mota para começares a preparar a próxima viagem.</p>
          <button onClick={() => setEditing(null)}>
            Adicionar a primeira mota
          </button>
        </div>
      )}
      <div className="bike-grid">
        {query.data?.map((bike) => (
          <article className="bike-card" key={bike.id}>
            <div className="bike-illustration">
              <Bike size={100} strokeWidth={1} />
              {bike.is_primary && (
                <span className="badge">
                  <Star size={13} /> Principal
                </span>
              )}
            </div>
            <div className="bike-info">
              <span className="eyebrow">{bike.brand}</span>
              <h2>{bike.model}</h2>
              <p>
                {[
                  bike.manufacture_year,
                  bike.engine_cc ? `${bike.engine_cc} cc` : null,
                  bike.color,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Sem detalhes adicionais"}
              </p>
              <div className="card-actions">
                <button
                  className="secondary"
                  disabled={mutation.isPending || bike.is_primary}
                  onClick={() =>
                    mutation.mutate({ kind: "primary", id: bike.id })
                  }
                >
                  <Star size={16} />
                  {bike.is_primary ? "Mota principal" : "Tornar principal"}
                </button>
                <button
                  className="icon-button"
                  aria-label={`Editar ${bike.model}`}
                  onClick={() => {
                    mutation.reset();
                    setValidation("");
                    setEditing(bike);
                  }}
                >
                  <Pencil size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Remover ${bike.model}`}
                  onClick={() => setDeleting(bike)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {editing !== undefined && (
        <section className="panel editor" aria-labelledby="edit-title">
          <h2 id="edit-title">{editing ? "Editar mota" : "Nova mota"}</h2>
          <form onSubmit={submit} key={editing?.id ?? "new"}>
            <div className="form-grid">
              <label>
                Marca
                <input
                  name="brand"
                  defaultValue={editing?.brand}
                  maxLength={80}
                  required
                />
              </label>
              <label>
                Modelo
                <input
                  name="model"
                  defaultValue={editing?.model}
                  maxLength={120}
                  required
                />
              </label>
              <label>
                Ano
                <input
                  name="manufacture_year"
                  type="number"
                  min={1885}
                  max={2100}
                  defaultValue={editing?.manufacture_year ?? ""}
                />
              </label>
              <label>
                Cilindrada (cc)
                <input
                  name="engine_cc"
                  type="number"
                  min={1}
                  max={10000}
                  defaultValue={editing?.engine_cc ?? ""}
                />
              </label>
              <label>
                Cor
                <input
                  name="color"
                  maxLength={60}
                  defaultValue={editing?.color ?? ""}
                />
              </label>
            </div>
            <p>A mota principal é escolhida depois de guardar.</p>
            {validation && (
              <p role="alert" className="error">
                {validation}
              </p>
            )}
            <div className="actions">
              <button disabled={mutation.isPending}>Guardar mota</button>
              <button
                type="button"
                className="secondary"
                disabled={mutation.isPending}
                onClick={() => setEditing(undefined)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}
      {deleting && (
        <section
          className="panel editor"
          role="alertdialog"
          aria-labelledby="delete-title"
        >
          <h2 id="delete-title">Remover {deleting.model}?</h2>
          <p>
            Esta ação é permanente. A mota será também desassociada das viagens,
            que serão preservadas.
          </p>
          <div className="actions">
            <button
              disabled={mutation.isPending}
              onClick={() =>
                mutation.mutate({ kind: "delete", id: deleting.id })
              }
            >
              Confirmar remoção
            </button>
            <button
              className="secondary"
              disabled={mutation.isPending}
              onClick={() => setDeleting(null)}
            >
              Cancelar
            </button>
          </div>
        </section>
      )}
      <aside className="note">
        <span>01 — A GARAGEM</span>
        <p>
          A tua mota principal ficará pronta para ser escolhida nas futuras
          viagens.
        </p>
      </aside>
    </>
  );
}
