# 09 — Estratégia de testes e aceitação

## Pirâmide de testes
- Unit: validação de inputs, transformações de coordenadas, normalização de routing, estado de viagem, stale detection.
- Integration: Supabase queries/RPC, Edge Functions, políticas RLS com diferentes utilizadores.
- E2E (Playwright): login, garagem, criar viagem, convite, selecionar mota, iniciar sessão, parar partilha.
- Manual em dispositivos reais: permissões GPS, background/foreground, bloqueio de ecrã, rede instável, Safari iOS e Chrome Android.

## Cenários obrigatórios
| ID | Cenário | Resultado esperado |
|---|---|---|
| T-01 | User A edita mota de B | Negado por RLS |
| T-02 | A escolhe mota de B numa viagem | Negado no servidor |
| T-03 | Duas motas principais simultâneas | Impossível por constraint/transação |
| T-04 | Outsider consulta viagem privada | Negado |
| T-05 | Convite expirado | Rejeitado sem membership |
| T-06 | Participante recusa GPS | Continua na viagem sem publicar localização |
| T-07 | Participante para GPS | Sem novos updates; posição deixa de ser live |
| T-08 | Mensagem de GPS fora de ordem | Ignorada |
| T-09 | Ligação cai 60 s | Marcador aparece stale/offline |
| T-10 | Reconexão | Snapshot + updates sem regressão temporal |
| T-11 | LLM devolve JSON inválido | Erro tratado, manual disponível |
| T-12 | Routing indisponível | Sem percurso inventado |
| T-13 | Membro tenta terminar viagem | Negado |
| T-14 | PWA em segundo plano | UI explica limitação; sem promessa de tracking contínuo |

## Demonstração de aceitação
Três contas, três motas, uma viagem com 2+ waypoints, convite e aceitação, seleção de mota, visualização simultânea de posições, interrupção/reconexão, stop de partilha, encerramento e proposta de rota por IA.

## Critérios de qualidade
Typecheck, lint, testes automatizados e verificações RLS a passar; nenhuma chave privada no frontend; fluxos críticos demonstrados em dispositivos reais; erros e limitações documentados. Toda a documentação e o README devem ser revistos em cada alteração, com os documentos afetados atualizados e os estados local/publicado/validado coerentes. Validar links locais e IDs documentais.

## Testes adicionais — mapa e navegação
| ID | Cenário | Resultado esperado |
|---|---|---|
| MAP-T01 | Safari iOS e Chrome Android | Mapa renderiza, rota visível, controlos touch e safe areas corretos |
| MAP-T02 | Routing/geocoding indisponível | Erro recuperável; sem rota ou ETA inventados |
| MAP-T03 | Abrir Google Maps | Abre destino por link; aviso de possível suspensão GPS antes de sair |
| MAP-T04 | Abrir Waze | Abre destino por link/fallback; sem garantia de waypoints |
| MAP-T05 | PWA suspensa/background | Outros veem posição antiga com timestamp; nunca posição falsa em tempo real |
| MAP-T06 | Regressar à PWA | Reconnect e snapshot, atualização com consentimento, sem duplicações |
| MAP-T07 | Chaves de API | Segredos routing/LLM ausentes do bundle; MapTiler público com restrições quando disponíveis |
| MAP-T08 | Atribuição e quotas | Créditos cartográficos visíveis; limites externos documentados |


IDs duplicados resolvidos: T-13/T-14 da tabela principal mantêm significado;
a tabela de mapas usa MAP-T01…08. Histórico conserva nomes antigos nas execuções
datadas. Novos cenários:

| ID | Cenário | Resultado esperado |
|---|---|---|
| GRP-T01 | Membro pede entrada e tenta aprovar-se | Pedido criado; autoaprovação negada |
| GRP-T02 | Dois dirigentes saem simultaneamente | Só um sai; permanece pelo menos um |
| GRP-T03 | Inscrição aceite noutro grupo | Rejeitada no servidor/índice único |
| GRP-T04 | Outsider lê pedidos ou perfil bruto | Negado; diretório mostra só sede/dados publicados |
| GRP-T05 | Sede sem coordenadas ou NaN | Rejeitada; não converter vazio para zero |
| VOZ-T01 | Participante normal pede publish | JWT de ouvinte; falar normal negado |
| VOZ-T02 | SOS durante fala do organizador | Interrupção, nova época e prioridade ao emissor do SOS |
| VOZ-T03 | Reutilizar JWT de fala antiga | Não autoriza a sala atual da audiência |
| VOZ-T04 | Provider falha/operação atrasada | Época trocada, sem publicação indevida |
| VOZ-T05 | Microfone negado ou permissão termina depois de sair | SOS visual permanece; track tardio parado |
| VOZ-T06 | Rede/background/viagem termina | Media local parada; retoma explícita |
| VOZ-T07 | Mensagem/papel forjado no Broadcast | Só invalida; snapshot autorizado determina subscrição |
| VOZ-T08 | Três dispositivos e headset reais | Medir áudio/latência; ainda pendente |

Executar npm run test:db:local, npm test, npm run test:e2e e check:edge. Testes
simulados não substituem a validação LiveKit real nem a aceitação em hardware.


## Convites e Perfil — evolução da entrega (2026-10-24)

**Estado após autorização:** A migration 010 foi aplicada com autorização no rideSync-app. Tipos remotos regenerados e 34 checks HTTPS reais aprovados, com contas/grupos temporários removidos e limpeza verificada. Publicação frontend em curso; confirmação do bundle será registada abaixo.

Registo da fase local anterior:

Extensão 010: 137 unitários e 371 checks PostgreSQL locais; 55 checks novos cobrem propostas, autorização exclusiva da direção, invisibilidade antes da aprovação, convites diretos, consentimento, revogação, expiração e concorrência. O novo E2E simula proposta→revisão→aceitação→Perfil mobile; validação HTTPS da 010 ainda pendente.

Detalhes e estado: [Convites de grupo e Perfil](25-GROUP-INVITATIONS-AND-PROFILE.md).


| ID | Cenário da extensão local 010 | Resultado esperado |
|---|---|---|
| GRP-T06 | Membro propõe convite | Só direção vê controlos de revisão; destinatário não recebe antes da aprovação |
| GRP-T07 | Direção convida ou aprova proposta | Entrega convite; aceitar cria inscrição aceite imediatamente, sem nova candidatura |
| GRP-T08 | Revogação, recusa, expiração e aceitação concorrente | Sem entrada indevida nem dois grupos; RLS e destinatário validados no servidor |
| GRP-T09 | Consultar Perfil e voltar a abrir Notificações | Grupo/papel ou candidatura distinguíveis; convites entregues persistem |
