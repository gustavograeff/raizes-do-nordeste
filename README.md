# Raízes do Nordeste

Protótipo front-end de pedidos multicanal para a rede de lanchonetes do estudo de caso do Projeto Multidisciplinar, na trilha **front-end**.

O app roda inteiro no navegador, em React, TypeScript e Vite, com o estado no `localStorage` e sem back-end. As regras de negócio ficam em `src/domain/`, puras e cobertas por teste.

## O que ele faz

- Lista as unidades, cada uma com cozinha completa ou reduzida, canais próprios e horário próprio.
- Monta o cardápio por unidade, com estoque, sazonalidade junina e hora de serviço do item.
- Fecha o pedido pelo carrinho, com desconto de fidelidade e pontos a creditar.
- Simula o pagamento externo nos três desfechos, aprovado, negado e falha.
- Acompanha o status do pedido avançando sozinho, com anúncio para leitor de tela.
- Cadastra fidelidade com consentimento explícito, só para maior de idade, com retirada e exclusão de dados.
- Mostra o painel da matriz com vendas, metas, mais consumidos, estoque e auditoria de acessos.

## Rodar

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # 98 testes de regra de negócio e de leitura do estado gravado
npm run build   # gera dist/, pronto para publicar
```

## O que dá para testar

| Tela | Rota | O que demonstra |
| --- | --- | --- |
| Unidades | `/` | Cozinha completa contra reduzida, canais por loja, horário próprio e selo de aberta ou fechada |
| Cardápio | `/cardapio` | Disponibilidade por unidade, estoque restante, sazonalidade junina, hora de serviço do item, nota da receita regional, busca e filtro |
| Carrinho | `/carrinho` | Quantidades, desconto de fidelidade, pontos a creditar |
| Pagamento | `/checkout` | Serviço externo com simulação de aprovado, negado e falha |
| Pedido | `/pedido/:id` | Status avançando sozinho, com anúncio para leitor de tela |
| Fidelidade | `/fidelidade` | Consentimento explícito, cadastro só de maior de idade, faixas, retirada e exclusão de dados. Sem cadastro no totem |
| Painel da matriz | `/matriz` | Vendas por unidade, meta do mês, mais consumidos, descontos, recusas, estoque, público anonimizado das campanhas e auditoria de acessos. Só no canal de balcão |

O seletor "Canal" no topo troca entre aplicativo, totem e retirada rápida. No totem, os alvos de toque e a tipografia aumentam. O canal de balcão fica fora do seletor. Em `/matriz`, o código de operador (`VITE_STAFF_CODE`, por omissão `raizes-matriz`) passa o aparelho para esse canal e libera o painel.

Para ver o cardápio junino liberado fora de junho, mude o relógio do sistema ou ajuste `JUNINO_MONTHS` em `src/domain/catalog.ts`.

Cada unidade tem horário próprio, entre 6h e 22h conforme a loja, e o café da manhã completo sai do cardápio às 11h. Fora do horário o cardápio explica o motivo. Para testar a qualquer hora, ajuste `opensAtHour` e `closesAtHour` em `src/domain/catalog.ts` ou mude o relógio do sistema.

O estoque de cada unidade sai de `stockOpened`, com padrão de 20 unidades por item, e a venda paga dá baixa. O Centro abre com 6 tapiocas, então poucas compras mostram o item esgotando.

## Estrutura

```
src/
  domain/     regra de negócio pura, sem React, coberta por teste
  pages/      uma tela por rota
  state.ts    forma do estado e fronteira do localStorage
  store.tsx   contexto React, ações e valores derivados
  App.tsx     casca, navegação, seleção de canal
```

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [Requisitos](docs/01-requisitos.md) | Usuários, requisitos funcionais e não funcionais, ambiguidades resolvidas |
| [Arquitetura](docs/02-arquitetura.md) | Stack, camadas, fluxo do pedido, costura com o pagamento, limites |
| [Plano de testes](docs/03-plano-de-testes.md) | Casos automatizados, roteiro manual, testes não funcionais, riscos |
| [Documento de entrega](docs/entrega/entrega.pdf) | PDF único em ABNT, com capa, sumário, wireframes das 7 telas, conclusão e referências |
| [Documento de entrega editável](docs/entrega/entrega.docx) | Mesmo conteúdo em `.docx`, que abre como Documento Google ao ser arrastado para o Drive |
