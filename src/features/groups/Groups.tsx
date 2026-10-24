import { lazy, Suspense, useCallback, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Users } from "lucide-react";
import { PlaceSearch } from "../trips/PlaceSearch";
import {
  changeMembership,
  getGroupMembers,
  getGroups,
  getOwnMemberships,
  groupError,
  groupSchema,
  saveGroup,
  type GroupAction,
  type MotardGroup,
} from "./api";
const GroupMap = lazy(() => import("./GroupMap"));
function GroupEditor({
  group,
  onClose,
  onSaved,
}: {
  group?: MotardGroup;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [address, setAddress] = useState(group?.headquarters_address ?? "");
  const [coords, setCoords] = useState({
    latitude: group ? String(group.latitude) : "",
    longitude: group ? String(group.longitude) : "",
  });
  const [validation, setValidation] = useState("");
  const mutation = useMutation({
    mutationFn: (values: Parameters<typeof saveGroup>[0]) =>
      saveGroup(values, group),
    onSuccess: onSaved,
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = groupSchema.safeParse({
      ...Object.fromEntries(data),
      headquarters_address: address,
      ...coords,
    });
    if (!values.success) {
      setValidation(values.error.issues[0].message);
      return;
    }
    setValidation("");
    mutation.mutate(values.data);
  }
  return (
    <section className="panel">
      <h1>{group ? "Editar grupo" : "Registar grupo motard"}</h1>
      <p>
        A sede e os dados abaixo ficam visíveis aos utilizadores da app. Usa uma
        morada que o grupo autorize divulgar. Só registes grupos que estás
        autorizado a representar.
      </p>
      <form onSubmit={submit}>
        <fieldset disabled={mutation.isPending}>
          <label>
            Nome do grupo
            <input
              name="name"
              defaultValue={group?.name}
              minLength={3}
              maxLength={100}
              required
            />
          </label>
          <label>
            Descrição
            <textarea
              name="description"
              defaultValue={group?.description}
              maxLength={1000}
            />
          </label>
          <label>
            Denominação legal (opcional)
            <input
              name="legal_name"
              defaultValue={group?.legal_name}
              maxLength={160}
            />
          </label>
          <label>
            Número de registo ou NIPC (opcional)
            <input
              name="registration_number"
              defaultValue={group?.registration_number}
              maxLength={80}
            />
          </label>
          <p className="muted">
            Estes dados são declarados pelo grupo. A RideSync não certifica o
            seu estatuto legal.
          </p>
          <PlaceSearch
            label="Morada pública da sede"
            value={address}
            onChange={setAddress}
            onSelect={(place) => {
              setAddress(place.label.slice(0, 240));
              setCoords({
                latitude: String(place.latitude),
                longitude: String(place.longitude),
              });
            }}
          />
          <div className="form-grid">
            {(["latitude", "longitude"] as const).map((field) => (
              <label key={field}>
                {field === "latitude"
                  ? "Latitude da sede"
                  : "Longitude da sede"}
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={field === "latitude" ? -90 : -180}
                  max={field === "latitude" ? 90 : 180}
                  value={coords[field]}
                  onChange={(e) =>
                    setCoords((current) => ({
                      ...current,
                      [field]: e.target.value,
                    }))
                  }
                  required
                />
              </label>
            ))}
          </div>
          {validation && (
            <p role="alert" className="error">
              {validation}
            </p>
          )}
          {mutation.isError && (
            <p role="alert" className="error">
              {groupError(mutation.error)}
            </p>
          )}
          <div className="actions">
            <button>
              {mutation.isPending ? "A guardar…" : "Guardar grupo"}
            </button>
            <button type="button" className="secondary" onClick={onClose}>
              Voltar sem guardar
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
function GroupRoster({
  groupId,
  leader,
  onAction,
  busy,
}: {
  groupId: string;
  leader: boolean;
  onAction: (action: GroupAction, userId: string) => void;
  busy: boolean;
}) {
  const query = useQuery({
    queryKey: ["group-members", groupId],
    queryFn: () => getGroupMembers(groupId),
    refetchInterval: 15000,
  });
  return (
    <section>
      <h2>Membros e direção</h2>
      {query.isPending && <p role="status">A carregar membros…</p>}
      {query.isError && (
        <div role="alert">
          <p className="error">Não foi possível carregar os membros.</p>
          <button onClick={() => void query.refetch()}>Tentar novamente</button>
        </div>
      )}
      <ul className="group-members">
        {query.data?.map((member) => (
          <li key={member.user_id}>
            <strong>
              {member.display_name || member.username || "Motard"}
            </strong>
            <p>
              {member.status === "pending"
                ? "Pedido de entrada"
                : member.role === "leader"
                  ? "Dirigente"
                  : "Membro"}
            </p>
            {leader && (
              <div className="actions">
                {member.status === "pending" ? (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => onAction("approve", member.user_id)}
                    >
                      Aprovar entrada
                    </button>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => onAction("reject", member.user_id)}
                    >
                      Recusar entrada
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        onAction(
                          member.role === "leader" ? "demote" : "promote",
                          member.user_id,
                        )
                      }
                    >
                      {member.role === "leader"
                        ? "Retirar cargo de dirigente"
                        : "Tornar dirigente"}
                    </button>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => onAction("remove", member.user_id)}
                    >
                      Remover membro
                    </button>
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
export function Groups({ userId }: { userId: string }) {
  const cache = useQueryClient();
  const [view, setView] = useState<"list" | "map">("list");
  const [selected, setSelected] = useState<string | null>(null);
  const [editor, setEditor] = useState<"new" | MotardGroup | null>(null);
  const [search, setSearch] = useState("");
  const [confirmation, setConfirmation] = useState<{
    action: GroupAction;
    userId?: string;
  } | null>(null);
  const groups = useQuery({ queryKey: ["groups"], queryFn: getGroups });
  const memberships = useQuery({
    queryKey: ["group-memberships", userId],
    queryFn: () => getOwnMemberships(userId),
    refetchInterval: 15000,
  });
  const refresh = async () => {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ["groups"] }),
      cache.invalidateQueries({ queryKey: ["group-memberships"] }),
      cache.invalidateQueries({ queryKey: ["group-members"] }),
    ]);
  };
  const mutation = useMutation({
    mutationFn: ({
      action,
      userId: target,
    }: {
      action: GroupAction;
      userId?: string;
    }) => changeMembership(selected!, action, target),
    onSuccess: async () => {
      setConfirmation(null);
      await refresh();
    },
  });
  const resetMembership = mutation.reset;
  const select = useCallback(
    (id: string) => {
      setSelected(id);
      setConfirmation(null);
      resetMembership();
    },
    [resetMembership],
  );
  const all = groups.data ?? [];
  const group = all.find((g) => g.id === selected);
  const membership = memberships.data?.find((m) => m.group_id === selected);
  const current = memberships.data?.find(
    (m) => m.status === "accepted" || m.status === "pending",
  );
  const leader =
    membership?.status === "accepted" && membership.role === "leader";
  const filtered = all.filter((g) =>
    `${g.name} ${g.headquarters_address}`
      .toLocaleLowerCase("pt-PT")
      .includes(search.trim().toLocaleLowerCase("pt-PT")),
  );
  function action(kind: GroupAction, target?: string) {
    if (["remove", "demote", "leave"].includes(kind))
      setConfirmation({ action: kind, userId: target });
    else mutation.mutate({ action: kind, userId: target });
  }
  if (editor)
    return (
      <GroupEditor
        group={editor === "new" ? undefined : editor}
        onClose={() => setEditor(null)}
        onSaved={(id) => {
          setEditor(null);
          setSelected(id);
          void refresh();
        }}
      />
    );
  return (
    <section className="panel groups-panel">
      <span className="eyebrow">
        <Users size={16} /> A COMUNIDADE
      </span>
      <h1>Grupos motards</h1>
      <p>
        Descobre grupos e sedes físicas. Podes pertencer a um grupo; a entrada é
        aprovada por um dos dirigentes.
      </p>
      {selected && (
        <button
          className="text-button"
          onClick={() => {
            setSelected(null);
            setConfirmation(null);
            mutation.reset();
          }}
        >
          Todos os grupos
        </button>
      )}
      {groups.isPending && <p role="status">A carregar grupos…</p>}
      {(groups.isError || memberships.isError) && (
        <div role="alert">
          <p className="error">
            Não foi possível atualizar os grupos ou a tua inscrição.
          </p>
          <button onClick={() => void refresh()}>Tentar novamente</button>
        </div>
      )}
      {group ? (
        <>
          <h2>{group.name}</h2>
          <p>{group.description}</p>
          <p>
            <MapPin size={16} /> {group.headquarters_address}
          </p>
          {group.legal_name && <p>Denominação: {group.legal_name}</p>}
          {group.registration_number && (
            <p>Registo/NIPC: {group.registration_number}</p>
          )}
          <p className="muted">
            Informação declarada pelo grupo, sem verificação legal pela
            RideSync.
          </p>
          {membership?.status === "accepted" ? (
            <div className="actions">
              {leader && (
                <button onClick={() => setEditor({ ...group })}>
                  Editar grupo e sede
                </button>
              )}
              <button
                className="secondary"
                disabled={mutation.isPending}
                onClick={() => action("leave")}
              >
                Sair do grupo
              </button>
            </div>
          ) : membership?.status === "pending" ? (
            <>
              <p role="status">
                Pedido pendente de aprovação por um dirigente.
              </p>
              <button
                className="secondary"
                disabled={mutation.isPending}
                onClick={() => action("withdraw")}
              >
                Retirar pedido
              </button>
            </>
          ) : current ? (
            <p>
              Já tens um grupo ou um pedido pendente. Gere a tua inscrição antes
              de pedir entrada noutro.
            </p>
          ) : (
            <button
              disabled={mutation.isPending || !memberships.isSuccess}
              onClick={() => action("request")}
            >
              Pedir entrada no grupo
            </button>
          )}
          {membership?.status === "accepted" && (
            <GroupRoster
              groupId={group.id}
              leader={leader}
              busy={mutation.isPending}
              onAction={action}
            />
          )}
        </>
      ) : (
        <>
          <div className="actions">
            <button
              className={view === "list" ? "" : "secondary"}
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              Lista de grupos
            </button>
            <button
              className={view === "map" ? "" : "secondary"}
              aria-pressed={view === "map"}
              onClick={() => setView("map")}
            >
              Mapa das sedes
            </button>
            {!current && memberships.isSuccess && (
              <button className="secondary" onClick={() => setEditor("new")}>
                Registar grupo
              </button>
            )}
          </div>
          {current && (
            <button
              className="text-button"
              onClick={() => select(current.group_id)}
            >
              {current.status === "pending"
                ? "Ver o meu pedido"
                : "O meu grupo"}
            </button>
          )}
          <label>
            Pesquisar grupo ou sede
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="search"
            />
          </label>
          {groups.isSuccess && filtered.length === 0 && (
            <p className="empty">
              {search
                ? "Não encontrámos grupos para esta pesquisa."
                : "Ainda não há grupos registados. Podes registar o teu grupo e a sua sede."}
            </p>
          )}
          {view === "map" && filtered.length > 0 && (
            <Suspense fallback={<p role="status">A carregar mapa…</p>}>
              <GroupMap groups={filtered} onSelect={select} />
            </Suspense>
          )}
          <ul className="group-list">
            {filtered.map((item) => (
              <li key={item.id}>
                <h2>{item.name}</h2>
                <p>{item.headquarters_address}</p>
                <button className="secondary" onClick={() => select(item.id)}>
                  Ver grupo {item.name}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {confirmation && (
        <div className="confirmation" role="alert">
          <p>
            Confirmas esta alteração de inscrição ou cargo? O grupo precisa de
            manter pelo menos um dirigente.
          </p>
          <div className="actions">
            <button
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(confirmation)}
            >
              Confirmar alteração
            </button>
            <button
              className="secondary"
              disabled={mutation.isPending}
              onClick={() => setConfirmation(null)}
            >
              Voltar
            </button>
          </div>
        </div>
      )}
      {mutation.isPending && <p role="status">A atualizar inscrição…</p>}
      {mutation.isSuccess && <p role="status">Inscrição atualizada.</p>}
      {mutation.isError && (
        <p role="alert" className="error">
          {groupError(mutation.error)}
        </p>
      )}
    </section>
  );
}
