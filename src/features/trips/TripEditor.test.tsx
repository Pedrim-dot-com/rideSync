import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TripEditor } from "./TripEditor";
afterEach(cleanup);
function setup() {
  const save = vi.fn();
  render(
    <TripEditor busy={false} error={null} onSave={save} onCancel={() => {}} />,
  );
  fireEvent.change(screen.getByLabelText("Título da viagem"), {
    target: { value: "Gerês" },
  });
  fireEvent.change(screen.getByLabelText(/Data e hora de partida/), {
    target: { value: "2026-11-01T09:00" },
  });
  return save;
}
function fillPoint(index: number, name: string) {
  for (const [field, value] of [
    ["Nome", name],
    ["Latitude", "41.1"],
    ["Longitude", "-8.6"],
  ]) {
    fireEvent.change(screen.getByLabelText(`${field} do ponto ${index}`), {
      target: { value },
    });
  }
}
describe("itinerary editing", () => {
  it("keeps endpoints fixed when stops are inserted, reordered and removed", () => {
    const save = setup();
    fillPoint(1, "Porto");
    fillPoint(2, "Gerês");
    fireEvent.click(screen.getByText("Adicionar paragem"));
    fillPoint(2, "Braga");
    fireEvent.click(screen.getByText("Adicionar paragem"));
    fillPoint(3, "Amares");
    fireEvent.click(screen.getByLabelText("Subir paragem 2"));
    expect(screen.getByLabelText("Nome do ponto 2")).toHaveValue("Amares");
    expect(screen.getByLabelText("Nome do ponto 4")).toHaveValue("Gerês");
    fireEvent.click(screen.getByLabelText("Remover paragem 2"));
    fireEvent.click(screen.getByText("Guardar viagem"));
    expect(save).toHaveBeenCalledOnce();
    expect(
      save.mock.calls[0][0].waypoints.map((p: { label: string }) => p.label),
    ).toEqual(["Porto", "Amares", "Gerês"]);
  });
  it("does not submit missing coordinates", () => {
    const save = setup();
    fillPoint(1, "Porto");
    fireEvent.change(screen.getByLabelText("Nome do ponto 2"), {
      target: { value: "Gerês" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Guardar viagem" }).closest("form")!,
    );
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "coordenadas numéricas válidas",
    );
  });
});
