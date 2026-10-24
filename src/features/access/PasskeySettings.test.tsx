import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PasskeySettings } from "./PasskeySettings";
import * as api from "./passkeys";
vi.mock("./passkeys", async (original) => ({
  ...(await original<typeof import("./passkeys")>()),
  supportsPasskeys: vi.fn(),
  listPasskeys: vi.fn(),
  registerPasskey: vi.fn(),
  removePasskey: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(api.supportsPasskeys).mockReturnValue(true);
  vi.mocked(api.listPasskeys).mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function setup() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <PasskeySettings userId="owner" />
    </QueryClientProvider>,
  );
}
describe("passkey enrollment and recovery", () => {
  it("registers through the Auth service only on explicit action", async () => {
    vi.mocked(api.registerPasskey).mockResolvedValue({
      id: "key",
      created_at: "2026-10-24T09:00:00Z",
    });
    setup();
    await screen.findByText(/Ainda não tens chaves de acesso/);
    expect(api.registerPasskey).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Ativar chave de acesso" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Chave de acesso criada",
    );
    expect(api.registerPasskey).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
  it("requires confirmation before deleting a key", async () => {
    vi.mocked(api.listPasskeys).mockResolvedValue([
      {
        id: "key",
        friendly_name: "iPhone",
        created_at: "2026-10-24T09:00:00Z",
      },
    ]);
    setup();
    await screen.findByText("iPhone");
    fireEvent.click(screen.getByLabelText("Remover chave de acesso 1"));
    expect(api.removePasskey).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar remoção da chave" }),
    );
    await waitFor(() => expect(api.removePasskey).toHaveBeenCalledWith("key"));
  });
  it("keeps a failed enrollment recoverable without exposing service messages", async () => {
    vi.mocked(api.registerPasskey).mockRejectedValue({
      message: "private service detail",
    });
    setup();
    await screen.findByText(/Ainda não tens chaves/);
    fireEvent.click(
      screen.getByRole("button", { name: "Ativar chave de acesso" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "email e password",
    );
    expect(
      screen.queryByText("private service detail"),
    ).not.toBeInTheDocument();
  });
  it("does not claim biometric availability on unsupported devices", async () => {
    vi.mocked(api.supportsPasskeys).mockReturnValue(false);
    setup();
    expect(screen.getByText(/Este navegador não disponibiliza/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Ativar chave de acesso" }),
    ).not.toBeInTheDocument();
    await screen.findByText(/Ainda não tens chaves/);
  });
});
