import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { getGroupSummary, getOwnMemberships } from "./api";
import { ReceivedGroupInvitations } from "./ReceivedGroupInvitations";
export function ProfileGroup({
  userId,
  onOpenGroups,
}: {
  userId: string;
  onOpenGroups?: (id?: string) => void;
}) {
  const memberships = useQuery({
    queryKey: ["group-memberships", userId],
    queryFn: () => getOwnMemberships(userId),
    refetchInterval: 15000,
  });
  const accepted = memberships.data?.find((item) => item.status === "accepted");
  const pending = memberships.data?.find((item) => item.status === "pending");
  const current = accepted ?? pending;
  const group = useQuery({
    queryKey: ["group-summary", current?.group_id],
    queryFn: () => getGroupSummary(current!.group_id),
    enabled: Boolean(current),
    refetchInterval: 30000,
  });
  return (
    <section className="panel profile-group">
      <span className="eyebrow">
        <Users size={16} /> A TUA COMUNIDADE
      </span>
      <h2>O meu grupo</h2>
      {memberships.isPending && (
        <p role="status">A carregar a tua inscrição…</p>
      )}
      {memberships.isError && (
        <div role="alert">
          <p className="error">Não foi possível consultar a tua inscrição.</p>
          <button
            className="secondary"
            onClick={() => void memberships.refetch()}
          >
            Tentar novamente
          </button>
        </div>
      )}
      {memberships.isSuccess && !accepted && (
        <p>Ainda não pertences a nenhum grupo. A inscrição é opcional.</p>
      )}
      {current && group.isPending && <p role="status">A carregar grupo…</p>}
      {current && group.isError && (
        <div role="alert">
          <p className="error">Não foi possível carregar os dados do grupo.</p>
          <button className="secondary" onClick={() => void group.refetch()}>
            Tentar carregar grupo novamente
          </button>
        </div>
      )}
      {group.data && current && (
        <>
          <h3>{group.data.name}</h3>
          <p>
            {accepted
              ? accepted.role === "leader"
                ? "Dirigente · inscrição aceite"
                : "Membro · inscrição aceite"
              : "Candidatura pendente · aguarda aprovação da direção"}
          </p>
          <p>{group.data.headquarters_address}</p>
          {onOpenGroups && (
            <button
              className="secondary"
              onClick={() => onOpenGroups(group.data.id)}
            >
              {accepted?.role === "leader"
                ? "Gerir o meu grupo"
                : "Ver o meu grupo ou candidatura"}
            </button>
          )}
        </>
      )}
      {!current && memberships.isSuccess && onOpenGroups && (
        <button className="secondary" onClick={() => onOpenGroups()}>
          Explorar ou criar grupos
        </button>
      )}
      <ReceivedGroupInvitations userId={userId} onOpenGroup={onOpenGroups} />
    </section>
  );
}
