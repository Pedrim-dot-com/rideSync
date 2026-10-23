import { test, expect } from "@playwright/test";
test("login, garage CRUD, primary motorcycle, profile and logout (mocked Supabase transport)", async ({
  page,
}) => {
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "rider@example.test",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  let bikes: Record<string, unknown>[] = [];
  let profile = {
    id: user.id,
    display_name: "",
    username: null as string | null,
  };
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
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
    else if (path.endsWith("/motorcycles")) {
      if (request.method() === "POST") {
        const input = request.postDataJSON();
        const bike = { ...input, id: "test-bike", is_primary: false };
        bikes.push(bike);
        body = { id: bike.id };
      } else if (request.method() === "PATCH") {
        bikes = bikes.map((b) => ({ ...b, ...request.postDataJSON() }));
        body = { id: "test-bike" };
      } else if (request.method() === "DELETE") {
        bikes = [];
        body = { id: "test-bike" };
      } else body = bikes;
    } else if (path.endsWith("/set_primary_motorcycle")) {
      bikes = bikes.map((b) => ({ ...b, is_primary: true }));
      body = null;
    } else if (path.endsWith("/profiles")) {
      if (request.method() === "PATCH") {
        profile = { ...profile, ...request.postDataJSON() };
        body = { id: user.id };
      } else body = profile;
    }
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
  await expect(page.getByText("O primeiro lugar é teu.")).toBeVisible();
  await page.getByRole("button", { name: "Adicionar a primeira mota" }).click();
  await page.getByLabel("Marca", { exact: true }).fill("Honda");
  await page.getByLabel("Modelo", { exact: true }).fill("CB500");
  await page.getByRole("button", { name: "Guardar mota" }).click();
  await expect(page.getByRole("heading", { name: "CB500" })).toBeVisible();
  await page.getByRole("button", { name: "Tornar principal" }).click();
  await expect(
    page.getByRole("button", { name: "Mota principal", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Editar CB500").click();
  await page.getByLabel("Modelo", { exact: true }).fill("CB500X");
  await page.getByRole("button", { name: "Guardar mota" }).click();
  await expect(page.getByRole("heading", { name: "CB500X" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Perfil", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Rider");
  await page.getByLabel("Nickname").fill("rider_test");
  await page.getByRole("button", { name: "Guardar perfil" }).click();
  await expect(page.getByText("Perfil atualizado.")).toBeVisible();
  await page.getByRole("button", { name: "Garagem", exact: true }).click();
  await page.getByLabel("Remover CB500X").click();
  await page.getByRole("button", { name: "Confirmar remoção" }).click();
  await expect(page.getByText("O primeiro lugar é teu.")).toBeVisible();
  await page.getByLabel("Terminar sessão").click();
  await expect(
    page.getByRole("button", { name: "Entrar", exact: true }),
  ).toBeVisible();
});
