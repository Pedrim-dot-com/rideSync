import { ArrowUpRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import { client } from "../shared/supabase";
export function Auth({
  recovery = false,
  onRecovered,
}: {
  recovery?: boolean;
  onRecovered: () => void;
}) {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const email = String(form.get("email"));
      const password = String(form.get("password"));
      const auth = client().auth;
      const result = recovery
        ? await auth.updateUser({ password })
        : mode === "login"
          ? await auth.signInWithPassword({ email, password })
          : mode === "signup"
            ? await auth.signUp({
                email,
                password,
                options: { emailRedirectTo: window.location.origin },
              })
            : await auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin,
              });
      if (result.error) throw result.error;
      if (recovery) {
        setMessage("Password atualizada.");
        onRecovered();
      } else if (mode === "signup")
        setMessage(
          "Se o registo for aceite, receberás um email de confirmação.",
        );
      else if (mode === "reset")
        setMessage("Se existir uma conta, receberás um email de recuperação.");
    } catch {
      setMessage(
        "Não foi possível concluir. Verifica os dados e tenta novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="auth-layout">
      <div className="auth-hero">
        <span className="eyebrow">RIDESYNC / VAI MAIS LONGE</span>
        <h1>
          O próximo
          <br />
          caminho
          <br />
          <em>é teu.</em>
        </h1>
        <p>Planeia a viagem. Junta o grupo. Vive o percurso.</p>
        <div className="route-art" aria-hidden="true">
          <ArrowUpRight size={76} strokeWidth={1} />
          <span>DUAS RODAS. O MESMO CAMINHO.</span>
        </div>
      </div>
      <form className="panel" onSubmit={submit}>
        <h2>
          {recovery
            ? "Nova password"
            : mode === "login"
              ? "Bem-vindo de volta"
              : mode === "signup"
                ? "Cria a tua conta"
                : "Recuperar acesso"}
        </h2>
        <p>
          {recovery
            ? "Escolhe uma password segura."
            : "As tuas viagens e o teu grupo, no mesmo lugar."}
        </p>
        {!recovery && (
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>
        )}
        {(recovery || mode !== "reset") && (
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={
                mode === "login" && !recovery
                  ? "current-password"
                  : "new-password"
              }
              minLength={8}
              required
            />
          </label>
        )}
        <button disabled={busy}>
          {busy
            ? "A processar…"
            : recovery
              ? "Guardar password"
              : mode === "login"
                ? "Entrar"
                : mode === "signup"
                  ? "Criar conta"
                  : "Enviar email"}
        </button>
        {message && <p role="status">{message}</p>}
        {!recovery && (
          <div className="auth-actions">
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setMode(mode === "signup" ? "login" : "signup");
                setMessage("");
              }}
            >
              {mode === "signup" ? "Já tenho conta" : "Criar conta"}
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setMode("reset");
                setMessage("");
              }}
            >
              Esqueci-me da password
            </button>
          </div>
        )}
      </form>
    </section>
  );
}
