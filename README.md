# RideSync — documentação da PoC

> Fonte de verdade para implementação assistida por Claude Code. Estado: fases 0 e 1 e planeamento de viagens implementados; mapas e adapters de rotas implementados; serviços de mapas publicados e validados com sessão Supabase real; convites e seleção de mota validados no Supabase real (migration 004 aplicada); início/fim, cronómetro e GPS foreground validados por API/WebSocket real (migration 005 aplicada); emails e instalação mobile por validar.

## Objetivo
Validar que motards conseguem criar e partilhar uma viagem, escolher a mota, participar em grupos e ver as posições uns dos outros em tempo real **com a PWA aberta**. Um planeador com IA transforma pedidos em itinerários validados por um motor de rotas.

## Stack aprovada
React + TypeScript + Vite; Tailwind; TanStack Query; Zustand quando necessário; MapLibre GL JS + MapTiler (tiles/style) + openrouteservice (routing/geocoding); Supabase Free Tier (Auth, PostgreSQL, Realtime, Storage, Edge Functions); motor de routing openrouteservice com adapter substituível; fornecedor LLM configurável; deploy estático.

## Ordem de leitura
1. `CLAUDE.md` — instruções de execução
2. `docs/01-BUSINESS-PRD.md` — visão e regras de negócio
3. `docs/02-FUNCTIONAL-REQUIREMENTS.md` — requisitos e aceitação
4. `docs/03-TECHNICAL-ARCHITECTURE.md` — arquitetura e fluxos
5. `docs/04-DATA-MODEL-AND-SECURITY.md` — esquema, RLS e privacidade
6. `docs/05-API-AND-REALTIME.md` — contratos
7. `docs/06-AI-DESIGN.md` — integração de IA
8. `docs/07-UX-FLOWS.md` — ecrãs e UX
9. `docs/08-DELIVERY-PLAN.md` — fases e tarefas
10. `docs/09-TEST-AND-ACCEPTANCE.md` — testes e definição de pronto
11. `docs/10-DECISIONS-AND-RISKS.md` — ADRs e pendências
12. `docs/11-OPERATIONS.md` — setup, deploy e observabilidade
13. `docs/12-MAPS-AND-NAVIGATION.md` — decisão e integração de mapas

## Limites explícitos
Não prometer GPS em segundo plano no iOS; não construir navegação turn-by-turn, SOS, chat, pagamentos, motoclubes públicos, monetização ou aplicação nativa nesta PoC. A posição só é partilhada após consentimento explícito.

## Desenvolvimento

Consultar [docs/13-DEVELOPMENT.md](docs/13-DEVELOPMENT.md) para instalação, `.env`, migrations e testes.

## Abrir a PWA

Publicação HTTPS e instalação em iPhone/Android: [Cloudflare Pages](docs/14-CLOUDFLARE-PAGES.md).
O push para o GitHub não publica automaticamente o site antes de ligar a integração.

## Como começar
Abrir este repositório no Claude Code e enviar o conteúdo de `PROMPT-CLAUDE.md`. O Claude deve primeiro inspecionar o repositório, elaborar um plano, assinalar decisões bloqueantes e implementar faseadamente.

## Decisão de mapas e navegação (ADR-007)
- **Mapa interno:** MapLibre GL JS, com estilos/tiles MapTiler.
- **Cálculo de rotas e geocoding:** openrouteservice; a rota renderizada tem origem no serviço de routing, não no LLM.
- **Navegação opcional:** abrir Google Maps ou Waze através de URLs oficiais, sem integrar SDK de navegação nem prometer preservar waypoints.
- **Plataformas:** mesma PWA em Safari iOS e Chrome Android; validar instalação, safe areas e GPS foreground em dispositivos reais.
- Ao abrir uma app externa, a PWA pode ser suspensa e **o tracking pode parar**. Apresentar última localização + timestamp e não anunciar tracking em background.
- Confirmar licenças, planos gratuitos, quotas, atribuições e termos de cada fornecedor antes de usar credenciais reais. Consultar `docs/12-MAPS-AND-NAVIGATION.md`.
