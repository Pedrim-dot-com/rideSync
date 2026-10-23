# Convites e participação — Fase 3

## Comportamento implementado

O organizador cria um link por pessoa na página da viagem, em rascunho ou
planeada. O link permite uma resposta, tem validade de 48 horas e pode ser
revogado antes de ser utilizado. Não é enviado automaticamente por email.
A interface permite copiar o link para o organizador o partilhar.

Quem recebe o link pode iniciar sessão ou criar conta, confirmar o email e
voltar ao convite. Só a aceitação revela a viagem e os seus pontos/rota.
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
  em localStorage. Limpa-se ao aceitar, recusar ou fechar o convite.
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

## Migration e publicação pendentes

Ficheiro: `supabase/migrations/202610240004_trip_invitations.sql`.
Cria `trip_invitations`, índices e seis RPCs: `create_trip_invitation`,
`list_trip_invitations`, `revoke_trip_invitation`, `respond_trip_invitation`,
`list_trip_members`, `set_trip_motorcycle`. Não altera dados de viagens existentes.
Não requer Edge Functions, novos segredos nem alterações a Auth ou MapTiler.

A migration está validada apenas em PostgreSQL local descartável; **ainda não
foi aplicada no Supabase**. Requer autorização explícita conforme `CLAUDE.md`.
Depois da autorização: aplicar só a 004, regenerar tipos com o esquema remoto,
substituir o contrato provisório `participation.types.ts` pela tipagem gerada
quando adequado, executar smoke com contas temporárias e só depois publicar o
frontend via push para `main`. Nunca executar o bootstrap local no Supabase real.

O snapshot `database.generated.ts` continua a refletir a migration 003 remota.
`database.types.ts` acrescenta explicitamente os contratos da migration 004
pendente, sem fingir que o esquema remoto já foi atualizado.

## Validação

- Testes PostgreSQL cobrem hashes, privilégios, expiração, revogação, duplicação,
  outsider, concorrência, estado da viagem, quotas e ownership de motas.
- Testes unitários cobrem UI de organizador/participante, bloqueios, erros de
  convite e fragmentos privados sem interferir com hashes de recuperação Auth.
- E2E com transporte Supabase simulado: criar/revogar convite, registo, login,
  persistência do convite após reload, aceitação e escolha de mota em viewport
  móvel. Não comprova entrega de email nem integração remota da migration 004.
- Instalação/uso em iOS e Android reais continuam por validar.
