import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useGpsSharing } from "./useGpsSharing";
import * as api from "./api";
vi.mock("./api", () => ({
  startSharing: vi.fn(),
  stopSharing: vi.fn(),
  publishLocation: vi.fn(),
}));
let fix: PositionCallback;
let fail: PositionErrorCallback | null | undefined;
const watch = vi.fn(
  (success: PositionCallback, error?: PositionErrorCallback | null) => {
    fix = success;
    fail = error;
    return 7;
  },
);
const clear = vi.fn();
const changed = vi.fn();
const position = {
  coords: {
    latitude: 41,
    longitude: -8,
    accuracy: 10,
    heading: null,
    altitude: null,
    altitudeAccuracy: null,
    speed: null,
  },
  timestamp: Date.now(),
  toJSON: () => ({}),
} as GeolocationPosition;
beforeEach(() => {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { watchPosition: watch, clearWatch: clear },
  });
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
  vi.mocked(api.startSharing).mockResolvedValue("generation");
  vi.mocked(api.stopSharing).mockResolvedValue();
  vi.mocked(api.publishLocation).mockResolvedValue();
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
describe("foreground GPS consent and cleanup", () => {
  it("does not request a position until the rider explicitly opts in", () => {
    renderHook(() => useGpsSharing("session", true, changed));
    expect(watch).not.toHaveBeenCalled();
    expect(api.startSharing).not.toHaveBeenCalled();
  });
  it("publishes a real watch fix only after starting authenticated sharing", async () => {
    const { result } = renderHook(() =>
      useGpsSharing("session", true, changed),
    );
    act(() => result.current.toggle());
    await waitFor(() => expect(watch).toHaveBeenCalled());
    await act(async () => {
      fix(position);
    });
    expect(api.publishLocation).toHaveBeenCalledWith(
      "session",
      "generation",
      position,
    );
    expect(result.current.status).toBe("Localização a ser partilhada.");
  });
  it("stops the watcher on hide and rejects callbacks from that watcher", async () => {
    const { result } = renderHook(() =>
      useGpsSharing("session", true, changed),
    );
    act(() => result.current.toggle());
    await waitFor(() => expect(watch).toHaveBeenCalled());
    const previous = fix;
    act(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() =>
      expect(api.stopSharing).toHaveBeenCalledWith("session", "generation"),
    );
    expect(clear).toHaveBeenCalledWith(7);
    await act(async () => {
      previous(position);
    });
    expect(api.publishLocation).not.toHaveBeenCalled();
  });
  it("stops on permission denial without publishing a location", async () => {
    const { result } = renderHook(() =>
      useGpsSharing("session", true, changed),
    );
    act(() => result.current.toggle());
    await waitFor(() => expect(watch).toHaveBeenCalled());
    act(() =>
      fail?.({
        code: 1,
        message: "Denied",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      }),
    );
    await waitFor(() => expect(api.stopSharing).toHaveBeenCalled());
    expect(result.current.consent).toBe(false);
    expect(result.current.status).toContain("recusada");
    expect(api.publishLocation).not.toHaveBeenCalled();
  });
  it("revokes a late opt-in response after unmount without opening a watcher", async () => {
    let resolve!: (value: string) => void;
    vi.mocked(api.startSharing).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const { result, unmount } = renderHook(() =>
      useGpsSharing("session", true, changed),
    );
    act(() => result.current.toggle());
    unmount();
    await act(async () => {
      resolve("late-generation");
    });
    expect(watch).not.toHaveBeenCalled();
    expect(api.stopSharing).toHaveBeenCalledWith("session", "late-generation");
  });
  it("ends watching when the organizer finishes the session", async () => {
    const { result, rerender } = renderHook(
      ({ active }) => useGpsSharing("session", active, changed),
      { initialProps: { active: true } },
    );
    act(() => result.current.toggle());
    await waitFor(() => expect(watch).toHaveBeenCalled());
    rerender({ active: false });
    await waitFor(() => expect(api.stopSharing).toHaveBeenCalled());
    expect(clear).toHaveBeenCalledWith(7);
  });
});
