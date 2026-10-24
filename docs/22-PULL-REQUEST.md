# 22 — Proposta de pull request

Estado da tentativa automática: branch enviada; este ambiente não conseguiu
criar o PR. O estado atual de PRs externos não foi consultado. A API GitHub devolveu
Forbidden nas tentativas de listagem/criação, enquanto o push Git funciona.
Não foi possível consultar o resultado remoto do CI neste ambiente.

Base: `main`. Head: `feat/motard-groups-voice-sos`.

## Título proposto

Add motard groups with shared leadership and priority SOS voice

A interface foi entretanto observada em produção; o backend 007/008/trip-voice
continua ausente. Estado e roteiro atuais: [guia de teste](23-FEATURE-TEST-GUIDE.md).
A descrição abaixo é o texto preparado na proposta anterior.

## Descrição preparada para revisão

Esta alteração acrescenta grupos motards com sedes públicas para contas autenticadas e comunicação de voz durante viagens ativas.

Os grupos suportam pedidos de entrada, uma inscrição aceite por conta e vários dirigentes com poderes iguais. As operações são transacionais e impedem a saída/despromoção do último dirigente. Os dados legais são declarados pelo grupo, sem certificação automática.

Na viagem, o organizador pode falar e os participantes só publicam voz através de SOS com prioridade. O alerta visual é criado antes de pedir o microfone. A integração LiveKit usa uma Edge Function autenticada, permissões impostas no servidor e épocas de sala por mudança de fala. Inclui atalho SOS mobile, expiração e limpeza de media ao sair/perder foco ou rede. A PWA exige foreground; não garante áudio com ecrã bloqueado.

A documentação e o README foram revistos: contratos reais, IDs únicos, estado local/publicado/validado e regra permanente de manutenção documental.

## Validação
- 126 testes unitários e 316 verificações PostgreSQL aprovados.
- 6 E2E com transporte simulado aprovados, incluindo direção plural e SOS com microfone negado.
- Typecheck, lint, formatação, build/PWA e Deno check das três Edge Functions aprovados.
- Links locais e IDs documentais verificados.

## Publicação e limitações
As migrations 007/008 e a função trip-voice ainda não foram aplicadas/publicadas. Antes de integrar em produção: aplicar migrations, publicar a Edge Function, regenerar tipos e validar o fornecedor com contas temporárias; depois publicar o frontend. Os três nomes de segredos LiveKit existem no Supabase, mas os valores e a ligação real não foram validados.

Faltam testes reais de áudio/latência com três dispositivos e headset. Os limites de background e de limpeza remota de salas antigas estão registados em docs/20-VOICE-AND-SOS.md. Ver também docs/19-MOTARD-GROUPS.md e docs/21-DOCUMENTATION-REVIEW.md.
