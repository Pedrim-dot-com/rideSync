# Iniciar, acompanhar e terminar viagens

## Fluxo implementado

1. O organizador calcula e guarda um percurso real.
2. Em rascunho ou planeada, escolhe **Iniciar viagem**. O servidor cria uma
   sessão, guarda a hora de início e muda a viagem para `active` atomicamente.
3. O cronómetro mostra o tempo decorrido, também depois de recarregar a página.
   O relógio usa a hora do servidor e tempo monotónico do browser entre leituras.
4. Cada participante escolhe **Partilhar a minha localização** e concede GPS.
   O mapa mantém a linha do percurso e mostra as posições recentes do grupo.
   Pode seguir a posição própria; arrastar o mapa desativa o seguimento.
5. Ao chegar ao destino, o organizador escolhe **Terminar viagem** e confirma.
   O servidor guarda a hora final, muda para `completed`, impede novos envios
   e apaga posições/autorizações de partilha. O tempo total fica no histórico.

O fim é manual, não depende de um GPS impreciso detetar a chegada. Esta versão
não dá instruções de voz/curva a curva, não recalcula a rota ao sair do percurso
e não garante tracking em background. Não fornece percursos especializados
para motas. É possível ver o grupo sem partilhar a localização própria.

## Consentimento, estados e privacidade

Política de última posição/apagar ao parar ou terminar confirmada pelo
utilizador em 2026-10-24.

- Sem opt-in explícito não há `watchPosition` nem envio de coordenadas.
- Cada opt-in recebe uma geração nova, associada pelo servidor a `auth.uid()`.
  Não existe `user_id` fornecido pelo cliente na RPC de publicação.
- Parar, sair do ecrã, perder ligação, esconder a PWA ou terminar a sessão
  limpa o watcher. Em segundo plano não se iniciam novos envios. Ao regressar
  à mesma página, o consentimento mantido em memória pode retomar um watcher
  novo; recarregar/sair do ecrã exige optar novamente.
- Parar a partilha apaga a posição no servidor e invalida a geração. Um pedido
  atrasado dessa geração não consegue voltar a publicar, nem parar uma nova.
- Apenas a última posição é guardada; não se guarda histórico de coordenadas.
  Depois de 30 s, uma posição fica cinzenta/datada. Aos 60 s, é invisível por
  RLS e pelo snapshot, mesmo se o browser fechar sem conseguir avisar.
- Expiração física adicional acontece ao ler o snapshot da viagem. Se todos
  fecharem a app sem rede, uma linha expirada pode permanecer na BD, sem
  visibilidade, até à próxima leitura ou fim da sessão. Não há cron de purga
  instalado nem promessa de eliminação física ao segundo quando offline.
- Dados de coordenadas são apagados ao parar/terminar com ligação. Só timestamps
  de limitação de chamadas podem permanecer na sessão enquanto ativa; são
  apagados ao terminar. Não existe cache offline de posições.
- Raw shares são privadas; sessões/posições têm RLS de membership aceite.
  Membros removidos deixam de ler snapshots e a UI retira posições em erro.
- A API valida coordenadas, precisão, heading e timestamp recente. Isso não é
  uma prova de autenticidade do sensor GPS: um utilizador pode falsificar a sua
  própria posição, mas não a identidade de outra pessoa.

## Realtime e reconexão

A base de dados emite `tracking_changed` via `realtime.send` para o canal
privado `trip:<uuid>`, depois de alterar sessões/posições. A notificação contém
`{changed:true}` e um ID de mensagem gerado pelo Supabase; não inclui
coordenadas. Nenhuma coordenada vem de mensagens do browser.
O frontend invalida a query e relê o snapshot autorizado. Mesmo uma mensagem
fabricada só poderia provocar uma releitura, não inventar marcadores.

A policy SELECT de `realtime.messages` verifica membership aceite e extensão
Broadcast. Esta migration não cria policy INSERT para clientes. Autorização do
canal não substitui a autorização da RPC, incluindo depois de revogar membership.

