import { useRegisterSW } from "virtual:pwa-register/react";
export function UpdateNotice() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
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
