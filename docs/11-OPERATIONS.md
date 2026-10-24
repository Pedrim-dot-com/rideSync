# 11 — Ambiente, deploy e operações

## Pré-requisitos
Node LTS suportado pelo projeto, pnpm ou npm (escolher um e fixar), Supabase CLI, conta Supabase, fornecedor de mapas/rotas e fornecedor LLM.

## Variáveis de ambiente
Frontend (públicas):
```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_MAPTILER_API_KEY=
VITE_MAP_STYLE_URL=
```
Servidor/Edge Functions (segredos, nunca `VITE_`):
```dotenv
AI_API_KEY=
ROUTING_API_KEY=
GEOCODING_API_KEY=
```
Nomes concretos podem mudar consoante fornecedores; nunca commitar `.env.local`. `VITE_SUPABASE_ANON_KEY` é pública, mas RLS é obrigatória.

## Setup e migrations
1. Criar projeto Supabase Free.
2. Inicializar Supabase CLI no repo e criar migrations versionadas.
3. Aplicar migrations localmente; executar seeds fictícios.
4. Testar RLS com múltiplas identidades.
5. Só aplicar ao projeto remoto após aprovação explícita.
6. Configurar segredos de Edge Functions no ambiente remoto.

## Deploy
Build estático da PWA; configurar HTTPS e redirects SPA; configurar domínios autorizados de Auth. Testar PWA instalada no Android/iOS e a política de permissões GPS.

## Observabilidade mínima
Registar erros de Edge Functions, latência routing/LLM, falhas de auth, estado de canais Realtime, taxa de reconexão e uso de quotas. Não registar posições GPS ou prompts completos desnecessariamente.

## Checklist de segurança
- [ ] RLS ativa em todas as tabelas expostas.
- [ ] Testes outsider/owner/organizer/participant.
- [ ] Chaves privadas apenas server-side.
- [ ] Rate limits em IA, routing e convites.
- [ ] Políticas Storage e limites de upload.
- [ ] Retenção/eliminação de snapshots.
- [ ] Validação de CORS e autenticação das funções.
- [ ] Sem dados reais nos seeds e logs.

## Custo
Free Tier não implica custo zero de serviços externos. Validar quotas e pricing atuais antes de escolher routing, tiles, geocoding e LLM; configurar alertas/limites quando disponíveis.

## Operação de mapas
- Configurar MapTiler para tiles/styles e mostrar atribuições exigidas; restringir chave pública por domínio quando disponível.
- Guardar `ROUTING_API_KEY` (openrouteservice) apenas nos segredos das Supabase Edge Functions; nunca em `VITE_*`.
- Definir limites de chamadas, timeouts, tratamento de 429 e monitorização de quotas de tiles, routing e geocoding.
- Usar HTTPS para permissões de geolocalização; testar instalação em Safari iOS e Chrome Android.
- Links Google Maps/Waze não requerem API key para o caso básico de abrir destino, mas não garantem paragens nem tracking contínuo.
- Antes do deploy, validar termos e preços atuais dos fornecedores; a PoC não assume gratuidade ilimitada.


## Operação de grupos e voz

Grupos/SOS acrescentam migrations 007/008; não reaplicar 001–006. Criar os
segredos LIVEKIT_URL (wss://...), LIVEKIT_API_KEY e LIVEKIT_API_SECRET nas Edge
Functions, nunca no frontend. APP_ORIGINS mantém a origem PWA exata. Publicar
trip-voice só depois da migration e validação de roles; regenerar tipos remotos.
Documentação e critérios: docs/19-MOTARD-GROUPS.md e docs/20-VOICE-AND-SOS.md.

Antes de convidar utilizadores reais, rever plano/custos LiveKit, autorizações
de divulgação de sedes e testar áudio/microfone/foreground em vários aparelhos.
Nunca registar JWT LiveKit, segredos, SDP, ICE candidates ou conteúdos de áudio
em logs da app. Usar apenas códigos de erro e contadores agregados. Se uma sala
antiga ficar ocupada por clientes adulterados após falha de remoção, encerrá-la
no painel LiveKit; automatização desta limpeza continua pendente.
