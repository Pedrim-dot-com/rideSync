# Convites e participação — Fase 3

## Comportamento implementado

O organizador cria um link por pessoa na página da viagem, em rascunho ou
planeada. O link permite uma resposta, tem validade de 48 horas e pode ser
revogado antes de ser utilizado. Não é enviado automaticamente por email.
A interface permite copiar o link para o organizador o partilhar.

Quem recebe o link pode iniciar sessão ou criar conta, confirmar o email e
voltar ao convite. Abrir o link com sessão permite guardar título, partida e
nome do organizador nas notificações. Só a aceitação revela os detalhes da
viagem, participantes e pontos/rota.
Recusar também consome o link e não concede acesso. Um link já usado, expirado,
revogado, inválido ou para viagem bloqueada devolve a mesma mensagem.
Um participante já confirmado não pode consumir outro convite dessa viagem.
Se perder a resposta de uma aceitação por falha de rede, pode abrir a viagem
na lista; o token continua a não permitir uma segunda utilização.

Os participantes confirmados veem nomes/nicknames e a marca/modelo da mota
escolhida para a viagem. Cada um escolhe apenas uma mota da sua garagem, ou
nenhuma. A escolha fica bloqueada quando a viagem deixa de estar em planeamento.
Apagar a mota limpa a associação, preservando a viagem. Não se promove
automaticamente a mota principal nem se expõe o resto da garagem.

## Segurança

- Token gerado no servidor com dois UUIDs v4 independentes (244 bits aleatórios).
- Apenas SHA-256 é guardado; o token original é devolvido uma única vez.
- O link usa fragmento `#invite=…`, que não integra pedidos HTTP nem o referrer.
  O browser captura e remove o fragmento, guardando-o temporariamente em
  sessionStorage para permitir login/registo no mesmo separador. Não é guardado
  em localStorage. Com a migration 006, limpa-se após o servidor confirmar
  o recibo na conta; fechar o aviso mantém o token enquanto a gravação não
  estiver confirmada. A limpeza de um token antigo não remove um novo convite.
- Se a confirmação de email abrir outro separador/dispositivo, reabrir o link
  original. O convite nunca é incluído no redirect de Auth.
- Tabela de convites com RLS e sem acesso direto para anon/authenticated;
  RPC de listagem exclusiva do organizador devolve apenas metadados, nunca hashes.
- RPCs com `search_path` vazio, identidade obtida por `auth.uid()`, locks na mesma
  ordem e proteção contra duas aceitações simultâneas do mesmo link.
- Limites de 10 convites/viagem/24 horas e 30/organizador/24 horas, incluindo
  usados/revogados, com serialização por organizador. Sem segunda chave ou serviço.
- RLS de perfis/motas permanece privada. RPC de membros expõe só a projeção
  mínima dos participantes aceites. Seleção de mota não permite alterar outro
  participante, papel, estado, itinerário ou revisão.
- Qualquer pessoa autenticada que possua um link ainda válido pode utilizá-lo.
  O organizador deve partilhá-lo apenas com o destinatário pretendido.

## Migration e publicação autorizadas

Ficheiro: `supabase/migrations/202610240004_trip_invitations.sql`.
Cria `trip_invitations`, índices e seis RPCs: `create_trip_invitation`,
`list_trip_invitations`, `revoke_trip_invitation`, `respond_trip_invitation`,
`list_trip_members`, `set_trip_motorcycle`. Não altera dados de viagens existentes.
Não requer Edge Functions, novos segredos nem alterações a Auth ou MapTiler.

A migration foi aplicada com autorização do utilizador em 2026-10-24
(Europe/Lisbon; recibo UTC: 2026-10-23 23:16:26.803351+00).
SHA-256: `149f2275320819c7367b79ff6f0784a2c3844b26cdc27df549fa081cddc8abde`.
RLS, privilégios e as seis funções SECURITY DEFINER com search_path vazio foram
confirmados no projeto real. Não reaplicar nem editar esta migration.

O snapshot `database.generated.ts` foi regenerado da API Supabase após a 004.
`participation.types.ts` deriva agora os contratos gerados e corrige apenas a
nulabilidade de argumentos/resultados SQL que o gerador não representa
(por exemplo, escolher nenhuma mota e metadados de convites ainda não usados).
O frontend é publicado via push para `main`, após validação do backend.
Nunca executar o bootstrap de testes local no Supabase real.

## Validação

- Testes PostgreSQL cobrem hashes, privilégios, expiração, revogação, duplicação,
  outsider, concorrência, estado da viagem, quotas e ownership de motas.
