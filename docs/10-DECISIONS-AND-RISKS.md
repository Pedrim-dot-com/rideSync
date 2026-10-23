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
- DEC-004: plataforma de deploy (Cloudflare Pages/Vercel).
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
