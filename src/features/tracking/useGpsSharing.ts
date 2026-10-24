import { useEffect, useState } from "react";
import { publishLocation, startSharing, stopSharing } from "./api";
import { trackingError } from "./types";
// A watcher exists only while consent, visibility, connectivity and session agree.
export function useGpsSharing(
  sessionId: string | undefined,
  active: boolean,
  changed: () => void,
) {
  const [consent, setConsent] = useState(false);
  const [visible, setVisible] = useState(
    () => document.visibilityState === "visible",
  );
  const [online, setOnline] = useState(() => navigator.onLine);
  const [status, setStatus] = useState("");
  useEffect(() => {
    const visibility = () => setVisible(document.visibilityState === "visible");
    const network = () => setOnline(navigator.onLine);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
    };
  }, []);
  useEffect(() => {
    if (!consent || !active || !sessionId || !visible || !online) return;
    let disposed = false;
    let watch: number | undefined;
    let shareId: string | undefined;
    let lastSent = -Infinity;
    let inFlight = false;
    const stop = async () => {
      if (watch !== undefined) navigator.geolocation.clearWatch(watch);
      if (shareId) {
        try {
          await stopSharing(sessionId, shareId);
          changed();
        } catch {
          /* Lease expiry hides an offline client's last position. */
        }
      }
    };
    void startSharing(sessionId)
      .then(async (id) => {
        shareId = id;
        if (disposed) {
          await stop();
          return;
        }
        setStatus("A obter uma posição GPS…");
        watch = navigator.geolocation.watchPosition(
          (position) => {
            if (
              disposed ||
              document.visibilityState !== "visible" ||
              !navigator.onLine ||
              inFlight ||
              performance.now() - lastSent < 5500
            )
              return;
            inFlight = true;
            lastSent = performance.now();
            void publishLocation(sessionId, id, position)
              .then(() => {
                if (!disposed) {
                  setStatus("Localização a ser partilhada.");
                  changed();
                }
              })
              .catch((error) => {
                if (!disposed) {
                  const message = (error as { message?: string })?.message;
                  if (message === "LOCATION_RATE_LIMITED") return;
                  setStatus(trackingError(error));
                  if (message === "SHARING_STOPPED") setConsent(false);
                }
              })
              .finally(() => {
                inFlight = false;
              });
          },
          (error) => {
            if (disposed) return;
            setStatus(
              error.code === 1
                ? "Permissão GPS recusada. Podes continuar a viagem sem partilhar a posição."
                : error.code === 3
                  ? "O GPS demorou a responder. Confirma o sinal e tenta novamente."
                  : "Não foi possível obter a tua posição. Tenta novamente num local com melhor sinal.",
            );
            setConsent(false);
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
        );
      })
      .catch((error) => {
        if (!disposed) {
          setStatus(trackingError(error));
          setConsent(false);
        }
      });
    return () => {
      disposed = true;
      void stop();
    };
  }, [sessionId, active, consent, visible, online, changed]);
  return {
    consent,
    online,
    visible,
    status,
    sharing: consent && active && visible && online,
    toggle: () => {
      if (!navigator.geolocation) {
        setStatus("Este dispositivo não disponibiliza GPS.");
        return;
      }
      setStatus(consent ? "" : "A pedir acesso ao GPS…");
      setConsent((v) => !v);
    },
  };
}
