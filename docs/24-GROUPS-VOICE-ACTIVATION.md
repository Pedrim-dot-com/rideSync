# 24 — Ativação remota de grupos e voz/SOS

O utilizador autorizou terminar a tarefa pendente. A execução aplicou apenas as
migrations novas em falta, publicou trip-voice e validou grupos/voz por HTTPS.
Projeto: rideSync-app (`isyhpoyihcbkujtjadzc`). Datas/horas dos recibos em UTC.

## Recibos SQL

| Migration | Verificação após aplicação UTC | SHA-256 |
|---|---|---|
| 202610240007_motard_groups.sql | 2026-10-24 15:01:24.856627+00 | `467febcf42ec3b79247ecb1aea18b736d338ca6691fb709f7c3c95573136c907` |
| 202610240008_trip_voice_sos.sql | 2026-10-24 15:01:26.324284+00 | `2362ed4ca411038cff7d05ef044424f5f74b5b52639b061eb9e5a4aa13e137e6` |
| 202610240009_group_edit_conflicts.sql | 2026-10-24 15:09:20.953009+00 | `71050437993bcdb0f37068fb098b0f775716dc7ec7c822d0d97c2fe02d98fa41` |

RLS confirmado nas tabelas novas. authenticated não executa a arbitragem interna,
não lê trip_voice_state nem a identidade de criador do diretório. service_role
executa begin/finish; a Edge obtém actor de getUser. Snapshot remoto regenerado.
Não editar ou reaplicar 007–009 neste projeto.

## Publicação da função

trip-voice: ACTIVE, versão 1, import map ativo, verify_jwt=false no gateway e
getUser obrigatório no handler. APP_ORIGINS existente valida a origem PWA;
origem estrangeira rejeitada nos testes. Nenhum segredo LiveKit foi obtido ou
impresso. Credenciais validadas por criação de salas e emissão real de tokens.

## Verificações reais

Passaram 49 checks HTTPS com quatro contas temporárias: pertença opcional,
criação de grupos, diretório e privacidade, pedidos/aprovação, vários dirigentes,
conflito de edição, último dirigente e grupo único. Rota real openrouteservice,
início de viagem, voz em viagem ativa, roles, JWTs restritos, SOS que bloqueia
organizador, emissor prioritário, resolução/retoma explícita, fim de viagem,
outsider/CORS negados. Contas, grupos, viagens e quotas temporárias removidos;
limpeza confirmada. Salas vazias usam os timeouts do fornecedor.

A primeira tentativa de conflito de revisão 40001 ficou sem resposta até timeout.
Migration 009 e cliente tratam PT409/GROUP_CHANGED; o teste real passou. A
correção não modifica dados existentes nem altera a migration 007 já aplicada.

## Limites de validação

Estes testes não comprovam audição de áudio em três telefones, latência real ou
headsets. O browser de testes não abre HTTPS público diretamente devido à CA do
ambiente (ERR_CERT_AUTHORITY_INVALID); a validação HTTPS usou curl com TLS
verificado, sem desativar certificados. Executar o roteiro de docs/23 nos
aparelhos antes de considerar a aceitação acústica concluída. A PWA continua
a exigir foreground e ação explícita para som/microfone.


A tentativa de sinalização WebSocket direta ao LiveKit recebeu HTTP 403 com
corpo “Domain forbidden” do proxy do ambiente. Não foi uma recusa de identidade
reportada pelo serviço de voz. Assim, o transporte WebRTC/áudio não foi validado
neste ambiente. A API de salas/tokens executada na Edge passou, e os dispositivos
dos utilizadores precisam de testar a ligação e som reais conforme docs/23.

Verificações locais da ativação: 127 unitários, 316 checks PostgreSQL e seis
E2E com transporte simulado aprovados;
tipagem, lint, formatação, build/PWA e check Deno das três funções aprovados.


## Confirmação da PWA pública

Push para main do commit `6bcb36c` concluído. A Cloudflare passou a servir
`/assets/index-Ddx2-HYw.js`, com GROUP_CHANGED/PT409 e os contratos de grupos/voz.
O service worker público precacheia o mesmo bundle. Verificação final do projeto
confirmou motard_groups/trip_voice_state presentes, conflito HTTP explícito e
trip-voice ACTIVE versão 1. Para receber a mensagem de conflito atualizada,
aplicar o aviso Atualizar na PWA. Não são necessárias novas chaves.
