import { describe, it, expect, vi, afterEach } from "vitest";
import { externalNavigation, mapTiler } from "./providers";
afterEach(() => vi.unstubAllEnvs());
describe("public map adapters", () => {
  it("builds destination-only official links", () => {
    const result = externalNavigation(41.15, -8.62)!;
    expect(new URL(result.google).hostname).toBe("www.google.com");
    expect(new URL(result.google).searchParams.get("destination")).toBe(
      "41.15,-8.62",
    );
    expect(new URL(result.waze).hostname).toBe("waze.com");
  });
  it.each([
    [91, 0],
    [0, 181],
    [NaN, 0],
    [Infinity, 0],
  ])("rejects invalid coordinates", (latitude, longitude) => {
    expect(externalNavigation(latitude, longitude)).toBeNull();
  });
  it("rejects arbitrary style hosts", () => {
    vi.stubEnv("VITE_MAPTILER_API_KEY", "test-public-key");
    vi.stubEnv(
      "VITE_MAP_STYLE_URL",
      "https://attacker.example.test/style.json",
    );
    expect(mapTiler.getStyleUrl()).toBeNull();
  });
  it("uses MapTiler with the configured public browser key", () => {
    vi.stubEnv("VITE_MAPTILER_API_KEY", "test-public-key");
    vi.stubEnv("VITE_MAP_STYLE_URL", "");
    const url = new URL(mapTiler.getStyleUrl()!);
    expect(url.hostname).toBe("api.maptiler.com");
    expect(url.searchParams.get("key")).toBe("test-public-key");
  });
});
