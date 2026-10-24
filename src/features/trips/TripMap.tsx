import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { geometrySchema, mapTiler } from "../../shared/maps/providers";
import { positionAge, type RiderPosition } from "../tracking/types";
import type { TripDetail } from "./api";
export default function TripMap({
  waypoints,
  route,
  positions = [],
  userId,
  now = 0,
}: {
  waypoints: TripDetail["waypoints"];
  route: TripDetail["route"];
  positions?: RiderPosition[];
  userId?: string;
  now?: number;
}) {
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [follow, setFollow] = useState(true);
  const riders = useRef(new Map<string, maplibregl.Marker>());
  const style = mapTiler.getStyleUrl();
  const attachMap = useCallback(
    (container: HTMLDivElement | null) => {
      if (!container || !style) return;
      setError(false);
      setReady(false);
      setLoaded(false);
      maplibregl.setWorkerUrl(workerUrl);
      let instance: maplibregl.Map | undefined;
      try {
        instance = new maplibregl.Map({
          container,
          style,
          center: [-8, 40],
          zoom: 6,
          attributionControl: { compact: false },
        });
        instance.addControl(new maplibregl.NavigationControl(), "top-right");
        instance.on("error", () => setError(true));
        instance.on("idle", () => setReady(true));
        instance.on("load", () => setLoaded(true));
        instance.on("dragstart", () => setFollow(false));
        setMap(instance);
      } catch {
        setError(true);
      }
      return () => {
        instance?.remove();
        setMap(null);
      };
    },
    [style],
  );
  // Geometry changes may re-fit the itinerary. GPS ticks never recreate the map.
  useEffect(() => {
    if (!map || !loaded) return;
    const pins: maplibregl.Marker[] = [];
    const bounds = new maplibregl.LngLatBounds();
    waypoints.forEach((point, index) => {
      const element = document.createElement("span");
      element.className = "map-pin";
      element.textContent = String(index + 1);
      pins.push(
        new maplibregl.Marker({ element })
          .setLngLat([point.longitude, point.latitude])
          .setPopup(new maplibregl.Popup({ offset: 20 }).setText(point.label))
          .addTo(map),
      );
      bounds.extend([point.longitude, point.latitude]);
    });
    const parsed = route ? geometrySchema.safeParse(route.geometry) : null;
    if (parsed?.success) {
      map.addSource("trip-route", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: parsed.data },
      });
      map.addLayer({
        id: "trip-route",
        type: "line",
        source: "trip-route",
        paint: { "line-color": "#e85d04", "line-width": 5 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      parsed.data.coordinates.forEach((point) => bounds.extend(point));
    }
    if (!bounds.isEmpty())
      map.fitBounds(bounds, { padding: 50, maxZoom: 13, duration: 0 });
    return () => {
      pins.forEach((p) => p.remove());
      if (map.getLayer("trip-route")) map.removeLayer("trip-route");
      if (map.getSource("trip-route")) map.removeSource("trip-route");
    };
  }, [map, loaded, waypoints, route]);
  useEffect(() => {
    if (!map || !loaded) return;
    const markers = riders.current;
    const present = new Set(positions.map((p) => p.user_id));
    for (const [id, marker] of markers)
      if (!present.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    for (const position of positions) {
      let marker = markers.get(position.user_id);
      if (!marker) {
        const element = document.createElement("span");
        marker = new maplibregl.Marker({ element })
          .setLngLat([position.longitude, position.latitude])
          .addTo(map);
        markers.set(position.user_id, marker);
      }
      const own = position.user_id === userId;
      const stale = positionAge(position, now) >= 30;
      const name = own ? "Tu" : position.display_name || "Motard";
      const element = marker.getElement();
      element.classList.add("gps-pin");
      element.classList.toggle("gps-own", own);
      element.classList.toggle("gps-stale", stale);
      element.textContent = name;
      element.setAttribute(
        "aria-label",
        `${name}${stale ? " — posição antiga" : ""}`,
      );
      marker.setLngLat([position.longitude, position.latitude]);
      marker.setPopup(
        new maplibregl.Popup({ offset: 20 }).setText(
          `${name} · ${positionAge(position, now)} s · precisão ±${Math.ceil(position.accuracy_m)} m`,
        ),
      );
    }
  }, [map, loaded, positions, userId, now]);
  useEffect(
    () => () => {
      for (const marker of riders.current.values()) marker.remove();
      riders.current.clear();
    },
    [],
  );
  const own = positions.find((p) => p.user_id === userId);
  const freshOwn = own && positionAge(own, now) < 30 ? own : undefined;
  useEffect(() => {
    if (!map || !loaded || !follow || !freshOwn) return;
    map.easeTo({
      center: [freshOwn.longitude, freshOwn.latitude],
      zoom: Math.max(map.getZoom(), 15),
      duration: 500,
      ...(freshOwn.heading === null ? {} : { bearing: freshOwn.heading }),
    });
  }, [map, loaded, follow, freshOwn]);
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
      {positions.length > 0 && (
        <button
          className="secondary follow-position"
          aria-pressed={Boolean(follow && freshOwn)}
          disabled={!freshOwn}
          onClick={() => setFollow((v) => !v)}
        >
          {follow ? "A seguir a minha posição" : "Seguir a minha posição"}
        </button>
      )}
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
          : "Pontos do itinerário. O percurso ainda não foi calculado."}{" "}
        {positions.length > 0
          ? "Marcadores GPS com precisão variável; posições antigas a cinzento."
          : ""}
      </p>
    </section>
  );
}
