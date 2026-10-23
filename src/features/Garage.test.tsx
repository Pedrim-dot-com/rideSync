import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Garage } from "./Garage";
import * as api from "../shared/api";
vi.mock("../shared/api", () => ({
  getMotorcycles: vi.fn(),
  saveMotorcycle: vi.fn(),
  removeMotorcycle: vi.fn(),
  setPrimary: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function renderGarage() {
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
      <Garage userId="owner" />
    </QueryClientProvider>,
  );
}
describe("garage workflow", () => {
  it("submits a validated new motorcycle for the current owner", async () => {
    vi.mocked(api.getMotorcycles).mockResolvedValue([]);
    vi.mocked(api.saveMotorcycle).mockResolvedValue(undefined);
    renderGarage();
    await screen.findByText("O primeiro lugar é teu.");
    fireEvent.click(screen.getByText("Adicionar a primeira mota"));
    fireEvent.change(screen.getByLabelText("Marca"), {
      target: { value: "Honda" },
    });
    fireEvent.change(screen.getByLabelText("Modelo"), {
      target: { value: "CB500" },
    });
    fireEvent.click(screen.getByText("Guardar mota"));
    await waitFor(() =>
      expect(api.saveMotorcycle).toHaveBeenCalledWith(
        "owner",
        {
          brand: "Honda",
          model: "CB500",
          manufacture_year: null,
          engine_cc: null,
          color: null,
        },
        undefined,
      ),
    );
  });
  it("requires explicit confirmation before deletion", async () => {
    vi.mocked(api.getMotorcycles).mockResolvedValue([
      {
        id: "bike",
        user_id: "owner",
        brand: "Honda",
        model: "CB500",
        is_primary: false,
        manufacture_year: null,
        engine_cc: null,
        color: null,
      },
    ]);
    renderGarage();
    fireEvent.click(await screen.findByLabelText("Remover CB500"));
    expect(api.removeMotorcycle).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Confirmar remoção"));
    await waitFor(() =>
      expect(api.removeMotorcycle).toHaveBeenCalledWith("owner", "bike"),
    );
  });
  it("shows a recoverable query failure", async () => {
    vi.mocked(api.getMotorcycles).mockRejectedValue(new Error("network"));
    renderGarage();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir",
    );
    expect(screen.getByText("Tentar novamente")).toBeVisible();
  });
});
