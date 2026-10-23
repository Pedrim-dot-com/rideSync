# 08 — Plano de execução e backlog

> Estimativa indicativa: 4–6 semanas de trabalho focado; rever após escolha de fornecedores. Atualizar checkboxes durante implementação.

## Fase 0 — Fundação
- [ ] Confirmar fornecedores routing/tiles, IA, deploy e Supabase project.
- [x] Inicializar Vite React TS, PWA, Tailwind, lint, formatter, Vitest.
- [x] Configurar variáveis de ambiente e cliente Supabase (Auth real ainda por validar).
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
- [ ] Mapa, geocoding, waypoints e routing externo.
- [ ] Guardar e apresentar geometria, distância e ETA.
- [x] Testes locais de criação, edição, permissões e concorrência; smoke remoto transacional de viagens aprovado. Auth/browser real ainda por validar.

## Fase 3 — Convites e participantes
- [ ] Convites seguros com expiração.
- [ ] Aceitar/recusar e listar participantes.
- [ ] Selecionar mota própria por viagem.
- [ ] Testes de token expirado, duplicado e outsider.

## Fase 4 — Tracking
- [ ] Sessões de tracking e regras de estado.
- [ ] Consentimento GPS e `watchPosition`.
- [ ] Canal privado Realtime e autorização.
- [ ] Broadcast/Presence e snapshot de última posição.
- [ ] Stale/offline, reconexão, cleanup.
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
- [ ] Integrar MapLibre e estilo MapTiler com atribuição e estados de erro.
- [ ] Criar adapters de geocoding/routing e Edge Functions com segredos server-side.
- [ ] Mostrar rota, waypoints, distância e ETA de openrouteservice.
- [ ] Adicionar links externos Google Maps e Waze com aviso sobre suspensão do tracking.
- [ ] Validar em iOS Safari e Android Chrome, incluindo regresso após abrir navegação externa.
- [ ] Documentar comportamento stale e medir quota/latência dos serviços.
