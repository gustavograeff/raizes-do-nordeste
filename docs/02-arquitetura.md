# Modelagem e arquitetura do front-end

## Stack e por quê

| Escolha | Razão |
| --- | --- |
| React 19 com TypeScript | Tipo no domínio pega erro de regra de negócio em tempo de build, não no caixa |
| Vite | Build estático, publicável em qualquer hospedagem de página, sem servidor |
| Tailwind CSS 4 | Estilo junto do componente, sem folha global crescendo sem dono |
| React Router com `HashRouter` | A publicação é estática e não reescreve rota no servidor |
| Vitest | Mesma configuração do Vite, sem segundo build só para teste |

Nada de biblioteca de estado global, formulário ou componente. `useState` e `useReducer` dão conta do estado da aplicação (`state.ts`, `store.tsx`), e cada dependência a mais é uma superfície a manter.

## Camadas

```
src/
  domain/     regras de negócio puras, sem React
  pages/      uma tela por rota
  state.ts    forma do estado e a fronteira que lê e grava o localStorage
  store.tsx   contexto React, ações e valores derivados
  App.tsx     casca, navegação e seleção de canal
```

O registro gravado é entrada não confiável. O arquivo `state.ts` confere o que a tela
desreferencia sem guarda, descarta linha de item que saiu do catálogo, corrige
canal que a unidade não opera mais e protege leitura e gravação, porque
armazenamento cheio ou bloqueado não pode virar tela branca.

A regra `domain` não importa nada de React. É essa separação que deixa a regra testável sem renderizar tela e reaproveitável se amanhã existir um app nativo.

## Fluxo do pedido

```
Unidades  ->  Cardápio  ->  Carrinho  ->  Pagamento  ->  Pedido
                                              |
                                              v
                                    serviço externo de pagamento
```

Estados do pedido.

```
aguardando_pagamento --aprovado--> confirmado -> em_preparo -> pronto -> entregue
          |
          +--negado--> pagamento_recusado
          |
          +--falha--> permanece aguardando_pagamento (nova tentativa com o mesmo identificador)
```

## Regra de disponibilidade

A disponibilidade é avaliada nesta ordem, e a ordem importa.

1. Unidade fechada no horário atual.
2. Estoque da unidade esgotado para o item.
3. Item junino fora de junho e julho.
4. Item fora da hora de serviço, como o café da manhã depois das 11h.
5. Item que exige cozinha completa em unidade reduzida.
6. Disponível.

A unidade fechada vem primeiro porque loja fechada não prepara nada, e falar de temporada ou de cozinha seria detalhe sem efeito. Estoque vem logo depois porque é a informação mais concreta para o cliente. Dizer "só no período junino" para um item que acabou hoje seria mentira.

O estoque sai das vendas, e não de um contador gravado à parte. Cada unidade declara em `stockOpened` o que abriu o dia com, o padrão da rede é 20 unidades por item, e `computeStockUsed` soma as linhas de todo pedido pago e não cancelado. Três efeitos vêm de graça dessa escolha.

- O cancelamento devolve o item ao cardápio, sem código de estorno.
- A fusão do histórico entre duas abas não conta a mesma venda duas vezes, porque o pedido tem identidade própria.
- A sacola é conferida contra o que resta, então três unidades de um item com duas em estoque não chegam ao caixa.

## Costura com o serviço de pagamento

A rede não processa pagamento. O front-end fala com uma porta chamada `PaymentGateway`, nomeada pela função e nunca pelo fornecedor.

```ts
type PaymentGateway = {
  charge: (request: PaymentRequest) => Promise<PaymentResult>;
};
```

- Nenhum tipo do fornecedor atravessa a porta. Cada implementação traduz para `PaymentResult`.
- A implementação é escolhida em `resolvePaymentGateway()` pela variável `VITE_PAYMENT_DRIVER`, no ponto de composição, nunca deduzida da presença de credencial.
- As telas chamam `requestCharge()`, que resolve a implementação na hora da cobrança e traduz qualquer erro do serviço externo para o desfecho `falha` do contrato. Configuração errada ou serviço fora derrubam a cobrança, nunca o aplicativo inteiro. A cobrança tem prazo de 15 segundos, então serviço travado devolve `falha` em vez de deixar o caixa esperando.
- Hoje existe uma implementação, `stubPaymentGateway`, que simula os três desfechos do contrato. Trocar por um adquirente real é criar um arquivo e mudar a variável, sem tocar em tela.

Credencial de pagamento nunca vive no front-end. A cobrança real deve sair de um serviço de back-end, e a tela apenas acompanha o resultado.

## Multicanal

O canal é um estado global e muda o comportamento da casca.

| Canal | Diferença |
| --- | --- |
| Aplicativo | Fluxo completo, com fidelidade |
| Totem | Alvos de toque de 48 px e tipografia maior, para uso em pé |
| Balcão | Atendente registra o pedido, cadastro segue opcional |
| Retirada rápida | Mesmo fluxo, entrega no balcão de retirada |

A lista de canais oferecidos vem da unidade. Uma loja sem totem não oferece a opção, e trocar de unidade mantém o canal atual só quando a nova unidade também o opera.

O painel da matriz consolida a rede inteira, então não pode abrir num totem de auto-atendimento. Sem login, o canal é o único sinal de papel disponível. O painel só existe no canal de balcão, operado por funcionário. Por isso o seletor de canal do cliente não oferece o balcão, e quem entra nele digita um código de operador na própria tela do painel.

