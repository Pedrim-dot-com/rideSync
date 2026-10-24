# Reformulação visual RideSync

## Direção

Pedido: reduzir confusão e reformular as cores, com inspiração na KTM
(https://www.ktm.com/en-pt.html). A referência direta foi tentada, mas a rede
cloud devolveu CONNECT 403. A implementação usa a direção visual da marca
como inspiração; não afirma reproduzir a página atual nem reutiliza logótipos,
fotografias, código ou fontes proprietárias da KTM.

- Laranja #ff6b00, preto #121212, superfícies brancas e fundo #f3f2ef.
- Títulos em Barlow Condensed 800, caixas direitas, contraste e hierarquia forte.
- Corpo e labels em fonte de sistema. Inputs continuam com 16 px e sem autofocus.
- Grafismo de estrada/contornos original em terrain.svg, decorativo. Não é uma
  geometria GPS, um percurso guardado ou uma representação de viagens reais.
- Ícones da PWA e theme-color/manifesto acompanham a nova identidade.

## Organização

Viagens é a entrada após login. Filtros Todas/Em curso/Planeadas/Histórico usam
os estados reais; não existem números, distâncias ou viagens demonstrativas no
produto. Sair passa para o cabeçalho, fora da navegação principal. Em mobile,
Viagens/Garagem/Perfil ficam numa barra inferior com safe area.

No detalhe: resumo do percurso, mapa e controlo da viagem em destaque. Em
desktop, mapa e cronómetro/ações ficam lado a lado. Itinerário compacto; grupo e
convites e gestão ficam em disclosures nativas, para reduzir ruído. Abrir ou
fechar disclosures não desmonta o controlador de GPS ou o mapa.

Mantêm-se consentimento antes de GPS, estados/loading/erros, confirmação ao
terminar/remover, ownership e ações de organizador. Informação de privacidade
mais longa fica em GPS e privacidade, com a regra de participantes/foreground
visível antes do opt-in.

Na revisão visual foi corrigida uma falha dos marcadores GPS: substituir todo
o className removia a classe de posicionamento do MapLibre. Agora acrescentam-se
classes de estado sem remover as internas. O E2E confirma o marcador dentro dos
limites do mapa, além de preservar o canvas durante updates.

## Recursos e acessibilidade

Barlow Condensed obtida do pacote oficial @fontsource/barlow-condensed 5.3.0,
woff2 Latin 800 e licença SIL OFL incluídas em public/fonts. Sem CDN de fontes,
novos trackers ou dependências de aplicação. Woff2 incluído na precache PWA.
Grafismo original e ícones locais; sem pedidos ao site KTM durante uso da app.

Focus visível, link saltar para conteúdo, aria-current na navegação, aria-pressed
nos filtros, alvos touch >=44px nos controlos de aplicação, zoom manual mantido
e preferência reduced-motion respeitada. A cor não substitui texto de estado.
Safari iOS/dispositivos físicos continuam a exigir validação manual.

## Verificação e publicação

83 testes unitários, 4 E2E (transporte Supabase/GPS simulados, MapLibre/WebGL real),
tipagem, lint, formatação e build passaram. O E2E de tracking foi repetido depois
da correção do marcador, com verificação de filtro, foco/16px, posições e canvas.
SQL e políticas remotas não foram alterados; não há migrations nem segredos novos.

Prévia gerada com dados de teste explicitamente simulados, fora do bundle:
/workspace/ridesync-ui-preview (login/dashboard desktop e dashboard/GPS mobile).
Publicação autorizada pelo utilizador e push para main concluído em 2026-10-24
(commit de UI `453c62b`). Confirmados em https://ridesync-8z1.pages.dev:
HTML HTTP 200, JS `/assets/index-BjMBwqQy.js`, CSS `/assets/index-B7GyhKP5.css`,
laranja/preto e Barlow Condensed servidos. Manifesto com theme-color #121212 e
woff2 local HTTP 200; service worker precacheia o JS atual e a fonte.

Na instalação existente, aceitar Atualizar quando surgir o aviso. Em iOS,
se necessário guardar edições, fechar completamente a PWA e voltar a abrir
com internet. A confirmação de assets publicados não prova que o telemóvel
já aplicou a atualização; não começar por desinstalar ou apagar dados.
