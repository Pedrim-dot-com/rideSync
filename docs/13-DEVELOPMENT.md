# Desenvolvimento — fundação, garagem e planeamento de viagens

## Estado implementado

React + TypeScript estrito, Vite, Tailwind, TanStack Query, Supabase client,
manifest e service worker PWA (apenas shell estática). Registo, login, logout,
recuperação de password, edição de perfil e CRUD da garagem. Mota principal
por RPC atómica, índice único parcial e RLS por proprietário.

Planeamento de viagens: criar/listar/consultar/editar/remover, partida, origem,
destino e paragens ordenadas, com coordenadas manuais validadas. Estados
rascunho/planeada/cancelada e controlo de revisões concorrentes.

Mapa MapLibre/MapTiler, pesquisa de lugares, cálculo e persistência de rotas
openrouteservice, bem como links Google Maps/Waze, estão implementados.
A migration `202610230003_map_services.sql` foi aplicada com autorização e as
duas Edge Functions estão publicadas. Pesquisa, cálculo e persistência foram
validados com uma sessão Supabase real em 2026-10-23.
Convites e participação estão implementados e testados localmente; a migration
004 remota aguarda autorização. Ver `docs/15-INVITATIONS-AND-PARTICIPATION.md`.
Tracking, uploads e IA ainda não estão implementados.
Não são apresentados dados fictícios como dados de utilizadores reais.
A instalação e GPS em iOS/Android exigem testes futuros em dispositivos reais.

## Arranque

Requisitos: Node 24 LTS e npm (lockfile versionado).

```sh
npm ci --cache /workspace/.npm-cache
# Apenas se .env ainda não existir; nunca substituir credenciais existentes:
test -f .env || cp .env.example .env
npm run dev
```

Preencher no `.env` local (ignorado pelo Git):

- `VITE_SUPABASE_URL`: Project URL do Supabase.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: chave pública `sb_publishable_...`.
- Alternativa legada: `VITE_SUPABASE_ANON_KEY`. Se ambas existirem, a publishable tem prioridade.

Todas as variáveis `VITE_*` são públicas no bundle. Nunca colocar a secret key,
service_role, password da BD ou chaves de IA/routing nestas variáveis.
MapTiler e estilo não são necessários para a garagem ou o planeamento por coordenadas.
O `.env.edge-functions` é um modelo local separado; não é carregado automaticamente.

Sem configuração, a aplicação apresenta instruções de setup. Reiniciar o Vite
após alterar o `.env`. Configurar **Authentication → URL Configuration** no
Supabase com o URL efetivo do frontend e os redirect URLs permitidos. Em
produção usar HTTPS. O Site URL foi configurado para
`https://ridesync-8z1.pages.dev`, com esse domínio nos redirects e preservação
do endereço de desenvolvimento anterior. Manter confirmação de email; o registo pode exigir que o
utilizador confirme o email antes de entrar. A recuperação regressa à aplicação
e apresenta o formulário de nova password.

## Migration remota: rever e obter aprovação antes de executar

Ficheiro: `supabase/migrations/202610230001_profiles_garage.sql`.
Cria `profiles`, `motorcycles`, trigger de perfil para novos utilizadores,
backfill dos perfis existentes, políticas RLS, constraints e RPC
`set_primary_motorcycle(motorcycle_id uuid)`.

Num projeto novo aprovado, executar o conteúdo completo no SQL Editor do
Supabase. A migration não é idempotente: executar uma só vez e preservar o
registo da execução. Não executar `tests/integration/bootstrap.sql` no Supabase:
é apenas um contrato auth mínimo para testes PostgreSQL isolados.

Tipos gerados do esquema remoto estão em `src/shared/database.generated.ts`,
com aliases em `src/shared/database.types.ts`. Foram obtidos pela API de gestão
após aplicar a migration de viagens. Depois de migrations futuras, regenerar
com `supabase gen types typescript --project-id <project-ref> --schema public`
para o ficheiro gerado e rever o diff.
A inspeção remota apenas de leitura confirmou que `profiles`, `motorcycles`,
a função de mota principal e as políticas RLS já existem no projeto e
correspondem à estrutura inicial. A origem da aplicação dessa migration inicial
não foi estabelecida.
Não executar a migration inicial novamente sobre essas tabelas.