Na rota do painel, `App.tsx` troca a casca do cliente (cardápio, carrinho, fidelidade, seletor de canal) por um cabeçalho de administrador, com só o nome da unidade e um botão para sair do painel. Mistura de tela de cliente com tela de gerente na mesma casca facilitaria o clique errado no meio de um turno.

## Auditoria de operações sensíveis

Ajuste manual só aparece na tela do pedido quando o canal é balcão, e exige motivo por texto (RF18). Cancelamento aparece em qualquer canal, enquanto o pedido não passa de `confirmado`. No balcão exige motivo, no cliente é só uma confirmação. As duas ações usam a mesma via genérica de atualização do pedido (`updateOrder`), sem ação de estado dedicada, porque o registro é só um patch de campos.

- Cancelar grava o status `cancelado`, `cancelReason` e `canceledAtIso`, e tira o pedido do faturamento mesmo que o pagamento tenha sido aprovado antes. `canCancelOrder()` bloqueia a partir de `em_preparo`, porque o preparo já começou.
- Ajustar grava `adjustmentCents` e `adjustmentReason`, sem apagar `totalCents`, que continua sendo o valor realmente cobrado do cliente. `getOrderTotal()` soma os dois na hora de mostrar ou consolidar.

O painel lista todo pedido cancelado ou ajustado, com unidade, motivo e data, porque é isso que a franqueadora audita. O código está no pacote entregue ao navegador, então evita o cliente que tropeça na tela e não protege o dado. O desbloqueio também não sobrevive ao recarregamento, porque a leitura do estado gravado recusa o canal de balcão e o operador digita o código de novo. Com autenticação, a restrição passa a ser por perfil do usuário, e a consolidação passa a ser calculada no servidor.

O cadastro de fidelidade não é oferecido no totem, pela mesma falta de sessão. A tela é compartilhada e o nome e o saldo do cliente anterior ficariam à vista do próximo da fila. O totem só oferece apagar um cadastro que tenha ficado ali.

## Escalabilidade e tolerância a falha

- Build estático servido por CDN, que é o que sustenta o horário de pico sem servidor de aplicação.
- Falha de pagamento não descarta o pedido nem o carrinho.
- Estado persistido no `localStorage`, então recarregar a página no meio do fluxo não perde o pedido, inclusive o pedido que ficou aguardando pagamento depois de uma falha.
- O identificador do pedido é sorteado na criação, com 48 bits de `crypto.getRandomValues`. Um contador derivado do histórico sairia igual em duas abas para vendas diferentes, e as duas ficariam em desacordo sobre qual venda é qual. O sorteio dispensa a coordenação que só um servidor daria, e a mesma venda fica com o mesmo número em toda aba.
- O mesmo identificador é a chave de idempotência da cobrança. Trocar a forma de pagamento depois de um tempo esgotado repete a chave, então o serviço externo devolve o desfecho da cobrança que já recebeu.
- A aprovação grava o pedido e o saldo de pontos numa operação só, então o consentimento é lido uma vez. Separadas, o crédito podia ser recusado e o pedido seguia prometendo o ponto que ninguém creditou.
- A fusão entre abas mantém o status mais adiantado da mesma venda, e a confirmação de pagamento vence a recusa, porque a aba que recebeu a aprovação viu o dinheiro entrar. Cancelamento vence qualquer estágio de preparo, porque é decisão manual do funcionário.
- O cadastro carrega o momento da própria alteração, e a fusão mantém o mais novo. Uma aba que perdeu um evento de armazenamento grava depois um cadastro velho, e sem esse carimbo apagaria o consentimento e o ponto recém-ganho.
- A retirada de consentimento vence mesmo sem ser o registro mais novo. A aba que creditou ponto logo depois da retirada tem carimbo maior, e sem essa exceção devolveria o consentimento já retirado.
- Gravação recusada por cota cheia tira o cadastro antes de tirar o histórico. A venda paga só existe no registro do navegador, e o dado pessoal é o que não pode ficar gravado sem finalidade.
- A sacola é reconferida contra a disponibilidade da unidade imediatamente antes de cobrar, porque entre desenhar o cardápio e pagar a data vira e o estoque muda.
- Catálogo fixo no bundle hoje. Ao integrar a API, a troca fica contida em `src/domain/catalog.ts`.

## Limites conhecidos do protótipo

| Limite | Quando deixa de servir |
| --- | --- |
| Catálogo e histórico fixos no código | Ao existir API de cardápio e de pedidos |
| Saldo de pontos lido do registro do navegador | Ao existir cadastro fora do aparelho, porque quem edita o armazenamento se dá a faixa ouro |
| Estado no `localStorage` | Ao existir sessão de verdade com login |
| Avanço de status por temporizador | Ao existir evento da cozinha, por WebSocket ou polling |
| Um único idioma e uma única moeda | Ao operar fora do Brasil |
| Duas alterações do cadastro no mesmo milissegundo deixam a local por cima | Ao existir cadastro no servidor, que passa a resolver o conflito |
| Prazo de cobrança devolve o controle à tela, sem cancelar a cobrança enviada | Ao existir adquirente real, que precisa receber o sinal de cancelamento |
| Papel deduzido do canal | Ao existir login, que traz perfil de usuário |
| Estoque contado só pelas vendas deste aparelho | Ao existir serviço de estoque, porque a venda feita em outro terminal não baixa aqui |
| Horário de funcionamento fixo no código, sem feriado nem exceção | Ao existir cadastro de calendário por unidade |
| Auditoria de acessos sem identificar a pessoa | Ao existir login, que diz qual funcionário entrou |
| Público de campanha limitado ao cadastro deste aparelho | Ao existir base de clientes no servidor, que é quem agrega a rede inteira |
