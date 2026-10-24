# 21 — Revisão documental de 2026-10-24

## Inconsistências corrigidas

| Fonte | Problema | Correção |
|---|---|---|
| README/PRD | SOS e motoclubes excluídos | Âmbito atualizado pelo pedido explícito do utilizador; serviços de emergência continuam excluídos |
| Requisitos 02 | FR-021…024 repetidos em mapas | Secção mapas passa a MAP-001…006; tabela principal preservada |
| Testes 09 | T-13/T-14 repetidos | Secção mapas passa a MAP-T01…08 |
| Arquitetura 03/API 05 | Coordenadas de Broadcast/Presence e contratos propostos | Estado real: invalidações da BD e snapshots; nomes reais de RPCs |
| Modelo 04 | accepted_by/speed_mps e timestamps antigos | used_by/heading/received_at conforme migrations; sede fixa distingue-se de GPS pessoal |
| UX 07 | Home e substituição da navegação na viagem | Navegação atual e novos separadores Grupos/Notificações; voz/SOS na viagem |
| Plano 08 | E2E ainda todo pendente e start/stop “futuro” | Automação assinalada; testes físicos continuam pendentes |
| Estado geral | Implementado confundido com publicado | 001–006 publicados; 007/008 locais; LiveKit nomes de segredos presentes, valores/provider ainda não verificados |

A revisão preserva recibos/contagens das execuções históricas em docs/13…18;
não apresenta essas contagens datadas como o total atual nem reescreve migrations
já publicadas. Instruções gerais não substituem contratos SQL versionados e
procedimentos mais recentes registados nas ADRs.

## Novos critérios e pendências

- docs/19-MOTARD-GROUPS.md: diretório, sede, um grupo, aprovação e vários dirigentes.
- docs/20-VOICE-AND-SOS.md: floor de áudio, prioridade, permissões, configuração,
  custo, lifecycle, limites e roteiro de testes físicos.
- Mudanças remotas só após autorização; então regenerar snapshot de tipos,
  validar com contas temporárias e atualizar estado de publicação.
- IA e fotos continuam por implementar. Grupos não implicam verificação jurídica.
- Voz/SOS não implica contacto com 112, entrega sem rede ou intercomunicador
  contínuo com ecrã bloqueado. A prova de áudio/latência em três aparelhos reais
  continua necessária, assim como revisão do plano e limpeza de salas órfãs.

## Evidência local desta entrega

- 126 testes unitários aprovados, incluindo permissões/cancelamento de áudio.
- 316 checks PostgreSQL aprovados: 32 novos de grupos e 46 de voz/SOS.
- Seis E2E com transporte simulado aprovados; incluem direção plural e SOS com
  microfone negado. Não equivalem a uma chamada WebRTC real entre telemóveis.
- Typecheck, lint sem avisos, formatação, build/PWA e Deno check das três Edge
  Functions aprovados. Código LiveKit é carregado de forma lazy.
- 41 IDs únicos na tabela de requisitos e 35 na de testes; nenhum link Markdown
  local quebrado em README/docs.
- Verificação do bundle não encontrou identificadores de segredos/serviço de
  voz de servidor. Nenhum valor privado foi obtido ou impresso na leitura de
  presença dos segredos Supabase.

Estes resultados correspondem à implementação local. Migrations 007/008,
provider/token real, publicação e teste de três dispositivos mantêm o estado
pendente descrito acima, até autorização/execução próprias.


## Regra permanente de manutenção

Instrução explícita do utilizador em 2026-10-24: atualizar sempre a documentação
e o README. Registada em CLAUDE.md, README e critérios de entrega/aceitação.
Cada alteração exige revisão do conjunto documental e atualização dos ficheiros
afetados, incluindo resultados após publicação e testes reais. Não alterar
recibos históricos nem apresentar implementação local como publicação concluída.
O índice do README passa a incluir todos os documentos de docs/01 a docs/21.
Esta atualização documental não altera a autorização pendente para 007/008/voz.


## Envio para revisão no GitHub

O utilizador pediu envio das alterações e abertura de PR. Branch de revisão:
`feat/motard-groups-voice-sos`, com base em `main`. Inclui grupos/voz/SOS,
revisão documental e a regra permanente de manutenção do README/documentação.
O envio da branch/PR não equivale a aplicar migrations 007/008, publicar a Edge
Function ou integrar em main. Esses passos mantêm a autorização e validação
próprias descritas em docs/19 e docs/20.


