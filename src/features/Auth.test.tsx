import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { Auth } from "./Auth";
const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
}));
vi.mock("../shared/supabase", () => ({ client: () => ({ auth }) }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
describe("authentication", () => {
  it("logs in through Supabase", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    render(<Auth onRecovered={() => {}} />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "rider@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() =>
      expect(auth.signInWithPassword).toHaveBeenCalledWith({
        email: "rider@example.test",
        password: "password123",
      }),
    );
  });
  it("does not reveal whether a recovery email has an account", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<Auth onRecovered={() => {}} />);
    fireEvent.click(screen.getByText("Esqueci-me da password"));
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "rider@example.test" },
    });
    fireEvent.click(screen.getByText("Enviar email"));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Se existir uma conta",
    );
  });
  it("updates password only in recovery mode", async () => {
    auth.updateUser.mockResolvedValue({ error: null });
    const done = vi.fn();
    render(<Auth recovery onRecovered={done} />);
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "newpassword123" },
    });
    fireEvent.click(screen.getByText("Guardar password"));
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(auth.updateUser).toHaveBeenCalledWith({
      password: "newpassword123",
    });
  });
  it("explains the next step when login requires email confirmation", async () => {
    auth.signInWithPassword.mockResolvedValue({
      error: {
        code: "email_not_confirmed",
        message: "internal service detail",
      },
    });
    render(<Auth onRecovered={() => {}} />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "rider@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Confirma primeiro o teu email",
    );
    expect(
      screen.queryByText("internal service detail"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });
  it("shows a safe login error", async () => {
    auth.signInWithPassword.mockResolvedValue({
      error: { message: "private details" },
    });
    render(<Auth onRecovered={() => {}} />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "rider@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByText("Entrar"));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Não foi possível concluir",
    );
    expect(screen.queryByText("private details")).not.toBeInTheDocument();
  });
});
