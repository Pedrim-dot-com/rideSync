# 25 — Convites de grupo e pertença no Perfil

## Estado desta entrega

A migration 010 foi aplicada com autorização no rideSync-app. Tipos remotos regenerados e 34 checks HTTPS reais aprovados, com contas/grupos temporários removidos e limpeza verificada. Interface publicada e bundle/service worker confirmados; recibo em docs/25.
Não são necessárias novas chaves nem alterações à função de voz.

## Regras confirmadas

| Ação | Quem pode iniciar | Revisão | Resultado |
|---|---|---|---|
| Criar grupo | Conta sem grupo nem candidatura pendente | Não | Primeiro dirigente do novo grupo |
| Candidatar-se | Conta sem grupo nem candidatura pendente | Dirigente aceita/recusa | Só a aprovação cria inscrição aceite |
| Convidar diretamente | Dirigente | Já aprovado pela direção | Pessoa convidada aceita e entra imediatamente |
| Propor convite | Membro aceite | Dirigente aprova/recusa antes de entregar | Após aprovação, destinatário aceita e entra imediatamente |

**Aceitar um convite aprovado não cria uma nova candidatura.** A aprovação da
direção já aconteceu antes da entrega. Uma proposta por rever é invisível ao
destinatário. Não existe inscrição sem aceitação voluntária da pessoa convidada.
Grupo opcional, zero ou uma inscrição aceite; no máximo uma candidatura pendente.

O dirigente/membro escreve o nickname exato de uma conta existente sem grupo nem
candidatura pendente. Não existe pesquisa pública de pessoas nem envio por email.
O remetente vê os seus convites; dirigentes veem todos os do grupo. Só dirigentes
podem aprovar/recusar propostas e candidaturas. Remetente ou dirigente pode revogar
um convite ativo. O destinatário consulta convites entregues no Perfil e em
Notificações, com badge; fechar/sair do ecrã não apaga o pedido.

Propostas expiram em sete dias. Aprovação inicia sete dias para responder ao
convite entregue. Estados finais ficam consultáveis; expiração/revogação/recusa
não cria inscrição. Outro grupo aceite ou candidatura noutro grupo bloqueia a
aceitação; se houver candidatura entretanto ao mesmo grupo, aceitar um convite
já aprovado resolve essa candidatura como inscrição aceite. Concorrência de duas
aceitações não permite pertencer a dois grupos.

## Dados e contratos

Tabela `group_invitations` com RLS, sem leitura/escrita direta por anon ou
contas autenticadas. `invited_by`, `approved_by/approved_at` e `responded_at`
registam autoria, aprovação e resposta. RPCs SECURITY DEFINER com search_path
vazio validam auth.uid(), pertença/papel e alvo; locks grupo→perfil protegem as
transações. Máximo de dez novos convites/minuto e cinquenta/dia por grupo.

- `invite_group_member(p_group_id, p_username) → uuid`: dirigente cria pending;
  membro cria review; repetição ativa é idempotente. Dirigente pode aprovar
  proposta existente ao convidar o mesmo alvo.
- `review_group_invitation(p_group_id, p_invitation_id, p_approve) → void`:
  dirigente muda review para pending ou rejected.
- `list_sent_group_invitations(p_group_id)`: projeção mínima do alvo e estado;
  membro só vê os próprios, dirigente vê todos.
- `revoke_group_invitation(p_group_id, p_invitation_id) → void`: revogação autorizada.
- `list_received_group_invitations()`: só convites próprios já aprovados;
  inclui nome do grupo/remetente, prazo e estado, sem email ou dados privados.
- `respond_group_invitation(p_invitation_id, p_accept) → uuid|null`: recusa ou
  inscrição member/accepted atómica; não atribui cargo dirigente.

Perfil consulta a inscrição própria e resumo público do grupo, apresenta nome,
sede e papel para inscrição aceite, ou candidatura pendente de forma distinta.
Sem inscrição continua possível criar grupo/candidatar-se. As listas usam polling
e invalidação de cache após ações; não prometem notificações push em background.
O snapshot de tipos remotos foi regenerado após a aplicação da 010; os aliases
locais refinam os contratos usados pela interface.

## Como testar na PWA publicada

1. A cria grupo; B candidata-se. A aprova B, que fica membro comum.
2. B propõe convite para C (sem grupo): B vê “Aguarda revisão da direção”.
   C não recebe nada antes da aprovação; B não tem botões para aprovar.
3. A abre o grupo, aprova a proposta. C vê convite no Perfil/Notificações;
   ainda não pertence ao grupo. Sair e voltar mantém o convite.
4. C aceita: passa imediatamente a membro; Perfil mostra grupo e papel.
   Não aparece candidatura pendente nem é necessária segunda aprovação.
5. Usar D sem grupo: A convida diretamente. D recebe logo e pode aceitar/recusar.
6. Com outra proposta, testar recusa pela direção (não entregar), revogação,
   destinatário a recusar e prazo expirado. Nenhum destes cria inscrição.
7. Separadamente, D sem grupo pode candidatar-se: Perfil mostra pendente até
   dirigente aprovar. Sem grupo/candidatura pode também criar o seu próprio.

## Validação e publicação

137 testes unitários, 371 checks PostgreSQL locais (55 de convites de grupo),
com permissões, privacidade, expiração e concorrência. O E2E de transporte
simulado cobre três contas: proposta, revisão, aceitação e Perfil em mobile.
Sete E2E de transporte simulado, typecheck, lint, formatação e build/PWA
aprovados; resultados registados na revisão documental.
A validação real acrescentou 34 checks HTTPS: criação sem grupo, candidatura
e aprovação, proposta por membro, destinatário sem acesso antes da revisão,
revisão exclusiva de dirigentes, entrega e consentimento, inscrição imediata
sem nova candidatura, Perfil/grupo/papel, inbox privada, impossibilidade de ler
convites enviados por outros membros, convite direto, recusa da proposta e do
destinatário, revogação, expiração, replay, anonymous e corrida de duas aceitações
com apenas um grupo aceite. Contas e grupos temporários removidos; limpeza
confirmada. Não comprova Safari num iPhone físico nem notificações em background.

## Recibo remoto — 010

- Projeto: rideSync-app (`isyhpoyihcbkujtjadzc`).
- Verificação UTC: `2026-10-24 16:42:52.321289+00`.
- Ficheiro: `202610240010_group_invitations.sql`.
- SHA-256: `9309799c0f723f2574123c4bef23f9e32da8adc6e4ae51345f5d4ca34ed84136`.
- RLS ativo; authenticated sem SELECT direto na tabela.
- Snapshot de tipos públicos regenerado; nenhuma chave privada no repositório.
- Não reaplicar 010. Recibos históricos de 007–009 preservados em docs/24.

## Publicação confirmada

Push de `99e9199` e `0d7e5b2` para main concluído. Cloudflare Pages serve
`/assets/index-CUFv1z09.js`, e o service worker público precacheia o mesmo bundle.
Verificação HTTPS em UTC `2026-10-24T16:46:31.830487+00:00` confirmou os contratos de convites,
revisão de propostas, aceitação e grupo/candidatura no Perfil no JavaScript
público. Sem nova publicação de Edge Functions.

Na PWA instalada: ligar à internet, abrir a app e aplicar o aviso Atualizar
quando aparecer. Depois abrir Perfil → O meu grupo; dirigentes/membros aceites
também encontram os convites na página do grupo. Sair e voltar a abrir a app
pode ser necessário para o service worker detetar a versão. A publicação
verificada não comprova que um iPhone individual já recebeu a atualização.
