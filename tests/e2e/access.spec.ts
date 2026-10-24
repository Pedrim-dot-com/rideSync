import { test, expect } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
test.use({
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
  viewport: { width: 390, height: 844 },
  hasTouch: true,
});
test("install instructions, real browser WebAuthn ceremonies, Auth session and passkey removal (mocked Auth transport)", async ({
  page,
  context,
}, testInfo) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "rider@example.test",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-10-24T09:00:00Z",
  };
  const session = () => ({
    access_token: "test-access-token",
    refresh_token: "test-refresh-token",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user,
  });
  let keys: { id: string; friendly_name: string; created_at: string }[] = [];
  let credentialId = "";
  let authChallenge = "";
  let challengeId = "";
  let rejectLogin = true;
  let assertions = 0;
  const registrationChallenge = randomBytes(32).toString("base64url");
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
    let body: unknown;
    if (path.endsWith("/token")) body = session();
    else if (path.endsWith("/logout")) {
      await route.fulfill({ status: 204, headers });
      return;
    } else if (path.endsWith("/user")) body = user;
    else if (path.endsWith("/trips")) body = [];
    else if (path.endsWith("/profiles"))
      body = { id: user.id, display_name: "Motard", username: "motard" };
    else if (path.endsWith("/passkeys/registration/options")) {
      expect(req.headers().authorization).toBe("Bearer test-access-token");
      body = {
        challenge_id: "registration",
        expires_at: Math.floor(Date.now() / 1000) + 300,
        options: {
          challenge: registrationChallenge,
          rp: { id: "localhost", name: "RideSync test" },
          user: {
            id: Buffer.from(user.id).toString("base64url"),
            name: user.email,
            displayName: "Motard",
          },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }],
          timeout: 60000,
          attestation: "none",
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            residentKey: "required",
            userVerification: "required",
          },
        },
      };
    } else if (path.endsWith("/passkeys/registration/verify")) {
      const input = req.postDataJSON();
      expect(input.challenge_id).toBe("registration");
      expect(input.credential.type).toBe("public-key");
      const clientData = JSON.parse(
        Buffer.from(
          input.credential.response.clientDataJSON,
          "base64url",
        ).toString(),
      );
      expect(clientData.type).toBe("webauthn.create");
      expect(clientData.challenge).toBe(registrationChallenge);
      expect(clientData.origin).toBe("http://localhost:4173");
      expect(
        input.credential.response.attestationObject.length,
      ).toBeGreaterThan(20);
      credentialId = input.credential.id;
      keys = [
        {
          id: "key-id",
          friendly_name: "Chave de teste",
          created_at: new Date().toISOString(),
        },
      ];
      body = keys[0];
    } else if (path.endsWith("/passkeys/authentication/options")) {
      authChallenge = randomBytes(32).toString("base64url");
      challengeId = randomUUID();
      body = {
        challenge_id: challengeId,
        expires_at: Math.floor(Date.now() / 1000) + 300,
        options: {
          challenge: authChallenge,
          rpId: "localhost",
          userVerification: "required",
          timeout: 60000,
          allowCredentials: [
            { type: "public-key", id: credentialId, transports: ["internal"] },
          ],
        },
      };
    } else if (path.endsWith("/passkeys/authentication/verify")) {
      const input = req.postDataJSON();
      expect(input.challenge_id).toBe(challengeId);
      expect(input.credential.id).toBe(credentialId);
      expect(input.credential.response.signature.length).toBeGreaterThan(20);
      const clientData = JSON.parse(
        Buffer.from(
          input.credential.response.clientDataJSON,
          "base64url",
        ).toString(),
      );
      expect(clientData.type).toBe("webauthn.get");
      expect(clientData.challenge).toBe(authChallenge);
      assertions++;
      if (rejectLogin) {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          headers,
          body: JSON.stringify({
            code: "invalid_credentials",
            message: "Credential rejected",
          }),
        });
        return;
      }
      body = session();
    } else if (path.endsWith("/passkeys/key-id")) {
      expect(req.method()).toBe("DELETE");
      expect(req.headers().authorization).toBe("Bearer test-access-token");
      keys = [];
      await route.fulfill({ status: 204, headers });
      return;
    } else if (path.endsWith("/passkeys")) body = keys;
    else throw new Error(`Unexpected mock path ${path}`);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers,
      body: JSON.stringify(body),
    });
  });
  await page.goto("http://localhost:4173/");
  await expect(
    page.getByRole("button", { name: "Entrar com passkey" }),
  ).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Leva o RideSync no bolso" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Como instalar" }).click();
  await expect(page.getByText("Adicionar ao ecrã principal")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("install-iphone.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Perfil", exact: true }).click();
  await page.getByRole("button", { name: "Ativar chave de acesso" }).click();
  await expect(
    page.getByText(
      "Chave de acesso criada. Na próxima entrada, escolhe Entrar com passkey.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Chave de teste", { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("passkeys-profile.png"),
    fullPage: true,
  });
  await page.getByLabel("Terminar sessão").click();
  await page.getByRole("button", { name: "Entrar com passkey" }).click();
  await expect(page.getByRole("status")).toHaveText(/Não foi possível usar/);
  await expect(
    page.getByRole("button", { name: "Entrar", exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole("heading", { name: /^Viagens\.?$/ })).toHaveCount(
    0,
  );
  rejectLogin = false;
  await page.getByRole("button", { name: "Entrar com passkey" }).click();
  await expect(
    page.getByRole("heading", { name: /^Viagens\.?$/ }),
  ).toBeVisible();
  expect(assertions).toBe(2);
  await page.getByRole("button", { name: "Perfil", exact: true }).click();
  await page.getByLabel("Remover chave de acesso 1").click();
  expect(keys).toHaveLength(1);
  await page
    .getByRole("button", { name: "Confirmar remoção da chave" })
    .click();
  await expect(
    page.getByText(
      "Chave de acesso removida. O acesso por email e password continua disponível.",
    ),
  ).toBeVisible();
  expect(keys).toHaveLength(0);
  await cdp.send("WebAuthn.disable");
});