Ao ligar/religar o canal, a app relê o estado. Uma atualização de segurança a
cada 10 s em viagens draft/planned/active funciona durante falha de WebSocket;
a UI distingue esse modo. Envio GPS limitado a um a cada 5,5 s no cliente e no
mínimo 5 s no servidor por pessoa, sem contornar o limite ao parar/retomar.

## Inputs mobile

O utilizador confirmou zoom ao tocar e deslocamento da página em iOS.
Campos usam 16 px para evitar o zoom automático comum no Safari iOS, mantendo
pinch-to-zoom acessível. Removido autofocus do título ao abrir o editor. O foco
por teclado mantém contorno visível, mais discreto; não se apaga o foco nativo
indiscriminadamente. Refresh de token Auth mantém a cache se a identidade não
mudou, evitando desmontar formulários/mapas e interromper a partilha.

## Migration e publicação

Ficheiro: `supabase/migrations/202610240005_trip_tracking.sql`.
Cria `tracking_sessions`, `location_shares`, `rider_locations`, RPCs de início/fim,
opt-in/stop/publicação/snapshot, helpers RLS, notificações DB e policy de receção
Realtime. Não altera migrations anteriores ou dados de viagens existentes.

A migration 005 foi aplicada com autorização do utilizador em 2026-10-24,
com recibo UTC `2026-10-24 07:26:29.04432+00`.
SHA-256: `56d9814594806fe6c01d7763c783e39b52a338ccf596145db50356c3e30fff56`.
RLS, ausência de escritas diretas pelo cliente e policy privada confirmadas.
Não reaplicar nem editar esta migration. Sem novos fornecedores ou segredos.

`database.generated.ts` foi regenerado da API após a 005. O wrapper corrige
apenas a nulabilidade de heading que o gerador não infere na RPC SQL.
O frontend é publicado via push para `main` depois dos testes remotos.
Nunca executar o bootstrap local no Supabase real.

Passaram **24 verificações HTTPS/WebSocket reais**: rota real ORS, ciclo
início/fim, tempo persistido, opt-in, quota, stop/anti-replay e limpeza de
posições. Os canais privados de organizador e participante receberam seis
notificações cada; outsider foi recusado. Notificações contêm só mudança/ID,
sem coordenadas. Contas, viagem, convites, sessões e posições de teste removidos.

## Validação e limites

- PostgreSQL descartável: 195 checks, incluindo 57 de tracking, transições,
  concorrência, membership, timestamps, quota, expiração e cleanup. O contrato
  local de realtime testa policies/notificações, não um servidor WebSocket real.
- 83 testes unitários, incluindo watcher sem consentimento, permissões negadas,
  background, desmontagem com resposta atrasada, fim, erro de acesso e eventos
  sem confiança na payload.
- Quatro E2E: garagem, viagens, convites e novo fluxo mobile de início/GPS/fim.
  Transporte Supabase e GPS são simulados; MapLibre/WebGL2 e browser são reais.
  Verifica que o canvas não é recriado quando chegam posições e que o tempo
  final persiste após reload. Não comprova sensores/dispositivos reais.
- Tipagem, lint, formatação e build passam. iOS Safari/Android Chrome reais,
  3–5 telemóveis e perda/retorno de rede continuam por validar após publicação.


## Atualizações da PWA

Uma alteração local não chega ao telemóvel antes de push e deploy Pages.
O service worker continua em modo prompt: não força reload nem interrompe
edições ou tracking. A aplicação verifica novas versões no registo, ao voltar
ao primeiro plano/ganhar ligação e a cada minuto enquanto visível, com throttle.
Falhas offline não impedem usar a aplicação. A atualização só é aplicada quando
o utilizador escolhe **Atualizar** no aviso; pode escolher **Mais tarde**.

Para uma instalação antiga que ainda não tenha esta verificação, fechar
completamente a PWA no seletor de aplicações do iPhone e voltar a abrir online.
Guardar edições e aceitar o aviso. Os headers de `sw.js` e manifesto usam
`no-cache`; assets têm nomes com hash. Não apagar dados locais como primeiro passo.
