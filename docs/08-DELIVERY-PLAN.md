# 08 — Plano de execução e backlog

> Estimativa indicativa: 4–6 semanas de trabalho focado; rever após escolha de fornecedores. Atualizar checkboxes durante implementação.

## Fase 0 — Fundação
- [ ] Confirmar fornecedores routing/tiles, IA, deploy e Supabase project.
- [ ] Inicializar Vite React TS, PWA, Tailwind, lint, formatter, Vitest.
- [ ] Configurar variáveis de ambiente e cliente Supabase.
- [ ] Definir estrutura modular e navegação.
- [ ] Preparar CI para lint, typecheck e testes.

## Fase 1 — Auth e garagem
- [ ] Criar migrations profiles/motorcycles, índices e RLS.
- [ ] Auth e proteção de rotas.
- [ ] CRUD de perfil e garagem.
- [ ] Mota principal transacional.
- [ ] Testes de ownership e RLS.

## Fase 2 — Viagens e mapa
- [ ] Migrations trips, waypoints, routes, participants.
- [ ] CRUD de viagens e estados.
- [ ] Mapa, geocoding, waypoints e routing externo.
- [ ] Guardar e apresentar geometria, distância e ETA.
- [ ] Testes de criação, edição e permissão.

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
