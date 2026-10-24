# 20 — Voz da viagem e prioridade SOS

Pedido obrigatório em 2026-10-24: organizador comunica para todos os participantes;
os restantes só publicam voz através de SOS que interrompe a fala do organizador.

## Comportamento

Disponível para participantes aceites durante viagem ativa. Ouvir é opt-in e não
pede microfone. Organizador escolhe Falar para o grupo. Participante escolhe um
motivo e SOS; o alerta visual é gravado antes de pedir microfone. Se a permissão
falhar, o alerta permanece e a interface indica que a voz não foi ativada.

Um SOS de cada vez, prioridade ao primeiro ativo, validade máxima 90 s. Próprio
emissor ou organizador resolve. Organizador volta a falar explicitamente depois;
não reativar o seu microfone automaticamente. SOS avisa participantes ligados,
não contacta 112 nem funciona sem rede. Não é um serviço de emergência.

Canais limitados a 16 ligações. A PWA só promete voz com app visível/ativa;
sair, esconder, perder rede ou terminar viagem desliga som/microfone local.
Regresso exige nova ação. Safari pode exigir Ativar som após conectar. Testar
Bluetooth/headset, outras apps, bloqueio de ecrã e chamadas telefónicas em hardware.
Não afirmar intercomunicador de capacete contínuo com ecrã bloqueado numa PWA.

## Media e autorização

LiveKit Cloud fornece SFU/TURN; áudio não passa por Broadcast nem PostgreSQL.
SDK cliente 2.23.0 carregado apenas ao usar áudio; SDK servidor 2.19.2 só na Edge.
Ambos Apache-2.0, licenças verificadas nos pacotes. A app não grava áudio, não usa
camera, Egress/Agents/SIP nem guarda trilhos/ficheiros de voz.

- Edge trip-voice valida JWT com auth.getUser e CORS APP_ORIGINS. Limite corpo
  2048 bytes; schema estrito tripId/action sem actor/role/room arbitrários.
- RPCs service-only determinam interlocutor e membership. 30 comandos/minuto/
  conta; heartbeat 15 s. Palavra do organizador expira sem renovar em 45 s.
- Join emite JWT LiveKit de 60 s, sala exata, identidade derivada do JWT Supabase,
  fonte microphone, sem publishData nem gestão de sala. Ouvintes não publicam.
- Cada mudança de fala cria nova room_epoch. Reutilizar um token de antiga
  autorização de publicação não permite entrar na sala atual da audiência.
  Este desenho inclui reconnect breve por mudança e, durante fala contínua,
  pelo menos uma vez por minuto para renovar a autorização da audiência. Medir
  a latência real.
- Operação de criação tem lease 25 s e fencing por época. Falha/timeout/stale
  completion não autoriza publicação na época atual. Provider timeout 8 s,
  sem failover automático. Tentativa de eliminar sala anterior é best effort.
- autoSubscribe false: cliente só assina áudio/microfone do interlocutor indicado
  pelo snapshot autenticado, nunca metadados/Presence de participantes.
- Snapshot a cada 5 s durante áudio, polling 15 s sem áudio e invalidação privada
  voice:<trip>. Sem snapshot confirmado durante 12 s, desligar media. Prazo do
  interlocutor deriva de server_now, sem confiar no relógio civil do telemóvel.
- Autorizações de microfone que terminem depois de sair são canceladas e os
  tracks parados. Não guardar tokens LiveKit em localStorage/sessionStorage.

A mudança de sala protege a audiência atual de tokens de publicação antigos;
não confundir com expiração imediata de ligações já abertas em salas antigas.
Clientes legítimos desligam/reconectam ao snapshot; salas vazias são removidas
pelo fornecedor (departureTimeout 10 s, emptyTimeout 30 s). Se a remoção remota
falhar e clientes adulterados mantiverem uma sala antiga ocupada, um operador
deve encerrá-la no LiveKit. Revogação administrativa imediata independente dos
clientes e limpeza agendada de salas órfãs são pendências operacionais antes de
considerar este mecanismo adequado a cenários de segurança mais exigentes.

## Configuração

1. Criar projeto RideSync em https://cloud.livekit.io/.
2. Obter Project URL `wss://<projeto>.livekit.cloud`, API key e API secret.
3. Guardar LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET em Supabase Edge
   Functions → Secrets. Nunca usar prefixo VITE_, bundle frontend ou chat.
4. APP_ORIGINS mantém apenas origens HTTPS autorizadas, incluindo
   https://ridesync-8z1.pages.dev. Função gateway verify_jwt=false porque o
   handler valida getUser; não expor begin/finish ao papel authenticated.
5. Rever plano, https://livekit.io/pricing, limites de participantes/minutos,
   tráfego e alertas de custo do projeto. Não assumir tráfego grátis ilimitado,
   nem ativar upgrades pagos implicitamente. Os valores atuais dependem do plano.
6. Aplicar migration 008 após 007, publicar trip-voice e então frontend, com
   confirmação prevista no CLAUDE.md. Regenerar tipos após aplicação remota.

O utilizador confirmou que guardou os segredos. Consulta read-only confirmou
presença dos três nomes; isto não valida o URL, valores, billing ou ligação real.

## Validação e limites da entrega

Implementado e testado localmente. 46 checks PostgreSQL adicionais cobrem roles,
prioridade, sala/época, JWT replay isolado, expiração, operações abandonadas,
privilégios service-only, Realtime privado e término. Unitários cobrem Edge/CORS,
identidade, falhas, subscrição autorizada, microfone negado/tardio e cleanup.
Testes simulados não provam latência/entrega WebRTC nem áudio de um headset.

Após autorização: aplicar migrations, validar provider e token real com contas
fictícias, limpar dados de teste e publicar. Antes de aceitação em estrada,
executar em três dispositivos (iOS e Android) e redes móveis distintas:
organizador fala, participante A interrompe com SOS, B ouve o SOS, permissões
negadas mantêm alerta, resolver/retomar, perda de rede, foreground/background,
headset e conclusão. Registar latência medida e falhas, sem prometer um SLA.
