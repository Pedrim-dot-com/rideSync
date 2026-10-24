# Instalar a app e entrar com Face ID / biometria

## Instalação no painel principal

O banner aparece no painel de Viagens em telemóveis, fora do modo instalado.
É montado antes do login para capturar o evento Chrome `beforeinstallprompt` e
apresentá-lo depois de entrar. Não obriga a instalar para usar a aplicação.

- iPhone/iPad: Safari → Partilhar → Adicionar ao ecrã principal → Adicionar.
  Se necessário, abrir Mais para encontrar a opção. Navegadores embebidos devem
  abrir o site no Safari primeiro.
- Android: botão nativo Instalar app quando o navegador o disponibilizar;
  alternativa pelo menu Chrome → Instalar aplicação/Adicionar ao ecrã principal.
- O banner desaparece em `display-mode: standalone`, `navigator.standalone`
  ou após `appinstalled`. Aceitar um prompt não é tratado como prova de instalação.
- Pode ser dispensado durante sete dias. Só esse timestamp não sensível vai para
  localStorage; funciona em memória se o browser bloquear armazenamento.

## Passkeys nativas Supabase Auth

Primeiro, entrar com email/password e abrir Perfil → Ativar chave de acesso.
O browser pede Face ID, impressão digital ou código do dispositivo, conforme o
hardware/configuração. Nas entradas seguintes, escolher Entrar com passkey.
Não se garante Face ID em todos os equipamentos nem se força um sensor específico.

A implementação usa `auth.registerPasskey`, `auth.signInWithPasskey` e
`auth.passkey.list/delete` do SDK instalado. O fluxo inclui challenge do Auth,
cerimónia WebAuthn no dispositivo e verificação no servidor. Só uma sessão Auth
verificada concede acesso; nenhum resultado local de biometria cria sessão.

Biometria, PIN e chaves privadas não são recolhidos pelo RideSync. Não se guardam
passwords para simular login biométrico, nem tokens de serviço no frontend.
Supabase gere as credenciais públicas e desafios no serviço Auth. Sessão/RLS
continuam com a identidade do utilizador autenticado, sem alterar policies.

A UI permite listar/remover chaves com confirmação; email/password e recuperação
por email mantêm-se. Cancelamento/erros são recuperáveis e não expõem mensagens
internas do serviço. O pedido é abortado ao desmontar o ecrã e impede operações
concorrentes. Browsers sem WebAuthn/HTTPS têm alternativa de email/password.
Em dispositivos compatíveis, o sistema pode permitir chaves sincronizadas.

## Ativação remota autorizada

O SDK 2.118.0 já inclui a API nativa. Leitura da configuração real confirmou:
inicialmente `passkey_enabled=false`, com RP ID/display name/origins nulos. Auth health
reporta GoTrue v2.197.0. Os endpoints nativos foram confirmados no código oficial
da mesma versão:
https://raw.githubusercontent.com/supabase/auth/v2.197.0/internal/api/api.go
(`/passkeys` usa middleware `requirePasskeyEnabled`, registo exige autenticação).
Um pedido ao endpoint de authentication/options devolveu 404 com a opção desligada,
sem criar sessão. A Management OpenAPI confirma os quatro campos editáveis.

A configuração foi ativada com autorização explícita em 2026-10-24, alterando
apenas os quatro campos abaixo por PATCH em
`/v1/projects/isyhpoyihcbkujtjadzc/config/auth`. GET após a alteração confirmou
os valores; nenhuma outra definição Auth mudou:

```json
{
  "passkey_enabled": true,
  "webauthn_rp_display_name": "RideSync",
  "webauthn_rp_id": "ridesync-8z1.pages.dev",
  "webauthn_rp_origins": "https://ridesync-8z1.pages.dev"
}
```

A lista de origins é string na API de gestão. Não utilizar `pages.dev` como RP ID,
wildcards, URLs de preview ou substituir as restantes definições Auth. Não alterar
email/password, confirmação de email ou recuperação de conta. Não são necessárias
migrations, Edge Functions, novos fornecedores ou novos segredos.

Passaram 10 verificações com Auth real e autenticador virtual na origem de
produção: sessão por password, registo WebAuthn vinculado ao domínio, listagem,
logout, assinatura inválida recusada sem sessão, login por passkey, revogação,
lista vazia e password de recuperação funcional. A conta temporária, chaves,
sessões e perfil foram removidos; limpeza de utilizador/perfil confirmada.
O frontend é enviado para main depois desta validação, com confirmação de
assets/worker publicados. Preservar TLS e não imprimir tokens/credenciais.
Para mudar o domínio da aplicação será necessário rever o RP ID das passkeys.

## Validação

99 testes unitários e cinco E2E passaram. Cobertura nova: instruções iOS,
standalone, dismiss/storage bloqueado, prompt Android capturado antes do login,
registro/remoção/cancelamento/erros de passkey e ausência de sessão quando o
servidor rejeita uma prova. E2E usa cerimónias reais do Chromium com autenticador
virtual CTAP2 interno e verificação de utilizador; transporte Auth é simulado.
Gera atestação e assinatura, verifica challenge/origin e testa login rejeitado,
login aceite e remoção com confirmação. Usa localhost como RP de desenvolvimento,
com verificação nativa do domínio, sem desativar segurança do browser.

Adicionalmente, o smoke real usou assets locais na origem de produção e
encaminhou pedidos HTTPS Auth por curl com TLS verificado, mantendo a origem e
a cerimónia nativa do browser. Não foi desativada a verificação TLS nem exportada
qualquer chave privada. Isto valida a integração Auth real, mas não a distribuição
do frontend, instalação iOS ou Face ID num iPhone físico. Validar Safari/PWA
instalada e Android depois da publicação.

## Publicação confirmada — 2026-10-24

Push de implementação/ativação concluído (`b9a5776` e `1ef2a66`). Verificação
HTTPS de https://ridesync-8z1.pages.dev confirmou HTML 200, JavaScript
`/assets/index-YuYxFh-k.js` com o banner e a gestão de passkeys, CSS
`/assets/index-SXgjaUjH.css` e service worker que precacheia esse mesmo JS.
A configuração remota e a distribuição estão ativas; registar a primeira chave
no iPhone continua a ser uma ação explícita do utilizador no Perfil.

## Registo — confirmação clara do email

A resposta de registo sem sessão apresenta agora um ecrã próprio «Confirma o teu
email», com o endereço introduzido, instruções para procurar a mensagem e o link
na caixa de entrada/spam, e botão «Já confirmei o email. Entrar». É possível
corrigir o endereço ou recuperar uma conta existente. Não sugere aprovação
manual, não garante envio quando o serviço mascara contas já existentes e não
contorna a verificação do servidor. Uma resposta com sessão não apresenta esta
etapa. O convite pendente mantém-se durante este fluxo.

Quando o servidor devolve `email_not_confirmed` no login, a mensagem volta a
indicar como confirmar o email, em vez do erro genérico. Recuperação por email
mantém a resposta neutra para não revelar contas existentes. Alteração apenas no
frontend, testada com Auth simulado. Publicação autorizada e confirmada em
2026-10-24 após push do commit 79d988f: bundle e precache públicos incluem o
ecrã de confirmação e as ações de entrada/correção do email.