A migration seguinte `supabase/migrations/202610230002_trips.sql` cria `trips`,
`trip_waypoints`, `trip_participants`, `trip_routes`, RLS e RPCs de criação,
edição, estados e remoção. Foi aplicada com autorização explícita em 2026-10-23
no projeto `rideSync-app` (`isyhpoyihcbkujtjadzc`).
SHA-256 do SQL aplicado: `c7859747fce5d56b17a29514dc2eb79b13b3a98cf8fca3365a33f49e2757fe12`.
Não reaplicar nem editar esta migration; evoluções usam um novo ficheiro.

Verificação remota: quatro tabelas com RLS e SELECT autenticado, sem DML direto
ou SELECT anónimo; quatro policies e oito funções com permissões verificadas.
Passaram 12 verificações funcionais com roles reais da BD: criação, organizador,
paragens, revisão, edição obsoleta, isolamento de outra conta, permissões de
edição/estado, transições, bloqueio após cancelamento e remoção em cascata.
Todos os dados de teste foram revertidos por rollback, com contagens confirmadas.
A API REST também bloqueou leituras anónimas de viagens/paragens com HTTP 401.
Estes testes não validam registo, emails ou login real no browser.
As migrations devem ser executadas uma só vez, pela ordem dos nomes.
No teste local, o runner descobre e aplica todas as migrations numa BD nova.

## Verificações

