import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TripVoice } from "./TripVoice";
import * as api from "./api";
const mocks = vi.hoisted(() => ({
  mic: vi.fn(),
  close: vi.fn(),
  enable: vi.fn(),
}));
vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  getVoiceSnapshot: vi.fn(),
  raiseSos: vi.fn(),
  resolveSos: vi.fn(),
  voiceAction: vi.fn(),
}));
vi.mock("./RadioConnection", () => ({
  RadioConnection: class {
    enabled = false;
    enable = mocks.enable;
    close = mocks.close;
    prepareMicrophone = mocks.mic;
    update = vi.fn();
    cancelMicrophone = vi.fn();
    checkFreshness = vi.fn();
  },
}));
vi.mock("../../shared/supabase", () => ({
  client: () => ({
    channel: () => ({
      on() {
        return this;
      },
      subscribe() {
        return this;
      },
    }),
    removeChannel: vi.fn(),
  }),
}));
const snapshot: api.VoiceSnapshot = {
  status: "active",
  server_now: new Date().toISOString(),
  room_epoch: "epoch",
  speaker_id: null,
  speaker_name: null,
  speaker_kind: null,
  speaker_until: null,
  ready: false,
  settling: false,
  sos: null,
};
function renderVoice(owner = false) {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
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
      <TripVoice tripId="trip" userId="rider" owner={owner} active />
    </QueryClientProvider>,
  );
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.restoreAllMocks();
});
describe("trip voice and SOS interface", () => {
  it("keeps the SOS visible when microphone access is denied", async () => {
    let raised = false;
    vi.mocked(api.getVoiceSnapshot).mockImplementation(async () => ({
      ...snapshot,
      sos: raised
        ? {
            user_id: "rider",
            display_name: "Ana",
            reason: "puncture",
            raised_at: snapshot.server_now,
            expires_at: new Date(Date.now() + 90000).toISOString(),
          }
        : null,
    }));
    vi.mocked(api.raiseSos).mockImplementation(async () => {
      raised = true;
    });
    mocks.mic.mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
    renderVoice();
    await screen.findByRole("button", { name: "Ouvir grupo" });
    expect(
      screen.queryByRole("button", { name: "Falar para o grupo" }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Motivo do SOS"), {
      target: { value: "puncture" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "SOS · preciso de ajuda" }),
    );
    await waitFor(() =>
      expect(api.raiseSos).toHaveBeenCalledWith("trip", "puncture"),
    );
    expect(
      await screen.findByText(
        "SOS visual enviado ao grupo. Não foi possível ativar a voz.",
      ),
    ).toBeVisible();
    expect(screen.getByText(/SOS · Ana/)).toBeVisible();
    expect(screen.getByText("Furo")).toBeVisible();
    expect(api.voiceAction).not.toHaveBeenCalled();
  });
  it("blocks organizer speech during another participant's SOS", async () => {
    vi.mocked(api.getVoiceSnapshot).mockResolvedValue({
      ...snapshot,
      sos: {
        user_id: "other",
        display_name: "Pedro",
        reason: "left_behind",
        raised_at: snapshot.server_now,
        expires_at: new Date(Date.now() + 90000).toISOString(),
      },
    });
    renderVoice(true);
    expect(
      await screen.findByRole("button", { name: "Falar para o grupo" }),
    ).toBeDisabled();
    expect(
      await screen.findByRole("button", { name: "Resolver SOS" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "SOS · preciso de ajuda" }),
    ).toBeDisabled();
  });
  it("does not restart audio when a delayed speech response arrives after pagehide", async () => {
    vi.mocked(api.getVoiceSnapshot).mockResolvedValue(snapshot);
    mocks.mic.mockResolvedValue(undefined);
    let finish!: (value: unknown) => void;
    vi.mocked(api.voiceAction).mockImplementation((_trip, action) =>
      action === "speak"
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : Promise.resolve({ ok: true }),
    );
    renderVoice(true);
    const speak = await screen.findByRole("button", {
      name: "Falar para o grupo",
    });
    await waitFor(() => expect(speak).toBeEnabled());
    fireEvent.click(speak);
    await waitFor(() =>
      expect(api.voiceAction).toHaveBeenCalledWith("trip", "speak"),
    );
    fireEvent(window, new Event("pagehide"));
    finish({ ok: true });
    await waitFor(() =>
      expect(screen.queryByText("A preparar o canal…")).not.toBeInTheDocument(),
    );
    expect(mocks.enable).not.toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalled();
  });
});