Envio confirmado para a branch remota. A API GitHub respondeu Forbidden tanto
na listagem de PRs como no POST de criação; por isso não foi criado um número
ou URL de PR. A descrição completa está em docs/22-PULL-REQUEST.md, incluída
no índice do README, para criação pelo formulário GitHub. Main mantém a versão
anterior e as migrations/Edge Function novas continuam pendentes de publicação.


## Fluxogramas no README

Acrescentados dois diagramas Mermaid: arquitetura (PWA, Cloudflare, Supabase,
cartografia/routing e integração de voz) e fluxos de acesso, perfil/garagem,
convites, viagens/GPS, SOS e grupos. Ligações tracejadas e nós identificados
assinalam grupos/voz ainda em revisão. IA e uploads continuam planeados;
interrupção por SOS não sugere retoma automática do microfone do organizador.
Docs/03 e docs/07 apontam para as vistas gerais no README. As alterações seguem
na mesma branch de revisão, sem aplicar migrations ou publicar funcionalidades.

Os dois diagramas foram validados pelo parser Mermaid 11.12 e renderizados em
Chromium sem erros. Links locais e âncoras do README foram verificados.


## Verificação remota após relato de dificuldades

Em 2026-10-24, a PWA pública serviu `/assets/index-DJftS0LK.js`, contendo grupos
e chamadas de voz. A consulta apenas de leitura devolveu NULL para as tabelas
motard_groups/group_memberships/trip_voice_state e para as RPCs save_motard_group/
trip_voice_snapshot. A lista de Edge Functions contém apenas search-places e
calculate-route. Conclusão: interface publicada, backend das duas features ausente.
O estado anterior “só local/por publicar” descrevia a entrega anterior; esta
verificação atualiza o estado operacional sem afirmar que a ativação terminou.

Reforçada a pertença opcional: zero ou um grupo; qualquer conta sem inscrição/
pedido pendente pode criar um. Não houve mudança desta regra no SQL: o limite
único já era máximo, não uma obrigação de inscrição. Criado docs/23 com roteiro
que separa pré-condições de publicação dos testes do utilizador. Nenhuma migration
ou função remota foi alterada por esta verificação.


## Ativação autorizada após o merge

O histórico Git confirmou merge do PR #3 em main. A autorização posterior para
terminar a tarefa permitiu aplicar 007/008, publicar trip-voice e corrigir o
conflito de edição por migration 009. Passaram 49 verificações HTTPS reais com
limpeza confirmada das fixtures. README, fluxogramas, plano, arquitetura e guias
foram atualizados para backend ativo, preservando os registos anteriores como
históricos. Recibos e limites da validação em docs/24; testes de áudio em aparelhos
reais mantêm-se distintos da validação do provider/roles por API.


Publicação confirmada após push de 6bcb36c: bundle público e service worker
correspondem à versão ativada. Verificações locais finais: 127 unitários,
316 checks PostgreSQL e seis E2E simulados aprovados; 49 checks HTTPS reais
com limpeza confirmada. O proxy recusou WebSocket LiveKit como Domain forbidden,
pelo que o áudio físico continua sujeito ao roteiro em aparelhos reais.


## Revisão — convites de grupo e Perfil (010 local)

Revistos README e todos os documentos 01–25. Atualizados PRD, requisitos,
arquitetura, dados/RLS, API, UX, plano, testes, decisões, operação, desenvolvimento,
grupos e roteiro. README inclui os três caminhos: candidatura espontânea,
convite de dirigente e proposta de membro com revisão antes da entrega.

A interpretação inicial de aceitação como candidatura foi corrigida antes de
qualquer aplicação remota. ADR-019 e docs/25 registam a regra final e distinguem
a extensão local da produção com 001–009. Restantes documentos e recibos
históricos de mapas, convites de viagem, tracking, instalação, voz e publicação
mantêm-se aplicáveis e foram preservados. Sem novas decisões de mapas/voz.

Validação final: typecheck, lint, formatação e build/PWA aprovados; 137 testes
unitários, 371 checks PostgreSQL (55 novos) e sete E2E com transporte simulado
aprovados. Novo E2E mobile com três contas confirma proposta invisível ao alvo,
aprovação exclusiva de dirigente, aceitação com entrada imediata e grupo/papel
no Perfil, sem overflow horizontal. Não demonstra Safari num iPhone físico nem
valida a 010 por HTTPS no Supabase real. Links Markdown locais e unicidade dos
IDs das tabelas de requisitos/testes verificados. Aplicação remota, regeneração
de tipos e publicação continuam pendentes de confirmação.
