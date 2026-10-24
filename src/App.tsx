import { Invitation } from "./features/trips/Invitation";
import {
  clearPendingInvitation,
  readPendingInvitation,
} from "./features/trips/invitation-link";
import { UpdateNotice } from "./UpdateNotice";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { Bike, UserRound, LogOut, ArrowUpRight, Map } from "lucide-react";
import { supabase } from "./shared/supabase";
import { Auth } from "./features/Auth";
import { Garage } from "./features/Garage";
import { Profile } from "./features/Profile";
import { Trips } from "./features/trips/Trips";
export default function App() {
  const cache = useQueryClient();
  const [invitation, setInvitation] = useState(readPendingInvitation);
  const [acceptedTrip, setAcceptedTrip] = useState<string | undefined>();
  function closeInvitation() {
    clearPendingInvitation();
    setInvitation(null);
  }
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [authError, setAuthError] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [page, setPage] = useState<"garage" | "profile" | "trips">("garage");
  useEffect(() => {
    function captureInvitation() {
      if (new URLSearchParams(window.location.hash.slice(1)).has("invite"))
        setInvitation(readPendingInvitation());
    }
    window.addEventListener("hashchange", captureInvitation);
    return () => window.removeEventListener("hashchange", captureInvitation);
  }, []);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let eventReceived = false;
    let currentUserId: string | undefined;
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      eventReceived = true;
      if (active) {
        if (currentUserId !== next?.user.id) cache.clear();
        currentUserId = next?.user.id;
        setSession(next);
        setLoading(false);
        if (event === "PASSWORD_RECOVERY") setRecovery(true);
        if (event === "SIGNED_OUT") setRecovery(false);
      }
    });
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (active && !eventReceived) {
          currentUserId = data.session?.user.id;
          setSession(data.session);
          setAuthError(Boolean(error));
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setAuthError(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [cache]);
  async function logout() {
    const { error } = await supabase!.auth.signOut();
    if (error) setAuthError(true);
    else {
      cache.clear();
      setSession(null);
      setPage("garage");
      setAcceptedTrip(undefined);
    }
  }
  return (
    <>
      <header>
        <a className="brand" href="/" aria-label="RideSync início">
          <span className="brand-icon">
            R<ArrowUpRight size={14} aria-hidden="true" />
          </span>
          ride<span>sync</span>
          <small>POC</small>
        </a>
        {session && !recovery && (
          <nav aria-label="Navegação principal">
            <button
              className={page === "trips" ? "nav-active" : ""}
              onClick={() => setPage("trips")}
            >
              <Map size={18} />
              Viagens
            </button>
            <button
              className={page === "garage" ? "nav-active" : ""}
              onClick={() => setPage("garage")}
            >
              <Bike size={18} />
              Garagem
            </button>
            <button
              className={page === "profile" ? "nav-active" : ""}
              onClick={() => setPage("profile")}
            >
              <UserRound size={18} />
              Perfil
            </button>
            <button aria-label="Terminar sessão" onClick={() => void logout()}>
              <LogOut size={18} />
              <span className="logout-label">Sair</span>
            </button>
          </nav>
        )}
        {!session && (
          <span className="header-note">
            BONS CAMINHOS, EM BOA COMPANHIA <ArrowUpRight size={15} />
          </span>
        )}
      </header>
      <main>
        {invitation && !loading && !recovery && supabase && (
          <Invitation
            key={`${session?.user.id ?? "anonymous"}-${invitation}`}
            token={invitation}
            signedIn={Boolean(session)}
            onClose={closeInvitation}
            onAccepted={(tripId) => {
              closeInvitation();
              setAcceptedTrip(tripId);
              setPage("trips");
              void cache.invalidateQueries({
                queryKey: ["trips", session?.user.id],
              });
            }}
          />
        )}
        {authError && (
          <p className="error" role="alert">
            Não foi possível atualizar a sessão. Tenta novamente ou recarrega a
            página.
          </p>
        )}
        {!supabase ? (
          <section className="setup panel">
            <span className="eyebrow">RIDESYNC · PRIMEIRO ARRANQUE</span>
            <h1>A estrada começa aqui.</h1>
            <p>A ligação ao Supabase ainda não está configurada.</p>
            <p>
              Define <code>VITE_SUPABASE_URL</code> e{" "}
              <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> no ficheiro{" "}
              <code>.env</code> e reinicia o servidor.
            </p>
            <p>Não uses a chave service_role no frontend.</p>
          </section>
        ) : loading ? (
          <p role="status">A verificar sessão…</p>
        ) : !session || recovery ? (
          <Auth recovery={recovery} onRecovered={() => setRecovery(false)} />
        ) : (
          <div key={session.user.id}>
            {page === "garage" ? (
              <Garage userId={session.user.id} />
            ) : page === "trips" ? (
              <Trips
                key={acceptedTrip ?? "list"}
                userId={session.user.id}
                initialTripId={acceptedTrip}
              />
            ) : (
              <Profile userId={session.user.id} />
            )}
          </div>
        )}
      </main>
      <UpdateNotice />
      <footer>
        <span>RideSync © {new Date().getFullYear()}</span>
        <span>Planeia parado. Aproveita o caminho.</span>
      </footer>
    </>
  );
}
