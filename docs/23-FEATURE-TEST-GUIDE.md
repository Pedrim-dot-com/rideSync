# 23 — Estado real e teste de grupos e voz/SOS

## Estado confirmado no projeto atual

Ativação concluída com autorização em 2026-10-24, PWA
https://ridesync-8z1.pages.dev e Supabase rideSync-app. Migrations 007/008 e a
correção 009 aplicadas; trip-voice ativa e credenciais de API LiveKit validadas
por criação de salas e tokens reais. Recibos em [docs/24](24-GROUPS-VOICE-ACTIVATION.md).

| Camada | Grupos | Voz/SOS |
|---|---|---|
| Código/interface | Implementados e publicados | Implementados e publicados |
| Base de dados | Tabelas/RPCs 007 e correção 009 instaladas | Tabelas/RPCs 008 instaladas |
| Edge Function | Usa RPCs e mapas existentes | trip-voice ativa com autenticação própria |
| Validação real | Criação, aprovação, vários dirigentes e restrições por HTTPS | Salas/tokens LiveKit e prioridade SOS por HTTPS |
| Aceitação manual | Testar o fluxo abaixo com as próprias contas | Som/latência/headsets em três aparelhos ainda por confirmar |

O bloqueio anterior de backend ausente foi resolvido. Se ainda aparecerem erros
antigos na PWA, aplicar o aviso Atualizar e voltar a abrir o ecrã. Guardar chaves,
por si só, não era suficiente; agora migrations e função estão efetivamente ativas.

## Regra dos grupos

Pertencer a um grupo é opcional. Uma conta pode ter zero ou uma inscrição aceite.
Não há associação automática no registo. Sem grupo é possível usar garagem,
viagens e voz — sem pertencer a um motoclube.

Qualquer conta sem inscrição aceite/pedido pendente pode registar o seu grupo,
fornecer sede publicável e tornar-se primeiro dirigente. Um pedido pendente tem
de ser retirado antes de criar grupo; uma inscrição aceite tem de terminar antes
de aderir/criar outro. A criação conta como inscrição, pelo que não permite
permanecer em dois grupos. O último dirigente não pode sair pela app sem promover
outro membro. Este limite já está na migration 007; não obriga ninguém a aderir.

Todas as contas autenticadas veem diretório/mapa. Entrada num grupo existente
exige aprovação; vários dirigentes podem aprovar e gerir. Dados legais são
declarados, sem certificação automática pela plataforma.

## Ativação já executada neste projeto

Migrations 007–009 aplicadas, trip-voice publicada, tipos regenerados e testes
com contas temporárias concluídos, com limpeza confirmada. Não reaplicar essas
migrations nem executar o bootstrap PostgreSQL local no Supabase real.
Atualizar a PWA e seguir os testes abaixo; não é necessário novo projeto ou
novas chaves para os casos que já passaram na API. A aceitação de áudio exige
os aparelhos, permissões e rede descritos no roteiro.

## Testar grupos depois da ativação

Usar contas A, B e C separadas. Preferir ambiente de teste; em produção, publicar
apenas dados/sedes que se está autorizado a divulgar e identificar dados de teste.
Não criar associações reais em nome de terceiros.

1. B entra sem grupo: continua a usar viagens/garagem e consulta Grupos → Lista
   de grupos/Mapa das sedes. Não deve ser obrigada a inscrever-se.
2. A abre Grupos → Registar grupo. Preenche nome, descrição e sede com morada/
   coordenadas explícitas. Denominação legal e NIPC/registo são opcionais.
3. Ao guardar, A passa a primeiro dirigente. O grupo/sede aparece a B e C.
4. B abre o grupo e escolhe Pedir entrada no grupo. Antes da aprovação, o estado
   deve ser pendente. A abre O meu grupo → Membros e direção e aprova B.
5. A promove B com Tornar dirigente. Ambas conseguem gerir o grupo. A pode sair;
   B, se for o último dirigente, deve receber explicação ao tentar sair.
6. C, continuando sem grupo nem pedido, pode criar outro grupo próprio. Não
   precisa de ser convidada, aprovada noutro grupo ou participar numa viagem.
7. A lista/mapa mostra ambas as sedes. B não pode criar/aderir a outro grupo
   enquanto continuar inscrita no primeiro. Pedidos podem ser retirados.

## Testar voz/SOS depois da ativação

Usar três dispositivos e contas A (organizador), B e C (participantes). A inscrição
num grupo motard é irrelevante para este acesso. Usar HTTPS, internet, PWA visível
e ecrã desbloqueado; testar parado, com auscultadores para reduzir eco.

1. A cria viagem, calcula a rota e partilha convites com B/C. Ambos aceitam os
   convites **antes de iniciar**. Podem escolher mota própria ou nenhuma.
2. A inicia a viagem. Todos abrem a mesma viagem ativa e escolhem Ouvir grupo.
   Se o Safari pedir, tocar em Ativar som. Ouvir não deve pedir microfone.
3. A escolhe Falar para o grupo e autoriza o microfone. B/C devem ouvir A.
   B/C não têm o botão de fala normal do organizador.
4. B escolhe motivo, por exemplo Furo, e toca SOS. O alerta deve chegar a todos;
   a fala de A é interrompida. B autoriza o microfone e fala para A/C.
5. Repetir com microfone negado em B: o alerta visual permanece, sem fingir que
   existe áudio. Um SOS de cada vez; próprio emissor/organizador pode resolver,
   ou o alerta expira após 90 segundos.
6. Resolver o SOS. A retoma com Falar para o grupo; o microfone não liga sozinho.
7. Desligar voz deve parar o microfone. Sair da app, bloquear ecrã ou perder rede
   desliga a ligação local; regressar exige ativar novamente. A PWA não é um
   intercomunicador com funcionamento garantido em segundo plano.
8. A termina a viagem: tempo fica no histórico, posições são removidas e
   voz/SOS deixam de estar ativos. Registar latência e problemas em iOS/Android,
   redes distintas e headset; os testes simulados não provam esta aceitação.

Se falhar depois da ativação, registar dispositivo/versão iOS ou Android,
conta/role (sem credenciais), ação, texto exato do erro e estado da viagem.
Nunca incluir API secrets, tokens, SDP ou ICE candidates no relato.


## Extensão local — convites e Perfil (2026-10-24)

O estado publicado e os testes acima referem-se a 001–009. Convites de grupo, revisão de propostas e grupo no Perfil são uma extensão local dependente da 010, ainda sem deploy. Seguir o roteiro separado em docs/25 depois da ativação; não esperar estes controlos na PWA publicada atual.

Detalhes e estado: [Convites de grupo e Perfil](25-GROUP-INVITATIONS-AND-PROFILE.md).
