# 02 — Requisitos funcionais e critérios de aceitação

Prioridades: **P0** obrigatório para PoC; **P1** se houver tempo; **P2** pós-PoC.

| ID | Prioridade | Requisito | Aceitação mínima |
|---|---|---|---|
| FR-001 | P0 | Registo/login/logout | Sessão autenticada e logout efetivo |
| FR-002 | P0 | Perfil do motard | Editar nome/nickname e consultar perfil próprio |
| FR-003 | P0 | Garagem CRUD | Adicionar, listar, editar e remover motas próprias |
| FR-004 | P0 | Mota principal | Só uma principal por utilizador; troca atómica |
| FR-005 | P0 | Dados da mota | Marca, modelo obrigatórios; ano, cilindrada, cor opcionais |
| FR-006 | P1 | Foto da mota | Upload privado/controlado; validação tipo e tamanho |
| FR-007 | P0 | Criar/editar viagem | Título, partida, origem/destino e estado |
| FR-008 | P0 | Waypoints | Adicionar, ordenar e remover paragens |
| FR-009 | P0 | Routing | Geometria real, distância e duração do fornecedor |
| FR-010 | P0 | Mapa da viagem | Desenhar percurso e marcadores de origem/destino |
| FR-011 | P0 | Convidar motards | Token expira e não concede acesso antes de aceitar |
| FR-012 | P0 | Participação | Aceitar/recusar convite; listar participantes |
| FR-013 | P0 | Mota na viagem | Escolher apenas uma mota própria ou nenhuma |
| FR-014 | P0 | Iniciar/terminar sessão | Só organizador; transições de estado válidas |
| FR-015 | P0 | Consentimento GPS | Opt-in individual; pode parar a qualquer momento |
| FR-016 | P0 | Localização live | Atualizar marcadores de participantes autorizados |
| FR-017 | P0 | Estado de localização | Timestamp, precisão e estado stale/offline |
| FR-018 | P0 | Reconexão | Recuperar snapshot permitido sem mostrar stale como live |
| FR-019 | P0 | AI Trip Planner | Prompt gera proposta estruturada e editável |
| FR-020 | P0 | Validação de rota IA | Geometria/distância só via routing, não pelo LLM |
| FR-021 | P0 | Histórico básico | Listar viagens e estatísticas agregadas disponíveis |
| FR-022 | P1 | Foto do perfil | Upload e exibição com políticas de acesso |
| FR-023 | P2 | GPX | Importar/exportar percursos |
| FR-024 | P2 | Consumo/autonomia | Dados opcionais da mota e sugestões de abastecimento |

## Regras detalhadas de aceitação
### FR-003/004 — Garagem
- Não se podem editar ou apagar motas de terceiros.
- A primeira mota pode ser definida como principal automaticamente, se confirmado na UI.
- Definir uma principal retira esse estado às restantes na mesma transação.
- Apagar uma mota associada a viagens preserva a viagem e limpa a associação, com aviso ao utilizador.

### FR-011/012 — Convites
- Link contém token aleatório de alta entropia; guardar hash no servidor, com expiração.
- Apenas utilizador autenticado pode aceitar; convite de uso único ou controlado por estado.
- Impedir duplicados e acesso por adivinhação de UUID.

### FR-015/018 — Tracking
- Permissão GPS negada mostra explicação e mantém o utilizador na viagem sem partilha.
- Ao parar, deixar de emitir eventos; remover/invalidar snapshot conforme política definida.
- Ao perder ligação, mostrar último update e estado stale após limiar configurável (ex.: 30 s).
- O browser não garante tracking em background; informar claramente.

### FR-019 — IA
- Falha do LLM não impede planeamento manual.
- Pedido gera campos estruturados validados e editáveis antes de calcular/guardar rota.
- Se routing não encontrar percurso, mostrar erro recuperável e não inventar percurso.

## Requisitos adicionais — mapas e plataformas
| ID | Prioridade | Requisito | Aceitação |
|---|---|---|---|
| MAP-001 | P0 | Renderizar mapa interno com MapLibre + MapTiler | Percurso e marcadores legíveis em Safari iOS e Chrome Android; atribuição visível |
| MAP-002 | P0 | Calcular rota com openrouteservice | Distância, duração e geometria derivadas da API; erro explícito se indisponível |
| MAP-003 | P0 | Abrir navegação externa Google Maps | Link válido para destino; não prometer preservar todos os waypoints |
| MAP-004 | P1 | Abrir navegação externa Waze | Link válido para destino com fallback browser quando aplicável |
| MAP-005 | P0 | Mostrar estado de localização stale | Ao trocar para app externa/background, mostrar timestamp e estado de ligação, sem fingir GPS contínuo |
| MAP-006 | P0 | Compatibilidade PWA Android/iOS | Testes reais de instalação, mapa, permissões, safe areas e retorno do background |

Para a PoC, não implementar navegação curva-a-curva própria, tracking em background ou sincronização de percurso entre apps externas. Consultar `12-MAPS-AND-NAVIGATION.md`.


IDs duplicados resolvidos: os antigos FR-021…026 da tabela **adicional de mapas**
passam a MAP-001…006. Os FR-021…024 da tabela principal mantêm o significado.

## Grupos e voz/SOS — obrigatórios

| ID | Prioridade | Requisito | Aceitação |
|---|---|---|---|
| GRP-001 | P0 | Diretório e mapa das sedes | Todas as contas autenticadas consultam sedes declaradas sem expor GPS pessoal |
| GRP-002 | P0 | Uma inscrição por conta | No máximo um grupo aceite; um pedido pendente; limites impostos na BD |
| GRP-003 | P0 | Aprovar entradas | Só dirigentes aprovam/recusam; membro não se promove nem altera pedidos alheios |
| GRP-004 | P0 | Vários dirigentes | Poderes iguais; impedir remover/despromover/sair do último dirigente, incluindo concorrência |
| GRP-005 | P0 | Associação e sede física | Nome/morada/coordenadas; denominação e registo opcionais; sem selo de verificação legal |
| VOZ-001 | P0 | Voz do organizador | Só organizador ou emissor de SOS ativo recebe autorização de publicar microfone |
| VOZ-002 | P0 | Prioridade SOS | SOS interrompe organizador; um SOS ativo; expiração 90 s e resolução pelo próprio/organizador |
| VOZ-003 | P0 | Alerta sem microfone | Falha/permissão negada mantém SOS visual; sem alegação de contacto com 112 |
| VOZ-004 | P0 | Segurança áudio | Tokens curtos, fonte microfone, canais privados e nova época por mudança de fala; sem gravação pela app |
| VOZ-005 | P0 | Lifecycle | Sem microfone ao ouvir; parar ao sair/perder foco/rede, negar snapshot antigo; retoma explícita |
| VOZ-006 | P0 | Validação real | Três dispositivos, iPhone/Android e redes móveis distintas; medir latência/interrupção e verificar headset |

VOZ-006 é um gate de validação manual, ainda pendente. Ver docs/20-VOICE-AND-SOS.md.
