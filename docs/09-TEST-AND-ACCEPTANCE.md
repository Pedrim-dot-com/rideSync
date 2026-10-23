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
Typecheck, lint, testes automatizados e verificações RLS a passar; nenhuma chave privada no frontend; fluxos críticos demonstrados em dispositivos reais; erros e limitações documentados.

## Testes adicionais — mapa e navegação
| ID | Cenário | Resultado esperado |
|---|---|---|
| T-13 | Safari iOS e Chrome Android | Mapa renderiza, rota visível, controlos touch e safe areas corretos |
| T-14 | Routing/geocoding indisponível | Erro recuperável; sem rota ou ETA inventados |
| T-15 | Abrir Google Maps | Abre destino por link; aviso de possível suspensão GPS antes de sair |
| T-16 | Abrir Waze | Abre destino por link/fallback; sem garantia de waypoints |
| T-17 | PWA suspensa/background | Outros veem posição antiga com timestamp; nunca posição falsa em tempo real |
| T-18 | Regressar à PWA | Reconnect e snapshot, atualização com consentimento, sem duplicações |
| T-19 | Chaves de API | Segredos routing/LLM ausentes do bundle; MapTiler público com restrições quando disponíveis |
| T-20 | Atribuição e quotas | Créditos cartográficos visíveis; limites externos documentados |
