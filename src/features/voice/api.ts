import { z } from "zod";
import { client } from "../../shared/supabase";
export type SosReason = "puncture" | "mechanical" | "left_behind" | "other";
export const sosLabels: Record<SosReason, string> = {
  puncture: "Furo",
  mechanical: "Problema mecânico",
  left_behind: "Fiquei para trás",
  other: "Preciso de ajuda",
};
const snapshotSchema = z.object({
  status: z.string(),
  server_now: z.string(),
  room_epoch: z.string().nullable(),
  speaker_id: z.string().nullable(),
  speaker_name: z.string().nullable(),
  speaker_kind: z.enum(["organizer", "sos"]).nullable(),
  speaker_until: z.string().nullable(),
  ready: z.boolean(),
  settling: z.boolean(),
  sos: z
    .object({
      user_id: z.string(),
      display_name: z.string().nullable(),
      reason: z.enum(["puncture", "mechanical", "left_behind", "other"]),
      raised_at: z.string(),
      expires_at: z.string(),
    })
    .nullable(),
});
export type VoiceSnapshot = z.infer<typeof snapshotSchema>;
export type VoiceFunctions = {
  trip_voice_snapshot: { Args: { p_trip_id: string }; Returns: VoiceSnapshot };
  raise_trip_sos: {
    Args: { p_trip_id: string; p_reason: SosReason };
    Returns: undefined;
  };
  resolve_trip_sos: { Args: { p_trip_id: string }; Returns: undefined };
};
export type VoiceAction =
  "join" | "speak" | "sos" | "stop" | "leave" | "heartbeat";
export class VoiceClientError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export function voiceError(error: unknown) {
  const code =
    error instanceof VoiceClientError
      ? error.code
      : error && typeof error === "object" && "message" in error
        ? error.message
        : "";
  if (code === "VOICE_NOT_CONFIGURED")
    return "O serviço de voz ainda não está configurado. O alerta SOS visual continua disponível.";
  if (code === "SOS_ALREADY_ACTIVE")
    return "Já existe um SOS ativo. Aguarda que seja resolvido antes de falar.";
  if (code === "VOICE_BUSY" || code === "VOICE_CHANGED")
    return "O canal está a mudar de interlocutor. Tenta novamente dentro de instantes.";
  if (code === "RATE_LIMITED")
    return "Demasiados pedidos. Aguarda alguns segundos e tenta novamente.";
  if (
    error instanceof DOMException &&
    ["NotAllowedError", "NotFoundError"].includes(error.name)
  )
    return "Não foi possível aceder ao microfone. Autoriza-o nas definições do Safari ou Chrome. O SOS visual foi mantido.";
  return "A voz está indisponível. Verifica a ligação e volta a ativar o canal. O SOS visual não depende do microfone.";
}
export async function getVoiceSnapshot(tripId: string) {
  const { data, error } = await client().rpc("trip_voice_snapshot", {
    p_trip_id: tripId,
  });
  if (error) throw error;
  return snapshotSchema.parse(data);
}
export async function raiseSos(tripId: string, reason: SosReason) {
  const { error } = await client().rpc("raise_trip_sos", {
    p_trip_id: tripId,
    p_reason: reason,
  });
  if (error) throw error;
}
export async function resolveSos(tripId: string) {
  const { error } = await client().rpc("resolve_trip_sos", {
    p_trip_id: tripId,
  });
  if (error) throw error;
}
export async function voiceAction(tripId: string, action: VoiceAction) {
  const { data, error } = await client().functions.invoke("trip-voice", {
    body: { tripId, action },
  });
  if (error) {
    let code = "VOICE_UNAVAILABLE";
    if (error.context instanceof Response) {
      try {
        const body = await error.context.clone().json();
        if (typeof body.code === "string") code = body.code;
      } catch {
        /* Unknown upstream response is never shown. */
      }
    }
    throw new VoiceClientError(code);
  }
  return data as unknown;
}
export const voiceAccessSchema = z.object({
  token: z.string().min(1),
  url: z.url().refine((value) => {
    const url = new URL(value);
    return url.protocol === "wss:" && url.hostname.endsWith(".livekit.cloud");
  }),
  room: z.string(),
});
export function roomName(tripId: string, epoch: string) {
  return `ridesync-${tripId}-${epoch}`;
}
