# 03 — Arquitetura técnica

## Princípios
Monólito frontend modular + Supabase BaaS. Evitar backend próprio, Redis, broker e microserviços. Preferir soluções reversíveis e contratos explícitos.

## Componentes
- **React/Vite PWA:** UI, Geolocation API, MapLibre, Supabase client, cache de dados não sensíveis.
- **Supabase Auth:** identidade e sessões.
- **Supabase PostgreSQL:** perfis, motas, viagens, waypoints, participantes, convites, rotas e snapshots.
- **Supabase Realtime:** canais privados por viagem, Broadcast para posições e Presence para estado de ligação.
- **Supabase Storage:** imagens de perfil/mota, com policies e limites.
- **Edge Functions:** proxy para LLM e routing/geocoding quando requerem segredo; autorização e rate limits básicos.
- **Routing externo:** geometria, distância e ETA; fornecedor selecionado após verificar quotas/licenças.

## Estrutura sugerida
```text
src/
  app/                # bootstrap, providers, routing
  pages/              # páginas e layouts
  features/
    auth/
    profile/
    garage/
    trips/
    invitations/
    tracking/
    ai-planner/
  entities/           # tipos e componentes de domínio
  shared/
    ui/
    lib/supabase/
    lib/maps/
    config/
    validation/
supabase/
  migrations/
  functions/
  seed.sql            # dados fictícios, nunca pessoais
tests/
  e2e/
  integration/
```

## Estado
- TanStack Query: dados remotos e invalidação.
- Zustand: apenas estado UI/transitório se necessário.
- Realtime hook/service dedicado por viagem: subscrição, deduplicação, reconnect e cleanup.
- Não persistir tokens ou posições sensíveis em caches offline acessíveis sem necessidade.

## GPS e lifecycle
`watchPosition` enquanto a app está visível, tracking ativo e utilizador consentiu. Preferir filtro de precisão e throttling (inicialmente ~10 s). Eventos incluem sequence, timestamp, accuracy. Suspender/reativar de acordo com visibility e conectividade; nunca assumir funcionamento com ecrã bloqueado.

## Realtime vs persistência
Broadcast transmite atualizações efémeras. Presence sinaliza ligações, não prova GPS ativo. Snapshot `rider_locations` persiste último ponto apenas por meio de escrita autorizada e limitada; evitar gravar cada broadcast. Ao reconectar, obter snapshot, comparar timestamps e depois processar eventos novos. Limpar snapshots ao terminar consentimento/sessão conforme política.

## Performance e limites
Objetivo inicial 3–5 participantes por viagem. Medir mensagens/segundo, tráfego, quota Realtime, chamadas routing/LLM e consumo DB. Free Tier tem quotas e pode pausar projetos inativos; validar valores atuais no painel antes de testes.

## Progressive enhancement
Sem GPS: planeamento continua disponível. Sem Realtime: mostrar estado de ligação e dados antigos claramente. Sem IA: fluxo manual permanece funcional. Sem ligação: mostrar apenas dados previamente disponíveis, sem prometer navegação offline.

## Stack de mapas aprovada
- `maplibre-gl`: renderização no frontend (camada de apresentação).
- **MapTiler:** fornecedor de estilo/tiles, com atribuição visível e chave pública de browser restringida por domínio quando suportado.
- **openrouteservice:** geocoding e cálculo de rota; chamadas protegidas por Edge Function quando exigirem chave privada, com validação, quotas e tratamento de falhas.
- **Google Maps / Waze:** links externos de navegação gerados por utilitário dedicado; não fazem parte do motor de tracking.
- Adapters `MapStyleProvider`, `GeocodingProvider`, `RoutingProvider` e `ExternalNavigationLinks` para facilitar substituição futura.
- PWA compatível com Safari iOS e Chrome Android; HTTPS, viewport/safe areas e testes reais.
- Não criar worker para GPS em background: browsers não garantem geolocalização contínua quando a PWA perde foco. Ao regressar, reconectar Realtime, recuperar snapshot e sinalizar posições stale.
Ver `docs/12-MAPS-AND-NAVIGATION.md`.
