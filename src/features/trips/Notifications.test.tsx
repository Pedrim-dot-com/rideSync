import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Notifications } from "./Notifications";
import { Invitation } from "./Invitation";
import { readPendingInvitation } from "./invitation-link";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("../groups/ReceivedGroupInvitations", () => ({
  ReceivedGroupInvitations: () => null,
}));
vi.mock("../../shared/supabase", () => ({ client: () => ({ rpc }) }));
const invitation = {
  receipt_id: "receipt",
  title: "Serra ao domingo",
  departure_at: "2026-12-01T09:00Z",
  inviter_name: "Ana",
  expires_at: "2026-12-02T09:00Z",
  received_at: "2026-10-24T09:00Z",
  status: "pending",
  trip_id: null,
};
function wrap(component: React.ReactNode) {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={cache}>{component}</QueryClientProvider>,
  );
  return { ...view, cache };
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});
describe("received invitations", () => {
  it("responds later using only the saved receipt and refreshes declined history", async () => {
    let declined = false;
    rpc.mockImplementation(async (name: string) => {
      if (name === "respond_received_trip_invitation") {
        declined = true;
        return { data: null, error: null };
      }
      return {
        data: [{ ...invitation, status: declined ? "declined" : "pending" }],
        error: null,
      };
    });
    const accepted = vi.fn();
    wrap(<Notifications userId="rider" onAccepted={accepted} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Recusar convite" }),
    );
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("respond_received_trip_invitation", {
        p_receipt_id: "receipt",
        p_accept: false,
      }),
    );
    expect(await screen.findByText("Convite recusado.")).toBeVisible();
    expect(accepted).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Aceitar convite" }),
    ).not.toBeInTheDocument();
  });
  it("shows expired, revoked and used history without response actions", async () => {
    rpc.mockResolvedValue({
      data: ["expired", "revoked", "used"].map((status) => ({
        ...invitation,
        receipt_id: status,
        status,
      })),
      error: null,
    });
    wrap(<Notifications userId="rider" onAccepted={vi.fn()} />);
    await screen.findByText("Expirado.");
    expect(screen.getByText("Revogado.")).toBeVisible();
    expect(screen.getByText("Já utilizado.")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Aceitar convite" }),
    ).not.toBeInTheDocument();
  });
  it("offers a retry after network failure and an empty state after recovery", async () => {
    rpc
      .mockResolvedValueOnce({ data: null, error: new Error("offline") })
      .mockResolvedValue({ data: [], error: null });
    wrap(<Notifications userId="rider" onAccepted={vi.fn()} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Tentar novamente" }),
    );
    expect(
      await screen.findByText(/Ainda não tens convites de viagem/),
    ).toBeVisible();
  });
  it("retains the bearer until saving succeeds, including while its banner is closed", async () => {
    const token = "a".repeat(64);
    window.history.replaceState(null, "", `/#invite=${token}`);
    readPendingInvitation();
    rpc
      .mockResolvedValueOnce({ data: null, error: new Error("offline") })
      .mockResolvedValue({ data: "receipt", error: null });
    const remembered = vi.fn();
    const close = vi.fn();
    wrap(
      <Invitation
        token={token}
        signedIn
        userId="rider"
        hidden
        onClose={close}
        onAccepted={vi.fn()}
        onRemembered={remembered}
      />,
    );
    await screen.findByRole("alert");
    expect(readPendingInvitation()).toBe(token);
    fireEvent.click(
      screen.getByRole("button", { name: "Tentar guardar novamente" }),
    );
    await waitFor(() => expect(remembered).toHaveBeenCalledOnce());
    expect(readPendingInvitation()).toBe(null);
    expect(rpc).toHaveBeenCalledWith("remember_trip_invitation", {
      p_token: token,
    });
    expect(rpc).not.toHaveBeenCalledWith(
      "respond_received_trip_invitation",
      expect.anything(),
    );
    expect(close).not.toHaveBeenCalled();
  });
  it("closing a saved banner is separate from accepting or declining", async () => {
    rpc.mockResolvedValue({ data: "receipt", error: null });
    const close = vi.fn();
    wrap(
      <Invitation
        token={"a".repeat(64)}
        signedIn
        userId="rider"
        onClose={close}
        onAccepted={vi.fn()}
      />,
    );
    await screen.findByText(/Guardado em Notificações/);
    fireEvent.click(screen.getByRole("button", { name: "Fechar convite" }));
    expect(close).toHaveBeenCalledWith(true);
    expect(rpc).not.toHaveBeenCalledWith(
      "respond_received_trip_invitation",
      expect.anything(),
    );
  });
});
