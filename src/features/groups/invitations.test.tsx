import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReceivedGroupInvitations } from "./ReceivedGroupInvitations";
import { GroupInvitationManager } from "./GroupInvitationManager";
import { inviteGroupMember } from "./invitations-api";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../shared/supabase", () => ({ client: () => ({ rpc }) }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function wrap(component: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      {component}
    </QueryClientProvider>,
  );
}
const invitation = {
  invitation_id: "invite",
  group_id: "group",
  group_name: "Motards do Porto",
  inviter_name: "Ana",
  created_at: "2026-10-24T09:00Z",
  expires_at: "2026-10-31T09:00Z",
  status: "pending",
};
describe("member invitations and leader approval", () => {
  it("allows an ordinary member to send an invitation by exact nickname", async () => {
    rpc.mockImplementation(async (name) => ({
      data: name === "list_sent_group_invitations" ? [] : "invite",
      error: null,
    }));
    wrap(
      <GroupInvitationManager groupId="group" userId="member" leader={false} />,
    );
    fireEvent.change(screen.getByLabelText(/Nickname da pessoa/), {
      target: { value: "@carla" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Propor convite de grupo" }),
    );
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("invite_group_member", {
        p_group_id: "group",
        p_username: "carla",
      }),
    );
    expect(
      await screen.findByText(/Pedido de convite registado/),
    ).toBeVisible();
  });
  it("acceptance of an approved invitation joins the group", async () => {
    let accepted = false;
    rpc.mockImplementation(async (name) => {
      if (name === "respond_group_invitation") {
        accepted = true;
        return { data: "group", error: null };
      }
      return {
        data: [{ ...invitation, status: accepted ? "joined" : "pending" }],
        error: null,
      };
    });
    wrap(<ReceivedGroupInvitations userId="recipient" />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Aceitar convite de grupo",
      }),
    );
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("respond_group_invitation", {
        p_invitation_id: "invite",
        p_accept: true,
      }),
    );
    expect(
      await screen.findByText("Convite aceite. Já pertences ao grupo."),
    ).toBeVisible();
    expect(
      screen.queryByText("Membro · inscrição aceite"),
    ).not.toBeInTheDocument();
  });
  it("refuses an invitation without applying for membership", async () => {
    rpc.mockImplementation(async (name) => ({
      data: name === "respond_group_invitation" ? null : [invitation],
      error: null,
    }));
    wrap(<ReceivedGroupInvitations userId="recipient" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Recusar convite de grupo" }),
    );
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("respond_group_invitation", {
        p_invitation_id: "invite",
        p_accept: false,
      }),
    );
    expect(await screen.findByText("Convite recusado.")).toBeVisible();
  });
  it("only actions pending invitations and explains expired invitations", async () => {
    rpc.mockResolvedValue({
      data: [{ ...invitation, status: "expired" }],
      error: null,
    });
    wrap(<ReceivedGroupInvitations userId="recipient" />);
    expect(await screen.findByText("Expirado")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Aceitar convite de grupo" }),
    ).not.toBeInTheDocument();
  });
  it("normalizes a single @ without changing case or searching unrelated people", async () => {
    rpc.mockResolvedValue({ data: "invite", error: null });
    await inviteGroupMember("group", " @Carla ");
    expect(rpc).toHaveBeenCalledWith("invite_group_member", {
      p_group_id: "group",
      p_username: "Carla",
    });
  });
  it("only leaders can review member proposals in the interface", async () => {
    let approved = false;
    rpc.mockImplementation(async (name) => {
      if (name === "review_group_invitation") {
        approved = true;
        return { data: null, error: null };
      }
      return {
        data: [
          {
            invitation_id: "invite",
            display_name: "Carla",
            username: "carla",
            created_at: invitation.created_at,
            expires_at: invitation.expires_at,
            status: approved ? "pending" : "review",
          },
        ],
        error: null,
      };
    });
    wrap(<GroupInvitationManager groupId="group" userId="leader" leader />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Aprovar convite para carla" }),
    );
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("review_group_invitation", {
        p_group_id: "group",
        p_invitation_id: "invite",
        p_approve: true,
      }),
    );
    expect(
      await screen.findByText(
        "Convite aprovado e enviado à pessoa para aceitação.",
      ),
    ).toBeVisible();
  });
});
