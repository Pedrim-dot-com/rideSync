import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { participationError } from "./participation-api";
import {
  rememberTripInvitation,
  respondReceivedInvitation,
} from "./notifications-api";
import { clearPendingInvitation } from "./invitation-link";
export function Invitation({
  token,
  signedIn,
  userId,
  hidden = false,
  onRemembered,
  onClose,
  onAccepted,
}: {
  token: string;
  signedIn: boolean;
  userId?: string;
  hidden?: boolean;
  onRemembered?: () => void;
  onClose: (saved: boolean) => void;
  onAccepted: (tripId: string) => void;
}) {
  const cache = useQueryClient();
  const notified = useRef<string | null>(null);
  const receipt = useQuery({
    queryKey: ["invitation-receipt", userId, token],
    queryFn: () => rememberTripInvitation(token),
    enabled: signedIn && Boolean(userId),
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
  useEffect(() => {
    if (receipt.data && notified.current !== receipt.data) {
      notified.current = receipt.data;
      clearPendingInvitation(token);
      void cache.invalidateQueries({ queryKey: ["notifications", userId] });
      onRemembered?.();
    }
  }, [receipt.data, token, userId, cache, onRemembered]);
  const mutation = useMutation({
    mutationFn: (accept: boolean) =>
      respondReceivedInvitation(receipt.data!, accept),
    onSuccess: (tripId) => {
      void cache.invalidateQueries({ queryKey: ["notifications", userId] });
      if (tripId) onAccepted(tripId);
      else onClose(true);
    },
  });
  if (hidden && (!signedIn || receipt.isSuccess)) return null;
  return (
    <section
      className="panel invitation-panel"
      aria-labelledby="invitation-title"
    >
      <span className="eyebrow">VAMOS JUNTOS</span>
      <h1 id="invitation-title">
        {hidden ? "Guardar convite" : "Recebeste um convite"}
      </h1>
      {!hidden && (
        <p>
          O link é de uso único e expira em 48 horas. Só terás acesso à viagem
          depois de aceitar.
        </p>
      )}
      {!signedIn ? (
        <p>
          Inicia sessão ou cria conta abaixo. O convite será guardado nas
          notificações para responderes mais tarde. Se confirmares o email
          noutro dispositivo, volta a abrir o link original.
        </p>
      ) : (
        <>
          {receipt.isFetching && !receipt.data && (
            <p role="status">A guardar o convite nas notificações…</p>
          )}
          {receipt.isError && (
            <div role="alert">
              <p className="error">
                Não foi possível guardar o convite.{" "}
                {participationError(receipt.error)}
              </p>
              <button
                className="secondary"
                onClick={() => void receipt.refetch()}
              >
                Tentar guardar novamente
              </button>
            </div>
          )}
          {!hidden && (
            <>
              {receipt.data && (
                <p role="status">
                  Guardado em Notificações. Podes responder agora ou mais tarde,
                  até expirar.
                </p>
              )}
              <p>
                Ao aceitar, os participantes poderão ver o teu nome, nickname e
                a mota que escolheres para esta viagem.
              </p>
              <div className="actions">
                <button
                  disabled={!receipt.data || mutation.isPending}
                  onClick={() => mutation.mutate(true)}
                >
                  Aceitar convite
                </button>
                <button
                  className="secondary"
                  disabled={!receipt.data || mutation.isPending}
                  onClick={() => mutation.mutate(false)}
                >
                  Recusar convite
                </button>
              </div>
            </>
          )}
        </>
      )}
      {mutation.isPending && <p role="status">A responder ao convite…</p>}
      {mutation.isError && (
        <p role="alert" className="error">
          {participationError(mutation.error)}
        </p>
      )}
      {!hidden && (
        <button
          className="text-button"
          disabled={mutation.isPending}
          onClick={() => onClose(Boolean(receipt.data))}
        >
          Fechar convite
        </button>
      )}
    </section>
  );
}
