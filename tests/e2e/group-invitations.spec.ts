import { test, expect, type BrowserContext } from "@playwright/test";
test("member proposes, leader reviews, recipient joins voluntarily and profile shows group (mocked transport)", async ({
  browser,
  baseURL,
}, testInfo) => {
  const ids = {
    leader: "00000000-0000-4000-8000-000000000071",
    member: "00000000-0000-4000-8000-000000000072",
    recipient: "00000000-0000-4000-8000-000000000073",
  };
  type Role = keyof typeof ids;
  const names = { leader: "Ana", member: "Bruno", recipient: "Carla" };
  const nicknames = { leader: "ana", member: "bruno", recipient: "carla" };
  const group = {
    id: "group-1",
    name: "Motards com amigos",
    description: "Grupo motard",
    legal_name: "",
    registration_number: "",
    headquarters_address: "Porto, Portugal",
    latitude: 41.15,
    longitude: -8.62,
    revision: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const memberships: Record<
    Role,
    {
      group_id: string;
      user_id: string;
      role: string;
      status: string;
      updated_at: string;
    } | null
  > = {
    leader: {
      group_id: group.id,
      user_id: ids.leader,
      role: "leader",
      status: "accepted",
      updated_at: group.created_at,
    },
    member: {
      group_id: group.id,
      user_id: ids.member,
      role: "member",
      status: "accepted",
      updated_at: group.created_at,
    },
    recipient: null,
  };
  let invitation: {
    invitation_id: string;
    group_id: string;
    group_name: string;
    inviter_name: string;
    created_at: string;
    expires_at: string;
    status: string;
  } | null = null;
  function inviteStatus() {
    return invitation?.status === "accepted"
      ? memberships.recipient?.status === "accepted"
        ? "joined"
        : "left"
      : invitation?.status;
  }
  async function transport(context: BrowserContext, who: Role) {
    const user = {
      id: ids[who],
      aud: "authenticated",
      role: "authenticated",
      email: `${who}@example.test`,
      app_metadata: {},
      user_metadata: {},
      created_at: group.created_at,
    };
    await context.route("http://127.0.0.1:54321/**", async (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        path = url.pathname;
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
      if (path.endsWith("/token"))
        body = {
          access_token: `${who}-access`,
          refresh_token: `${who}-refresh`,
          expires_in: 3600,
          token_type: "bearer",
          user,
        };
      else if (path.endsWith("/user")) body = user;
      else if (path.endsWith("/profiles"))
        body = {
          id: user.id,
          display_name: names[who],
          username: nicknames[who],
        };
      else if (
        path.endsWith("/passkeys") ||
        path.endsWith("/trips") ||
        path.endsWith("/list_received_trip_invitations")
      )
        body = [];
      else if (path.endsWith("/motard_groups"))
        body = url.searchParams.has("id")
          ? {
              id: group.id,
              name: group.name,
              headquarters_address: group.headquarters_address,
            }
          : [group];
      else if (path.endsWith("/group_memberships"))
        body = memberships[who] ? [memberships[who]] : [];
      else if (path.endsWith("/list_received_group_invitations"))
        body =
          who === "recipient" && invitation && invitation.status !== "review"
            ? [{ ...invitation, status: inviteStatus() }]
            : [];
      else if (path.endsWith("/list_sent_group_invitations"))
        body = invitation
          ? who === "leader" || who === "member"
            ? [
                {
                  ...invitation,
                  status: inviteStatus(),
                  display_name: "Carla",
                  username: "carla",
                },
              ]
            : []
          : [];
      else if (path.endsWith("/list_group_members"))
        body = (Object.keys(ids) as Role[]).flatMap((role) => {
          const m = memberships[role];
          return m && (m.status === "accepted" || who === "leader")
            ? [
                {
                  user_id: m.user_id,
                  display_name: names[role],
                  username: nicknames[role],
                  role: m.role,
                  status: m.status,
                },
              ]
            : [];
        });
      else if (path.endsWith("/invite_group_member")) {
        expect(who).toBe("member");
        expect(req.postDataJSON()).toEqual({
          p_group_id: group.id,
          p_username: "carla",
        });
        invitation = {
          invitation_id: "invitation-1",
          group_id: group.id,
          group_name: group.name,
          inviter_name: "Bruno",
          created_at: group.created_at,
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          status: "review",
        };
        body = invitation.invitation_id;
      } else if (path.endsWith("/review_group_invitation")) {
        expect(who).toBe("leader");
        expect(req.postDataJSON()).toEqual({
          p_group_id: group.id,
          p_invitation_id: "invitation-1",
          p_approve: true,
        });
        expect(memberships.recipient).toBeNull();
        invitation!.status = "pending";
        body = null;
      } else if (path.endsWith("/respond_group_invitation")) {
        expect(who).toBe("recipient");
        expect(req.postDataJSON()).toEqual({
          p_invitation_id: "invitation-1",
          p_accept: true,
        });
        invitation!.status = "accepted";
        memberships.recipient = {
          group_id: group.id,
          user_id: user.id,
          role: "member",
          status: "accepted",
          updated_at: group.created_at,
        };
        body = group.id;
      } else if (path.endsWith("/change_group_membership")) {
        expect(who).toBe("leader");
        expect(req.postDataJSON()).toEqual({
          p_group_id: group.id,
          p_action: "approve",
          p_user_id: ids.recipient,
        });
        memberships.recipient!.status = "accepted";
        body = null;
      } else throw new Error(`Unexpected endpoint ${path}`);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers,
        body: JSON.stringify(body),
      });
    });
  }
  const contexts: BrowserContext[] = [];
  async function login(who: Role) {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 375, height: 812 },
    });
    contexts.push(context);
    await transport(context, who);
    const page = await context.newPage();
    await page.goto("/");
    await page.getByLabel("Email", { exact: true }).fill(`${who}@example.test`);
    await page.getByLabel("Password", { exact: true }).fill("password123");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Grupos", exact: true }),
    ).toBeVisible();
    return page;
  }
  try {
    const member = await login("member");
    await member.getByRole("button", { name: "Grupos", exact: true }).click();
    await member
      .getByRole("button", { name: "O meu grupo", exact: true })
      .click();
    await expect(
      member.getByRole("button", { name: "Aprovar entrada" }),
    ).toHaveCount(0);
    await member.getByLabel(/Nickname da pessoa/).fill("@carla");
    await member
      .getByRole("button", { name: "Propor convite de grupo" })
      .click();
    await expect(member.getByText(/Pedido de convite registado/)).toBeVisible();
    const recipient = await login("recipient");
    await recipient
      .getByRole("button", { name: "Perfil", exact: true })
      .click();
    const profile = recipient.locator(".profile-group");
    await expect(
      profile.getByText(/Ainda não pertences a nenhum grupo/),
    ).toBeVisible();
    await expect(
      profile.getByRole("button", { name: "Aceitar convite de grupo" }),
    ).toHaveCount(0);
    const leader = await login("leader");
    await leader.getByRole("button", { name: "Grupos", exact: true }).click();
    await leader
      .getByRole("button", { name: "O meu grupo", exact: true })
      .click();
    await leader
      .getByRole("button", { name: "Aprovar convite para carla", exact: true })
      .click();
    await expect(
      leader.getByText("Convite aprovado e enviado à pessoa para aceitação."),
    ).toBeVisible();
    expect(memberships.recipient).toBeNull();
    await recipient.reload();
    await recipient
      .getByRole("button", { name: "Perfil", exact: true })
      .click();
    await recipient
      .locator(".profile-group")
      .getByRole("button", { name: "Aceitar convite de grupo" })
      .click();
    await expect(
      recipient
        .locator(".profile-group")
        .getByText("Membro · inscrição aceite"),
    ).toBeVisible();
    await expect(
      recipient.getByText(
        "Candidatura pendente · aguarda aprovação da direção",
      ),
    ).toHaveCount(0);
    await recipient
      .getByRole("button", { name: "Ver o meu grupo ou candidatura" })
      .click();
    await expect(
      recipient.getByRole("heading", {
        name: "Motards com amigos",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      recipient.getByRole("button", { name: "Propor convite de grupo" }),
    ).toBeVisible();
    await expect(
      recipient.getByRole("button", { name: "Aprovar entrada" }),
    ).toHaveCount(0);
    expect(
      await recipient.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await recipient.screenshot({
      path: testInfo.outputPath("group-member-invitation-mobile.png"),
      fullPage: true,
    });
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
