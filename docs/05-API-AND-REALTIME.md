# 05 — Contratos de API e eventos

Estado revisto em 2026-10-24. Os nomes abaixo correspondem à implementação;
`plan-trip` continua planeado. Exemplos antigos de eventos com coordenadas e
`riderId` fornecido pelo cliente foram retirados: não são o contrato publicado.

| Operação | Interface | Autorização |
|---|---|---|
| Perfil/garagem | tabelas profiles/motorcycles sob RLS | próprio |
| Mota principal | set_primary_motorcycle | próprio + transação |
| Criar/editar | create_trip, update_trip, replace_trip_waypoints | organizador, revisão e estado |
| Rotas | calculate-route | organizador antes de iniciar, tripId/revisão; pontos lidos no servidor |
| Pesquisa | search-places | JWT válido e quota |
| Convites | create/list/revoke_trip_invitation | organizador |
| Responder por token | respond_trip_invitation | conta autenticada + token válido |
| Notificações | remember_trip_invitation, list_received_trip_invitations, respond_received_trip_invitation | recibo próprio |
| Mota na viagem | set_trip_motorcycle | participante aceite, mota própria |
| Sessão | start_trip, finish_trip | organizador + revisão |
| GPS | start/stop_location_sharing, publish_rider_location, tracking_snapshot | identidade própria, sessão/consentimento válidos |
| Grupo/sede | save_motard_group | criação autenticada; edição por dirigente + revisão |
| Inscrição/direção | change_group_membership, list_group_members | próprio/dirigente conforme ação |
| SOS | raise_trip_sos, resolve_trip_sos, trip_voice_snapshot | participante aceite em viagem ativa |
| Voz | Edge trip-voice | JWT getUser, membership, viagem ativa e floor no servidor |
| IA (planeada) | plan-trip | ainda não implementada |

## Realtime publicado e preparado

`trip:<uuid>` recebe `tracking_changed`, emitido pela BD, com `{changed:true}`.
A UI relê tracking_snapshot e metadados da viagem sob autorização. Posições não
são aceites da payload de Broadcast/Presence.

`voice:<uuid>` recebe `voice_changed`, emitido pela BD, com `{trip_id:uuid}`.
A UI relê trip_voice_snapshot. Não aceitar papéis, prioridades, tokens, áudio ou
identidades de mensagens enviadas por browsers. Ver migrations 005 e 008 para
policies de SELECT; clientes não têm policy de INSERT nos canais.

O áudio WebRTC passa pela LiveKit Cloud e usa JWT próprio emitido pela Edge.
Nenhum token Supabase é entregue ao fornecedor. O JWT LiveKit tem identidade
obtida da sessão validada, sala exata e fontes limitadas a microfone. Participantes
normais são ouvintes; só o interlocutor autorizado tem canPublish.

## Payloads

- calculate-route: `{tripId,expectedRevision,avoidHighways}`; saída
  `{route:{geometry,distanceM,durationS,provider,calculatedAt}}`.
- search-places: `{text}`; saída `{places:[{label,latitude,longitude}]}`.
- trip-voice: `{tripId,action}` com action join/speak/sos/stop/leave/heartbeat.
  Join devolve `{token,url,room}` sem cache; restantes devolvem `{ok,room}`.
  Não aceita actor/userId/role/room/URL no corpo.
- Snapshot de voz: server_now, status, room_epoch, speaker_id/name/kind/until,
  ready, settling e SOS mínimo. Fonte da decisão de reprodução no cliente.

## Erros e limites

Mapas usam códigos estáveis UNAUTHENTICATED, FORBIDDEN, RATE_LIMITED,
TRIP_CHANGED, ITINERARY_LOCKED e erros de fornecedor. Voz acrescenta
VOICE_NOT_CONFIGURED, VOICE_BUSY, VOICE_CHANGED, SOS_ALREADY_ACTIVE,
VOICE_UNAVAILABLE e ORIGIN_NOT_ALLOWED. A UI não mostra exceções privadas do
fornecedor nem guarda tokens LiveKit em storage/offline cache.

Ver docs/12-MAPS-AND-NAVIGATION.md, docs/19-MOTARD-GROUPS.md e
docs/20-VOICE-AND-SOS.md para contratos, CORS, quotas e lifecycle.


## Extensão local — convites e Perfil (2026-10-24)

Contratos locais novos: invite_group_member, review_group_invitation, list_sent_group_invitations, revoke_group_invitation, list_received_group_invitations, respond_group_invitation. Assinaturas e regras completas em docs/25; estas seis RPCs ainda não estão disponíveis em produção. Sem novos canais Realtime/push: polling/invalidação.

Detalhes e estado: [Convites de grupo e Perfil](25-GROUP-INVITATIONS-AND-PROFILE.md).
