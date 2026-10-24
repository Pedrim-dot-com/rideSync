import { test, expect, type BrowserContext } from "@playwright/test";
test("organizer creates/revokes a link, rider signs up, logs in and accepts with a private bike (mocked transport)", async ({
  page,
  browser,
  baseURL,
}, testInfo) => {
  const ownerId = "00000000-0000-4000-8000-000000000001";
  const riderId = "00000000-0000-4000-8000-000000000002";
  const tripId = "00000000-0000-4000-8000-000000000010";
  const bikeId = "00000000-0000-4000-8000-000000000020";
  const trip = {
    id: tripId,
    created_by: ownerId,
    title: "Volta com amigos",
    departure_at: "2026-12-01T09:00:00Z",
    status: "planned",
    revision: 1,
    created_at: "2026-10-24T09:00:00Z",
    updated_at: "2026-10-24T09:00:00Z",
  };
  let accepted = false;
  let selected = false;
  const invitations: {
    invitation_id: string;
    created_at: string;
    expires_at: string;
    used_at: string | null;
    response: string | null;
    revoked_at: string | null;
    token: string;
  }[] = [];
  const profile = (id: string) => ({
    id,
    aud: "authenticated",
    role: "authenticated",
    email: id === ownerId ? "owner@example.test" : "rider@example.test",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-10-24T09:00:00Z",
  });
  async function transport(context: BrowserContext, id: string) {
    await context.route("https://api.maptiler.com/**", (route) =>
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
    await context.route("http://127.0.0.1:54321/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      // Fragment invitation secrets must never be sent in a request URL.
      expect(request.url()).not.toContain("invite=");
      let body: unknown;
      if (request.method() === "OPTIONS") {
        await route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "*",
            "access-control-allow-methods": "*",
          },
        });
        return;
      }
      const path = url.pathname;
      if (path.endsWith("/token"))
        body = {
          access_token: `${id}-access`,
          refresh_token: `${id}-refresh`,
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: "bearer",
          user: profile(id),
        };
      else if (path.endsWith("/signup"))
        body = { user: profile(id), session: null };
      else if (path.endsWith("/user")) body = profile(id);
      else if (path.endsWith("/tracking_snapshot"))
        body = {
          server_now: new Date().toISOString(),
          status: trip.status,
          revision: trip.revision,
          session: null,
          positions: [],
        };
      else if (path.endsWith("/motorcycles"))
        body =
          id === riderId
            ? [
                {
                  id: bikeId,
                  user_id: riderId,
                  brand: "Honda",
                  model: "CB500",
                  is_primary: true,
                  manufacture_year: null,
                  engine_cc: null,
                  color: null,
                },
              ]
            : [];
      else if (path.endsWith("/trips")) {
        if (id !== ownerId && !accepted) body = [];
        else body = url.searchParams.has("id") ? trip : [trip];
      } else if (path.endsWith("/trip_waypoints"))
        body = [
          {
            id: "point-1",
            trip_id: tripId,
            position: 0,
            label: "Porto",
            latitude: 41.15,
            longitude: -8.62,
          },
          {
            id: "point-2",
            trip_id: tripId,
            position: 1,
            label: "Gaia",
            latitude: 41.13,
            longitude: -8.61,
          },
        ];
      else if (path.endsWith("/trip_routes")) body = [];
      else if (path.endsWith("/trip_participants"))
        body = [
          {
            trip_id: tripId,
            user_id: ownerId,
            role: "organizer",
            status: "accepted",
            motorcycle_id: null,
            joined_at: trip.created_at,
          },
          ...(accepted
            ? [
                {
                  trip_id: tripId,
                  user_id: riderId,
                  role: "rider",
                  status: "accepted",
                  motorcycle_id: selected ? bikeId : null,
                  joined_at: trip.created_at,
                },
              ]
            : []),
        ];
      else if (path.endsWith("/list_trip_members"))
        body = [
          {
            user_id: ownerId,
            role: "organizer",
            display_name: "Pedro",
            username: "pedro",
            motorcycle_brand: null,
            motorcycle_model: null,
          },
          ...(accepted
            ? [
                {
                  user_id: riderId,
                  role: "rider",
                  display_name: "Ana",
                  username: "ana",
                  motorcycle_brand: selected ? "Honda" : null,
                  motorcycle_model: selected ? "CB500" : null,
                },
              ]
            : []),
        ];
      else if (path.endsWith("/list_trip_invitations"))
        body = invitations.map(({ token, ...metadata }) => {
          expect(token).toHaveLength(64);
          return metadata;
        });
      else if (path.endsWith("/create_trip_invitation")) {
        expect(id).toBe(ownerId);
        const invite = {
          invitation_id: `invite-${invitations.length + 1}`,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 48 * 3600000).toISOString(),
          used_at: null,
          response: null,
          revoked_at: null,
          token: (invitations.length === 0 ? "a" : "b").repeat(64),
        };
        invitations.push(invite);
        body = [
          {
            invitation_id: invite.invitation_id,
            token: invite.token,
            expires_at: invite.expires_at,
          },
        ];
      } else if (path.endsWith("/revoke_trip_invitation")) {
        expect(id).toBe(ownerId);
        const data = request.postDataJSON();
        invitations.find(
          (i) => i.invitation_id === data.p_invitation_id,
        )!.revoked_at = new Date().toISOString();
        body = null;
      } else if (path.endsWith("/respond_trip_invitation")) {
        expect(id).toBe(riderId);
        const data = request.postDataJSON();
        expect(data).toEqual({ p_token: "b".repeat(64), p_accept: true });
        accepted = true;
        invitations[1].used_at = new Date().toISOString();
        invitations[1].response = "accepted";
        body = tripId;
      } else if (path.endsWith("/set_trip_motorcycle")) {
        expect(id).toBe(riderId);
        expect(request.postDataJSON()).toEqual({
          p_trip_id: tripId,
          p_motorcycle_id: bikeId,
        });
        selected = true;
        body = null;
      } else throw new Error(`Unexpected mock endpoint: ${path}`);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify(body),
      });
    });
  }
  await transport(page.context(), ownerId);
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("owner@example.test");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByRole("button", { name: "Viagens", exact: true }).click();
  await page
    .getByRole("button", { name: "Ver viagem Volta com amigos" })
    .click();
  await expect(page.getByText("Pedro (tu)")).toBeVisible();
  await page.getByRole("button", { name: "Criar link de convite" }).click();
  await expect(page.getByLabel("Link do convite")).toHaveValue(
    /#invite=a{64}$/,
  );
  await page.getByRole("button", { name: "Revogar convite 1" }).click();
  await expect(page.getByLabel("Link do convite")).toHaveCount(0);
  await expect(page.getByText(/ · Revogado/)).toBeVisible();
  await page.getByRole("button", { name: "Criar link de convite" }).click();
  const invitationURL = await page.getByLabel("Link do convite").inputValue();
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
  });
  try {
    await transport(context, riderId);
    const rider = await context.newPage();
    await rider.goto(invitationURL);
    await expect(
      rider.getByRole("heading", { name: "Recebeste um convite" }),
    ).toBeVisible();
    await expect(
      rider.getByRole("button", { name: "Aceitar convite" }),
    ).toHaveCount(0);
    await expect(rider.getByText("Volta com amigos")).toHaveCount(0);
    expect(new URL(rider.url()).hash).toBe("");
    await rider
      .getByRole("button", { name: "Criar conta", exact: true })
      .click();
    await rider.getByLabel("Email", { exact: true }).fill("rider@example.test");
    await rider.getByLabel("Password", { exact: true }).fill("password123");
    await rider
      .getByRole("button", { name: "Criar conta", exact: true })
      .click();
    await expect(
      rider.getByText(
        "Se o registo for aceite, receberás um email de confirmação.",
      ),
    ).toBeVisible();
    await rider.reload();
    await expect(
      rider.getByRole("heading", { name: "Recebeste um convite" }),
    ).toBeVisible();
    await rider.getByLabel("Email", { exact: true }).fill("rider@example.test");
    await rider.getByLabel("Password", { exact: true }).fill("password123");
    await rider.getByRole("button", { name: "Entrar", exact: true }).click();
    await rider.getByRole("button", { name: "Aceitar convite" }).click();
    await expect(
      rider.getByRole("heading", { name: "Volta com amigos" }),
    ).toBeVisible();
    await expect(rider.getByText("Ana (tu)")).toBeVisible();
    await expect(
      rider.getByRole("button", { name: "Criar link de convite" }),
    ).toHaveCount(0);
    await rider.getByLabel("A tua mota nesta viagem").selectOption(bikeId);
    await rider.getByRole("button", { name: "Guardar mota da viagem" }).click();
    await expect(rider.getByText("Mota da viagem atualizada.")).toBeVisible();
    await expect(
      rider.locator(".participant-list").getByText("Honda CB500"),
    ).toBeVisible();
    expect(
      await rider.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      rider.getByRole("region", { name: "Mapa do itinerário" }),
    ).toHaveAttribute("data-map-ready", "true");
    await rider.screenshot({
      path: testInfo.outputPath("participants-mobile.png"),
      fullPage: true,
    });
    await rider.reload();
    await expect(
      rider.getByRole("heading", { name: "Recebeste um convite" }),
    ).toHaveCount(0);
    // Opening another fragment while the SPA is already running must work too.
    await rider.evaluate(() => {
      window.location.hash = "invite=" + "c".repeat(64);
    });
    await expect(
      rider.getByRole("heading", { name: "Recebeste um convite" }),
    ).toBeVisible();
    expect(new URL(rider.url()).hash).toBe("");
  } finally {
    await context.close();
  }
});
