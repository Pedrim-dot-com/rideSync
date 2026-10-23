vi.mock("./Participation", () => ({ Participation: () => null }));
vi.mock("./TripMap", () => ({ default: () => null }));
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  act,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Trips } from "./Trips";
import * as api from "./api";
vi.mock("./api", () => ({
  getTrips: vi.fn(),
  getTrip: vi.fn(),
  saveTrip: vi.fn(),
  changeTripStatus: vi.fn(),
  deleteTrip: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const trip = {
  id: "trip",
  created_by: "owner",
  title: "Serra",
  departure_at: "2026-11-01T09:00:00Z",
  status: "draft" as const,
  revision: 7,
  created_at: "2026-10-23",
  updated_at: "2026-10-23",
};
const detail = {
  trip,
  waypoints: [
    {
      id: "p1",
      trip_id: "trip",
      position: 0,
      label: "Porto",
      latitude: 41,
      longitude: -8,
    },
    {
      id: "p2",
      trip_id: "trip",
      position: 1,
      label: "Gerês",
      latitude: 42,
      longitude: -8,
    },
  ],
  participants: [],
  route: null,
};
async function setup(userId = "owner") {
  vi.mocked(api.getTrips).mockResolvedValue([trip]);
  vi.mocked(api.getTrip).mockResolvedValue(detail);
  vi.mocked(api.saveTrip).mockResolvedValue("trip");
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={cache}>
      <Trips userId={userId} />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByLabelText("Ver viagem Serra"));
  await screen.findByText("Itinerário");
  return cache;
}
describe("trip permissions in the UI", () => {
  it("lets a rider read the itinerary without organizer actions", async () => {
    await setup("rider");
    expect(screen.getByText("Porto")).toBeVisible();
    expect(screen.getByText("Percurso por calcular")).toBeVisible();
    expect(screen.queryByText("Editar viagem")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancelar viagem")).not.toBeInTheDocument();
  });
  it("sends the displayed revision when changing status", async () => {
    await setup();
    fireEvent.click(screen.getByText("Marcar como planeada"));
    await waitFor(() =>
      expect(api.changeTripStatus).toHaveBeenCalledWith("trip", "planned", 7),
    );
  });
  it("requires confirmation before deleting an itinerary", async () => {
    await setup();
    fireEvent.click(screen.getByText("Remover viagem"));
    expect(api.deleteTrip).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Confirmar remoção"));
    await waitFor(() => expect(api.deleteTrip).toHaveBeenCalledWith("trip", 7));
  });
  it("keeps the edit snapshot revision when a background refetch changes the trip", async () => {
    const cache = await setup();
    fireEvent.click(screen.getByText("Editar viagem"));
    act(() =>
      cache.setQueryData(["trip", "owner", "trip"], {
        ...detail,
        trip: { ...trip, revision: 8, title: "Changed remotely" },
      }),
    );
    fireEvent.change(screen.getByLabelText("Título da viagem"), {
      target: { value: "Novo título" },
    });
    fireEvent.click(screen.getByText("Guardar viagem"));
    await waitFor(() =>
      expect(api.saveTrip).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Novo título" }),
        { id: "trip", revision: 7 },
      ),
    );
  });
  it("explains optimistic concurrency conflicts", async () => {
    vi.mocked(api.changeTripStatus).mockRejectedValue({ code: "40001" });
    await setup();
    fireEvent.click(screen.getByText("Marcar como planeada"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "alterada entretanto",
    );
    expect(screen.getByText("Atualizar dados da viagem")).toBeVisible();
  });
});
