import { ProfileGroup } from "./groups/ProfileGroup";
import { PasskeySettings } from "./access/PasskeySettings";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getProfile, saveProfile } from "../shared/api";
import { profileSchema } from "../shared/validation";
import { errorMessage } from "../shared/supabase";
export function Profile({
  userId,
  onOpenGroups,
}: {
  userId: string;
  onOpenGroups?: (id?: string) => void;
}) {
  const cache = useQueryClient();
  const [message, setMessage] = useState("");
  const key = ["profile", userId];
  const query = useQuery({ queryKey: key, queryFn: () => getProfile(userId) });
  const mutation = useMutation({
    mutationFn: (values: ReturnType<typeof profileSchema.parse>) =>
      saveProfile(userId, values),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: key });
      setMessage("Perfil atualizado.");
    },
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = profileSchema.safeParse(
      Object.fromEntries(new FormData(e.currentTarget)),
    );
    if (!parsed.success) {
      setMessage(parsed.error.issues[0].message);
      return;
    }
    setMessage("");
    mutation.mutate(parsed.data);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">QUEM VAI AOS COMANDOS</span>
          <h1>O teu perfil</h1>
          <p>Como te apresentas ao grupo.</p>
        </div>
      </div>
      {query.isPending && <p role="status">A carregar perfil…</p>}
      {query.isError && (
        <div role="alert">
          {errorMessage(query.error)}
          <button onClick={() => void query.refetch()}>Tentar novamente</button>
        </div>
      )}
      {query.data && (
        <form
          className="panel profile-form"
          onSubmit={submit}
          key={query.data.id}
        >
          <label>
            Nome
            <input
              name="display_name"
              defaultValue={query.data.display_name}
              maxLength={80}
              required
            />
          </label>
          <label>
            Nickname
            <input
              name="username"
              defaultValue={query.data.username ?? ""}
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_]+"
              required
            />
            <small>3–30 letras, números ou underscores.</small>
          </label>
          <button disabled={mutation.isPending}>
            {mutation.isPending ? "A guardar…" : "Guardar perfil"}
          </button>
          {message && <p role="status">{message}</p>}
          {mutation.isError && (
            <p role="alert" className="error">
              {errorMessage(mutation.error)}
            </p>
          )}
        </form>
      )}
      <ProfileGroup userId={userId} onOpenGroups={onOpenGroups} />
      {query.data && (
        <PasskeySettings key={`passkeys:${userId}`} userId={userId} />
      )}
    </>
  );
}
