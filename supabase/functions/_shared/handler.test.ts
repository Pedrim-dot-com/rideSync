// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { mapHandler } from "./handler";
import { MapError, type UserContext, type RouteResult } from "./contracts";
const id = "00000000-0000-4000-8000-000000000001";
const route: RouteResult = {
  geometry: {
    type: "LineString",
    coordinates: [
      [-8, 41],
      [-8.1, 41.1],
    ],
  },
  distanceM: 1000,
  durationS: 120,
  provider: "openrouteservice",
  calculatedAt: "2026-10-23T12:00:00Z",
};
function setup() {
  const context: UserContext = {
    userId: "owner",
    consumeQuota: vi.fn().mockResolvedValue(undefined),
    getTrip: vi.fn().mockResolvedValue({
      id,
      createdBy: "owner",
      status: "draft",
      revision: 3,
      waypoints: [
        { label: "A", latitude: 41, longitude: -8 },
        { label: "B", latitude: 41.1, longitude: -8.1 },
      ],
    }),
    saveRoute: vi.fn().mockResolvedValue(undefined),
  };
  const deps = {
    authenticate: vi.fn().mockResolvedValue(context),
    routing: { calculate: vi.fn().mockResolvedValue(route) },
    geocoding: {
      search: vi
        .fn()
        .mockResolvedValue([{ label: "Porto", latitude: 41, longitude: -8 }]),
    },
    allowedOrigins: () => ["https://ridesync.example.test"],
  };
  const request = (body: unknown, origin = "https://ridesync.example.test") =>
    new Request("https://edge.example.test", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  return {
    context,
    deps,
    request,
    handler: mapHandler("calculate-route", deps),
  };
}
describe("map Edge authorization and contracts", () => {
  it("derives coordinates from the authorized trip and persists provider output", async () => {
    const { handler, request, context, deps } = setup();
    const r = await handler(
      request({ tripId: id, expectedRevision: 3, avoidHighways: true }),
    );
    expect(r.status).toBe(200);
    expect(deps.routing.calculate).toHaveBeenCalledWith(
      (await context.getTrip(id)).waypoints,
      true,
    );
    expect(context.saveRoute).toHaveBeenCalledWith(id, 3, route);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://ridesync.example.test",
    );
    expect(r.headers.get("Cache-Control")).toBe("no-store");
  });
  it("does not call a provider without a verified user", async () => {
    const { handler, request, deps } = setup();
    deps.authenticate.mockRejectedValue(new MapError(401, "UNAUTHENTICATED"));
    expect(
      (await handler(request({ tripId: id, expectedRevision: 3 }))).status,
    ).toBe(401);
    expect(deps.routing.calculate).not.toHaveBeenCalled();
  });
  it("rejects an unapproved browser origin", async () => {
    const { handler, request, deps } = setup();
    expect(
      (await handler(request({}, "https://attacker.example.test"))).status,
    ).toBe(403);
    expect(deps.authenticate).not.toHaveBeenCalled();
  });
  it("rejects caller-supplied coordinates", async () => {
    const { handler, request, deps } = setup();
    expect(
      (
        await handler(
          request({
            tripId: id,
            expectedRevision: 3,
            coordinates: [
              [0, 0],
              [1, 1],
            ],
          }),
        )
      ).status,
    ).toBe(400);
    expect(deps.routing.calculate).not.toHaveBeenCalled();
  });
  it.each([
    { createdBy: "other", status: "draft", revision: 3, expected: 403 },
    { createdBy: "owner", status: "active", revision: 3, expected: 409 },
    { createdBy: "owner", status: "draft", revision: 4, expected: 409 },
  ])(
    "checks ownership, lifecycle and revision %j",
    async ({ createdBy, status, revision, expected }) => {
      const { handler, request, context, deps } = setup();
      vi.mocked(context.getTrip).mockResolvedValue({
        id,
        createdBy,
        status,
        revision,
        waypoints: [],
      });
      expect(
        (await handler(request({ tripId: id, expectedRevision: 3 }))).status,
      ).toBe(expected);
      expect(deps.routing.calculate).not.toHaveBeenCalled();
    },
  );
  it("enforces quota before an external call", async () => {
    const { handler, request, context, deps } = setup();
    vi.mocked(context.consumeQuota).mockRejectedValue(
      new MapError(429, "RATE_LIMITED"),
    );
    expect(
      (await handler(request({ tripId: id, expectedRevision: 3 }))).status,
    ).toBe(429);
    expect(deps.routing.calculate).not.toHaveBeenCalled();
  });
  it("does not return a new route if persistence detects an intervening edit", async () => {
    const { handler, request, context } = setup();
    vi.mocked(context.saveRoute).mockRejectedValue(
      new MapError(409, "TRIP_CHANGED"),
    );
    const r = await handler(request({ tripId: id, expectedRevision: 3 }));
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ code: "TRIP_CHANGED" });
  });
  it("sanitizes unexpected failures", async () => {
    const { handler, request, deps } = setup();
    deps.routing.calculate.mockRejectedValue(
      new Error("private backend details"),
    );
    const r = await handler(request({ tripId: id, expectedRevision: 3 }));
    expect(r.status).toBe(500);
    expect(await r.text()).not.toContain("private backend");
  });
  it("supports authenticated geocoding without exposing upstream fields", async () => {
    const { deps, request, context } = setup();
    const handler = mapHandler("search-places", deps);
    const r = await handler(request({ text: "Porto" }));
    expect(r.status).toBe(200);
    expect(context.consumeQuota).toHaveBeenCalledWith("search-places");
    expect(await r.json()).toEqual({
      places: [{ label: "Porto", latitude: 41, longitude: -8 }],
    });
  });
});
