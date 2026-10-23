import { describe, it, expect } from "vitest";
import {
  tripSchema,
  waypointSchema,
  fromLocalDatetime,
  toLocalDatetime,
} from "./validation";
const point = { label: "Porto", latitude: "41.15", longitude: "-8.62" };
describe("trip validation", () => {
  it("normalizes numeric coordinates and trims labels", () => {
    expect(waypointSchema.parse({ ...point, label: " Porto " })).toEqual({
      label: "Porto",
      latitude: 41.15,
      longitude: -8.62,
    });
  });
  it.each([
    { latitude: "" },
    { longitude: " " },
    { latitude: null },
    { longitude: undefined },
    { latitude: "Infinity" },
    { latitude: 91 },
    { longitude: -181 },
  ])("rejects missing or invalid coordinates %j", (fields) => {
    expect(waypointSchema.safeParse({ ...point, ...fields }).success).toBe(
      false,
    );
  });
  it("requires origin and destination without inventing coordinates", () => {
    expect(
      tripSchema.safeParse({
        title: "Passeio",
        departure_at: "2026-11-01T09:00:00Z",
        waypoints: [point],
      }).success,
    ).toBe(false);
  });
  it("limits itinerary size and strips untrusted identities", () => {
    const input = {
      title: " Passeio ",
      departure_at: "2026-11-01T09:00:00Z",
      created_by: "another-user",
      status: "active",
      waypoints: [point, point],
    };
    expect(tripSchema.parse(input)).not.toHaveProperty("created_by");
    expect(tripSchema.parse(input)).not.toHaveProperty("status");
    expect(
      tripSchema.safeParse({ ...input, waypoints: Array(13).fill(point) })
        .success,
    ).toBe(false);
  });
});
describe("departure timezone", () => {
  it("round trips local dates through UTC storage", () => {
    const value = "2026-11-01T09:30";
    expect(toLocalDatetime(fromLocalDatetime(value))).toBe(value);
    expect(fromLocalDatetime(value)).toBe(new Date(value).toISOString());
  });
  it.each([
    "",
    "2026-02-30T10:00",
    "not a date",
    "2026-11-01T25:00",
    "2026-11-01T10:00Z",
  ])("rejects invalid local departure %s", (value) => {
    expect(fromLocalDatetime(value)).toBe("");
  });
});
