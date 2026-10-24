import { test, expect } from "@playwright/test";
test.use({ hasTouch: true });
test("mobile inputs, timed trip, explicit foreground GPS, map continuity and finishing (mocked transport)", async ({
  page,
  context,
}, testInfo) => {
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "rider@example.test",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-10-24T09:00:00Z",
  };
  const trip = {
    id: "tracking-trip",
    created_by: user.id,
    title: "Passeio GPS",
    departure_at: "2026-12-01T09:00:00Z",
    status: "planned",
    revision: 1,
    created_at: "2026-10-24T09:00:00Z",
    updated_at: "2026-10-24T09:00:00Z",
  };
  let session: {
    id: string;
    started_at: string;
    ended_at: string | null;
  } | null = null;
  let share: string | null = null;
  let publishCount = 0;
  let stopCount = 0;
  type Position = {
    user_id: string;
    display_name: string;
    latitude: number;
    longitude: number;
    accuracy_m: number;
    heading: number | null;
    recorded_at: string;
  };
  let positions: Position[] = [];
  const points = [
    {
      id: "a",
      trip_id: trip.id,
      position: 0,
      label: "Porto",
      latitude: 41.15,
      longitude: -8.62,
    },
    {
      id: "b",
      trip_id: trip.id,
      position: 1,
      label: "Gaia",
      latitude: 41.13,
      longitude: -8.61,
    },
  ];
  const geometry = {
    type: "LineString",
    coordinates: [
      [-8.62, 41.15],
      [-8.615, 41.14],
      [-8.61, 41.13],
    ],
  };
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({
    latitude: 41.149,
    longitude: -8.619,
    accuracy: 12,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://api.maptiler.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#eaf0df" },
          },
        ],
      }),
    }),
  );
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "*",
    };
    if (req.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    let body: unknown = null;
    if (path.endsWith("/token"))
      body = {
        access_token: "test-access",
        refresh_token: "test-refresh",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: "bearer",
        user,
      };
    else if (path.endsWith("/user")) body = user;
    else if (path.endsWith("/motorcycles")) body = [];
    else if (path.endsWith("/trips"))
      body = new URL(req.url()).searchParams.has("id") ? trip : [trip];
    else if (path.endsWith("/trip_waypoints")) body = points;
    else if (path.endsWith("/trip_participants"))
      body = [
        {
          trip_id: trip.id,
          user_id: user.id,
          role: "organizer",
          status: "accepted",
          motorcycle_id: null,
          joined_at: trip.created_at,
        },
      ];
    else if (path.endsWith("/trip_routes"))
      body = [
        {
          id: "route",
          trip_id: trip.id,
          geometry,
          distance_m: 4200,
          duration_s: 600,
          routing_provider: "openrouteservice",
          calculated_at: trip.created_at,
        },
      ];
    else if (path.endsWith("/list_trip_members"))
      body = [
        {
          user_id: user.id,
          role: "organizer",
          display_name: "Pedro",
          username: "pedro",
          motorcycle_brand: null,
          motorcycle_model: null,
        },
      ];
    else if (path.endsWith("/list_trip_invitations")) body = [];
    else if (path.endsWith("/tracking_snapshot"))
      body = {
        server_now: new Date().toISOString(),
        status: trip.status,
        revision: trip.revision,
        session,
        positions,
      };
    else if (path.endsWith("/start_trip")) {
      expect(req.postDataJSON()).toEqual({
        p_trip_id: trip.id,
        p_expected_revision: 1,
      });
      trip.status = "active";
      trip.revision = 2;
      session = {
        id: "session",
        started_at: new Date(Date.now() - 65000).toISOString(),
        ended_at: null,
      };
      body = "session";
    } else if (path.endsWith("/start_location_sharing")) {
      expect(session).not.toBeNull();
      share = "generation";
      body = share;
    } else if (path.endsWith("/publish_rider_location")) {
      const input = req.postDataJSON();
      expect(input.p_share_id).toBe(share);
      expect(input).not.toHaveProperty("user_id");
      positions = [
        {
          user_id: user.id,
          display_name: "Pedro",
          latitude: input.p_latitude,
          longitude: input.p_longitude,
          accuracy_m: input.p_accuracy_m,
          heading: input.p_heading,
          recorded_at: input.p_recorded_at,
        },
      ];
      publishCount++;
    } else if (path.endsWith("/stop_location_sharing")) {
      share = null;
      positions = [];
      stopCount++;
    } else if (path.endsWith("/finish_trip")) {
      expect(req.postDataJSON()).toEqual({
        p_trip_id: trip.id,
        p_expected_revision: 2,
      });
      session!.ended_at = new Date().toISOString();
      trip.status = "completed";
      trip.revision = 3;
      positions = [];
      share = null;
    } else throw new Error(`Unexpected mock endpoint ${path}`);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers,
      body: JSON.stringify(body),
    });
  });
  await page.goto("/");
  const email = page.getByLabel("Email", { exact: true });
  await email.tap();
  await email.fill("rider@example.test");
  expect(await email.evaluate((el) => getComputedStyle(el).fontSize)).toBe(
    "16px",
  );
  await expect(email).toBeFocused();
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByRole("button", { name: "Viagens", exact: true }).click();
  await page.getByRole("button", { name: "Criar viagem", exact: true }).click();
  await expect(page.getByLabel("Título da viagem")).not.toBeFocused();
  await page.getByLabel("Título da viagem").tap();
  await page.getByLabel("Título da viagem").fill("Título no telemóvel");
  await expect(page.getByLabel("Título da viagem")).toBeFocused();
  expect(
    await page
      .getByLabel("Título da viagem")
      .evaluate((el) => getComputedStyle(el).fontSize),
  ).toBe("16px");
  await page.getByRole("button", { name: "Voltar sem guardar" }).click();
  await page.getByRole("button", { name: "Ver viagem Passeio GPS" }).click();
  await expect(
    page.getByRole("region", { name: "Mapa do itinerário" }),
  ).toHaveAttribute("data-map-ready", "true");
  await expect(page.locator(".map-pin")).toHaveCount(2);
  await page
    .locator(".maplibregl-canvas")
    .evaluate((el) => el.setAttribute("data-same-canvas", "true"));
  await page
    .getByRole("button", { name: "Iniciar viagem", exact: true })
    .click();
  await expect(page.locator(".trip-status")).toHaveText("Em curso");
  await expect(page.getByLabel("Tempo decorrido da viagem")).toHaveText(
    /00:01:\d\d/,
  );
  expect(publishCount).toBe(0);
  await page
    .getByRole("button", { name: "Partilhar a minha localização" })
    .click();
  await expect(page.locator(".gps-own")).toHaveCount(1);
  expect(publishCount).toBe(1);
  await expect(page.locator(".maplibregl-canvas")).toHaveAttribute(
    "data-same-canvas",
    "true",
  );
  await expect(page.locator(".map-pin")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "A seguir a minha posição" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: testInfo.outputPath("active-gps-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Parar partilha GPS" }).click();
  await expect(page.locator(".gps-pin")).toHaveCount(0);
  await expect.poll(() => stopCount).toBe(1);
  await page
    .getByRole("button", { name: "Terminar viagem", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirmar fim da viagem" }).click();
  await expect(page.locator(".trip-status")).toHaveText("Concluída");
  const finalTime = await page
    .getByLabel("Tempo total da viagem")
    .textContent();
  await page.reload();
  await page.getByRole("button", { name: "Viagens", exact: true }).click();
  await page.getByRole("button", { name: "Ver viagem Passeio GPS" }).click();
  await expect(page.getByLabel("Tempo total da viagem")).toHaveText(finalTime!);
  await expect(
    page.getByRole("button", { name: "Partilhar a minha localização" }),
  ).toHaveCount(0);
  await expect(page.locator(".gps-pin")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await expect(
    page.getByRole("region", { name: "Mapa do itinerário" }),
  ).toHaveAttribute("data-map-ready", "true");
  await page.screenshot({
    path: testInfo.outputPath("completed-trip-mobile.png"),
    fullPage: true,
  });
});
