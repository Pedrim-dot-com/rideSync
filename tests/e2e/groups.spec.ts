import { test, expect } from "@playwright/test";
test("directory, public headquarters map, approval requests and multiple leaders (mocked transport)", async ({
  page,
}, testInfo) => {
  const userId = "00000000-0000-4000-8000-000000000051";
  const otherId = "00000000-0000-4000-8000-000000000052";
  const user = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: "groups@example.test",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const groups = [
    {
      id: "group-1",
      name: "Motards do Norte",
      description: "Grupo com sede física",
      legal_name: "Associação Motards do Norte",
      registration_number: "Declarado pelo grupo",
      headquarters_address: "Porto, Portugal",
      latitude: 41.15,
      longitude: -8.62,
      revision: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
  let membership: {
    group_id: string;
    user_id: string;
    role: string;
    status: string;
    updated_at: string;
  } | null = null;
  const members = [
    {
      user_id: otherId,
      display_name: "Ana",
      username: "ana",
      role: "leader",
      status: "accepted",
    },
  ];
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
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "*",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    let body: unknown;
    if (path.endsWith("/list_received_group_invitations")) body = [];
    else if (path.endsWith("/list_sent_group_invitations")) body = [];
    else if (path.endsWith("/token"))
      body = {
        access_token: "groups-token",
        refresh_token: "groups-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user,
      };
    else if (path.endsWith("/user")) body = user;
    else if (
      path.endsWith("/trips") ||
      path.endsWith("/list_received_trip_invitations")
    )
      body = [];
    else if (path.endsWith("/motard_groups")) body = groups;
    else if (path.endsWith("/group_memberships"))
      body = membership ? [membership] : [];
    else if (path.endsWith("/list_group_members"))
      body = [
        ...members,
        ...(membership?.status === "accepted"
          ? [
              {
                user_id: userId,
                display_name: "Pedro",
                username: "pedro",
                role: membership.role,
                status: "accepted",
              },
            ]
          : []),
      ];
    else if (path.endsWith("/change_group_membership")) {
      const data = request.postDataJSON();
      if (data.p_action === "request")
        membership = {
          group_id: "group-1",
          user_id: userId,
          role: "member",
          status: "pending",
          updated_at: new Date().toISOString(),
        };
      if (data.p_action === "promote")
        members.find((m) => m.user_id === data.p_user_id)!.role = "leader";
      if (data.p_action === "demote")
        members.find((m) => m.user_id === data.p_user_id)!.role = "member";
      body = null;
    } else throw new Error(`Unhandled group endpoint ${path}`);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers,
      body: JSON.stringify(body),
    });
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByRole("button", { name: "Grupos", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Grupos motards" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mapa das sedes", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Mapa das sedes dos grupos" }),
  ).toHaveAttribute("data-map-ready", "true");
  await page
    .getByRole("button", { name: "Ver grupo Motards do Norte" })
    .first()
    .click();
  await expect(
    page.getByText("Associação Motards do Norte", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pedir entrada no grupo" }).click();
  await expect(
    page.getByText("Pedido pendente de aprovação por um dirigente."),
  ).toBeVisible();
  // Simulate another leader's approval, then a later login/device refresh.
  membership!.status = "accepted";
  membership!.role = "leader";
  await page.reload();
  await page.getByRole("button", { name: "Grupos", exact: true }).click();
  await page.getByRole("button", { name: "O meu grupo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Membros e direção" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Editar grupo e sede" }),
  ).toBeVisible();
  await expect(page.getByText("Dirigente", { exact: true })).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("group-leadership-mobile.png"),
    fullPage: true,
  });
});
