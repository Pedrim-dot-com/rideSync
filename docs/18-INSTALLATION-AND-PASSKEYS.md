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

## Estado remoto e ativação pendente

O SDK 2.118.0 já inclui a API nativa. Leitura da configuração real confirmou:
`passkey_enabled=false`; RP ID, display name e origins ainda nulos. Auth health
reporta GoTrue v2.197.0. Os endpoints nativos foram confirmados no código oficial
da mesma versão:
https://raw.githubusercontent.com/supabase/auth/v2.197.0/internal/api/api.go
(`/passkeys` usa middleware `requirePasskeyEnabled`, registo exige autenticação).
Um pedido ao endpoint de authentication/options devolveu 404 com a opção desligada,
sem criar sessão. A Management OpenAPI confirma os quatro campos editáveis.

**Não se ativou a configuração remota nem se publicou o frontend nesta fase.**
Após autorização explícita de ativação/publicação, atualizar apenas estes campos
por PATCH em `/v1/projects/isyhpoyihcbkujtjadzc/config/auth`:

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

Depois da ativação, confirmar configuração e challenge/RP/origin, fazer registo,
login, rejeição de prova inválida e revogação contra Auth real com uma conta
estritamente temporária e autenticador virtual, com limpeza. Preservar TLS e não
imprimir tokens/credenciais. Só então push main, confirmar Pages e service worker.
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

Isto não prova Face ID num iPhone físico nem valida endpoints remotos ainda
desativados. Testar depois em Safari/PWA instalada, Android, cancelamento do
pedido nativo, recuperação por email e remoção da última chave.