```sh
npm run typecheck
# Deno instalado como devDependency; neste ambiente usar DENO_DIR=/workspace/.deno-cache
npm run check:edge
npm run lint
npm run format:check
npm test
npm run build
# Docker disponível: cria e remove apenas a sua própria BD descartável
npm run test:db:local
# Chromium já instalado neste ambiente
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

Os testes PostgreSQL verificam RLS, ownership, restrições, isolamento de perfis,
acesso anónimo, troca concorrente de mota principal, membership aceite de
viagens, bloqueio de estados, rollback e conflitos entre editores. Usam PostgreSQL 17 e um
contrato mínimo `auth.uid()`, não um stack Supabase completo.

O E2E corre num browser real e simula o transporte HTTP Supabase: login,
CRUD da garagem, mota principal, perfil, logout, criação/edição de viagens,
ordenação de paragens, estados, remoção confirmada e viewport móvel. Não valida
credenciais reais, entrega de emails nem configuração do projeto remoto.

Para testar uma BD descartável já existente, definir `TEST_DATABASE_URL`
e executar `npm run test:db`. O runner só aceita loopback e cria roles/tabelas;
nunca apontar para uma BD de desenvolvimento com dados que se queira preservar.

## Validação com Supabase real

1. Configurar URL e chave pública e aprovar/aplicar apenas as migrations em falta.
2. Registar duas contas e confirmar os emails.
3. Editar perfis, criar/editar/remover motas e trocar a principal.
4. Confirmar que a sessão B não consegue consultar ou alterar os dados de A.
5. Recuperar password por email e terminar sessão.
6. Criar uma viagem por coordenadas, editar paragens, planear, cancelar e remover.
7. Confirmar que a segunda conta não pode ler/alterar a viagem privada da primeira.

### API de planeamento

- `create_trip(p_title,p_departure_at,p_waypoints)` → UUID. Sem `created_by` do cliente.
- `update_trip(p_trip_id,p_title,p_departure_at,p_waypoints,p_expected_revision)`.
- `set_trip_status(p_trip_id,p_status,p_expected_revision)` (só estados de planeamento).
- `delete_trip(p_trip_id,p_expected_revision)` (rascunho/cancelada, apenas organizador).

Os waypoints são um array JSON de `{label,latitude,longitude}`, na ordem pretendida.
O servidor valida campos e intervalos, e grava viagem/participações/itinerário numa
só transação. Conflitos de revisão devolvem `40001`; a UI permite atualizar os
valores sem tentar reenviar uma edição antiga automaticamente.

A sessão real e os serviços de mapas foram validados no smoke descrito abaixo.
Os passos de email e utilização manual no browser continuam por validar.
A CI executa checks frontend, RLS local e E2E simulado.

O projeto Supabase fornecido usa publishable key. No ambiente cloud, o domínio
`isyhpoyihcbkujtjadzc.supabase.co` precisa de estar permitido na rede. A rede da API de gestão `api.supabase.com` e o token `SUPABASE_ACCESS_TOKEN`
estão agora funcionais (projeto `ACTIVE_HEALTHY`). O token é apenas server-side,
injetado pelo proxy; nunca copiá-lo para o frontend, `.env` do Vite ou logs.
Uma resposta `CONNECT tunnel failed, response 403` indica bloqueio do proxy,
não uma chave inválida.

## Mapas e rotas (nova fatia da Fase 2)

Ver `docs/14-CLOUDFLARE-PAGES.md` para o site público e segredos remotos.
`VITE_MAPTILER_API_KEY` e `VITE_MAP_STYLE_URL` só configuram o browser.
`ROUTING_API_KEY` e `APP_ORIGINS` são configuração privada das Edge Functions.
A chave de geocoding é a mesma de routing; não é exigida uma segunda chave.

As chaves presentes no ambiente passaram chamadas HTTPS verificadas de estilo
MapTiler, geocoding e directions openrouteservice. A resposta de directions foi
GeoJSON LineString com perfil driving-car e opção de evitar autoestradas. Estas
chamadas diretas são complementadas pelo smoke das Edge Functions publicadas.

O novo SQL cria limites de chamadas persistentes e uma função exclusiva do
service_role para guardar rotas. Nunca aplicar a migration ou publicar funções
sem autorização explícita. Não reaplicar migrations já presentes.

Testes: os handlers validam autenticação, CORS, ownership, estado, revisão, quotas,
input e falhas de persistência. Os adapters rejeitam geometrias inválidas e não
inventam rotas. O E2E usa MapLibre/WebGL2 real com estilo offline controlado e
transporte Supabase simulado, incluindo cálculo, distância e links externos.
Os testes PostgreSQL cobrem a RPC privilegiada, invalidação de rotas e quotas.
O entrypoint Deno também rejeitou POST sem autenticação (401) e origem não
autorizada (403) numa verificação local.

O frontend carrega o mapa em chunk separado. O build pode emitir avisos de
tamanho desses chunks; não são falhas de build. A instalação e a navegação
externa em dispositivos Android/iOS continuam a exigir validação real.

A PWA apresenta aviso quando existe uma atualização, para o utilizador guardar
as edições antes de ativar a nova versão. Não há reload automático durante edição.


## Publicação e smoke remoto — 2026-10-23

Aplicada com autorização a migration 003 (SHA-256
`5ca1430b1d7b6b83ac3dfcb222371367388d8ec58d1537a40265f2fe35507942`).
`search-places` e `calculate-route` publicadas, ACTIVE versão 2, com
`APP_ORIGINS=https://ridesync-8z1.pages.dev` e segredo ORS guardado no Supabase.
Tipos gerados sincronizados com o esquema remoto. Não reaplicar migrations.

Passaram 10 verificações transacionais da BD com rollback e 10 verificações
HTTPS com conta temporária: sessão Auth real, pesquisa (5 locais), bloqueio de
pedidos anónimos/JWT inválido/origem não autorizada, cálculo ORS, persistência
sob RLS, incremento da revisão e rejeição de revisão antiga/viagem inacessível.
A rota de teste no Porto devolveu 4191,9 m e 559,9 s. Conta, viagem e contadores
temporários removidos no fim. Isto não valida emails nem o browser Pages.

O deploy usa dependências Deno com lockfile e `nodeModulesDir: auto`.
Se a CLI rejeitar o placeholder de autenticação proxy, usar a API oficial:

```sh
python3 scripts/deploy-map-functions.py --project-ref isyhpoyihcbkujtjadzc --dry-run
# Apenas após autorização de deploy:
python3 scripts/deploy-map-functions.py --project-ref isyhpoyihcbkujtjadzc
```

O helper usa `SUPABASE_ACCESS_TOKEN` injetado por HTTPS, sem o guardar ou imprimir.
Não aplica migrations nem configura segredos. Não extrair o token proxy nem
alterar HOME para contornar autenticação. Erros ORS 401/403 são apresentados como
indisponibilidade de credenciais do serviço; logs incluem apenas operação/status.
