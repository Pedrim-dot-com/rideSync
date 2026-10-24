import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Auth } from "./Auth";
import { signInWithPasskey } from "./access/passkeys";
const password = vi.hoisted(() => vi.fn());
vi.mock("../shared/supabase", () => ({
  client: () => ({ auth: { signInWithPassword: password } }),
}));
vi.mock("./access/passkeys", async (original) => ({
  ...(await original<typeof import("./access/passkeys")>()),
  supportsPasskeys: () => true,
  signInWithPasskey: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
describe("passkey login entry", () => {
  it("starts a device ceremony without requiring or saving a password", async () => {
    vi.mocked(signInWithPasskey).mockResolvedValue();
    render(<Auth onRecovered={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Entrar com passkey" }));
    await waitFor(() =>
      expect(signInWithPasskey).toHaveBeenCalledWith(expect.any(AbortSignal)),
    );
    expect(password).not.toHaveBeenCalled();
  });
  it("keeps email/password usable after a failed ceremony", async () => {
    vi.mocked(signInWithPasskey).mockRejectedValue({ name: "NotAllowedError" });
    render(<Auth onRecovered={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Entrar com passkey" }));
    expect(await screen.findByRole("status")).toHaveTextContent("cancelado");
    expect(screen.getByRole("button", { name: "Entrar" })).toBeDefined();
    expect(screen.getByLabelText("Password")).toBeEnabled();
  });
  it("does not offer passkey login inside password recovery", () => {
    render(<Auth recovery onRecovered={() => {}} />);
    expect(
      screen.queryByRole("button", { name: "Entrar com passkey" }),
    ).not.toBeInTheDocument();
  });
});
