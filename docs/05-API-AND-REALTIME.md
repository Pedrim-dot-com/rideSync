# 05 — Contratos de API e eventos

## Abordagem
CRUD simples via Supabase client com RLS. Operações transacionais/autorizadas via RPC ou Edge Functions. Não criar REST backend paralelo sem necessidade.

## Operações de domínio
| Operação | Interface proposta | Autorizações |
|---|---|---|
| getMyProfile/updateMyProfile | Supabase profiles | sessão própria |
| listMyMotorcycles/create/update/delete | Supabase motorcycles | owner |
| setPrimaryMotorcycle | RPC `set_primary_motorcycle(id)` | owner + transação |
| createTrip | RPC `create_trip(...)` | autenticado |
| updateTrip/waypoints | DB/RPC | organizer; estado permitido |
| calculateRoute | Edge Function `calculate-route` | participante/organizador |
| createInvite | Edge Function/RPC `create-invite` | organizer |
| acceptInvite | Edge Function/RPC `accept-invite` | auth + token válido |
| chooseTripMotorcycle | RPC `choose_trip_motorcycle` | participant + ownership |
| start/stopTrip | RPC `start_trip` / `stop_trip` | organizer |
| updateLocationSnapshot | RPC `update_location` | próprio + sessão ativa + consentimento |
| planTripWithAI | Edge Function `plan-trip` | autenticado + rate limit |

## Payload de localização (proposta)
```json
{
  "event": "rider.location.updated",
  "data": {
    "tripId": "uuid",
    "sessionId": "uuid",
    "riderId": "uuid",
    "sequence": 42,
    "latitude": 40.4168,
    "longitude": -8.7501,
    "accuracyMeters": 12,
    "speedMetersPerSecond": 13.8,
    "recordedAt": "2026-10-23T14:30:00Z"
  }
}
```
`riderId` no evento é informativo; o sistema não deve confiar nele sem associar o emissor à sessão autenticada. Nunca enviar tokens nos payloads. Rejeitar timestamps absurdos e coordenadas inválidas. Ignorar sequência antiga por rider/session.

## Eventos
- `rider.location.updated`: localização recente.
- `rider.sharing.stopped`: participante parou partilha; remover marcador live.
- `trip.session.started` / `trip.session.ended`: estado de sessão.
- Presence: `online`, `offline` derivados da ligação; independentes da partilha GPS.

## Erros e estados
`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_STATE`, `VALIDATION_ERROR`, `RATE_LIMITED`, `ROUTING_UNAVAILABLE`, `AI_UNAVAILABLE`. Mostrar mensagem legível, sem stack traces ou dados sensíveis.

## Contrato de routing
Entrada: coordenadas de origem/destino, lista ordenada de waypoints, preferências suportadas pelo fornecedor. Saída: geometria GeoJSON/Polyline normalizada, `distanceMeters`, `durationSeconds`, `provider`, `calculatedAt`. Se evitar autoestradas não for suportado, explicitar a limitação.

## Integração de mapas e navegação
- Routing: Edge Function `calculate-route` valida origem/destino/waypoints e opções suportadas, chama openrouteservice e normaliza `{geometry, distanceM, durationS, provider, waypoints}`.
- Geocoding: Edge Function `search-places` com limites de input, debounce no cliente, throttling/rate limit no servidor e normalização de resultados.
- A UI nunca chama APIs que exijam segredos diretamente. Não misturar chave pública MapTiler com chave privada openrouteservice.
- Links Google Maps/Waze são criados localmente a partir de coordenadas verificadas e `encodeURIComponent`; abrir por gesto explícito. Documentar limitações de waypoints e do background.
- Realtime continua independente da navegação externa; se a PWA ficar suspensa, posições ficam stale e nunca se inferem novas coordenadas.
