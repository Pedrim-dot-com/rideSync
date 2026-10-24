import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { InstallBanner } from "./InstallBanner";
beforeEach(() => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Safari",
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});
describe("mobile installation help", () => {
  it("shows Safari instructions without attempting an unsupported native install", () => {
    render(<InstallBanner show />);
    fireEvent.click(screen.getByRole("button", { name: "Como instalar" }));
    expect(
      screen.getByRole("heading", { name: "No iPhone ou iPad" }),
    ).toBeVisible();
    expect(screen.getByText("Adicionar ao ecrã principal")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Instalar app" }),
    ).not.toBeInTheDocument();
  });
  it("is hidden in an installed standalone PWA", () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);
    render(<InstallBanner show />);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
  it("remembers dismissal without storing account data", () => {
    const { unmount } = render(<InstallBanner show />);
    fireEvent.click(screen.getByLabelText("Dispensar dica de instalação"));
    unmount();
    render(<InstallBanner show />);
    expect(
      screen.queryByText("Leva o RideSync no bolso"),
    ).not.toBeInTheDocument();
    expect(localStorage.length).toBe(1);
  });
  it("retains Android installation event before login and hides after appinstalled", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 Android Chrome",
    );
    const { rerender } = render(<InstallBanner show={false} />);
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    fireEvent(window, event);
    expect(event.defaultPrevented).toBe(true);
    rerender(<InstallBanner show />);
    fireEvent.click(screen.getByRole("button", { name: "Instalar app" }));
    await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
    expect(await screen.findByRole("status")).toHaveTextContent(
      "concluir a instalação",
    );
    fireEvent(window, new Event("appinstalled"));
    expect(
      screen.queryByText("Leva o RideSync no bolso"),
    ).not.toBeInTheDocument();
  });
  it("can be dismissed even with storage blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Blocked");
    });
    render(<InstallBanner show />);
    fireEvent.click(screen.getByLabelText("Dispensar dica de instalação"));
    expect(
      screen.queryByText("Leva o RideSync no bolso"),
    ).not.toBeInTheDocument();
  });
});
