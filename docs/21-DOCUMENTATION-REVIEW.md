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
