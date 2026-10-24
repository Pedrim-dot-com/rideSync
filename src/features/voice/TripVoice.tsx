import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mic, Radio, Siren } from "lucide-react";
import { client } from "../../shared/supabase";
import { RadioConnection, type RadioStatus } from "./RadioConnection";
import {
  getVoiceSnapshot,
  raiseSos,
  resolveSos,
  sosLabels,
  voiceAction,
  voiceError,
  type SosReason,
} from "./api";
export function TripVoice({
  tripId,
  userId,
  owner,
  active,
}: {
  tripId: string;
  userId: string;
  owner: boolean;
  active: boolean;
}) {
  const cache = useQueryClient();
  const [status, setStatus] = useState<RadioStatus>("off");
  const [mediaError, setMediaError] = useState<unknown>(null);
  const [reason, setReason] = useState<SosReason>("other");
  const [message, setMessage] = useState("");
  const intentVersion = useRef(0);
  const cancelPending = useCallback(() => {
    intentVersion.current += 1;
  }, []);
  const panel = useRef<HTMLElement>(null);
  const audio = useRef<HTMLDivElement>(null);
  const connection = useRef<RadioConnection | null>(null);
  const listening = [
    "connecting",
    "listening",
    "speaking",
    "audio-blocked",
  ].includes(status);
  const query = useQuery({
    queryKey: ["voice", userId, tripId],
    queryFn: () => getVoiceSnapshot(tripId),
    enabled: active,
    refetchInterval: listening ? 5000 : 15000,
    retry: false,
  });
  useEffect(() => {
    const instance = new RadioConnection(
      tripId,
      userId,
      audio.current!,
      (next, error) => {
        setStatus(next);
        if (error) setMediaError(error);
      },
    );
    connection.current = instance;
    return () => {
      cancelPending();
      const wasEnabled = instance.enabled;
      instance.close();
      if (wasEnabled) void voiceAction(tripId, "leave").catch(() => {});
      connection.current = null;
    };
  }, [tripId, userId, cancelPending]);
  useEffect(() => {
    if (query.data && query.isSuccess) connection.current?.update(query.data);
    if (query.isError) connection.current?.close();
  }, [query.data, query.dataUpdatedAt, query.isSuccess, query.isError]);
  useEffect(() => {
    if (!active) {
      cancelPending();
      connection.current?.close();
    }
  }, [active, cancelPending]);
  useEffect(() => {
    if (!active) return;
    const tripChannel = client()
      .channel(`voice:${tripId}`, { config: { private: true } })
      .on(
        "broadcast",
        { event: "voice_changed" },
        () =>
          void cache.invalidateQueries({ queryKey: ["voice", userId, tripId] }),
      )
      .subscribe();
    return () => {
      void client().removeChannel(tripChannel);
    };
  }, [active, cache, tripId, userId]);
  useEffect(() => {
    const stop = (event: Event) => {
      if (
        event.type === "pagehide" ||
        document.visibilityState !== "visible" ||
        !navigator.onLine
      ) {
        cancelPending();
        connection.current?.close();
        void voiceAction(tripId, "leave").catch(() => {});
      }
    };
    const timer = setInterval(() => connection.current?.checkFreshness(), 2000);
    document.addEventListener("visibilitychange", stop);
    window.addEventListener("offline", stop);
    window.addEventListener("pagehide", stop);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", stop);
      window.removeEventListener("offline", stop);
      window.removeEventListener("pagehide", stop);
    };
  }, [tripId, cancelPending]);
  const refetchVoice = query.refetch;
  useEffect(() => {
    if (!listening) return;
    const timer = setInterval(() => {
      void voiceAction(tripId, "heartbeat")
        .then(() => refetchVoice())
        .catch((error) => {
          if (error instanceof Error && error.message === "VOICE_BUSY") {
            void refetchVoice();
            return;
          }
          connection.current?.close();
          setMediaError(error);
          setStatus("error");
        });
    }, 15000);
    return () => clearInterval(timer);
  }, [listening, tripId, refetchVoice]);
  const mutation = useMutation({
    mutationFn: async (
      action: "listen" | "speak" | "sos" | "stop" | "resolve",
    ) => {
      setMediaError(null);
      setMessage("");
      const radio = connection.current;
      if (!radio) throw new Error("Radio unavailable");
      const intent = ++intentVersion.current;
      const assertCurrent = () => {
        if (
          intent !== intentVersion.current ||
          document.visibilityState !== "visible" ||
          !navigator.onLine
        )
          throw new DOMException("Voice request cancelled", "AbortError");
      };
      if (action === "resolve") {
        radio.cancelMicrophone();
        await resolveSos(tripId);
        setMessage("SOS resolvido. O organizador pode voltar a falar.");
      } else if (action === "stop") {
        radio.close();
        await voiceAction(tripId, "leave");
      } else if (action === "listen") {
        const fresh = await query.refetch();
        if (!fresh.data || fresh.isError)
          throw new Error("Snapshot unavailable");
        assertCurrent();
        await radio.enable(fresh.data);
      } else {
        if (action === "sos") {
          await raiseSos(tripId, reason);
          await query.refetch();
          setMessage("SOS enviado ao grupo. A preparar o microfone…");
        }
        try {
          assertCurrent();
          await radio.prepareMicrophone();
          assertCurrent();
          await voiceAction(tripId, action);
          assertCurrent();
          const fresh = await query.refetch();
          if (!fresh.data || fresh.isError)
            throw new Error("Snapshot unavailable");
          assertCurrent();
          if (!radio.enabled) await radio.enable(fresh.data);
          else radio.update(fresh.data);
          radio.completeIntent();
          if (action === "sos")
            setMessage(
              "SOS enviado. Tens prioridade para falar enquanto o alerta estiver ativo.",
            );
        } catch (error) {
          radio.cancelMicrophone();
          if (error instanceof DOMException && error.name === "AbortError")
            void voiceAction(tripId, "leave").catch(() => {});
          if (action === "sos")
            setMessage(
              "SOS visual enviado ao grupo. Não foi possível ativar a voz.",
            );
          throw error;
        }
      }
      await cache.invalidateQueries({ queryKey: ["voice", userId, tripId] });
    },
  });
  const sos = query.data?.sos;
  const ownSos = sos?.user_id === userId;
  return (
    <section ref={panel} className="panel voice-panel">
      <span className="eyebrow">
        <Radio size={16} /> RÁDIO DA VIAGEM
      </span>
      <h2>Voz e SOS</h2>
      <p>
        O organizador fala para o grupo. Um SOS interrompe-o e dá prioridade ao
        participante que precisa de ajuda.
      </p>
      <p className="muted">
        Até 16 pessoas no canal. Requer internet, app visível e som ativado. O
        microfone só é pedido ao falar. Não grava áudio. Usa os controlos apenas
        quando estiveres parado em segurança.
      </p>
      {!active ? (
        <p>O canal e o SOS ficam disponíveis durante a viagem.</p>
      ) : (
        <>
          {query.isPending && <p role="status">A verificar o canal…</p>}
          {query.isError && (
            <div role="alert">
              <p className="error">
                Não foi possível atualizar o estado do canal.
              </p>
              <button onClick={() => void query.refetch()}>
                Tentar novamente
              </button>
            </div>
          )}
          {sos && (
            <div className="sos-alert" role="alert">
              <strong>
                <Siren size={20} /> SOS · {sos.display_name || "Participante"}
              </strong>
              <p>{sosLabels[sos.reason]}</p>
              <p>
                A fala do organizador está interrompida. O alerta expira em{" "}
                <time dateTime={sos.expires_at}>
                  {new Date(sos.expires_at).toLocaleTimeString("pt-PT")}
                </time>
                .
              </p>
              {(ownSos || owner) && (
                <button
                  className="secondary"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate("resolve")}
                >
                  Resolver SOS
                </button>
              )}
            </div>
          )}
          <p role="status">
            {status === "speaking"
              ? "Microfone ativo · estás a falar"
              : listening
                ? query.data?.speaker_id
                  ? `${query.data.speaker_name || "Participante"} está a falar.`
                  : "A ouvir · à espera de alguém falar."
                : "Voz desligada neste dispositivo."}
          </p>
          <div className="actions">
            {!listening ? (
              <button
                disabled={mutation.isPending || !query.data}
                onClick={() => mutation.mutate("listen")}
              >
                Ouvir grupo
              </button>
            ) : (
              <button
                className="secondary"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate("stop")}
              >
                Desligar voz
              </button>
            )}
            {owner && (
              <button
                disabled={
                  mutation.isPending ||
                  !query.data ||
                  Boolean(sos) ||
                  status === "speaking"
                }
                onClick={() => mutation.mutate("speak")}
              >
                <Mic size={16} /> Falar para o grupo
              </button>
            )}
            {status === "audio-blocked" && (
              <button onClick={() => void connection.current?.resumeAudio()}>
                Ativar som
              </button>
            )}
          </div>
          {!sos && (
            <label>
              Motivo do SOS
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as SosReason)}
              >
                {Object.entries(sosLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            className="sos-button"
            disabled={
              mutation.isPending ||
              !query.data ||
              Boolean(sos && !ownSos) ||
              (status === "speaking" && ownSos)
            }
            onClick={() => mutation.mutate("sos")}
          >
            <Siren size={22} />{" "}
            {ownSos ? "Falar no meu SOS" : "SOS · preciso de ajuda"}
          </button>
          <p className="muted">
            SOS avisa apenas o grupo ligado à viagem. Não contacta o 112 nem
            garante entrega se não houver rede.
          </p>
        </>
      )}
      {active && (
        <button
          className="trip-sos-shortcut"
          aria-label={sos ? "Ver SOS ativo da viagem" : "SOS rápido da viagem"}
          disabled={mutation.isPending || !query.data}
          onClick={() => {
            if (sos)
              panel.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            else mutation.mutate("sos");
          }}
        >
          <Siren size={22} />
          {sos ? "Ver SOS" : "SOS"}
        </button>
      )}
      <div ref={audio} className="voice-audio" aria-hidden="true" />
      {mutation.isPending && <p role="status">A preparar o canal…</p>}
      {message && <p role="status">{message}</p>}
      {(mutation.isError || Boolean(mediaError)) && (
        <p role="alert" className="error">
          {voiceError(mutation.error ?? mediaError)}
        </p>
      )}
    </section>
  );
}
