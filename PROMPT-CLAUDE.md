# Prompt inicial para Claude Code

Quero que implementes o projeto RideSync como uma Proof of Concept. Lê integralmente `README.md`, `CLAUDE.md` e os ficheiros em `docs/` antes de alterar código.

1. Analisa o estado atual do repositório e identifica código já existente.
2. Produz um plano de implementação em etapas pequenas, com dependências, critérios de aceitação e ficheiros previstos.
3. Identifica decisões que precisem da minha confirmação (credenciais/quotas MapTiler e openrouteservice já escolhidos, LLM, ambiente Supabase, deploy). Não inventes credenciais nem assumas fornecedores aprovados.
4. Começa pela Fase 0 (setup, estrutura, qualidade, env de exemplo) e Fase 1 (Auth, perfis e garagem), após aprovação do plano.
5. Implementa migrations e RLS desde o início. Não uses service role no browser.
6. Antes de cada fase, apresenta tarefas; no fim, executa os testes e apresenta evidência do que funciona e do que falta.
7. Mantém uma lista de progresso em `docs/08-DELIVERY-PLAN.md` e regista decisões relevantes.

Não cries todas as funcionalidades de uma só vez. Prefiro código funcional, seguro, testado e incremental. Se uma funcionalidade exigir custos, permissões ou serviços externos, explica antes de avançar.

Decisão já tomada: MapLibre GL JS + MapTiler + openrouteservice; navegação externa opcional por links Google Maps/Waze. Lê `docs/12-MAPS-AND-NAVIGATION.md` e não voltes a apresentar Google Maps SDK como opção equivalente sem uma nova decisão minha. Garante compatibilidade Safari iOS e Chrome Android, com testes de foreground/background e estado stale.
