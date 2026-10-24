# 04 — Modelo de dados, segurança e privacidade

## Entidades e colunas mínimas
- `profiles(id uuid PK -> auth.users, username unique, display_name, avatar_path, created_at)`.
- `motorcycles(id uuid PK, user_id -> profiles, brand, model, manufacture_year, engine_cc, color, photo_path, is_primary, created_at)`.
- `trips(id uuid PK, created_by -> profiles, title, departure_at, status [draft, planned, active, completed, cancelled], created_at, updated_at)`.
- `trip_waypoints(id uuid PK, trip_id -> trips, position int, label, latitude, longitude)`; UNIQUE(trip_id,position).
- `trip_routes(id uuid PK, trip_id -> trips, geometry jsonb/GeoJSON, distance_m, duration_s, routing_provider, calculated_at)`; para PoC, uma rota atual por viagem.
- `trip_participants(trip_id,user_id PK composta, role [organizer, rider], status [invited, accepted, declined, removed], motorcycle_id nullable -> motorcycles, joined_at)`.
- `trip_invitations(id uuid PK, trip_id, token_hash unique, invited_by, expires_at, used_by nullable, used_at nullable)`.
- `tracking_sessions(id uuid PK, trip_id, started_by, started_at, ended_at)`; no máximo uma ativa por viagem.
- `rider_locations(trip_id,user_id PK composta, session_id, latitude, longitude, accuracy_m, heading nullable, recorded_at, received_at)`; apenas último snapshot.

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
Consentimento explícito, revogação imediata, retenção mínima, exclusão dos snapshots após fim de sessão/partilha, política de privacidade e direito de apagar dados. Nunca publicar GPS de participantes em páginas públicas. Sedes fixas de grupos são a exceção explícita pedida: morada/coordenadas fornecidas por um representante, com aviso de divulgação a todas as contas autenticadas. Evitar dados pessoais reais nos seeds e logs. Guardar somente o necessário para PoC.

## Segurança operacional
Sem `service_role` no browser; sem tokens no git; HTTPS; Storage policies; validação server-side; limites de input; rate limits para convites, IA e routing; secrets nas Edge Functions. Confirmar configuração de verificação JWT por função.


## Grupos e voz/SOS (migrations 007–009 aplicadas)

- `motard_groups`: nome, descrição, denominação/registo opcionais, sede e revisão.
  SELECT autenticado apenas de colunas do diretório; não expor UUID de criador.
- `group_memberships`: role member/leader e estado; índices parciais garantem
  um grupo aceite e um pedido pendente por conta. Leituras brutas próprias ou
  de dirigentes; roster mínimo por RPC para membros aceites, pendentes só direção.
- `trip_sos_alerts`: apenas último SOS da viagem; expira 90 s. Sem texto livre,
  coordenadas adicionais ou contacto externo. Removido ao terminar viagem.
- `trip_voice_state`: época, interlocutor, prazo e operação em curso; sem áudio.
- `trip_voice_limits`: contador por minuto/conta. Sem SELECT cliente.
- `voice:<trip>`: canal privado só para membros aceites de viagem ativa; nenhuma
  policy INSERT para clientes. Broadcast limita-se a invalidar a query.
- `begin/finish_trip_voice_operation`: só service_role. Edge valida JWT, extrai
  actor de getUser e ignora papéis/identidades não autorizados. Corpo estrito.

SDKs de áudio não concedem acesso a dados de perfis/garagens/grupos ou viagens.
Remoção administrativa de conta que seja último dirigente exige transferência
ou tratamento do grupo; não existe ainda eliminação de conta na UI. Não confundir
a proteção de saída na app com gestão administrativa de cascades no Supabase.


## Extensão local — convites e Perfil (2026-10-24)

A migration local 010 acrescenta group_invitations com RLS e sem acesso direto. RPCs validam membro/dirigente/destinatário. Propostas review são ocultas do alvo; aprovação gera pending; aceitação insere member/accepted. Locks e unicidade preservam grupo único. Ver contratos, quotas e privacidade em docs/25.

Detalhes e estado: [Convites de grupo e Perfil](25-GROUP-INVITATIONS-AND-PROFILE.md).
