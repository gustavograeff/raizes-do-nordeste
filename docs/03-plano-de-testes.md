# Plano de testes e evidências

## Estratégia

| Camada | O que cobre | Como |
| --- | --- | --- |
| Automatizado | Regra de negócio pura em `src/domain` e leitura do estado gravado em `src/state.ts` | Vitest, `npm test`, 98 casos |
| Manual guiado | Jornada nas telas, incluindo caminhos negativos | Roteiro abaixo |
| Não funcional | Responsividade, acessibilidade, desempenho | DevTools, navegação por teclado, Lighthouse |

A regra de negócio é testada sem renderizar tela, porque é ela que erra com custo real. Liberar item que a cozinha não faz e dar desconto a quem não consentiu são os dois erros caros.

## Testes automatizados

Rodar com `npm test`.

| Caso | Entrada | Saída esperada |
| --- | --- | --- |
| Item comum em cozinha completa | Tapioca, Boa Viagem, agosto | `disponivel` |
| Item de cozinha completa em unidade reduzida | Cuscuz com carne de sol, Centro, agosto | `cozinha_reduzida` |
| Item junino fora de temporada | Pamonha, Boa Viagem, agosto | `fora_de_temporada` |
| Item junino na temporada | Pamonha, Boa Viagem, junho | `disponivel` |
| Estoque vence as demais regras | Suco de cajá, Boa Viagem, agosto | `sem_estoque` |
| Estoque vence a temporada | Pamonha em falta, junho | `sem_estoque` |
| Busca sem acento | Termo "cafe" | Encontra "Café coado na hora" |
| Sacola com item de cozinha reduzida | Cuscuz, Centro, agosto | Uma linha bloqueada, motivo `cozinha_reduzida` |
| Sacola atravessa a virada de temporada | Pamonha, junho e agosto | Liberada em junho, bloqueada em agosto |
| Item repetido no carrinho | Adicionar café duas vezes | Uma linha com quantidade 2 |
| Quantidade zerada | Remover a única unidade | Linha some do carrinho |
| Pontos sem consentimento | 900 pontos, sem consentimento | Faixa `nenhum`, desconto 0% |
| Limite exato de faixa | 199, 200, 499 e 500 pontos | `bronze`, `prata`, `prata`, `ouro` |
| Teto por item na tela do carrinho | Somar acima de 99 unidades | Quantidade para em 99 |
| Teto por item no botão do cardápio | Adicionar item que já está em 99 | Quantidade para em 99 |
| Ponto prometido sem consentimento | Sacola de 69,80 sem consentimento | Total inteiro, zero ponto |
| Item fora do catálogo no total | Linha de item inexistente | Subtotal, total e pontos zerados |
| Desconto de faixa Ouro | 2 cafés da manhã, 600 pontos | Subtotal 69,80, desconto 6,98, total 62,82, 62 pontos |
| Avanço do pedido | `confirmado` | `em_preparo` |
| Fim do ciclo | `entregue` | `entregue` |
| Pedido recusado não avança | `pagamento_recusado` | `pagamento_recusado` |
| Numeração do pedido | 500 identificadores sorteados seguidos | Nenhum repetido, todos no formato `RN-` com 12 dígitos |
| Idade pelo dia do aniversário | Nascimento em 15 e em 16 de agosto, hoje 15 de agosto | 18 e 17 anos |
| Data que o calendário não tem | 31 de fevereiro, mês 00 e 29 de fevereiro de 2008 | Recusada, recusada, 18 anos |
| Cadastro de maior de idade | Nome, telefone e data de 2000 | Nenhum erro |
| Cadastro de menor de idade | Data de 2010 | Mensagem citando 18 anos e o responsável legal |
| Campos obrigatórios do cadastro | Nome vazio, telefone curto, data ilegível | Uma mensagem própria para cada caso |
| Contrato do pagamento | Três simulações | `aprovado`, `negado`, `falha` |
| Número reaproveitado na nova tentativa | Mesma sacola aguardando pagamento | Cobra o mesmo `RN-` |
| Outra forma de pagamento na nova tentativa | Mesma sacola, crédito em vez de Pix | Cobra o mesmo `RN-` |
| Outra compra no mesmo aparelho | Sacola diferente aguardando pagamento | Número novo, a tentativa antiga fica no histórico |
| Pedido já pago não é recobrado | Pedido `confirmado` com a mesma sacola | Número novo |
| Chave de idempotência repetida | Duas cobranças com a mesma chave | O segundo pedido devolve o desfecho do primeiro |
| Falha pode ser reenviada | Chave que falhou, depois aprovada | A falha não fica gravada na chave |
| Item saído do catálogo no registro gravado | Sacola gravada com item inexistente | Linha descartada na leitura |
| Canal gravado que a unidade não opera | Centro com canal Totem | Volta para o primeiro canal de cliente da unidade |
| Canal de balcão no registro gravado | Centro com canal Balcão | Volta para o canal de cliente, exigindo novo código de operador |
| Unidade gravada que não existe mais | Identificador desconhecido | Estado inicial |
| Consentimento implícito no registro gravado | `hasConsent` como texto | Consentimento falso, zero ponto |
| Pedido gravado sem total | Registro só com identificador e itens | Pedido descartado na leitura |
| Total infinito no registro gravado | `1e999` como total | Pedido descartado, sem "R$ Infinity" na tela |
| Status vindo do protótipo do objeto | `status` igual a `constructor` | Pedido descartado na leitura |
| Fusão repetida do mesmo histórico | Histórico igual nas duas abas | Nenhum pedido duplicado |
| Venda que só existe na outra aba | Identificador ausente aqui | A venda entra no histórico desta aba |
| Trocas repetidas do histórico entre abas | Três rodadas de fusão nos dois sentidos | O histórico para de crescer |
| Identificador sorteado | 500 pedidos novos seguidos | Nenhum repetido |
| Recusa aqui e confirmação na outra aba | Mesma venda com desfechos opostos | As duas abas ficam com confirmado |
| Total mudado pela nova tentativa | Mesma venda com faixa de fidelidade nova | Uma venda só, sem cópia |
| Consentimento retirado durante a cobrança | Aprovação com cadastro já sem consentimento | Pedido confirmado com zero ponto, saldo intocado |
| Pedido cobrado que saiu do histórico | Aprovação de identificador inexistente | Estado inalterado |
| Ponto ganho na outra aba | Cadastro com 40 pontos gravado ao lado | Saldo adotado, sacola desta aba intacta |
| Cadastro gravado mais velho que o desta aba | Ponto creditado aqui depois da gravação ao lado | Saldo desta aba mantido |
| Nada mudou na outra aba | Gravação sem diferença | O mesmo estado, sem redesenhar a tela |
| Exclusão de dados feita na outra aba | Cadastro apagado ao lado | Cadastro apagado também aqui |
| Ano de nascimento com dois dígitos | `0050-06-15` | Data recusada, sem cair no século 20 |
| Item removido e recolocado antes de repetir o pagamento | Mesma sacola em outra ordem | Número do pedido reaproveitado |
| Cancelamento permitido | Pedido `confirmado` | Pode cancelar |
| Cancelamento bloqueado | Pedido `em_preparo`, `pronto`, `entregue` ou já `cancelado` | Não pode cancelar |
| Pedido cancelado não avança | `cancelado` | `cancelado` |
| Ajuste manual soma ao total cobrado | Total 7,00 com ajuste de -2,00 | Total final 5,00 |
| Pedido sem ajuste mantém o total cobrado | Sem `adjustmentCents` | Total final igual ao cobrado |
| Região da unidade | Boa Viagem e Aldeota | `PE` e `CE` |
| Ajuste manual corrompido no registro gravado | `adjustmentCents` como texto | Pedido descartado na leitura |
| Item do café da manhã depois da hora | Café da manhã completo, 11h30 | `fora_do_horario` |
| Item do café da manhã dentro da hora | Café da manhã completo, 9h | `disponivel` |
| Unidade fechada | Tapioca, Boa Viagem, 4h | `unidade_fechada` |
| Hora exata do fechamento | Centro às 17h59 e às 18h | Aberta e fechada |
| Estoque consumido pela venda | Tapioca com o estoque aberto todo vendido | `sem_estoque`, zero unidade restante |
| Sacola acima do estoque restante | 3 tapiocas com 2 em estoque | Uma linha bloqueada, motivo `sem_estoque` |
| Baixa de duas vendas da mesma unidade | Dois pedidos pagos de 2 tapiocas | 4 unidades baixadas |
| Pedido recusado não baixa estoque | Pedido `pagamento_recusado` | Nenhuma baixa |
| Cancelamento devolve o estoque | Pedido pago e depois cancelado | Nenhuma baixa, estoque cheio de novo |
| Estoque próprio da unidade | Venda de 2 tapiocas no Centro, que abre com 6 | 4 unidades restantes |
| Pedido do mês de referência | Pedido de agosto medido em agosto | Entra na meta |
| Pedido de outro mês | Pedido de agosto medido em setembro e no ano anterior | Fica fora da meta |
| Perfil de campanha anonimizado | Consentimento, campanhas aceitas, 1990, 3 pedidos, 250 pontos | Faixa `25 a 39`, frequência `ocasional`, faixa `prata` |
| Campanha sem o aceite próprio | Cadastro sem aceitar campanhas | Fora do público |
| Campanha sem consentimento | Consentimento retirado | Fora do público |
| Faixas de frequência | 0, 2 e 5 pedidos pagos | `novo`, `ocasional`, `recorrente` |
| Público agrupado por segmento | Dois clientes do mesmo segmento | Uma linha com contagem 2, sem identificar pessoa |
| Acesso registrado nas duas abas | Uma concessão aqui e uma recusa ao lado | As duas entram, da mais antiga à mais nova |
| Acesso repetido nas duas abas | Mesma tentativa nas duas | Sem duplicata |
| Teto do registro de acessos | 60 tentativas | Guarda as 50 mais novas |
| Acesso ilegível no registro gravado | Entrada sem data ou sem desfecho | Descartada na leitura |

