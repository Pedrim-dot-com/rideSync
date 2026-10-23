# 07 — UX, navegação e ecrãs

## Princípios
Mobile-first, interface legível sob luz solar, contraste elevado, alvos táteis adequados, operações críticas acessíveis em poucas interações. Não incentivar interação durante a condução; planeamento e edição são para quando estiver parado.

## Navegação
Home / Trips / Garage / Profile. A vista Live Trip substitui temporariamente a navegação principal por mapa e controlos mínimos. IA integrada em Create Trip, não precisa de separador próprio.

## Ecrãs
1. Login/registo; recuperação de acesso.
2. Home: próximas viagens, viagens ativas e CTA criar.
3. Perfil: dados do motard e garagem.
4. Garagem: lista de motas, principal, criar/editar e foto opcional.
5. Criar viagem: título/data, origem/destino, waypoints, cálculo da rota, mapa.
6. Detalhe da viagem: percurso, distância, ETA, participantes e convite.
7. Aceitar convite: detalhes, aceite/recusa e seleção da própria mota.
8. Live Trip: mapa, participantes, status, iniciar/parar partilha e terminar sessão (organizador).
9. AI Planner: prompt, campos interpretados, edição e confirmação.
10. Histórico: viagens concluídas e resumo básico.

## Estados obrigatórios
Loading, vazio, sem rede, GPS negado, localização imprecisa, localização antiga, convite expirado, sem rota disponível, LLM indisponível, permissão negada e erro genérico.

## Regras UX de tracking
- Mostrar consentimento claro antes de pedir permissão ao browser.
- Mostrar indicador persistente quando partilha ativa.
- Mostrar `última atualização há X s` por motard; diferenciar online de localização atual.
- Botão parar partilha sempre acessível.
- Avisar sobre limitações de GPS em background na PWA.

## Acessibilidade
Teclado, labels, foco visível, texto escalável, contraste WCAG AA, não depender apenas de cores para estado. Testar Safari iOS e Chrome Android.

## Ecrã de viagem — mapa e navegação
- Mapa interno MapLibre com rota, waypoints, participantes e atribuição MapTiler/OpenStreetMap conforme licença.
- CTA principal: `Ver grupo no mapa`; ação secundária: `Abrir navegação` com opções Google Maps e Waze.
- Antes de sair da PWA, aviso curto: **"Ao abrir outra aplicação, a tua localização pode deixar de ser partilhada com o grupo."**
- Se regressar à PWA, pedir/validar permissões, retomar tracking apenas com consentimento e atualizar timestamps.
- Mostrar última atualização GPS e estados `live`, `stale`, `offline` por participante.
- Testar notch/Dynamic Island, safe areas, orientação, gestos touch, Safari iOS e Chrome Android.
