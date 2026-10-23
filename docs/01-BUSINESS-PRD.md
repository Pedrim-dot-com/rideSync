# 01 — Definição de negócio (PRD)

## Problema
Organizar passeios de mota exige coordenar percurso, horários, participantes e localização. Links de mapas e mensagens dispersas não dão uma visão única da viagem e do progresso do grupo.

## Proposta de valor
Uma PWA mobile-first que permite criar uma viagem, visualizar o percurso, convidar motards, escolher a mota utilizada e acompanhar o grupo num mapa em tempo real enquanto a aplicação está ativa. Um assistente de IA ajuda a preparar o itinerário.

## Público-alvo
Motards individuais e pequenos grupos de amigos. Motoclubes e eventos públicos ficam fora da PoC.

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
Pagamentos, subscrições, social feed, chat, alertas de emergência, navegação curva-a-curva, localização garantida com ecrã bloqueado, telemetria da mota, motoclubes públicos, histórico GPS de alta resolução, apps nativas.

## Experiência de mapa e navegação aprovada
O utilizador planeia e acompanha a viagem no mapa interno MapLibre, alimentado por MapTiler e openrouteservice. Durante uma viagem pode optar por abrir Google Maps ou Waze para navegação turn-by-turn externa. Esta ação **não mantém a partilha GPS da PWA garantida**: os outros motards devem ver a última localização recebida, timestamp e estado stale/offline. A PoC não fornece navegação turn-by-turn própria nem tracking contínuo em background. A experiência deve funcionar em iOS e Android.
