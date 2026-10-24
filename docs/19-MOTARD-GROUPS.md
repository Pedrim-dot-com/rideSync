# 19 — Grupos motards e direção partilhada

Pedido obrigatório do utilizador em 2026-10-24, incluindo associações com sede
física e vários dirigentes. Pertencer a um grupo é opcional: uma conta pode
ficar sem grupo ou pertencer a um único grupo. Entrada aprovada por
um dirigente, conforme preferência confirmada pelo utilizador.

## Interface

Registar conta não associa ninguém automaticamente a um grupo. Uma pessoa sem
grupo pode usar viagens/garagem/voz e consultar todas as sedes. Qualquer conta
sem inscrição aceite nem pedido pendente pode criar o seu próprio grupo e
tornar-se o primeiro dirigente. Para criar outro grupo, sair do atual ou retirar
o pedido pendente; o último dirigente tem de promover outro membro antes de sair.

Separador Grupos com lista pesquisável e mapa das sedes. Selecionar um grupo
mostra nome/descrição, sede e dados legais opcionais. Sem selo “verificado”.
Qualquer conta autenticada pode consultar o diretório; viagens continuam privadas.

Criar grupo exige nome e sede explícita com morada/coordenadas; a pesquisa de
lugares existente pode preencher os valores. Não inferir sede a partir de GPS
pessoal. Aviso de divulgação e de representação autorizada antes de guardar.
Criador torna-se primeiro dirigente na mesma transação. Não pode criar outro
se já pertencer a um grupo ou tiver pedido pendente.

Membro pede entrada, retira pedido ou sai. Direção aprova/recusa, promove ou
retira cargos, remove membros e edita dados. Vários dirigentes têm poderes
iguais. Remoção, saída e despromoção pedem confirmação. Último dirigente não
pode sair/perder cargo pela app antes de promover outra pessoa. Mudanças
concorrentes são serializadas; edição usa revisão otimista.

## Dados e segurança

Migration 007 cria motard_groups e group_memberships, com RLS. Diretório permite
só colunas publicáveis, sem criador, emails, garagem ou localização pessoal.
Roster expõe nome/nickname/papel/estado só a membros aceites; pedidos pendentes
são exclusivos da direção e da própria conta. Membership bruta tem RLS própria/
dirigentes; escritas só por RPC, ator sempre auth.uid().

Índices únicos parciais impedem dois grupos aceites e dois pedidos pendentes.
Locks grupo→perfil alvo protegem transições entre grupos e contagem do último
dirigente. Limite de três grupos criados por dia/conta para reduzir spam.

Denominação legal e número de registo/NIPC são campos opcionais declarados pelo
representante. Não fazer validação jurídica automática nem inventar sedes ou
associações em seeds. Não incluir dados reais de grupos sem autorização.

## Estado e validação

Migrations 007 e 009 aplicadas com autorização em 2026-10-24, RLS/privilégios
verificados e tipos remotos regenerados. Os testes HTTPS reais confirmaram
criação por conta sem grupo, consulta das sedes, pedidos/aprovação, promoção de
segundo dirigente, saída e proteção do último dirigente. Grupos não dependem de
inscrição obrigatória nem de uma viagem. Ver recibos em docs/24.

A migration 009 altera apenas o conflito de revisão em save_motard_group para
`PT409 / GROUP_CHANGED`, devolvendo HTTP 409 explícito. O teste remoto inicial
com 40001 ficou sem resposta; o novo teste de edição desatualizada foi aprovado.
Não editar/reaplicar a 007 já instalada.

Testes de BD cobrem outsider/anon, RLS, approval, privilégios, vários dirigentes,
último dirigente, concorrência e grupo único. E2E simulado cobre mapa/lista,
pedido, aprovação por outro dirigente e direção partilhada em viewport mobile.
Cadastro oficial/importação pública, prova de mandato, fotos, eventos e gestão
financeira não fazem parte desta entrega. Exclusão administrativa da última
conta dirigente exige tratamento explícito do grupo pelo operador.

Roteiro de teste e pré-condições: [docs/23-FEATURE-TEST-GUIDE.md](23-FEATURE-TEST-GUIDE.md).