## Roteiro manual

### CT01 Pedido aprovado, do início ao fim

1. Abrir o app e escolher Raízes Boa Viagem.
2. Adicionar 1 tapioca e 1 café.
3. Abrir o carrinho e conferir o total.
4. Ir para o pagamento, manter a simulação em "Pagamento aprovado" e pagar.

**Esperado**
Pedido criado, status muda sozinho de Confirmado até Entregue, carrinho esvazia.

### CT02 Pagamento negado

1. Repetir os passos 1 a 3 do CT01.
2. Escolher a simulação "Pagamento negado pelo emissor" e pagar.

**Esperado**
Pedido em "Pagamento recusado", com botão para nova tentativa. O carrinho continua cheio.

### CT03 Falha de comunicação

1. Repetir os passos 1 a 3 do CT01.
2. Escolher "Falha de comunicação com o serviço de pagamento" e pagar.
3. Recarregar a página, abrir o pedido pelo histórico e usar "Voltar ao pagamento".

**Esperado**
Alerta de falha citando o identificador do pedido. A tela do pedido pendente oferece o caminho de volta ao caixa. Trocar a simulação para aprovado e pagar de novo aprova o **mesmo** pedido, sem duplicar, inclusive depois da recarga.

### CT04 Diferença entre unidades

1. Selecionar Raízes Centro, que tem cozinha reduzida.
2. Procurar "Cuscuz com carne de sol".

