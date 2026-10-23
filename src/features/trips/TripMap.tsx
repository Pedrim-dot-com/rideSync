import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { useCallback, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { geometrySchema, mapTiler } from "../../shared/maps/providers";
import type { TripDetail } from "./api";
export default function TripMap({
  waypoints,
  route,
}: {
  waypoints: TripDetail["waypoints"];
  route: TripDetail["route"];
}) {
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const style = mapTiler.getStyleUrl();
  const attachMap = useCallback(
    (container: HTMLDivElement | null) => {
      if (!container || !style || !waypoints.length) return;
      setError(false);
      setReady(false);
      maplibregl.setWorkerUrl(workerUrl);
      let map: maplibregl.Map | undefined;
      const pins: maplibregl.Marker[] = [];
      try {
        map = new maplibregl.Map({
          container,
          style,
          center: [waypoints[0].longitude, waypoints[0].latitude],
          zoom: 9,
          attributionControl: { compact: false },
        });
        map.addControl(new maplibregl.NavigationControl(), "top-right");
        map.on("error", () => setError(true));
        map.on("idle", () => setReady(true));
        map.on("load", () => {
          if (!map) return;
          const bounds = new maplibregl.LngLatBounds();
          waypoints.forEach((point, index) => {
            const element = document.createElement("span");
            element.className = "map-pin";
            element.textContent = String(index + 1);
            pins.push(
              new maplibregl.Marker({ element })
                .setLngLat([point.longitude, point.latitude])
                .setPopup(
                  new maplibregl.Popup({ offset: 20 }).setText(point.label),
                )
                .addTo(map!),
            );
            bounds.extend([point.longitude, point.latitude]);
          });
          if (route) {
            const parsed = geometrySchema.safeParse(route.geometry);
            if (parsed.success) {
              map.addSource("trip-route", {
                type: "geojson",
                data: {
                  type: "Feature",
                  properties: {},
                  geometry: parsed.data,
                },
              });
              map.addLayer({
                id: "trip-route",
                type: "line",
                source: "trip-route",
                paint: { "line-color": "#1c6551", "line-width": 5 },
                layout: { "line-cap": "round", "line-join": "round" },
              });
              parsed.data.coordinates.forEach((point) => bounds.extend(point));
            } else setError(true);
          }
          if (!bounds.isEmpty())
            map.fitBounds(bounds, { padding: 50, maxZoom: 13, duration: 0 });
        });
      } catch {
        setError(true);
      }
      return () => {
        pins.forEach((pin) => pin.remove());
        map?.remove();
      };
    },
    [style, waypoints, route],
  );
  if (!style)
    return (
      <div className="map-unavailable">
        <p>Mapa indisponível. Podes consultar o itinerário abaixo.</p>
      </div>
    );
  return (
    <section
      aria-label="Mapa do itinerário"
      className="trip-map-wrap"
      aria-busy={!ready && !error}
      data-map-ready={ready && !error}
    >
      <div ref={attachMap} className="trip-map" />
      {!ready && !error && (
        <p role="status" className="map-caption">
          A carregar mapa…
        </p>
      )}
      {error && (
        <p role="status" className="map-notice">
          Não foi possível carregar todo o mapa. O itinerário continua
          disponível abaixo.
        </p>
      )}
      <p className="map-caption">
        {route
          ? "Percurso calculado por openrouteservice."
          : "Pontos do itinerário. O percurso ainda não foi calculado."}
      </p>
    </section>
  );
}
