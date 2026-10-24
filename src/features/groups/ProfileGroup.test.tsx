import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProfileGroup } from "./ProfileGroup";
import * as api from "./api";
vi.mock("./api", () => ({
  getOwnMemberships: vi.fn(),
  getGroupSummary: vi.fn(),
}));
vi.mock("./ReceivedGroupInvitations", () => ({
  ReceivedGroupInvitations: () => null,
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function show(
  status: "none" | "pending" | "accepted",
  role: "member" | "leader" = "member",
) {
  vi.mocked(api.getOwnMemberships).mockResolvedValue(
    status === "none"
      ? []
      : [
          {
            group_id: "group",
            user_id: "me",
            role,
            status,
            updated_at: "2026-10-24",
          },
        ],
  );
  vi.mocked(api.getGroupSummary).mockResolvedValue({
    id: "group",
    name: "Motards do Porto",
    headquarters_address: "Sede pública",
  });
  const open = vi.fn();
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ProfileGroup userId="me" onOpenGroups={open} />
    </QueryClientProvider>,
  );
  return open;
}
describe("group on the user's own profile", () => {
  it("allows an ungrouped account and links to discovery", async () => {
    const open = show("none");
    expect(
      await screen.findByText(/Ainda não pertences a nenhum grupo/),
    ).toBeVisible();
    expect(api.getGroupSummary).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Explorar ou criar grupos" }),
    );
    expect(open).toHaveBeenCalledWith();
  });
  it("does not present a pending application as group membership", async () => {
    show("pending");
    expect(await screen.findByText("Motards do Porto")).toBeVisible();
    expect(screen.getByText(/Candidatura pendente/)).toBeVisible();
    expect(
      screen.queryByText("Membro · inscrição aceite"),
    ).not.toBeInTheDocument();
  });
  it("shows accepted group and member role with a direct link", async () => {
    const open = show("accepted");
    expect(await screen.findByText("Membro · inscrição aceite")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Ver o meu grupo ou candidatura" }),
    );
    expect(open).toHaveBeenCalledWith("group");
  });
  it("shows leadership accurately", async () => {
    show("accepted", "leader");
    expect(
      await screen.findByText("Dirigente · inscrição aceite"),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Gerir o meu grupo" }),
    ).toBeVisible();
  });
});
