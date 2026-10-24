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
- DEC-004: **RESOLVIDO — Cloudflare Pages ligada ao GitHub**; endereço indicado: https://ridesync-8z1.pages.dev.
- DEC-005: **RESOLVIDO — guardar só a última posição e apagar ao parar/terminar**, confirmado pelo utilizador em 2026-10-24; tempo permanece no histórico.
- DEC-006: **RESOLVIDO — link com login ou registo**, confirmado pelo utilizador em 2026-10-24.
- DEC-007: se fotos da mota são P0 ou P1 (sugestão P1).
- DEC-008: **RESOLVIDO tecnicamente — notificações pela BD e releitura de snapshots autorizados**; não aceitar coordenadas em eventos do cliente.

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


Publicação autorizada em 2026-10-23: migration 003 aplicada e duas funções ACTIVE
versão 2. Deploy pela Management API oficial quando a CLI rejeita o placeholder
proxy; dependências Deno com lockfile e resolução automática. Segredo ORS remoto
atualizado pelo utilizador; smoke autenticado de pesquisa, cálculo e persistência
passou (10 checks), com limpeza dos dados temporários. Logs de erro do fornecedor
incluem apenas operação e código HTTP, sem pesquisas, coordenadas ou credenciais.


## ADR-011 — Convites por link e mota na viagem

Escolha confirmada pelo utilizador: link com login/registo antes de responder.
Links individuais de uso único, validade fixa de 48 horas, revogação pelo
organizador e hash SHA-256 no servidor. Token de dois UUIDs v4 independentes
(244 bits aleatórios), devolvido uma vez. Fragmento removido do endereço e
retido em sessionStorage até resposta/fecho, sem o incluir no redirect Auth.
Limites: 10 convites/viagem e 30/organizador por janela móvel de 24 horas.
Apenas viagens em draft/planned aceitam novos participantes ou seleção de mota.

Aceitar/recusar é autenticado e serializado com o estado da viagem. Só aceitar
concede membership e acesso RLS. Link é bearer: quem o receber pode usá-lo;
partilha manual pelo organizador, sem emails automáticos. Dados partilhados:
nome/nickname e marca/modelo da mota escolhida, via projeção mínima; perfis e
restante garagem continuam privados. Não requer novas dependências/segredos.
Migration 004 aplicada com autorização em 2026-10-24 (Europe/Lisbon); tipos
regenerados e 25 verificações remotas de convites/participação aprovadas, com
limpeza confirmada dos dados temporários.
Ver `docs/15-INVITATIONS-AND-PARTICIPATION.md`.


## ADR-012 — Sessões cronometradas e GPS foreground

Pedido do utilizador: iniciar/terminar viagens, controlar tempo e acompanhar
posições no percurso. Sem novas dependências. Transições draft/planned → active
→ completed só pelo organizador, via RPC com revisão/locks e hora do servidor.
Exigir rota calculada antes de iniciar. Fim manual com confirmação; não inferir
chegada automática nem implementar turn-by-turn interno.

Retenção confirmada pelo utilizador (DEC-005): apenas última posição,
remoção ao parar/fim; invisibilidade após 60 s sem updates, stale aos 30 s,
purga física adicional em leituras. Não instalar cron ou guardar histórico GPS.
Falhas de rede podem impedir apagar imediatamente; documentar essa diferença.
Opt-in por geração impede reativação por pedidos atrasados e cleanup de outra
instância. Notificações pequenas e privadas emitidas pela BD; frontend relê dados
sob autorização, com polling de segurança de 10 s. Sem confiar em coordenadas
recebidas por Broadcast/Presence de clientes. Quota por pessoa persiste durante
stop/start, sem guardar histórico de coordenadas.

