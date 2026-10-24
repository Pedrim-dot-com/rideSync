import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  act,
  fireEvent,
  screen,
} from "@testing-library/react";
import { UpdateNotice } from "./UpdateNotice";
const worker = vi.hoisted(() => ({
  registered: undefined as
    | undefined
    | ((_url: string, registration: ServiceWorkerRegistration) => void),
  needRefresh: false,
  apply: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: (options: { onRegisteredSW: typeof worker.registered }) => {
    worker.registered = options.onRegisteredSW;
    return {
      needRefresh: [worker.needRefresh, worker.dismiss],
      updateServiceWorker: worker.apply,
    };
  },
}));
beforeEach(() => {
  vi.useFakeTimers();
  worker.needRefresh = false;
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});
it("checks for new deployments on resume without reloading or interrupting the user", async () => {
  const update = vi.fn().mockResolvedValue(undefined);
  render(<UpdateNotice />);
  await act(async () =>
    worker.registered?.("/sw.js", {
      update,
    } as unknown as ServiceWorkerRegistration),
  );
  expect(update).toHaveBeenCalledTimes(1);
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(update).toHaveBeenCalledTimes(1);
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "hidden",
  });
  await act(async () => {
    vi.advanceTimersByTime(60000);
  });
  expect(update).toHaveBeenCalledTimes(1);
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(update).toHaveBeenCalledTimes(2);
  expect(worker.apply).not.toHaveBeenCalled();
});
it("applies a waiting update only after explicit confirmation", () => {
  worker.needRefresh = true;
  render(<UpdateNotice />);
  fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
  expect(worker.apply).toHaveBeenCalledWith(true);
});
