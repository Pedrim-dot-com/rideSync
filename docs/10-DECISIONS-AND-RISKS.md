# 10 — Decisões, ADRs e riscos

## Decisões aprovadas
- ADR-001: PoC antes de produto comercial.
- ADR-002: PWA mobile-first em React/TypeScript.
- ADR-003: Supabase Free Tier com PostgreSQL como persistência e BaaS.
- ADR-004: Cada motard tem garagem com várias motas e escolhe uma por viagem.
- ADR-005: Tracking entre participantes com consentimento; GPS contínuo em background não é promessa da PWA.
- ADR-006: AI Planner como assistente; routing externo é fonte da geometria/distância.

## Decisões pendentes — confirmar antes de integrar
- DEC-001: **RESOLVIDO — MapLibre GL JS + MapTiler**; confirmar licença/quotas/chave no onboarding.
- DEC-002: **RESOLVIDO — openrouteservice** para routing/geocoding; confirmar quotas e opções realmente suportadas antes de implementar filtros.
- DEC-003: fornecedor/modelo de LLM e orçamento máximo por mês.
- DEC-004: **RESOLVIDO — Cloudflare Pages ligada ao GitHub**; confirmar endereço de produção após a primeira publicação.
- DEC-005: política exata de retenção de snapshots GPS (sugestão: apagar ao parar/terminar).
- DEC-006: convites apenas a contas existentes ou link para registo.
- DEC-007: se fotos da mota são P0 ou P1 (sugestão P1).
- DEC-008: mecanismo de confiança de Broadcast (publicação autenticada server-side se necessário).

## Registo de riscos
| Risco | Impacto | Mitigação |
|---|---|---|
| iOS suspende geolocalização em background | Alto | Testar foreground e comunicar limite; futuro app nativa |
| Free Tier quotas/pausa | Médio | Limitar frequência, medir consumo, monitorizar painel |
| Exposição de posições | Alto | RLS, canais privados, consentimento, testes adversariais |
| Spoofing de eventos Broadcast | Alto | Validar emissor, autorizar canais, avaliar publicação server-side |
| Custos de mapas/LLM | Médio | Quotas, caching permitido, rate limiting e fallback |
| Rotas inadequadas para motos | Alto | Testes de percursos reais, não afirmar routing especializado sem suporte |
| Rede instável | Médio | Timestamps, stale state, reconexão e snapshot |
| Complexidade excessiva por IA de código | Médio | PRs pequenos, revisão, testes e decisões explícitas |

## Template ADR
`ADR-NNN — Título` / Contexto / Decisão / Alternativas / Consequências / Data / Estado.

## ADR-007 — Mapas, routing e navegação externa (APROVADA)
**Contexto:** PoC PWA em Android/iOS, tracking partilhado e orçamento limitado.
**Decisão:** MapLibre GL JS para renderização; MapTiler para tiles/styles; openrouteservice para geocoding e cálculo de rotas; links opcionais Google Maps e Waze para navegação externa. Sem Google Maps SDK, Waze SDK, turn-by-turn interno ou GPS background garantido.
**Razões:** stack modular, personalização, separação entre mapa/rotas/tracking, adequada à PoC.
**Consequências:** gerir chaves e quotas de terceiros, atribuição cartográfica, suporte de opções de routing, links externos com possíveis perdas de waypoints; tracking da PWA pode parar quando o utilizador muda de app.
**Riscos adicionais:** custos e termos de tiles, rate limits de routing, diferenças Safari/Chrome e falsa perceção de localização em tempo real.
**Referência:** `docs/12-MAPS-AND-NAVIGATION.md`.

## ADR-008 — Fundação de desenvolvimento (implementada)

Node 24 LTS, npm com package-lock, Vite/React/TypeScript estrito, Tailwind e
TanStack Query. Vitest/Testing Library, Playwright e testes RLS em PostgreSQL
17 isolado. Fotos ficam fora da primeira implementação (P1); a mota principal
é escolhida explicitamente após guardar, sem promoção automática.
A chave pública Supabase publishable é preferida; anon legada mantém compatibilidade.
Sem migrations remotas nem deploy automático.

**Inconsistência documental identificada:** FR-021 a FR-024 são usados tanto
na tabela original como na tabela adicional de mapas em `02-FUNCTIONAL-REQUIREMENTS.md`.
Até renumeração acordada, referenciar esses requisitos pelo ID e pelo nome.

## ADR-009 — Planeamento de viagens antes da integração de mapas

Primeira fatia da Fase 2: itinerários por coordenadas numéricas explícitas, com
2–12 pontos (origem, até 10 paragens e destino). Não se infere geocoding, rota,
distância ou duração. A interface assinala o percurso por calcular. O limite
serve a PoC; antes da integração real será confrontado com a quota do fornecedor.

Criar e editar viagem usa RPCs atómicas. O organizador vem de `auth.uid()`; a sua
participação aceite é criada por trigger. As tabelas de viagens apenas concedem
SELECT ao cliente, com RLS baseada em membership aceite e helper mínimo sem
recursão. Escritas do cliente passam por funções com argumentos restritos.

Um contador `revision` protege de edições concorrentes. A edição usa um snapshot
da revisão original, mesmo quando as queries atualizam em background. Alterar
um itinerário invalida a rota guardada. Por simplicidade, qualquer gravação da
edição invalida a rota, incluindo alterações apenas ao título/data.

Estados permitidos nesta fase: draft ↔ planned; draft/planned → cancelled.
Iniciar/concluir sessões permanece reservado às futuras RPCs de tracking.
Só o organizador altera ou cancela; apenas rascunhos e viagens canceladas podem
ser removidos, após confirmação na UI. Itinerários ativos/concluídos/cancelados
não podem ser editados. Cancelamento é terminal nesta fase.

Data e hora são introduzidas no fuso horário do browser e persistidas como UTC.
Motas referenciadas por participantes são verificadas por ownership e usam
`ON DELETE SET NULL`, preservando a viagem quando se remove a mota.

## ADR-010 — Mapas e serviços de rotas

MapLibre GL JS carregado de forma lazy, com worker empacotado pelo Vite e estilo
MapTiler com atribuição original. Pins mostram os pontos guardados; só uma
LineString validada do fornecedor é desenhada como percurso. Sem fallback OSM.

As Edge Functions `search-places` e `calculate-route` validam o JWT com
`auth.getUser()`. O verificador legado do gateway fica desativado para suportar
as chaves assimétricas atuais; cada POST continua a exigir uma sessão válida
no handler. CORS restrito a `APP_ORIGINS`, timeout de 15 s e respostas sem cache.

O cálculo recebe apenas tripId/revisão/preferência; lê os pontos sob RLS e só
permite ao organizador calcular em draft/planned. Perfil openrouteservice
`driving-car`, com opção suportada `avoid_features: [highways]`; não anunciar
routing especializado para motas. A geometria/duração/distância são validadas
e guardadas por RPC exclusiva de service_role, com nova verificação de owner,
estado e revisão depois da chamada externa. A persistência aumenta a revisão.

Limites persistentes: 10 cálculos/minuto e 30 pesquisas/minuto por conta, com
duas entradas agregadas por utilizador (sem guardar pesquisas/coordenadas).
São proteção da PoC, não substituem limites globais de orçamento/quotas do
fornecedor. O segredo de openrouteservice serve também o geocoding.

Cloudflare Pages é a plataforma escolhida para a PWA. A ligação GitHub requer
a autorização da conta Cloudflare no browser do utilizador. As variáveis de
build `VITE_*` são públicas; segredos privados ficam nas Edge Functions.
A nova migration e publicação das funções requerem autorização própria.