O utilizador confirmou zoom ao tocar e deslocamento da página em iOS.
Input 16 px e remoção de autofocus corrigem causas comuns de zoom/foco em
mobile, mantendo acessibilidade. Refresh Auth não deve limpar cache quando a
identidade se mantém. Migration 005 aplicada com autorização em 2026-10-24; tipos regenerados e
24 verificações HTTPS/WebSocket passaram, com limpeza confirmada das fixtures.
PWA verifica novas versões ao retomar e a cada minuto, sempre com confirmação
antes do reload. Ver `docs/16-TRIP-TRACKING.md`.


## ADR-013 — Nova identidade e hierarquia de interface

Pedido do utilizador: UI menos confusa e inspiração KTM. Direção laranja/preto,
tipografia condensada e componentes direitos; marca RideSync própria, sem ativos
KTM. Referência URL bloqueada por CONNECT 403 no ambiente; não afirmar inspeção
da página atual. Fonte Barlow Condensed SIL OFL local e grafismo original.

Entrada por Viagens, navegação mobile inferior e filtros por estado real.
Mapa e ações de saída em destaque; grupo/convites e gestão em disclosures
nativas, mantendo o GPS montado. Inputs 16px, confirmação de ações e consentimento
continuam ativos. Corrigida a perda de classes de posicionamento do marcador
MapLibre durante updates visuais. Sem alterações de backend ou dependências.
Publicação autorizada e confirmada na Cloudflare em 2026-10-24: tema, fonte,
manifesto e precache da nova UI verificados após push do commit 453c62b.
Ver docs/17-UI-REDESIGN.md.


## ADR-014 — Instalação assistida e login por passkey

Pedido do utilizador: banner de instalação no painel e biometria como Face ID.
Banner por plataforma, instalado detetado e preferência de dispensa sete dias.
Sem prompt de instalação inventado em Safari; apenas Chrome fornece o evento
nativo quando elegível. Login implementado com passkeys nativas do Supabase Auth,
sem recolher biometria, guardar passwords ou fazer autenticação apenas no cliente.
Face ID, impressão digital ou PIN são escolhas do dispositivo.

Registo só em sessão autenticada, gestão no Perfil e alternativa email/password.
RP ID proposto limitado a ridesync-8z1.pages.dev e origem HTTPS exata. A ativação dos quatro campos Auth foi autorizada e confirmada em 2026-10-24,
sem mudar as restantes definições. Dez verificações com Auth real e autenticador
virtual passaram, incluindo assinatura inválida recusada e revogação, com
limpeza confirmada da conta temporária. Não há migrations ou chaves adicionais.
Face ID num iPhone físico ainda requer validação do utilizador.
Ver docs/18-INSTALLATION-AND-PASSKEYS.md.


## ADR-015 — Recibos privados de convite e data/hora mobile

Pedido: notificações persistentes para convites fechados e corrigir a data de
partida que ultrapassa a largura de ecrãs pequenos. Sem novas dependências.
Data e hora tornam-se dois controlos nativos, empilhados em mobile, com 16px,
min-width zero e conversão conjunta pela validação local/ISO já existente.
Sem remover zoom de acessibilidade. Chromium validado a 280/320/375px, incluindo
submissão e edição; WebKit não disponível, download bloqueado com HTTP 403 pelo
ambiente. Confirmar os seletores nativos em Safari/iPhone físico após publicação.

Como os convites são links bearer sem destinatário, guardar um recibo na conta
só após apresentar token válido e autenticar. Fechar banner não responde nem
consome o link. Nova projeção mínima do título/partida/organizador antes de
aceitar; detalhes da viagem continuam privados por RLS. Respostas por recibo
exigem ownership e partilham a implementação atómica do token original. Não
adicionar envio de email, push, localização ou acesso antecipado à viagem.
Histórico retido enquanto convite/viagem/conta existir; só pedidos válidos têm
ações. Ver docs/15-INVITATIONS-AND-PARTICIPATION.md. Migration 006 aplicada com autorização em 2026-10-24; tipos regenerados e
26 checks HTTPS reais passaram, com limpeza das contas/viagem/recibos temporários
confirmada. Publicação autorizada em curso. Não alterar migrations já aplicadas.