**Esperado**
Item visível, com "Indisponível em cozinha reduzida" e botão desabilitado.

### CT05 Sazonalidade junina

1. Em qualquer unidade, procurar "Pamonha" fora de junho e julho.

**Esperado**
"Só no período junino", botão desabilitado.

### CT06 Consentimento é obrigatório para o cadastro

1. Abrir Fidelidade, preencher nome, telefone e data de nascimento.
2. Não marcar a autorização e tentar criar o cadastro.

**Esperado**
Mensagem dizendo que o cadastro só é criado com consentimento explícito. Nenhum dado é gravado como cliente.

### CT07 Retirada de consentimento e exclusão

1. Criar o cadastro com a autorização marcada.
2. Retirar o consentimento.
3. Excluir os dados.

**Esperado**
Após a retirada, o desconto some do carrinho, o formulário volta vazio e as duas autorizações voltam desmarcadas, exigindo novo aceite explícito. Na aba Application do DevTools, nome e data de nascimento já não aparecem no registro gravado, e ficam só telefone e saldo. Após a exclusão, telefone e saldo também saem.

### CT08 Validação de formulário

| Entrada | Esperado |
| --- | --- |
| Nome vazio | "Informe o nome." |
| Telefone com 5 dígitos | "Informe um telefone com DDD." |
| Data de nascimento em branco | "Informe uma data de nascimento válida." |
| Data de nascimento de quem tem 17 anos | Mensagem de 18 anos indicando o responsável legal, e nenhum cadastro criado |

