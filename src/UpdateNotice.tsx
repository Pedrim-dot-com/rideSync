import { useCallback, useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
export function UpdateNotice() {
  const registration = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const lastCheck = useRef(-Infinity);
  const checkForUpdate = useCallback(() => {
    if (
      document.visibilityState !== "visible" ||
      !navigator.onLine ||
      !registration.current
    )
      return;
    const now = Date.now();
    if (now - lastCheck.current < 60_000) return;
    lastCheck.current = now;
    // Keep the current app usable offline; applying an update always requires a click.
    void registration.current.update().catch(() => {});
  }, []);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_url, worker) => {
      registration.current = worker;
      checkForUpdate();
    },
  });
  useEffect(() => {
    const timer = window.setInterval(checkForUpdate, 60_000);
    document.addEventListener("visibilitychange", checkForUpdate);
    window.addEventListener("focus", checkForUpdate);
    window.addEventListener("online", checkForUpdate);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", checkForUpdate);
      window.removeEventListener("focus", checkForUpdate);
      window.removeEventListener("online", checkForUpdate);
    };
  }, [checkForUpdate]);
  if (!needRefresh) return null;
  return (
    <aside className="update-notice panel" role="status">
      <strong>Há uma nova versão do RideSync.</strong>
      <p>Guarda as alterações antes de atualizar.</p>
      <div className="actions">
        <button onClick={() => void updateServiceWorker(true)}>
          Atualizar
        </button>
        <button className="secondary" onClick={() => setNeedRefresh(false)}>
          Mais tarde
        </button>
      </div>
    </aside>
  );
}
