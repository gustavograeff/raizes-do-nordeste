# Análise e requisitos

Trilha front-end. O estudo de caso é a rede de lanchonetes Raízes do Nordeste.

## Usuários

| Usuário | O que precisa | Onde aparece no protótipo |
| --- | --- | --- |
| Cliente | Pedir, pagar e acompanhar o pedido | Unidades, Cardápio, Carrinho, Pagamento, Pedido |
| Atendente de balcão | Registrar pedido de terceiros, sem cadastro obrigatório | Canal "Atendimento no balcão" |
| Gerente de unidade | Ver o que está em falta e o resultado da loja | Painel da matriz, tabela de disponibilidade |
| Matriz da franqueadora | Consolidar vendas, descontos e recusas | Painel da matriz |

## Requisitos funcionais

| ID | Requisito | Critério de aceite |
| --- | --- | --- |
| RF01 | Selecionar a unidade antes de montar o pedido | Trocar de unidade limpa o carrinho, porque preço e disponibilidade mudam |
| RF02 | Exibir o cardápio da unidade selecionada | Item indisponível aparece com o motivo, não some da lista |
| RF03 | Respeitar cozinha reduzida | Item que exige cozinha completa fica bloqueado em unidade reduzida |
| RF04 | Respeitar sazonalidade junina | Item junino só é vendável em junho e julho |
| RF05 | Respeitar o estoque local | Cada unidade abre o dia com um estoque por item, a venda paga dá baixa, e o item sai do cardápio ao chegar a zero. A sacola é reconferida antes de cobrar, inclusive contra a quantidade pedida |
| RF06 | Montar carrinho com quantidades | Somar linha repetida, remover linha ao chegar a zero |
| RF07 | Operar em quatro canais | Aplicativo, totem, balcão e retirada rápida, restritos aos canais que a unidade oferece. Trocar de unidade mantém o canal quando a nova também o opera |
| RF08 | Solicitar pagamento a serviço externo | A tela envia a cobrança, recebe a resposta e registra o resultado |
| RF09 | Tratar pagamento negado | Pedido vai para "pagamento recusado" e oferece nova tentativa |
| RF10 | Tratar falha de comunicação | Pedido continua aguardando pagamento e permite repetir a cobrança com o mesmo identificador |
| RF11 | Acompanhar o status do pedido | Confirmado, em preparo, pronto, entregue, com anúncio para leitor de tela |
| RF12 | Cadastrar no programa de fidelidade | Só cria cadastro com consentimento explícito marcado, e nenhum dado do formulário é gravado antes do aceite. Disponível em qualquer canal, incluindo o totem |
| RF13 | Restringir o cadastro a maior de idade | Abaixo de 18 anos a tela recusa o cadastro e informa que o consentimento é do responsável legal |
| RF14 | Aplicar desconto progressivo | Prata 5%, Ouro 10%, calculado sobre o subtotal |
| RF15 | Creditar pontos | Um ponto por real efetivamente pago, apenas com consentimento ativo |
| RF16 | Retirar consentimento e excluir dados | Ações separadas e disponíveis a qualquer momento. Retirar o consentimento apaga nome e data de nascimento na hora, mantém telefone e saldo neste aparelho, e volta o formulário ao zero, exigindo novo aceite. Excluir apaga também telefone e saldo |
| RF17 | Consolidar resultados para a matriz | Faturamento, pedidos pagos, descontos concedidos, recusas, cancelamentos, itens mais vendidos, vendas por região e por forma de pagamento, meta mensal por unidade, restritos ao canal de balcão, operado por funcionário. O canal de balcão não aparece no seletor do cliente, e só é assumido com código de operador |
| RF18 | Cancelar pedido e registrar ajuste manual | Cliente cancela o próprio pedido até o status `confirmado`, sem exigir motivo. A partir de `em_preparo` só o balcão cancela, e com motivo obrigatório. Ajuste manual (cortesia ou acréscimo) é restrito ao balcão, e some no total final sem apagar o valor originalmente cobrado. As duas ações entram na auditoria do painel |
| RF19 | Respeitar o horário de funcionamento da unidade | Cada unidade tem hora de abrir e de fechar. Fora do horário nenhum item é vendável, e o cardápio diz o motivo |
| RF20 | Respeitar o horário de serviço do item | Item de café da manhã sai do cardápio do dia depois da hora de serviço, hoje as 11h |
| RF21 | Mostrar a variação regional da receita | O mesmo item traz a nota da receita do estado da unidade, que é parte da identidade da marca |
| RF22 | Segmentar campanhas com dado anonimizado | O público sai por faixa etária, frequência de consumo e faixa de fidelidade, com aceite separado do consentimento do programa. Nome, telefone e data de nascimento não entram na segmentação |
| RF23 | Auditar o acesso ao painel da matriz | Toda tentativa de entrar com o código de operador vira registro com data, hora e desfecho, visível no próprio painel |

## Requisitos não funcionais