### CT09 Cadastro de menor de idade

1. Abrir Fidelidade e preencher nome e telefone.
2. Informar uma data de nascimento de quem completa 18 anos no ano que vem.
3. Marcar a autorização e tentar criar o cadastro.

**Esperado**
A tela recusa o cadastro e diz que um responsável legal precisa fazer o cadastro e dar o consentimento. Nada é gravado. Corrigir a data para uma de maior de idade cria o cadastro normalmente.

### CT10 Saldo em aparelho compartilhado

1. Criar o cadastro com um telefone e concluir um pedido aprovado, acumulando pontos.
2. Retirar o consentimento.
3. Criar um cadastro novo com outro telefone.

**Esperado**
O cadastro novo começa com zero ponto e faixa Bronze. Repetindo o passo 3 com o mesmo telefone do passo 1, o saldo anterior continua.

### CT11 Troca de canal

1. Selecionar Raízes Aldeota e abrir a lista de canais.
2. Escolher Totem e trocar para Raízes Boa Viagem, que também opera Totem.
3. Trocar para Raízes Centro, que não opera Totem.

**Esperado**
Só aparecem os canais da unidade. Escolher Totem aumenta a tipografia e a altura dos botões. O canal se mantém na unidade que o oferece e volta para App na que não oferece.

### CT12 Painel da matriz

1. Concluir um pedido aprovado.
2. Trocar o canal para Balcão, que é o canal operado por funcionário.
3. Abrir o painel.

**Esperado**
O item Matriz só aparece no canal Balcão. Ao abrir o painel, o cabeçalho troca para o de administrador (sem cardápio, carrinho, fidelidade ou seletor de canal), com um botão para sair do painel. Faturamento, contagem de pedidos, descontos concedidos e recusas aparecem atualizados, com o novo pedido somando na unidade certa, na região certa e na forma de pagamento certa, e a barra da unidade mostra o percentual da meta mensal.

### CT13 Painel da matriz depois de recarregar

1. No canal de balcão, abrir Matriz e digitar o código de operador.
2. Recarregar a página e abrir Matriz de novo.

**Esperado**
O painel abre na primeira vez. Depois do recarregamento, a tela pede o código de novo, e o canal volta a ser o de cliente.

### CT14 Escolher de novo a unidade já selecionada

1. Selecionar Raízes Boa Viagem e montar uma sacola.
2. Voltar às unidades e tocar de novo em Raízes Boa Viagem.

**Esperado**
A sacola continua montada. Só a troca para outra unidade esvazia.

### CT15 Item indisponível descoberto no pagamento

1. Montar a sacola em Raízes Boa Viagem com um item que só existe na cozinha completa.
2. Voltar às unidades e escolher Raízes Centro, de cozinha reduzida.

**Esperado**
A troca de unidade esvazia a sacola. Repetindo o cenário sem trocar de unidade, com o item ficando indisponível, a tela de pagamento acusa o item e desabilita a cobrança.

### CT16 Duas compras no mesmo terminal depois de uma falha

1. Montar uma sacola, escolher a simulação Falha e tocar em Pagar agora.
2. Voltar ao cardápio, montar uma sacola diferente e pagar com a simulação Aprovado.

**Esperado**
O pedido aprovado recebe número próprio, e a tentativa abandonada continua no histórico como aguardando pagamento. Repetir o pagamento da mesma sacola, sem alterá-la, reaproveita o número em vez de abrir um segundo pedido.

### CT17 Saldo de fidelidade entre duas abas do mesmo balcão

1. Abrir a aplicação em duas abas, cadastrar o cliente com consentimento e concluir um pedido na primeira.
2. Sem recarregar, voltar à segunda aba e abrir Fidelidade.

**Esperado**
O saldo mostrado na segunda aba inclui o ponto ganho na primeira. Apagar os dados em uma das abas apaga também na outra.

### CT18 Cancelamento de pedido

1. Concluir um pedido aprovado.
2. No canal Balcão, abrir o pedido e preencher o motivo em "Cancelar pedido".
3. Tocar em "Cancelar este pedido".

**Esperado**
O status vira "Cancelado", a trilha de progresso some, e o pedido sai do faturamento e da contagem de pedidos pagos no painel, entrando na lista de auditoria com o motivo.

