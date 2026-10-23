import { useMutation } from "@tanstack/react-query";
import { participationError, respondTripInvitation } from "./participation-api";
export function Invitation({
  token,
  signedIn,
  onClose,
  onAccepted,
}: {
  token: string;
  signedIn: boolean;
  onClose: () => void;
  onAccepted: (tripId: string) => void;
}) {
  const mutation = useMutation({
    mutationFn: (accept: boolean) => respondTripInvitation(token, accept),
    onSuccess: (tripId) => {
      if (tripId) onAccepted(tripId);
      else onClose();
    },
  });
  return (
    <section
      className="panel invitation-panel"
      aria-labelledby="invitation-title"
    >
      <span className="eyebrow">VAMOS JUNTOS</span>
      <h1 id="invitation-title">Recebeste um convite</h1>
      <p>
        O link é de uso único e expira em 48 horas. Só terás acesso à viagem
        depois de aceitar.
      </p>
      {!signedIn ? (
        <p>
          Inicia sessão ou cria conta abaixo para responder. Se o convite não
          aparecer após confirmares o email, volta a abrir o link original.
        </p>
      ) : (
        <>
          <p>
            Ao aceitar, os participantes poderão ver o teu nome, nickname e a
            mota que escolheres para esta viagem.
          </p>
          <div className="actions">
            <button
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(true)}
            >
              Aceitar convite
            </button>
            <button
              className="secondary"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(false)}
            >
              Recusar convite
            </button>
          </div>
        </>
      )}
      {mutation.isPending && <p role="status">A responder ao convite…</p>}
      {mutation.isError && (
        <p role="alert" className="error">
          {participationError(mutation.error)}
        </p>
      )}
      <button
        className="text-button"
        disabled={mutation.isPending}
        onClick={onClose}
      >
        Fechar convite
      </button>
    </section>
  );
}
