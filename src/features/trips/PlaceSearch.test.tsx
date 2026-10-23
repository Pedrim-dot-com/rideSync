import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import { PlaceSearch } from "./PlaceSearch";
import { geocoding } from "../../shared/maps/providers";
vi.mock("../../shared/maps/providers", () => ({
  geocoding: { search: vi.fn() },
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});
describe("place search", () => {
  it("debounces requests and selects verified coordinates", async () => {
    vi.useFakeTimers();
    vi.mocked(geocoding.search).mockResolvedValue([
      { label: "Porto, Portugal", latitude: 41.15, longitude: -8.62 },
    ]);
    const select = vi.fn();
    render(
      <PlaceSearch
        label="Origem"
        value="Porto"
        onChange={() => {}}
        onSelect={select}
      />,
    );
    fireEvent.focus(screen.getByLabelText("Origem"));
    expect(geocoding.search).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(401));
    fireEvent.pointerDown(screen.getByRole("option"));
    expect(select).toHaveBeenCalledWith({
      label: "Porto, Portugal",
      latitude: 41.15,
      longitude: -8.62,
    });
  });
  it("keeps manual editing available after a service failure", async () => {
    vi.useFakeTimers();
    vi.mocked(geocoding.search).mockRejectedValue(new Error("unavailable"));
    render(
      <PlaceSearch
        label="Origem"
        value="Porto"
        onChange={() => {}}
        onSelect={() => {}}
      />,
    );
    fireEvent.focus(screen.getByLabelText("Origem"));
    await act(() => vi.advanceTimersByTimeAsync(401));
    expect(screen.getByRole("status")).toHaveTextContent("manualmente");
    expect(screen.getByLabelText("Origem")).toBeEnabled();
  });
});
