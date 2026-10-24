import { describe, it, expect } from "vitest";
import { groupSchema } from "./api";
const group = {
  name: "Grupo motard",
  description: "",
  legal_name: "",
  registration_number: "",
  headquarters_address: "Morada da sede",
  latitude: "41.15",
  longitude: "-8.6",
};
describe("public headquarters validation", () => {
  it("requires explicit coordinates rather than converting empty fields to zero", () => {
    expect(groupSchema.safeParse({ ...group, latitude: "" }).success).toBe(
      false,
    );
    expect(groupSchema.safeParse({ ...group, longitude: null }).success).toBe(
      false,
    );
  });
  it("supports optional legal fields and converts explicit coordinates", () => {
    const value = groupSchema.parse(group);
    expect(value.latitude).toBe(41.15);
    expect(value.registration_number).toBe("");
  });
  it("rejects invalid or nonfinite headquarters coordinates", () => {
    for (const latitude of [NaN, Infinity, "91"])
      expect(groupSchema.safeParse({ ...group, latitude }).success).toBe(false);
  });
});
