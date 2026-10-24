import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTracking } from "./useTracking";
import * as api from "./api";
import type { TripRow } from "../../shared/database.types";
const realtime = vi.hoisted(() => ({
  broadcast: undefined as undefined | ((message: unknown) => void),
  channel: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../../shared/supabase", () => ({
  client: () => ({ channel: realtime.channel, removeChannel: realtime.remove }),
}));
vi.mock("./api", () => ({
  getTracking: vi.fn(),
  startTrip: vi.fn(),
  finishTrip: vi.fn(),
}));
vi.mock("./useGpsSharing", () => ({
  useGpsSharing: () => ({
    consent: false,
    online: true,
    visible: true,
    sharing: false,
    status: "",
    toggle: vi.fn(),
  }),
}));
const trip: TripRow = {
  id: "trip",
  created_by: "owner",
  title: "Trip",
  status: "active",
  revision: 2,
  departure_at: "2026-12-01T09:00:00Z",
  created_at: "2026-10-24",
  updated_at: "2026-10-24",
};
const position = {
  user_id: "rider",
  display_name: "Ana",
  latitude: 41,
  longitude: -8,
  accuracy_m: 10,
  heading: null,
  recorded_at: new Date().toISOString(),
};
beforeEach(() => {
  const chain = {
    on: vi.fn((_type, _filter, callback) => {
      realtime.broadcast = callback;
      return chain;
    }),
    subscribe: vi.fn(() => chain),
  };
  realtime.channel.mockReturnValue(chain);
  vi.mocked(api.getTracking).mockImplementation(async () => ({
    server_now: new Date().toISOString(),
    status: "active",
    revision: 2,
    session: {
      id: "session",
      started_at: new Date().toISOString(),
      ended_at: null,
    },
    positions: [position],
    fetchedAt: performance.now(),
  }));
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function setup() {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    ...renderHook(() => useTracking(trip, "owner"), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={cache}>{children}</QueryClientProvider>
      ),
    }),
    cache,
  };
}
describe("authoritative tracking state", () => {
  it("uses a private channel and rereads snapshots instead of trusting broadcast coordinates", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.positions).toHaveLength(1));
    expect(realtime.channel).toHaveBeenCalledWith("trip:trip", {
      config: { private: true },
    });
    act(() =>
      realtime.broadcast?.({
        payload: { user_id: "victim", latitude: 0, longitude: 0 },
      }),
    );
    await waitFor(() =>
      expect(vi.mocked(api.getTracking).mock.calls.length).toBeGreaterThan(1),
    );
    expect(result.current.positions[0].user_id).toBe("rider");
    expect(result.current.positions[0].latitude).toBe(41);
  });
  it("immediately hides previously cached locations when access is revoked", async () => {
    const { result, cache } = setup();
    await waitFor(() => expect(result.current.positions).toHaveLength(1));
    vi.mocked(api.getTracking).mockRejectedValue({ code: "42501" });
    await act(async () => {
      await cache.invalidateQueries({
        queryKey: ["tracking", "owner", "trip"],
      });
    });
    await waitFor(() => expect(result.current.query.isError).toBe(true));
    expect(result.current.positions).toEqual([]);
    expect(result.current.active).toBe(false);
  });
  it("uses the latest displayed revision after calculating a route", async () => {
    vi.mocked(api.getTracking).mockResolvedValue({
      server_now: new Date().toISOString(),
      status: "planned",
      revision: 1,
      session: null,
      positions: [],
      fetchedAt: performance.now(),
    });
    const { result } = setup();
    await waitFor(() => expect(result.current.data).toBeDefined());
    act(() => result.current.mutation.mutate("start"));
    await waitFor(() => expect(api.startTrip).toHaveBeenCalledWith("trip", 2));
  });
});
