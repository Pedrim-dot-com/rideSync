# 07 — UX, navegação e ecrãs

O [fluxograma dos principais percursos no README](../README.md#fluxos-principais-da-aplicação) resume estes fluxos e distingue as funcionalidades em revisão.

## Princípios
Mobile-first, interface legível sob luz solar, contraste elevado, alvos táteis adequados, operações críticas acessíveis em poucas interações. Não incentivar interação durante a condução; planeamento e edição são para quando estiver parado.

## Navegação
Viagens / Garagem / Notificações / Grupos / Perfil. Navegação inferior em mobile e Sair no cabeçalho. Viagem mantém mapa e controlos, incluindo voz/SOS. IA continua planeada, sem separador funcional publicado.

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


## Grupos, direção e voz/SOS

Grupos tem Lista/Mapa das sedes, pesquisa e detalhe. Inscrição mostra estados
sem grupo (situação válida e opcional), pedido pendente, aceite e dirigente.
Qualquer pessoa sem grupo/pedido pendente pode criar um e ser o primeiro dirigente. Vários dirigentes gerem o mesmo
grupo; indicar que não é possível sair ou remover o último. Dados legais são
opcionais e declarados; nenhuma marca de certificação. Sede tem aviso de
visibilidade antes da gravação.

Viagem ativa tem painel Voz e SOS. Ouvir não pede microfone. Falar é exclusivo
do organizador, exceto SOS do participante. Motivo e grande botão SOS vermelho
com texto/ícone; alerta tem nome e motivo, sem depender só de cor. Manter alerta
se microfone falhar. Indicar limite foreground e comando Ativar som no Safari.
Não reativar microfone depois de SOS, background ou perda de ligação.

Em mobile há um atalho SOS fixo acima da navegação durante a viagem ativa,
para não obrigar a percorrer mapa/controlos até ao painel de voz. Com alerta
ativo o atalho abre o painel; sem alerta envia SOS com o motivo selecionado.

A presença destes separadores/controlos na PWA não confirma backend instalado.
O estado remoto e os passos de teste estão em docs/23-FEATURE-TEST-GUIDE.md.
