import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "../../shared/supabase";
import { finishTrip, getTracking, startTrip } from "./api";
import { useGpsSharing } from "./useGpsSharing";
import type { TripRow } from "../../shared/database.types";
export function useTracking(trip: TripRow, userId: string) {
  const cache = useQueryClient();
  const key = ["tracking", userId, trip.id];
  const query = useQuery({
    queryKey: key,
    queryFn: () => getTracking(trip.id),
    refetchInterval: (query) =>
      ["draft", "planned", "active"].includes(
        query.state.data?.status ?? trip.status,
      )
        ? 10000
        : false,
    retry: false,
  });
  const [connection, setConnection] = useState("connecting");
  const changed = useCallback(() => {
    void cache.invalidateQueries({ queryKey: ["tracking", userId, trip.id] });
  }, [cache, trip.id, userId]);
  useEffect(() => {
    const channel = client()
      .channel(`trip:${trip.id}`, { config: { private: true } })
      .on("broadcast", { event: "tracking_changed" }, () => {
        changed();
        void cache.invalidateQueries({ queryKey: ["trip", userId, trip.id] });
        void cache.invalidateQueries({ queryKey: ["trips", userId] });
      })
      .subscribe((status) => {
        setConnection(status === "SUBSCRIBED" ? "connected" : "reconnecting");
        if (status === "SUBSCRIBED") changed();
      });
    return () => {
      void client().removeChannel(channel);
    };
  }, [trip.id, userId, cache, changed]);
  const data = query.data;
  const active = Boolean(
    !query.isError &&
    data?.status === "active" &&
    data.session &&
    !data.session.ended_at,
  );
  const gps = useGpsSharing(data?.session?.id, active, changed);
  const mutation = useMutation({
    mutationFn: async (kind: "start" | "finish") => {
      const revision = Math.max(data?.revision ?? 0, trip.revision);
      if (kind === "start") await startTrip(trip.id, revision);
      else await finishTrip(trip.id, revision);
    },
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: key }),
        cache.invalidateQueries({ queryKey: ["trip", userId, trip.id] }),
        cache.invalidateQueries({ queryKey: ["trips", userId] }),
      ]);
    },
  });
  const [tick, setTick] = useState(() => performance.now());
  useEffect(() => {
    const timer = window.setInterval(() => setTick(performance.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const now = data
    ? Date.parse(data.server_now) + Math.max(0, tick - data.fetchedAt)
    : 0;
  const positions =
    active && gps.online
      ? (data?.positions.filter(
          (p) =>
            now - Date.parse(p.recorded_at) < 60000 &&
            (p.user_id !== userId || gps.consent),
        ) ?? [])
      : [];
  return {
    query,
    data,
    active,
    gps,
    connection,
    mutation,
    now,
    positions,
    changed,
  };
}
export type TrackingController = ReturnType<typeof useTracking>;
