import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { useCallback, useEffect, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { mapTiler } from "../../shared/maps/providers";
import type { MotardGroup } from "./api";
export default function GroupMap({
  groups,
  onSelect,
}: {
  groups: MotardGroup[];
  onSelect: (id: string) => void;
}) {
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const style = mapTiler.getStyleUrl();
  const attach = useCallback(
    (container: HTMLDivElement | null) => {
      if (!container || !style) return;
      let instance: maplibregl.Map;
      try {
        maplibregl.setWorkerUrl(workerUrl);
        instance = new maplibregl.Map({
          container,
          style,
          center: [-8, 40],
          zoom: 5,
          attributionControl: { compact: false },
        });
        instance.addControl(new maplibregl.NavigationControl());
        instance.on("load", () => setReady(true));
        instance.on("error", () => setFailed(true));
        setMap(instance);
      } catch {
        setFailed(true);
        return;
      }
      return () => {
        instance.remove();
        setMap(null);
        setReady(false);
      };
    },
    [style],
  );
  useEffect(() => {
    if (!map || !ready) return;
    const bounds = new maplibregl.LngLatBounds();
    const markers = groups.map((group) => {
      const pin = document.createElement("button");
      pin.type = "button";
      pin.className = "group-map-pin";
      pin.textContent = "G";
      pin.setAttribute("aria-label", `Ver grupo ${group.name}`);
      pin.addEventListener("click", () => onSelect(group.id));
      bounds.extend([group.longitude, group.latitude]);
      return new maplibregl.Marker({ element: pin })
        .setLngLat([group.longitude, group.latitude])
        .setPopup(
          new maplibregl.Popup({ offset: 20 }).setText(
            `${group.name} · ${group.headquarters_address}`,
          ),
        )
        .addTo(map);
    });
    if (!bounds.isEmpty())
      map.fitBounds(bounds, { padding: 55, maxZoom: 13, duration: 0 });
    return () => markers.forEach((marker) => marker.remove());
  }, [map, ready, groups, onSelect]);
  if (!style)
    return (
      <p className="error">
        O mapa está indisponível. Podes consultar as sedes na lista de grupos.
      </p>
    );
  return (
    <div>
      {failed && (
        <p role="alert" className="error">
          Não foi possível carregar todo o mapa. A lista mantém as moradas
          disponíveis.
        </p>
      )}
      <div
        className="group-map"
        ref={attach}
        role="region"
        aria-label="Mapa das sedes dos grupos"
        data-map-ready={ready}
      />
      {!ready && !failed && <p role="status">A carregar mapa das sedes…</p>}
    </div>
  );
}