- Testes unitários cobrem UI de organizador/participante, bloqueios, erros de
  convite e fragmentos privados sem interferir com hashes de recuperação Auth.
- E2E com transporte Supabase simulado: criar/revogar convite, registo, login,
  persistência do convite após reload, aceitação e escolha de mota em viewport
  móvel. Não comprova entrega de email.
- Instalação/uso em iOS e Android reais continuam por validar.


Smoke HTTPS remoto: **25 verificações passaram** com quatro sessões reais.
Incluiu privacidade antes da aceitação, bloqueio anónimo/outsider, hashes
inacessíveis, listagem mínima, recusa, expiração, revogação, aceitação,
anti-replay, motas próprias/nenhuma, garagem/perfis privados e aceitações
simultâneas com apenas um vencedor. Contas, viagem, convites e motas temporárias
removidos; limpeza confirmada no fim. Este teste não envia emails reais.

Verificações locais após regeneração: tipagem, lint, formatação, 72 testes e
build passam. SQL inalterado desde os 138 checks PostgreSQL aprovados; os três
E2E com transporte simulado passaram na implementação da funcionalidade.


## Notificações persistentes — migration 006 aplicada

Pedido: fechar o banner deve permitir responder mais tarde. Os links atuais
não designam uma conta ou email: a receção acontece quando alguém abre o link
válido e inicia sessão. Criar um link não envia notificações nem emails a uma
pessoa ainda desconhecida. Não existem notificações push do sistema operativo.

`202610240006_invitation_notifications.sql` cria recibos por convite/conta,
com RLS e acesso apenas por RPC. Não guarda tokens em claro nem consome o convite
quando o guarda. `remember_trip_invitation` valida o token e a identidade;
`list_received_trip_invitations` devolve só os recibos próprios com título,
partida, nome público do organizador, validade e estado; o identificador de
viagem só é exposto se a conta já tiver acesso. Não expõe coordenadas, membros,
hashes ou outras contas que abriram o mesmo link. O recibo mantém histórico até
eliminação da viagem/convite/conta, com cascades.

`respond_received_trip_invitation` exige recibo da própria conta e valida de
novo validade, revogação, uso e estado da viagem no servidor. A resposta antiga
por token mantém compatibilidade, através de uma função interna sem EXECUTE
para papéis API. Ambas usam os mesmos locks viagem→convite. Se um link for
partilhado por várias pessoas, só uma pode utilizá-lo; ter recibo não reserva
o link nem alarga o acesso à viagem.

Navegação inclui Notificações e contador de pedidos pendentes. A lista atualiza
no foco, reconexão e a cada 30 segundos com a app ativa. Não usa o relógio do
telemóvel para autorizar respostas. Convites expirados, revogados ou consumidos
permanecem visíveis sem ações de resposta. Aceites permitem abrir a viagem
quando a conta ainda tem acesso. Falhas de gravação mantêm o link temporário e
oferecem nova tentativa. Fechar antes de iniciar sessão oculta o aviso mas
permite gravar o recibo após login na mesma execução. Se a confirmação do email
mudar de dispositivo/separador antes da gravação, reabrir o link original.

Validação local da fase: 43 novos checks PostgreSQL (238 no total), 106 testes
unitários, tipagem, lint, formatação, build e cinco E2E passaram. Incluem UI de
recusa/histórico/rede e E2E que fecha antes e depois do login, recarrega e aceita
a partir das notificações.

Aplicação autorizada em 2026-10-24, recibo UTC
`2026-10-24 09:27:45.930452+00`. SHA-256 da migration 006:
`05bf4179759111a87a31165b8b3c2b1cd46189dc92947fc86bbce28e1e773052`.
RLS ativo, SELECT direto e execução da função interna negados. Snapshot de tipos
regenerado da API; contratos derivados com refinamentos de nulabilidade/estado.
Passaram 26 verificações HTTPS reais com três contas temporárias, incluindo
privacidade, ownership, recusa, expiração, revogação e concorrência entre token
e recibo, com apenas um vencedor. Contas, viagem e recibos de teste removidos;
limpeza confirmada. Publicação autorizada e confirmada em 2026-10-24 após push
para main do commit `29f2c76`. Bundle público `/assets/index-CjoFwJXN.js`
contém os campos `departure_date`/`departure_time` e as três RPCs de notificações.
CSS `/assets/index-D0x-0J4X.css` inclui as regras de contenção dos campos; o
service worker público precacheia ambos os ficheiros. Atualização na PWA requer
o botão «Atualizar» quando surge o aviso de nova versão.
