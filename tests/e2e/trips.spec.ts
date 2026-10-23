import { test, expect } from "@playwright/test";
test("trip creation, ordered stops, editing, lifecycle and deletion (mocked Supabase transport)", async ({
  page,
}, testInfo) => {
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "rider@example.test",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-10-23T12:00:00Z",
  };
  type Trip = {
    id: string;
    title: string;
    created_by: string;
    departure_at: string;
    status: string;
    revision: number;
    created_at: string;
    updated_at: string;
  };
  type Point = {
    label: string;
    latitude: number;
    longitude: number;
    id: string;
    trip_id: string;
    position: number;
  };
  let trip: Trip | null = null;
  let points: Point[] = [];
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    let body: unknown = {};
    if (request.method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
        },
      });
      return;
    }
    if (path.endsWith("/token"))
      body = {
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: "bearer",
        user,
      };
    else if (path.endsWith("/user")) body = user;
    else if (path.endsWith("/motorcycles")) body = [];
    else if (path.endsWith("/create_trip") || path.endsWith("/update_trip")) {
      const input = request.postDataJSON();
      expect(input).not.toHaveProperty("created_by");
      expect(input).not.toHaveProperty("user_id");
      if (trip) {
        expect(input.p_expected_revision).toBe(trip.revision);
        trip = {
          ...trip,
          title: input.p_title,
          departure_at: input.p_departure_at,
          revision: trip.revision + 1,
        };
        body = null;
      } else {
        trip = {
          id: "test-trip",
          title: input.p_title,
          departure_at: input.p_departure_at,
          created_by: user.id,
          status: "draft",
          revision: 1,
          created_at: "2026-10-23T12:00:00Z",
          updated_at: "2026-10-23T12:00:00Z",
        };
        body = trip.id;
      }
      points = input.p_waypoints.map(
        (p: Omit<Point, "position" | "id" | "trip_id">, position: number) => ({
          ...p,
          id: `point-${position}`,
          trip_id: "test-trip",
          position,
        }),
      );
    } else if (path.endsWith("/set_trip_status")) {
      const input = request.postDataJSON();
      expect(input.p_expected_revision).toBe(trip!.revision);
      trip = { ...trip!, status: input.p_status, revision: trip!.revision + 1 };
      body = null;
    } else if (path.endsWith("/delete_trip")) {
      expect(request.postDataJSON().p_expected_revision).toBe(trip!.revision);
      trip = null;
      points = [];
      body = null;
    } else if (path.endsWith("/trips"))
      body = url.searchParams.has("id") ? trip : trip ? [trip] : [];
    else if (path.endsWith("/trip_waypoints")) body = points;
    else if (path.endsWith("/trip_participants"))
      body = trip
        ? [
            {
              trip_id: trip.id,
              user_id: user.id,
              role: "organizer",
              status: "accepted",
              motorcycle_id: null,
              joined_at: "2026-10-23T12:00:00Z",
            },
          ]
        : [];
    else if (path.endsWith("/trip_routes")) body = [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(body),
    });
  });
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("rider@example.test");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByRole("button", { name: "Viagens", exact: true }).click();
  await expect(page.getByText("Para onde vamos?")).toBeVisible();
  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByRole("button", { name: "Criar a primeira viagem" }).click();
  await page.getByLabel("Título da viagem").fill("Passeio ao Gerês");
  await page.getByLabel(/Data e hora de partida/).fill("2026-11-01T09:30");
  async function fill(
    index: number,
    label: string,
    latitude: string,
    longitude: string,
  ) {
    await page
      .getByLabel(`Nome do ponto ${index}`, { exact: true })
      .fill(label);
    await page
      .getByLabel(`Latitude do ponto ${index}`, { exact: true })
      .fill(latitude);
    await page
      .getByLabel(`Longitude do ponto ${index}`, { exact: true })
      .fill(longitude);
  }
  await fill(1, "Porto", "41.1579", "-8.6291");
  await fill(2, "Gerês", "41.727", "-8.162");
  await page.getByRole("button", { name: "Adicionar paragem" }).click();
  await fill(2, "Braga", "41.55", "-8.42");
  await page.getByRole("button", { name: "Adicionar paragem" }).click();
  await fill(3, "Amares", "41.63", "-8.35");
  await page.getByLabel("Subir paragem 2").click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page.locator(".point-inputs input").evaluateAll((inputs) =>
      inputs.every((input) => {
        const bounds = input.getBoundingClientRect();
        const card = input.closest("li")!.getBoundingClientRect();
        return bounds.right <= card.right && bounds.left >= card.left;
      }),
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("trip-editor-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Guardar viagem" }).click();
  await expect(
    page.getByRole("heading", { name: "Passeio ao Gerês" }),
  ).toBeVisible();
  await expect(page.locator(".itinerary h3")).toHaveText([
    "Porto",
    "Amares",
    "Braga",
    "Gerês",
  ]);
  await expect(page.getByText("Percurso por calcular")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("trip-desktop.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Editar viagem", exact: true })
    .click();
  await page.getByLabel("Título da viagem").fill("Volta ao Gerês");
  await page.getByLabel("Remover paragem 2").click();
  await page.getByRole("button", { name: "Guardar viagem" }).click();
  await expect(page.locator(".itinerary h3")).toHaveText([
    "Porto",
    "Amares",
    "Gerês",
  ]);
  await page.getByRole("button", { name: "Marcar como planeada" }).click();
  await expect(page.locator(".trip-status")).toHaveText("Planeada");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("trip-mobile.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Cancelar viagem", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirmar cancelamento" }).click();
  await expect(page.locator(".trip-status")).toHaveText("Cancelada");
  await expect(
    page.getByRole("button", { name: "Editar viagem", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Remover viagem", exact: true })
    .click();
  await page.getByRole("button", { name: "Manter viagem" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Remover viagem", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirmar remoção" }).click();
  await expect(page.getByText("Para onde vamos?")).toBeVisible();
});
