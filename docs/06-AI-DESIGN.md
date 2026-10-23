# 06 — IA: escopo, contratos e segurança

## Objetivo
Converter pedidos naturais em um rascunho de viagem editável. A IA não é fonte de verdade para estradas, distâncias, meteorologia, preços ou POIs.

## Pipeline
1. Utilizador escreve pedido.
2. Edge Function valida autenticação, tamanho do prompt e rate limit.
3. LLM devolve JSON estruturado, sem executar alterações.
4. Validar JSON com schema (Zod no TS); geocodificar lugares por fornecedor externo quando necessário.
5. Pedir confirmação/correção de origem, destino, paragens e preferências.
6. Routing externo calcula percurso real.
7. Mostrar proposta; só guardar depois de confirmação.

## Esquema de resposta
```json
{
  "originText": "Porto",
  "destinationText": "Gerês",
  "waypointsText": [],
  "avoidHighways": true,
  "routeStyle": "scenic",
  "desiredStops": 2,
  "departureAt": null,
  "clarifications": []
}
```
Valores opcionais devem ser `null`/vazios, nunca inventados. Não confundir `desiredStops` com paragens já geocodificadas. Se a ambiguidade impedir routing, solicitar esclarecimento.

## Requisitos
- Provider e modelo configuráveis via secrets; nunca hardcode de chave.
- Limites por utilizador e tamanho de input; logar custos/latência sem prompts sensíveis desnecessários.
- Timeout, erro recuperável e fallback para planeamento manual.
- Defesa contra prompt injection: output é dado não confiável; validar, não executar comandos ou URLs fornecidos pelo modelo.
- Testes com prompts ambíguos, locais inexistentes, pedidos perigosos e respostas inválidas.

## Fora de âmbito
Agentes autónomos, RAG, recomendações personalizadas com histórico, meteorologia live e execução automática de convites.

## Limites da integração com mapas
A IA produz preferências estruturadas; a Edge Function valida e usa openrouteservice para calcular geometria, distância e duração. Nunca afirmar suporte nativo a "estradas panorâmicas" ou "rotas para motas" sem verificar funcionalidades reais da API; preferências não suportadas exigem aviso ou confirmação. MapTiler apenas fornece a apresentação cartográfica. Google Maps/Waze são opções de navegação externa, não fontes de verdade do itinerário da PoC.
