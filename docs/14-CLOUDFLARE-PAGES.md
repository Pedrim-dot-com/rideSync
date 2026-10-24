# Publicar e abrir a PWA na Cloudflare Pages

A PWA precisa de HTTPS para instalação e geolocalização em telemóveis.
O ambiente cloud do Codex não fornece um preview público. O push para o GitHub
não cria, por si só, um site publicado.

Endereço indicado pelo utilizador: **https://ridesync-8z1.pages.dev**.
O Site URL e os redirects desse domínio foram configurados no Supabase;
a sessão Auth real foi validada por API, mas browser e entrega de emails ainda
requerem validação.

## Primeira publicação pelo GitHub

1. Em Cloudflare Dashboard → Workers & Pages → Create application → Pages,
   escolher a importação de um repositório Git. Autorizar a app Cloudflare no
   GitHub para `Pedrim-dot-com/rideSync`.
2. Selecionar o repositório e a branch de produção `main`.
3. Framework preset: **Vite**. Build command: **`npm run build`**.
   Build output directory: **`dist`**. Root directory: raiz do repositório.
   Node: **24** (também fixado em `.node-version`).
4. Nas variáveis de build de Production, definir:

   | Nome | Valor |
   | --- | --- |
   | `VITE_SUPABASE_URL` | Project URL do projeto Supabase |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key pública do projeto |
   | `VITE_MAPTILER_API_KEY` | Chave pública de browser do MapTiler |
   | `VITE_MAP_STYLE_URL` | `https://api.maptiler.com/maps/streets-v2/style.json` |

   Variáveis `VITE_*` são públicas no bundle. **Não configurar service_role,
   tokens de gestão ou `ROUTING_API_KEY` na Cloudflare.** O `.env` local não é
   enviado ao GitHub e não fornece as variáveis à Cloudflare.
5. Guardar e executar Deploy. Abrir o endereço HTTPS efetivamente apresentado
   pela Cloudflare (`<nome-do-projeto>.pages.dev`). Não adivinhar o endereço.
   Configurar as variáveis de Preview separadamente se se pretender testar branches.
6. Cada push seguinte a `main` inicia um novo build, depois de a integração estar ligada.
   Após alterar variáveis de build, fazer novo deploy para as incluir no bundle.

Os headers de cache e segurança estão em `public/_headers`. Não existe uma
página 404 na raiz: Cloudflare Pages aplica o fallback SPA padrão. O service
worker guarda apenas a shell estática; não há cache offline de dados privados,
tokens ou respostas Supabase.

## Ligar Auth e mapas ao endereço publicado

No Supabase → Authentication → URL Configuration:

- Definir Site URL com o endereço HTTPS publicado.
- Adicionar esse endereço à lista de Redirect URLs permitidos.
- Preservar quaisquer URLs de desenvolvimento que ainda sejam necessários.
- Validar confirmação de email e recuperação de password no site publicado.

No MapTiler, restringir a chave pública ao domínio publicado conforme as opções
do plano e os padrões suportados no painel. Rever atribuição, termos e quotas.
Não configurar wildcard de todos os sites sem necessidade.

A migration 003 e as Edge Functions de mapas foram publicadas com autorização
em 2026-10-23. Pesquisa, cálculo e persistência passaram testes remotos com
sessão real. A configuração em Supabase → Edge Functions → Secrets é:

- `ROUTING_API_KEY`: chave privada openrouteservice, usada também em geocoding.
- `APP_ORIGINS`: origens HTTPS autorizadas, separadas por vírgulas, incluindo o
  endereço efetivo da PWA. Usar apenas origens, sem paths ou barras finais.

O segredo proxy do ambiente Codex não configura automaticamente os segredos
remotos das Edge Functions. A aplicação continua com itinerários manuais se o
serviço de geocoding/routing não estiver disponível. Publicar funções e aplicar
novas migrations requer autorização explícita.

## Instalar no telemóvel

- **iPhone/iPad:** abrir o site publicado no Safari → Partilhar → Adicionar ao ecrã principal.
- **Android:** abrir o site no Chrome → menu → Instalar aplicação/Adicionar ao ecrã principal.

A instalação real e GPS foreground ainda devem ser testados nesses dispositivos.
Instalar a PWA não garante tracking com outra app aberta ou ecrã bloqueado.

## Validar a publicação

Confirmar no site: login/registo, confirmação por email, perfil/garagem,
criação/edição de viagem, mapa/atribuição e erros recuperáveis. Confirmar no
separador Network que não há chaves privadas no frontend e que as chamadas de
routing vão para Edge Functions, não diretamente para openrouteservice.
A API Supabase e as Edge Functions são separadas do site estático Pages.


## Receber atualizações na PWA instalada

Depois de um push, confirmar primeiro que o build Pages terminou e serve o
novo bundle. A PWA instalada pode continuar na versão anterior até aceitar o
aviso **Há uma nova versão do RideSync → Atualizar**. Guardar edições primeiro.

A versão com GPS verifica atualizações ao voltar ao primeiro plano e a cada
minuto enquanto visível. Para versões anteriores, fechar completamente a PWA
no seletor de aplicações iOS e abrir de novo com rede para iniciar a verificação.
Não é necessário desinstalar ou apagar os dados como primeiro passo.
