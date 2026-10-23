// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { openRouteService } from "./providers";
const points = [
  { label: "A", latitude: 41, longitude: -8 },
  { label: "B", latitude: 42, longitude: -9 },
];
describe("openrouteservice adapter", () => {
  it("sends longitude/latitude and supported highway avoidance", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          features: [
            {
              geometry: {
                type: "LineString",
                coordinates: [
                  [-8, 41],
                  [-9, 42],
                ],
              },
              properties: { summary: { distance: 1000, duration: 100 } },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await openRouteService(
      () => "test-api-key",
      fetcher,
    ).calculate(points, true);
    expect(result.distanceM).toBe(1000);
    const init = fetcher.mock.calls[0][1]!;
    expect(JSON.parse(init.body as string)).toEqual({
      coordinates: [
        [-8, 41],
        [-9, 42],
      ],
      instructions: false,
      options: { avoid_features: ["highways"] },
    });
    expect(init.headers).toHaveProperty("Authorization", "test-api-key");
  });
  it("rejects invalid provider geometry rather than synthesizing a route", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        features: [
          {
            geometry: {
              type: "LineString",
              coordinates: [
                [181, 0],
                [0, 0],
              ],
            },
            properties: { summary: { distance: 1, duration: 1 } },
          },
        ],
      }),
    );
    await expect(
      openRouteService(() => "test-api-key", fetcher).calculate(points, false),
    ).rejects.toMatchObject({ code: "INVALID_ROUTING_RESPONSE" });
  });
  it("distinguishes provider quota errors", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("", { status: 429 }));
    await expect(
      openRouteService(() => "test-api-key", fetcher).calculate(points, false),
    ).rejects.toMatchObject({ status: 429, code: "PROVIDER_RATE_LIMITED" });
  });
  it("normalizes geocoding coordinates", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({
          features: [
            {
              geometry: { type: "Point", coordinates: [-8, 41] },
              properties: { label: "Porto" },
            },
          ],
        }),
      );
    expect(
      await openRouteService(() => "test-api-key", fetcher).search("Porto"),
    ).toEqual([{ label: "Porto", latitude: 41, longitude: -8 }]);
  });
  it("never includes credentials in an upstream error", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("private details"));
    await expect(
      openRouteService(() => "test-api-key", fetcher).search("Porto"),
    ).rejects.toMatchObject({ message: "ROUTING_UNAVAILABLE" });
  });
});
