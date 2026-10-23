# 12 — Mapas, rotas e navegação externa

## Estado da decisão
**APROVADO para a PoC:** MapLibre GL JS + MapTiler + openrouteservice. Google Maps e Waze apenas por links externos opcionais. PWA compatível com iOS e Android.

## Responsabilidades
| Componente | Papel | Executa onde |
|---|---|---|
| MapLibre GL JS | Renderização, marcadores dos motards, linha da rota e waypoints | Browser |
| MapTiler | Styles e tiles, sujeitos a licença e quotas | Serviço externo/browser |
| openrouteservice | Geocoding, cálculo da geometria, distância e ETA | Serviço externo via Edge Function |
| Supabase Realtime | Distribuição de posições GPS, independente do fornecedor de mapas | Backend/browser |
| Google Maps / Waze | Navegação turn-by-turn externa por URL | Outra app/browser |

## Fluxo de planeamento
1. Utilizador pesquisa origem/destino e waypoints.
2. Frontend chama serviço de geocoding (Edge Function, com debounce e limites).
3. Frontend envia coordenadas/waypoints e opções suportadas à Edge Function `calculate-route`.
4. Edge Function valida e chama openrouteservice, com timeout, rate limit e tratamento de 429.
5. Normalizar geometria GeoJSON, distância em metros, duração em segundos, provider e metadados; persistir rota.
6. MapLibre apresenta GeoJSON sobre o estilo MapTiler, com atribuição e estados loading/empty/error.
7. IA só propõe parâmetros; nunca inventa geometria, distância ou ETA.

## Fluxo durante viagem
- Utilizador inicia partilha de localização com consentimento explícito e PWA em foreground.
- Marcadores são atualizados por Supabase Realtime e incluem timestamp, precisão e estado.
- Se a PWA for suspensa, não prometer envio de GPS; posição passa a stale e fica claramente datada.
- Ao regressar, recuperar snapshot, reconectar canal e retomar geolocalização quando permitido.

## Navegação externa
- Mostrar botão `Abrir navegação` e opções Google Maps/Waze (pode mostrar Apple Maps como opção futura, mas não é requisito PoC).
- Google Maps URLs: `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&travelmode=driving`.
- Waze Deep Links: `https://waze.com/ul?ll=<lat>%2C<lng>&navigate=yes`.
- Construir URLs a partir de coordenadas numéricas validadas, com encoding adequado; não aceitar URL arbitrária de utilizador.
- Estes links básicos destinam-se ao **destino**; não garantir reprodução integral de rotas com waypoints, estradas preferidas ou alternativas.
- Avisar antes de abrir: `Ao abrir outra aplicação, a tua localização pode deixar de ser partilhada com o grupo.`
- Abrir por gesto explícito; testar comportamento com app instalada e fallback browser em Android/iOS.

## Privacidade e segurança
- Não colocar chaves privadas openrouteservice ou IA no browser. MapTiler pode exigir chave pública no browser: aplicar restrições de domínio e limites disponíveis.
- Nunca colocar coordenadas pessoais em analytics ou logs desnecessários.
- Canais privados e RLS: apenas participantes autorizados recebem posições.
- Parar tracking deve impedir novas transmissões; expirar/remover snapshots conforme política.

## Compatibilidade e critérios de aceitação
- Safari iOS (browser e PWA instalada) e Chrome Android (browser e PWA instalada).
- Mapas touch e safe areas corretos; marcadores e linhas visíveis; atribuição legal exibida.
- Planeamento funciona sem GPS; erro de routing é recuperável.
- Três motards em dispositivos distintos veem posições em foreground; timestamp stale após troca de app.
- Links externos abrem navegação para o destino, sem alegações de tracking em background.

## Custos e licenças
- Confirmar antes de usar em ambiente real as quotas gratuitas, termos de utilização, atribuição, geocoding/routing e política de cache de MapTiler e openrouteservice.
- Implementar métricas de consumo e mensagens de erro em caso de quota excedida.
- Nunca usar servidores públicos de tiles OpenStreetMap como fallback automático sem rever política de uso.

## Fora de âmbito
Turn-by-turn interno, mapas offline garantidos, sincronização bidirecional com Waze/Google Maps, tracking em background, instruções de voz, cálculo de percursos especializados para motas sem suporte comprovado.