| ID | Requisito | Como o protótipo atende |
| --- | --- | --- |
| RNF01 | Responsivo de 320 px ao desktop | Layout em coluna única no celular, grade a partir de `sm` |
| RNF02 | Acessibilidade | Rótulos em todo campo, `aria-pressed` nos filtros, `aria-live` no status, foco visível |
| RNF03 | Alvo de toque adequado no totem | Botões com altura mínima de 48 px quando o canal é totem |
| RNF04 | Tolerância a falha do serviço de pagamento | Falha não perde o pedido nem o carrinho |
| RNF05 | Conformidade com a LGPD | Consentimento explícito, finalidade declarada por dado, idade mínima para consentir, minimização na retirada e exclusão, anonimização no público de campanha e auditoria de acessos |
| RNF06 | Desempenho em horário de pico | Bundle único otimizado, sem chamada bloqueante no carregamento |
| RNF07 | Auditoria de operações sensíveis | Descontos concedidos, pagamentos recusados, cancelamentos com motivo, ajustes manuais e acessos ao painel visíveis para a matriz |
| RNF08 | Manutenção e evolução | Regras de negócio isoladas em `src/domain`, cobertas por teste |

## Ambiguidades do enunciado e decisão tomada

| Ambiguidade | Decisão | Razão |
| --- | --- | --- |
| "Período junino" não tem mês definido | Junho e julho | Cobre a festa e a cauda de vendas de julho, sem virar cardápio permanente |
| "Descontos progressivos" não tem faixa definida | Bronze 0%, Prata 5% a partir de 200 pontos, Ouro 10% a partir de 500 | Faixas simples de explicar no balcão |
| Não diz se pedido sem cadastro é permitido | É permitido | Exigir cadastro para comprar transforma consentimento em obrigação, o que a LGPD não admite |
| Não diz o que fazer ao trocar de unidade com carrinho cheio | Limpar o carrinho | Item do carrinho pode não existir na outra unidade, e carregar item inválido gera erro no caixa |
| O enunciado cita idade só como fator de segmentação e não fixa idade mínima nem fala de menor de idade | Cadastro a partir de 18 anos, com mensagem indicando o responsável legal | O enunciado exige conformidade com a LGPD, e a LGPD trata dado de criança e adolescente com consentimento do responsável legal. Sem back-end não há como validar quem é o responsável, então a tela recusa o cadastro e explica o caminho |
| Não diz qual dado sobrevive à retirada de consentimento | Ficam telefone e saldo de pontos, neste aparelho | Sem servidor, o telefone é a única chave que liga o saldo a essa pessoa, e mantê-lo junto ao saldo evita que um cadastro novo no mesmo aparelho herde por engano os pontos do cliente anterior. Nome e data de nascimento não têm esse papel, então perdem a finalidade e saem na hora |
| Não diz como o funcionário se identifica sem back-end | Código de operador na própria tela do painel, que passa o aparelho para o canal de balcão | Deixar o canal de balcão no seletor do cliente entregava a consolidação da rede a qualquer visitante. O código viaja no pacote do navegador, então evita o acesso acidental e não protege o dado. Proteção real exige servidor que autentique o funcionário |
| Não diz de onde vem o número do pedido | Identificador sorteado na criação, com 48 bits | Sem back-end não existe contador coordenado, e um contador derivado do histórico sairia igual em duas abas para vendas diferentes. O sorteio dá o mesmo número para a mesma venda em toda aba |
| O enunciado cita equipe própria (atendentes, cozinheiros, gerentes) por unidade | Não modelada como cadastro de funcionário | Sem back-end não há como autenticar nem distinguir pessoas de verdade. O papel continua deduzido do canal (RF17), e cadastro de equipe fica para quando existir login, igual já registrado no limite "Papel deduzido do canal" |
| O enunciado cita controle de estoque local e não diz de onde vem o número | Cada unidade abre o dia com um estoque por item, padrão de 20 unidades, e a venda paga dá baixa | Sem serviço de estoque, o pedido pago é o único evento de consumo que o protótipo conhece. A baixa sai dos pedidos, e não de um contador à parte, então o cancelamento devolve o item sozinho e a fusão entre abas não conta a mesma venda duas vezes |
| O enunciado cita regras de funcionamento próprias e não define horário | Hora de abrir e de fechar por unidade, com o shopping preso ao horário do centro comercial | Horário é a regra de operação mais visível para o cliente, e é a que muda o cardápio na hora |
| O enunciado cita idade e frequência como fatores de segmentação e não define faixas | Faixas de 18 a 24, 25 a 39, 40 a 59 e 60 ou mais, e frequência novo, ocasional a partir de 2 pedidos e recorrente a partir de 5 | Faixa agrupa sem identificar, que é o que a LGPD pede para essa finalidade |
| O enunciado exige auditoria de acessos e o protótipo não tem login | Registro de data, hora e desfecho de cada tentativa no painel, sem identificar pessoa | Sem servidor não existe usuário para nomear. O que dá para provar é quando alguém tentou e se entrou |
