# 04 — Modelo de dados, segurança e privacidade

## Entidades e colunas mínimas
- `profiles(id uuid PK -> auth.users, username unique, display_name, avatar_path, created_at)`.
- `motorcycles(id uuid PK, user_id -> profiles, brand, model, manufacture_year, engine_cc, color, photo_path, is_primary, created_at)`.
- `trips(id uuid PK, created_by -> profiles, title, departure_at, status [draft, planned, active, completed, cancelled], created_at, updated_at)`.
- `trip_waypoints(id uuid PK, trip_id -> trips, position int, label, latitude, longitude)`; UNIQUE(trip_id,position).
- `trip_routes(id uuid PK, trip_id -> trips, geometry jsonb/GeoJSON, distance_m, duration_s, routing_provider, calculated_at)`; para PoC, uma rota atual por viagem.
- `trip_participants(trip_id,user_id PK composta, role [organizer, rider], status [invited, accepted, declined, removed], motorcycle_id nullable -> motorcycles, joined_at)`.
- `trip_invitations(id uuid PK, trip_id, token_hash unique, invited_by, expires_at, accepted_by nullable, used_at nullable)`.
- `tracking_sessions(id uuid PK, trip_id, started_by, started_at, ended_at)`; no máximo uma ativa por viagem.
- `rider_locations(trip_id,user_id PK composta, session_id, latitude, longitude, accuracy_m, speed_mps nullable, recorded_at, updated_at)`; apenas último snapshot.

## Integridade e índices
- `motorcycles.user_id`, `trips.created_by`, `trip_participants.user_id`, `trip_waypoints(trip_id,position)`, `rider_locations(trip_id,recorded_at)`.
- `motorcycles`: índice único parcial `UNIQUE(user_id) WHERE is_primary = true` para garantir uma principal. Alterar principal numa transação/RPC segura.
- Garantir por trigger/RPC que `trip_participants.motorcycle_id` pertence a `trip_participants.user_id`.
- Garantir que `created_by` tem participação `organizer` através de transação/RPC.
- CHECK latitude [-90,90], longitude [-180,180], year plausível, engine_cc positivo, distance/duration não negativos.
- Regras de transição de estado devem ser impostas no servidor, não apenas na UI.

## RLS — matriz obrigatória
| Recurso | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| profiles | próprio; dados públicos mínimos conforme política | próprio |
| motorcycles | próprio; projeção controlada para participantes da mesma viagem | apenas proprietário |
| trips | criador e participantes aceites | organizador autorizado |
| waypoints/routes | participantes aceites | organizador antes da sessão |
| participants | membros aceites e organizador; convites via função segura | organizador ou aceitação controlada |
| invitations | organizador; validação por função segura | organizador; aceitação via função |
| sessions | participantes aceites | organizador para start/stop |
| rider_locations | participantes aceites da sessão | apenas o próprio, com consentimento e sessão ativa |

**Nota:** policies complexas podem provocar recursão RLS. Criar funções `SECURITY DEFINER` mínimas e auditadas, com `search_path` explícito, apenas quando necessário. Testar como `anon`, utilizador A, B e outsider. Não expor tabelas brutas se uma view/RPC segura for mais adequada.

## Realtime
Usar canais privados `trip:<uuid>` e policies de autorização em `realtime.messages`, verificando membership aceite. Nunca tratar segredo do nome do canal como mecanismo de autorização. Considerar que Broadcast enviado diretamente pelo cliente não é, por si só, prova de identidade da payload: atribuir identidade a partir da sessão/autorização, rejeitar spoofing e validar o modelo de confiança em testes. Para garantias fortes, usar publicação via servidor/DB ou Edge Function autenticada, em vez de confiar em `userId` no payload.

## Privacidade
Consentimento explícito, revogação imediata, retenção mínima, exclusão dos snapshots após fim de sessão/partilha, política de privacidade e direito de apagar dados. Não publicar coordenadas em páginas públicas. Evitar dados pessoais reais nos seeds e logs. Guardar somente o necessário para PoC.

## Segurança operacional
Sem `service_role` no browser; sem tokens no git; HTTPS; Storage policies; validação server-side; limites de input; rate limits para convites, IA e routing; secrets nas Edge Functions. Confirmar configuração de verificação JWT por função.
