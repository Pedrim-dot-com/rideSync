# Desenvolvimento — fundação, garagem e planeamento de viagens

## Estado implementado

React + TypeScript estrito, Vite, Tailwind, TanStack Query, Supabase client,
manifest e service worker PWA (apenas shell estática). Registo, login, logout,
recuperação de password, edição de perfil e CRUD da garagem. Mota principal
por RPC atómica, índice único parcial e RLS por proprietário.

Planeamento de viagens: criar/listar/consultar/editar/remover, partida, origem,
destino e paragens ordenadas, com coordenadas manuais validadas. Estados
rascunho/planeada/cancelada e controlo de revisões concorrentes.

Mapas, cálculo de rotas, geocoding, convites, tracking, uploads e IA ainda não
estão implementados. A tabela de rotas está preparada mas apenas o futuro
backend de routing poderá escrever nela.
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
produção usar HTTPS. Manter confirmação de email; o registo pode exigir que o
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

## Validação com Supabase real (pendente)

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

Sem os passos anteriores não se considera a integração remota validada.
Não foi feito deploy. A CI executa checks frontend, RLS local e E2E simulado.

O projeto Supabase fornecido usa publishable key. No ambiente cloud, o domínio
`isyhpoyihcbkujtjadzc.supabase.co` precisa de estar permitido na rede. A rede da API de gestão `api.supabase.com` e o token `SUPABASE_ACCESS_TOKEN`
estão agora funcionais (projeto `ACTIVE_HEALTHY`). O token é apenas server-side,
injetado pelo proxy; nunca copiá-lo para o frontend, `.env` do Vite ou logs.
Uma resposta `CONNECT tunnel failed, response 403` indica bloqueio do proxy,
não uma chave inválida.
