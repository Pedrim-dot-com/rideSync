import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fingerprint } from "lucide-react";
import {
  listPasskeys,
  passkeyError,
  registerPasskey,
  removePasskey,
  supportsPasskeys,
} from "./passkeys";
export function PasskeySettings({ userId }: { userId: string }) {
  const cache = useQueryClient();
  const [supported] = useState(supportsPasskeys);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const ceremony = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      ceremony.current?.abort();
    };
  }, []);
  const key = ["passkeys", userId];
  const query = useQuery({
    queryKey: key,
    queryFn: listPasskeys,
    retry: false,
  });
  async function create() {
    if (busy || ceremony.current) return;
    setBusy(true);
    setCreating(true);
    setMessage("");
    setError("");
    const abort = new AbortController();
    ceremony.current = abort;
    try {
      await registerPasskey(abort.signal);
      if (mounted.current && !abort.signal.aborted) {
        setMessage(
          "Chave de acesso criada. Na próxima entrada, escolhe Entrar com passkey.",
        );
        await cache.invalidateQueries({ queryKey: key });
      }
    } catch (e) {
      if (mounted.current && !abort.signal.aborted) setError(passkeyError(e));
    } finally {
      if (mounted.current) {
        setBusy(false);
        setCreating(false);
      }
      ceremony.current = null;
    }
  }
  async function remove() {
    if (!deleting || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await removePasskey(deleting);
      if (mounted.current) {
        setDeleting(null);
        setMessage(
          "Chave de acesso removida. O acesso por email e password continua disponível.",
        );
        await cache.invalidateQueries({ queryKey: key });
      }
    } catch (e) {
      if (mounted.current) setError(passkeyError(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section
      className="panel passkey-settings"
      aria-labelledby="passkeys-title"
    >
      <span className="eyebrow">ACESSO / SEGURANÇA</span>
      <h2 id="passkeys-title">Entrar com Face ID ou biometria</h2>
      <p>
        Cria uma chave de acesso (passkey). Depois, entra com Face ID, impressão
        digital ou o código do dispositivo, conforme o equipamento.
      </p>
      <p className="note">
        A biometria fica no teu dispositivo. O RideSync não recebe a tua imagem,
        impressão digital ou código. Mantém o acesso ao email para recuperar a
        conta.
      </p>
      {!supported && (
        <p>
          Este navegador não disponibiliza chaves de acesso. Experimenta no
          Safari do iPhone ou num navegador atualizado; podes continuar com
          email e password.
        </p>
      )}
      {query.isPending && <p role="status">A carregar chaves de acesso…</p>}
      {query.isError && (
        <div role="alert">
          <p>{passkeyError(query.error)}</p>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </button>
        </div>
      )}
      {supported && !query.isError && (
        <button
          disabled={busy || query.isPending}
          onClick={() => void create()}
        >
          <Fingerprint size={18} />
          {creating ? "A aguardar o dispositivo…" : "Ativar chave de acesso"}
        </button>
      )}
      {creating && (
        <button
          className="text-button"
          onClick={() => {
            ceremony.current?.abort();
          }}
        >
          Cancelar pedido
        </button>
      )}
      {query.data?.length === 0 && (
        <p>
          Ainda não tens chaves de acesso. Adiciona uma neste dispositivo para
          entrares sem escrever a password.
        </p>
      )}
      <ul className="passkey-list">
        {query.data?.map((item, index) => (
          <li key={item.id}>
            <div>
              <strong>
                {item.friendly_name || `Chave de acesso ${index + 1}`}
              </strong>
              <small>
                Criada em{" "}
                {new Date(item.created_at).toLocaleDateString("pt-PT")}
              </small>
            </div>
            <button
              className="text-button danger-text"
              disabled={busy}
              onClick={() => setDeleting(item.id)}
              aria-label={`Remover chave de acesso ${index + 1}`}
            >
              Remover
            </button>
          </li>
        ))}
      </ul>
      {message && (
        <p role="status" className="success">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {deleting && (
        <div role="alertdialog" aria-labelledby="remove-passkey-title">
          <h3 id="remove-passkey-title">Remover esta chave de acesso?</h3>
          <p>
            Deixará de permitir entrar no RideSync. Isto não apaga o Face ID do
            dispositivo. Podes continuar a entrar com email e password.
          </p>
          <div className="actions">
            <button disabled={busy} onClick={() => void remove()}>
              Confirmar remoção da chave
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Manter chave
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
