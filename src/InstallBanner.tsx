import { useEffect, useState } from "react";
import { Download, Share, Smartphone, X } from "lucide-react";
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
const preferenceKey = "ridesync-install-hint-dismissed";
function isInstalled() {
  return Boolean(
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone,
  );
}
function platform() {
  if (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
    return "ios";
  return /Android/i.test(navigator.userAgent) ? "android" : "other";
}
function recentlyDismissed() {
  try {
    const saved = Number(localStorage.getItem(preferenceKey));
    return saved > 0 && Date.now() - saved < 7 * 86400000;
  } catch {
    return false;
  }
}
// Mounted by App before login so Chrome's one-shot install event is retained.
export function InstallBanner({ show }: { show: boolean }) {
  const [installed, setInstalled] = useState(isInstalled);
  const [dismissed, setDismissed] = useState(recentlyDismissed);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [device] = useState(platform);
  useEffect(() => {
    const media = window.matchMedia?.("(display-mode: standalone)");
    const update = () => setInstalled(isInstalled());
    const onInstalled = () => setInstalled(true);
    const capture = (event: Event) => {
      if (typeof (event as InstallPrompt).prompt !== "function") return;
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    media?.addEventListener?.("change", update);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      media?.removeEventListener?.("change", update);
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  async function install() {
    if (!prompt || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setMessage(
        choice.outcome === "accepted"
          ? "Segue as indicações do navegador para concluir a instalação."
          : "Podes instalar mais tarde. As instruções continuam disponíveis.",
      );
    } catch {
      setMessage(
        "Não foi possível abrir a instalação. Usa as instruções abaixo.",
      );
      setExpanded(true);
    } finally {
      setPrompt(null);
      setBusy(false);
    }
  }
  if (!show || installed || dismissed || (device === "other" && !prompt))
    return null;
  return (
    <aside className="install-banner" aria-labelledby="install-title">
      <Smartphone className="install-icon" size={28} aria-hidden="true" />
      <div className="install-copy">
        <h2 id="install-title">Leva o RideSync no bolso</h2>
        <p>Adiciona ao ecrã principal e abre como uma app.</p>
      </div>
      <div className="install-actions">
        {prompt && (
          <button disabled={busy} onClick={() => void install()}>
            <Download size={16} />
            {busy ? "A abrir…" : "Instalar app"}
          </button>
        )}
        <button
          className="secondary"
          aria-expanded={expanded}
          aria-controls="install-instructions"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Fechar instruções" : "Como instalar"}
        </button>
      </div>
      <button
        className="icon-button install-dismiss"
        aria-label="Dispensar dica de instalação"
        disabled={busy}
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(preferenceKey, String(Date.now()));
          } catch {
            /* Keep dismiss working with storage blocked. */
          }
        }}
      >
        <X size={18} />
      </button>
      {expanded && (
        <div className="install-instructions" id="install-instructions">
          {device === "ios" ? (
            <>
              <h3>No iPhone ou iPad</h3>
              <ol>
                <li>
                  Abre este site no <strong>Safari</strong>.
                </li>
                <li>
                  Toca em <strong>Partilhar</strong>{" "}
                  <Share size={15} aria-hidden="true" /> e escolhe{" "}
                  <strong>Adicionar ao ecrã principal</strong>. Se necessário,
                  abre Mais para encontrar a opção.
                </li>
                <li>
                  Confirma em <strong>Adicionar</strong>. O ícone RideSync fica
                  no ecrã principal.
                </li>
              </ol>
            </>
          ) : (
            <>
              <h3>{device === "android" ? "No Android" : "No navegador"}</h3>
              <ol>
                <li>
                  Abre este site no <strong>Chrome</strong> ou num navegador que
                  permita instalar apps.
                </li>
                <li>
                  Abre o menu <strong>⋮</strong> e escolhe{" "}
                  <strong>Instalar aplicação</strong> ou{" "}
                  <strong>Adicionar ao ecrã principal</strong>.
                </li>
                <li>Confirma a instalação e abre pelo ícone RideSync.</li>
              </ol>
            </>
          )}
          <p>
            Se a opção não aparecer, abre o site diretamente no navegador, fora
            do Instagram, Facebook ou de outra aplicação.
          </p>
        </div>
      )}
      {message && (
        <p className="install-message" role="status">
          {message}
        </p>
      )}
    </aside>
  );
}
