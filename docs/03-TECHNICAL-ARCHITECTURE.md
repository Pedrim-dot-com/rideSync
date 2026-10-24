# 03 — Arquitetura técnica

A visão geral visual está no [fluxograma de arquitetura do README](../README.md#arquitetura-da-aplicação), com os componentes ativos e fornecedores externos.

## Princípios
Monólito frontend modular + Supabase BaaS. Evitar backend próprio, Redis, broker e microserviços. Preferir soluções reversíveis e contratos explícitos.

## Componentes
- **React/Vite PWA:** UI, Geolocation API, MapLibre, Supabase client, cache de dados não sensíveis.
- **Supabase Auth:** identidade e sessões.
- **Supabase PostgreSQL:** perfis, motas, viagens, waypoints, participantes, convites, rotas e snapshots.
- **Supabase Realtime:** canais privados por viagem, Broadcast emitido pela BD para invalidar snapshots autorizados; não confiar em posições/identidade de eventos enviados pelo browser.
- **Supabase Storage:** imagens de perfil/mota, com policies e limites.
- **Edge Functions:** proxy para LLM e routing/geocoding quando requerem segredo; autorização e rate limits básicos.
- **Routing externo:** geometria, distância e ETA; fornecedor selecionado após verificar quotas/licenças.

## Estrutura implementada

`src/features/` contém Auth/Profile/Garage, trips, tracking, access, groups e voice.
`src/shared/` contém cliente Supabase, contratos e adapters de mapas.
`supabase/migrations/` contém SQL/RLS versionado; `supabase/functions/` contém
mapas e trip-voice; testes separados em src (unitários), tests/integration e
tests/e2e. Fotos/Storage e AI Planner são planos, não funcionalidades publicadas.

## Estado
- TanStack Query: dados remotos e invalidação.
- Zustand: apenas estado UI/transitório se necessário.
- Realtime hook/service dedicado por viagem: subscrição, deduplicação, reconnect e cleanup.
- Não persistir tokens ou posições sensíveis em caches offline acessíveis sem necessidade.

## GPS e lifecycle
`watchPosition` enquanto a app está visível, tracking ativo e utilizador consentiu. Preferir filtro de precisão e throttling (inicialmente ~10 s). A escrita usa session/share ID, timestamp, precisão e heading; não existe sequence de cliente no contrato publicado. Suspender/reativar de acordo com visibility e conectividade; nunca assumir funcionamento com ecrã bloqueado.

## Realtime vs persistência
Broadcast transmite apenas avisos efémeros de alteração; a aplicação relê snapshots sob autorização. Presence não é fonte de GPS ou de identidade de interlocutor. Snapshot `rider_locations` persiste último ponto apenas por meio de escrita autorizada e limitada; evitar gravar cada broadcast. Ao reconectar, obter snapshot, comparar timestamps e depois processar eventos novos. Limpar snapshots ao terminar consentimento/sessão conforme política.

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


## Voz e grupos

Grupos/sedes usam PostgreSQL/RLS, RPCs atómicas e MapLibre/MapTiler existentes.
Voz usa SFU/TURN geridos de LiveKit Cloud, SDK cliente lazy e Edge Function
`trip-voice` para tokens/controlo. O áudio não passa por PostgreSQL nem Broadcast.
Uma época de sala por mudança de interlocutor impede que um JWT antigo autorize
publicação para a audiência atual. Isto acrescenta um breve reconnect à mudança
de fala; medir em dispositivos reais. Credenciais e SDK de servidor só na Edge.
Ver docs/19-MOTARD-GROUPS.md e docs/20-VOICE-AND-SOS.md.

Estado operacional atual: grupos/voz com backend ativo (007–009 e trip-voice),
validação HTTPS real concluída; áudio físico ainda por testar. Ver docs/23 e docs/24.
