# 01 — Definição de negócio (PRD)

## Problema
Organizar passeios de mota exige coordenar percurso, horários, participantes e localização. Links de mapas e mensagens dispersas não dão uma visão única da viagem e do progresso do grupo.

## Proposta de valor
Uma PWA mobile-first que permite criar uma viagem, visualizar o percurso, convidar motards, escolher a mota utilizada e acompanhar o grupo num mapa em tempo real enquanto a aplicação está ativa. Um assistente de IA ajuda a preparar o itinerário.

## Público-alvo
Motards individuais, grupos de amigos e associações/motoclubes com sede física e direção partilhada. Eventos públicos continuam fora da PoC.

## Personas
- **Organizador:** cria viagem, define percurso, convida e gere participantes.
- **Participante:** aceita convite, escolhe mota, consulta itinerário e opta por partilhar localização.
- **Visitante:** consulta apenas páginas públicas explicitamente disponibilizadas; sem acesso a dados de localização.

## Jornada principal
1. Registar conta e completar perfil.
2. Adicionar uma ou mais motas à garagem; escolher mota principal.
3. Criar viagem com título, data, origem, destino e waypoints.
4. Calcular percurso e consultar distância/duração estimadas.
5. Convidar utilizadores por convite autenticado/link com token temporário.
6. Participantes aceitam, selecionam uma mota própria e consultam o plano.
7. Organizador inicia a sessão; cada participante consente individualmente na partilha GPS.
8. Todos os autorizados veem posições recentes e estado de atualização.
9. Cada participante pode parar a partilha; organizador termina a sessão.
10. Consultar resumo básico da viagem; histórico GPS detalhado não é objetivo inicial.

## Regras de negócio
- Um utilizador pode ter várias motas; no máximo uma principal.
- Um participante pode escolher apenas uma mota que lhe pertence para uma viagem.
- Uma viagem tem um organizador e vários participantes; participantes não entram automaticamente sem convite/aceitação.
- O organizador gere itinerário e convites; não pode ativar o GPS de terceiros.
- Apenas participantes aceites consultam a viagem privada e as posições partilhadas.
- Alterações ao itinerário durante uma sessão ativa exigem uma decisão de produto; na PoC, bloquear edição da rota após iniciar tracking.
- Posição antiga deve ser identificada como antiga, nunca como live.
- O LLM propõe, o routing calcula e o utilizador confirma.

## Métricas de sucesso da PoC
- 3–5 motards conseguem concluir o fluxo ponta a ponta em telemóveis distintos.
- 100% dos testes de autorização críticos passam.
- Em rede estável, atualizações GPS visíveis em poucos segundos; medir latência real em testes.
- Reconexão mostra snapshot e distingue dados desatualizados.
- O planeamento com IA devolve uma proposta editável e uma rota validada.

## Fora de âmbito
Pagamentos, subscrições, social feed, chat, integração com serviços de emergência/112, navegação curva-a-curva, GPS/voz garantidos com ecrã bloqueado, telemetria da mota, histórico GPS de alta resolução e apps nativas.

## Experiência de mapa e navegação aprovada
O utilizador planeia e acompanha a viagem no mapa interno MapLibre, alimentado por MapTiler e openrouteservice. Durante uma viagem pode optar por abrir Google Maps ou Waze para navegação turn-by-turn externa. Esta ação **não mantém a partilha GPS da PWA garantida**: os outros motards devem ver a última localização recebida, timestamp e estado stale/offline. A PoC não fornece navegação turn-by-turn própria nem tracking contínuo em background. A experiência deve funcionar em iOS e Android.


## Extensão obrigatória pedida em 2026-10-24

O organizador comunica por voz com os participantes aceites de uma viagem ativa.
Os restantes só falam ao acionar SOS, com prioridade sobre o organizador. O SOS
visual não exige microfone nem adesão ao áudio. Exige rede e só chega a quem está
ligado à viagem. Um SOS de cada vez, até resolver ou expirar em 90 segundos;
a prioridade é do primeiro alerta ativo. O organizador retoma explicitamente a
fala após resolução, sem ligar microfones automaticamente.

Pertencer a um grupo motard é opcional: cada conta pode não ter grupo ou
pertencer a no máximo um. Qualquer conta sem inscrição/pedido pendente pode
criar o seu próprio grupo e tornar-se o primeiro dirigente. Entradas exigem aprovação de
um dirigente. Pode haver vários dirigentes com os mesmos poderes: aprovar,
recusar, promover/despromover, remover membros e editar sede/dados. Impedir saída
ou despromoção do último dirigente pela app. Grupos podem declarar denominação
legal e registo/NIPC, sem certificação automática pela plataforma. Todas as contas
autenticadas consultam o diretório e o mapa de sedes publicáveis. A inscrição
num grupo não concede acesso a viagens privadas nem cargos de organizador.


## Extensão local — convites e Perfil (2026-10-24)

A pertença permanece opcional. Dirigentes convidam diretamente; membros propõem convites que só são entregues após revisão de um dirigente. Aceitar convite aprovado dá entrada imediata, sem nova candidatura.

Detalhes e estado: [Convites de grupo e Perfil](25-GROUP-INVITATIONS-AND-PROFILE.md).
