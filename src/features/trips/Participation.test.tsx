import * as notifications from "./notifications-api";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Participation } from "./Participation";
import { Invitation } from "./Invitation";
import * as api from "./participation-api";
import { getMotorcycles } from "../../shared/api";
import type { TripDetail } from "./api";
vi.mock("../../shared/api", () => ({ getMotorcycles: vi.fn() }));
vi.mock("./participation-api", async (original) => ({
  ...(await original<typeof import("./participation-api")>()),
  getTripMembers: vi.fn(),
  getTripInvitations: vi.fn(),
  createTripInvitation: vi.fn(),
  revokeTripInvitation: vi.fn(),
  setTripMotorcycle: vi.fn(),
  respondTripInvitation: vi.fn(),
}));
vi.mock("./notifications-api", () => ({
  rememberTripInvitation: vi.fn(),
  respondReceivedInvitation: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const trip: TripDetail = {
  trip: {
    id: "trip",
    title: "Volta",
    created_by: "owner",
    status: "planned",
    revision: 1,
    departure_at: "2026-12-01T09:00:00Z",
    created_at: "2026-10-24",
    updated_at: "2026-10-24",
  },
  participants: [
    {
      trip_id: "trip",
      user_id: "rider",
      role: "rider",
      status: "accepted",
      motorcycle_id: null,
      joined_at: "2026-10-24",
    },
  ],
  waypoints: [],
  route: null,
};
function wrap(component: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      {component}
    </QueryClientProvider>,
  );
}
function mocks() {
  vi.mocked(api.getTripMembers).mockResolvedValue([
    {
      user_id: "rider",
      role: "rider",
      display_name: "Ana",
      username: "ana",
      motorcycle_brand: null,
      motorcycle_model: null,
    },
  ]);
  vi.mocked(api.getTripInvitations).mockResolvedValue([]);
  vi.mocked(getMotorcycles).mockResolvedValue([
    {
      id: "own-bike",
      user_id: "rider",
      brand: "Honda",
      model: "CB500",
      is_primary: true,
      color: null,
      manufacture_year: null,
      engine_cc: null,
    },
  ]);
}
describe("trip participation", () => {
  it("shows the member roster and own garage, without invite controls for riders", async () => {
    mocks();
    wrap(<Participation detail={trip} userId="rider" />);
    expect(await screen.findByText("Ana (tu)")).toBeVisible();
    expect(
      await screen.findByRole("option", { name: /Honda CB500/ }),
    ).toBeVisible();
    expect(screen.queryByText("Criar link de convite")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("A tua mota nesta viagem"), {
      target: { value: "own-bike" },
    });
    fireEvent.click(screen.getByText("Guardar mota da viagem"));
    await waitFor(() =>
      expect(api.setTripMotorcycle).toHaveBeenCalledWith("trip", "own-bike"),
    );
  });
  it("keeps participation changes locked after the planning phase", async () => {
    mocks();
    wrap(
      <Participation
        detail={{ ...trip, trip: { ...trip.trip, status: "active" } }}
        userId="rider"
      />,
    );
    await screen.findByText("Ana (tu)");
    expect(
      screen.queryByText("Guardar mota da viagem"),
    ).not.toBeInTheDocument();
    expect(getMotorcycles).not.toHaveBeenCalled();
  });
  it("allows the organizer to create a one-time link and revoke it", async () => {
    mocks();
    vi.mocked(api.createTripInvitation).mockResolvedValue({
      invitation_id: "invite",
      token: "a".repeat(64),
      expires_at: "2026-12-01T09:00:00Z",
    });
    vi.mocked(api.getTripInvitations).mockResolvedValue([
      {
        invitation_id: "invite",
        created_at: "2026-10-24T09:00:00Z",
        expires_at: "2026-12-01T09:00:00Z",
        used_at: null,
        response: null,
        revoked_at: null,
      },
    ]);
    wrap(<Participation detail={trip} userId="owner" />);
    await screen.findByText("Ana");
    fireEvent.click(screen.getByText("Criar link de convite"));
    expect(await screen.findByLabelText("Link do convite")).toHaveValue(
      `${window.location.origin}/#invite=${"a".repeat(64)}`,
    );
    fireEvent.click(screen.getByLabelText("Revogar convite 1"));
    await waitFor(() =>
      expect(api.revokeTripInvitation).toHaveBeenCalledWith("trip", "invite"),
    );
    await waitFor(() =>
      expect(
        screen.queryByLabelText("Link do convite"),
      ).not.toBeInTheDocument(),
    );
  });
  it("requires login before allowing an invitation response", () => {
    wrap(
      <Invitation
        token={"a".repeat(64)}
        signedIn={false}
        onAccepted={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText("Aceitar convite")).not.toBeInTheDocument();
    expect(screen.getByText(/Inicia sessão ou cria conta/)).toBeVisible();
    expect(api.respondTripInvitation).not.toHaveBeenCalled();
  });
  it("keeps an expired invitation visible with a recoverable explanation", async () => {
    vi.mocked(notifications.rememberTripInvitation).mockRejectedValue({
      code: "P0001",
      message: "INVITATION_UNAVAILABLE",
    });
    const accepted = vi.fn();
    wrap(
      <Invitation
        token={"a".repeat(64)}
        signedIn
        userId="rider"
        onAccepted={accepted}
        onClose={vi.fn()}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Pede um novo link",
    );
    expect(accepted).not.toHaveBeenCalled();
  });
  it("navigates only after successful acceptance", async () => {
    vi.mocked(notifications.rememberTripInvitation).mockResolvedValue(
      "receipt",
    );
    vi.mocked(notifications.respondReceivedInvitation).mockResolvedValue(
      "trip",
    );
    const accepted = vi.fn();
    wrap(
      <Invitation
        token={"a".repeat(64)}
        signedIn
        userId="rider"
        onAccepted={accepted}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText("Aceitar convite")).toBeEnabled(),
    );
    fireEvent.click(screen.getByText("Aceitar convite"));
    await waitFor(() => expect(accepted).toHaveBeenCalledWith("trip"));
  });
});