### CT19 Ajuste manual

1. Concluir um pedido aprovado.
2. No canal Balcão, abrir o pedido e preencher "-5,00" e um motivo em "Ajuste manual".
3. Tocar em "Registrar ajuste".

**Esperado**
A tela do pedido mostra o ajuste e o total após o ajuste, o faturamento do painel reflete o total ajustado, e o pedido aparece na lista de auditoria com o motivo.

### CT20 Baixa de estoque pela venda

1. Escolher Raízes Centro e abrir o cardápio.
2. Conferir o aviso de últimas unidades na tapioca.
3. Comprar e pagar as unidades restantes.

**Esperado**
A tapioca sai do cardápio com "Sem estoque suficiente nesta unidade", e o painel da matriz mostra a unidade zerada na tabela de estoque.

### CT21 Unidade fechada e item fora do horário

1. Abrir a tela de unidades e conferir o selo "Aberta agora" ou "Fechada agora".
2. Escolher uma unidade fechada no horário do teste.
3. Abrir o cardápio.

**Esperado**
O cardápio avisa que a unidade está fechada e todos os itens ficam bloqueados. Dentro do horário, o café da manhã completo fica disponível antes das 11h e bloqueado depois.

### CT22 Campanha segmentada e anonimização

1. Criar o cadastro aceitando também as campanhas segmentadas.
2. Abrir a tela de fidelidade e conferir o segmento.
3. Entrar no painel da matriz.

**Esperado**
A fidelidade mostra faixa etária, frequência e faixa de pontos. O painel mostra o público por segmento, com contagem, sem nome nem telefone. Sem o aceite das campanhas, o público fica vazio.

### CT23 Auditoria de acessos ao painel

1. Abrir `/matriz` e digitar um código de operador errado.
2. Digitar o código correto.
3. Rolar até "Auditoria de acessos ao painel".

**Esperado**
As duas tentativas aparecem com data, hora e desfecho, a recusa e a concessão.

## Testes não funcionais

| Teste | Como | Critério |
| --- | --- | --- |
| Responsividade | DevTools em 320, 768 e 1440 px | Sem rolagem horizontal, sem texto cortado |
| Teclado | Percorrer a jornada só com Tab e Enter | Todo controle alcançável, foco sempre visível |
| Leitor de tela | VoiceOver na tela do pedido | Mudança de status é anunciada |
| Desempenho | Lighthouse no build de produção | Desempenho e acessibilidade acima de 90 |
| Privacidade | DevTools, aba Application | Nenhum dado pessoal gravado antes do consentimento |

## Riscos em horário de pico

| Risco | Efeito | Mitigação no protótipo |
| --- | --- | --- |
| Serviço de pagamento lento ou fora | Cliente paga duas vezes ou perde o pedido | Mesmo identificador e mesma chave de idempotência na nova tentativa, carrinho preservado |
| Cliente recarrega a página no meio do fluxo | Perde o pedido | Estado persistido no navegador |
| Item acaba com o cliente já no carrinho | Frustração no caixa | Disponibilidade reavaliada a cada exibição do cardápio e outra vez antes de cobrar |
| Duas abas abertas no mesmo balcão | Pedido de uma aba desaparece ou é duplicado | O identificador sorteado casa a mesma venda nas duas abas, e a que só existe de um lado entra |
| Cliente acumula ponto em um caixa e cobra no outro | Saldo da aba antiga sobrescreve o ganho | A aba adota o cadastro gravado ao lado quando ele é o mais novo, inclusive a exclusão de dados |
| Serviço de pagamento travado sem responder | Caixa preso na tela de processamento | Prazo de 15 segundos na cobrança devolve o desfecho de falha |
| Armazenamento cheio ou bloqueado | Tela branca no carregamento | Leitura e gravação protegidas, sessão segue em memória |
| Gravação recusada logo após a exclusão de dados | Dado pessoal antigo volta no próximo carregamento | A gravação recusada apaga o registro anterior |
| Fila no totem | Abandono | Alvos maiores e fluxo sem cadastro obrigatório |

## Evidências a anexar no PDF

1. Captura de cada tela, de unidades a painel.
2. Captura da tela de pagamento negado e da falha de comunicação.
3. Saída do `npm test` com os 98 casos passando.
4. Captura do Lighthouse.
5. Link da publicação e do repositório, com acesso público conferido.
