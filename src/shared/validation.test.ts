import { describe, it, expect } from "vitest";
import { motorcycleSchema, profileSchema } from "./validation";
describe("garage inputs", () => {
  it("normalizes optional fields without turning empty numbers into zero", () => {
    expect(
      motorcycleSchema.parse({
        brand: " Honda ",
        model: " CB ",
        manufacture_year: "",
        engine_cc: "",
        color: "",
      }),
    ).toEqual({
      brand: "Honda",
      model: "CB",
      manufacture_year: null,
      engine_cc: null,
      color: null,
    });
  });
  it.each([
    { brand: " ", model: "CB" },
    { brand: "Honda", model: " " },
    { brand: "Honda", model: "CB", engine_cc: 0 },
    { brand: "Honda", model: "CB", manufacture_year: 1800 },
  ])("rejects invalid motorcycle %j", (input) => {
    expect(motorcycleSchema.safeParse({ color: "", ...input }).success).toBe(
      false,
    );
  });
});
describe("profile inputs", () => {
  it("normalizes nickname", () => {
    expect(
      profileSchema.parse({ display_name: " Ana ", username: "ANA_RIDER" }),
    ).toEqual({ display_name: "Ana", username: "ana_rider" });
  });
  it("rejects ambiguous or unsafe nickname characters", () => {
    expect(
      profileSchema.safeParse({
        display_name: "Ana",
        username: "ana rider<script>",
      }).success,
    ).toBe(false);
  });
});
