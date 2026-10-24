# 08 — Plano de execução e backlog

> Estimativa indicativa: 4–6 semanas de trabalho focado; rever após escolha de fornecedores. Atualizar checkboxes durante implementação.

## Fase 0 — Fundação
- [ ] Confirmar fornecedores routing/tiles, IA, deploy e Supabase project.
- [x] Inicializar Vite React TS, PWA, Tailwind, lint, formatter, Vitest.
- [x] Configurar variáveis de ambiente e cliente Supabase (sessão real validada; emails por validar).
- [x] Definir estrutura modular e navegação.
- [x] Preparar CI para lint, typecheck e testes.

## Fase 1 — Auth e garagem
- [x] Criar migrations profiles/motorcycles, índices e RLS.
- [x] Auth e proteção de rotas.
- [x] CRUD de perfil e garagem.
- [x] Mota principal transacional.
- [x] Testes de ownership e RLS locais (PostgreSQL isolado; validar também no Supabase real).

## Fase 2 — Viagens e mapa
- [x] Migrations trips, waypoints, routes, participants (aplicadas e verificadas no Supabase com autorização).
- [x] CRUD de viagens e estados de planeamento (draft/planned/cancelled; start/stop reservado à Fase 4).
- [x] Mapa, geocoding, waypoints e routing externo implementados; Edge Functions publicadas e smoke remoto autenticado aprovado.
- [x] Guardar e apresentar geometria, distância e duração estimada (migration 003 aplicada e persistência remota validada).
- [x] Testes locais de criação, edição, permissões e concorrência; smoke remoto transacional de viagens aprovado. Sessão Auth real validada; browser/email por validar.

## Fase 3 — Convites e participantes
- [x] Convites seguros de uso único com expiração/revogação (migration 004 aplicada com autorização e smoke remoto aprovado).
- [x] Aceitar/recusar e listar participantes (validado localmente e com sessões reais).
- [x] Selecionar mota própria por viagem, ou nenhuma (RPC e UI).
- [x] Testes de token expirado, duplicado, outsider, concorrência, quotas e ownership.
- [x] Migration 004 aplicada, tipos regenerados e 25 verificações remotas aprovadas.

## Fase 4 — Tracking
- [x] Sessões de tracking e regras de estado (local; migration 005 por autorizar).
- [x] Consentimento GPS e `watchPosition`, pausa foreground e cleanup.
- [x] Canal privado Realtime e autorização implementados; integração remota por validar.
- [x] Notificações Broadcast emitidas pela BD e snapshot autorizado da última posição; sem confiar em Presence como prova de GPS.
- [x] Stale/offline, reconexão, expiração e cleanup (testados localmente).
- [ ] Autorizar/aplicar migration 005 e validar Realtime/sessões no Supabase real.
- [ ] Testes em 3–5 telemóveis e redes distintas.

## Fase 5 — AI Planner
- [ ] Edge Function autenticada.
- [ ] JSON estruturado + validação.
- [ ] Geocoding/routing + confirmação do utilizador.
- [ ] Limites de chamadas e fallback manual.

## Fase 6 — Beta PoC
- [ ] E2E de fluxo principal.
- [ ] Auditoria RLS, privacidade, secrets e quotas.
- [ ] Testes mobile e medição de latência.
- [ ] Deploy e roteiro de demonstração.

## Formato para cada PR
Objetivo, requisitos FR, alterações, migration/RLS, testes executados, screenshots se UI, riscos e rollback.

## Checklist específica de mapas
- [ ] Confirmar chaves, quotas e termos MapTiler/openrouteservice; registar restrições de domínio/servidor.
- [x] Integrar MapLibre e estilo MapTiler com atribuição e estados de erro.
- [x] Criar adapters de geocoding/routing e Edge Functions com segredos server-side (publicados e validados).
- [x] Mostrar rota, waypoints, distância e duração estimada de openrouteservice.
- [x] Adicionar links externos Google Maps e Waze com aviso sobre suspensão do tracking.
- [ ] Validar em iOS Safari e Android Chrome, incluindo regresso após abrir navegação externa.
- [ ] Documentar comportamento stale e medir quota/latência dos serviços.
