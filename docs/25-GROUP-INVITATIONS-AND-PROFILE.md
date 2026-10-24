# 25 — Convites de grupo e pertença no Perfil

## Estado desta entrega

Implementado e validado localmente em 2026-10-24. A migration
`202610240010_group_invitations.sql` ainda não foi aplicada no rideSync-app;
a interface nova ainda não foi publicada. Produção mantém migrations 001–009.
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
O snapshot de tipos remotos continua pela 009, com contratos locais tipados da
010; regenerar snapshot após a aplicação autorizada.

## Como testar após ativação

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
Isto não equivale a testes HTTPS da migration 010 no projeto real.

Após confirmação exigida pelo CLAUDE.md: aplicar só a 010, regenerar tipos,
validar com contas temporárias e limpar os dados, publicar frontend e confirmar
bundle/atualização PWA. Nunca publicar a UI dependente da 010 antes da migration.
Preservar recibos de 007–009 em docs/24; registar separadamente a nova execução.
