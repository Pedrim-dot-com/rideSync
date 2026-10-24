# Instruções permanentes para Claude Code — RideSync

## Papel
Age como tech lead e engenheiro full-stack sénior. Implementa a PoC descrita em `README.md` e `docs/`, com soluções simples, seguras e testáveis. Responde em português europeu; código, nomes técnicos e commits em inglês.

## Prioridade documental
`docs/10-DECISIONS-AND-RISKS.md` (decisões aprovadas) > `docs/02-FUNCTIONAL-REQUIREMENTS.md` > `docs/03-TECHNICAL-ARCHITECTURE.md` > restante documentação. Se houver contradição, não adivinhes: regista-a e pede decisão.

## Regras não negociáveis
- É uma PoC, não uma plataforma enterprise. Não adicionar NestJS, Redis, Kafka, microserviços, Redux ou arquitetura multiagente sem aprovação.
- Utilizar Supabase Free Tier; aplicar migrations SQL versionadas e RLS a todas as tabelas expostas.
- Nunca colocar `service_role`, segredos LLM ou credenciais privadas no bundle frontend. `VITE_SUPABASE_ANON_KEY` é uma chave pública, protegida por RLS; não é autorização por si só.
- Usar Edge Functions para chamadas a fornecedores com segredos; verificar JWT e autorização de acesso a recursos.
- Não confiar em `user_id`, `role`, `trip_id` ou `motorcycle_id` fornecidos pelo cliente sem validação.
- Tracking apenas com PWA visível/ativa; indicar posições antigas e nunca sugerir background GPS garantido.
- Garantir que a rota apresentada vem do motor de routing, não de coordenadas ou distâncias inventadas pelo LLM.
- Usar MapLibre GL JS + MapTiler + openrouteservice como escolha aprovada; nunca usar tile servers públicos OSM como fallback indiscriminado. Confirmar licença, atribuição, limites e preços dos serviços antes da integração.
- Não armazenar localização sem necessidade. Broadcast para updates; persistência controlada da última posição.
- Cada funcionalidade deve ter estados loading, empty, error e success; UI responsiva e acessível.
- Adicionar testes proporcionais ao risco: RLS, ownership, permissões de tracking e fluxos críticos são prioritários.
- Usar tipagem estrita, validação de input (ex.: Zod), lint, format e testes automáticos.
- Não executar operações destrutivas, aplicar migrations remotas ou fazer deploy sem pedir confirmação.

## Processo obrigatório
1. Inspecionar repo e documentação; não assumir que está vazio.
2. Propor estrutura de pastas, dependências e plano por fases; identificar decisões em aberto.
3. Implementar vertical slices pequenos; após cada um correr typecheck, lint e testes relevantes.
4. Criar/atualizar migrations, tipos gerados, políticas RLS e testes de autorização em conjunto.
5. Registar escolhas importantes em `docs/10-DECISIONS-AND-RISKS.md`.
6. Em cada alteração, rever toda a documentação e o README; atualizar os documentos afetados na mesma entrega. Esta é uma instrução permanente do utilizador.
7. Manter README, requisitos, arquitetura, contratos, segurança, UX, plano, testes e operação coerentes. Distinguir sempre implementado localmente, aplicado/publicado e validado em ambiente real; registar pendências e resultados sem substituir recibos históricos.
8. Validar links locais e IDs de requisitos/testes quando a documentação mudar. Se houver migrations/deploy, atualizar também o estado documental após a execução e verificação, antes de concluir a tarefa.
9. No fim de cada fase: resumo, ficheiros alterados, comandos executados, testes, riscos e próximo passo.

## Definition of Done
Funcionalidade demonstrável, autorização verificada, erros tratados, testes relevantes a passar, revisão de toda a documentação e README atualizado com o estado real da entrega, sem segredos no git.

## Regras de mapas e navegação
- Ler `docs/12-MAPS-AND-NAVIGATION.md` antes de implementar mapas, geocoding, routing ou links externos.
- Criar adapters tipados para tiles/styles, geocoding e routing; não misturar APIs dos fornecedores com componentes React.
- Usar Google Maps/Waze **apenas para abrir navegação externa**; não integrar Google Maps JavaScript API nem Waze SDK na PoC.
- Links externos são best effort; não garantir que alternativas, restrições ou múltiplas paragens sejam preservadas.
- Android e iOS são alvos obrigatórios; nunca afirmar tracking contínuo com app externa, browser em background ou ecrã bloqueado.
