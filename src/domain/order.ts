import { hasSameLineSet } from './cart';
import type { CartLine } from './cart';
import { addStockUsed } from './catalog';
import type { Channel, StockUsed } from './catalog';
import type { PaymentMethod, PaymentStatus } from './payment';

export type OrderStatus =
  | 'aguardando_pagamento'
  | 'pagamento_recusado'
  | 'confirmado'
  | 'em_preparo'
  | 'pronto'
  | 'entregue'
  | 'cancelado';

export type Order = {
  /**
   * Identidade da venda, sorteada na criação. Vale entre abas e no serviço de
   * pagamento, então a fusão do histórico e a chave de idempotência da cobrança
   * casam por aqui.
   */
  id: string;
  unitId: string;
  channel: Channel;
  lines: CartLine[];
  totalCents: number;
  discountCents: number;
  pointsEarned: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus | 'pendente';
  paymentExternalId?: string;
  status: OrderStatus;
  createdAtIso: string;
  /** Motivo do cancelamento, exigido pela auditoria de operações sensíveis. */
  cancelReason?: string;
  canceledAtIso?: string;
  /**
   * Correção manual do total, feita pelo funcionário depois da cobrança (ex.: cortesia por
   * reclamação). Fica separada do total cobrado para a auditoria mostrar os dois valores.
   */
  adjustmentCents?: number;
  adjustmentReason?: string;
};

/** O que a tela do caixa manda cobrar. O identificador e o desfecho vêm depois. */
export type OrderCharge = Pick<
  Order,
  'unitId' | 'channel' | 'lines' | 'totalCents' | 'discountCents' | 'pointsEarned' | 'paymentMethod'
>;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  aguardando_pagamento: 'Aguardando pagamento',
  pagamento_recusado: 'Pagamento recusado',
  confirmado: 'Pedido confirmado',
  em_preparo: 'Em preparo',
  pronto: 'Pronto para retirada',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

/** Pedido só cancela antes de ir para a cozinha. Depois disso o preparo já começou. */
const CANCELABLE_STATUSES: readonly OrderStatus[] = ['aguardando_pagamento', 'pagamento_recusado', 'confirmado'];

export function canCancelOrder(order: Order): boolean {
  return CANCELABLE_STATUSES.includes(order.status);
}

/** Total após o ajuste manual, quando existir. É o valor que a matriz concilia. */
export function getOrderTotal(order: Order): number {
  return order.totalCents + (order.adjustmentCents ?? 0);
}

/** Trilha feliz do pedido. Recusa de pagamento sai desta sequência e encerra. */
export const ORDER_PROGRESS_STEPS: readonly OrderStatus[] = [
  'confirmado',
  'em_preparo',
  'pronto',
  'entregue',
];

export function getNextStatus(status: OrderStatus): OrderStatus {
  const position = ORDER_PROGRESS_STEPS.indexOf(status);

  if (position === -1 || position === ORDER_PROGRESS_STEPS.length - 1) {
    return status;
  }

  return ORDER_PROGRESS_STEPS[position + 1];
}

/**
 * Pedido aguardando pagamento desta mesma cobrança, para a nova tentativa reaproveitar
 * o registro em vez de duplicar a venda. Forma de pagamento, total e ordem das linhas
 * ficam fora da comparação, porque não criam outra compra. Outra sacola recebe número
 * próprio, e a tentativa abandonada continua na auditoria.
 */
export function findRetriableOrder(orders: Order[], charge: OrderCharge): Order | undefined {
  return orders.find((order) => {
    return (
      order.status === 'aguardando_pagamento' &&
      order.unitId === charge.unitId &&
      order.channel === charge.channel &&
      hasSameLineSet(order.lines, charge.lines)
    );
  });
}

const ORDER_ID_PREFIX = 'RN-';

/** 48 bits sorteados. Colisão só apareceria muito além do que o navegador guarda. */
const ORDER_ID_BYTES = 6;

/**
 * Identificador sorteado, e não um contador, que sairia igual em duas abas para vendas
 * diferentes. `crypto.getRandomValues` vale fora de contexto seguro, diferente de
 * `crypto.randomUUID`, então o totem servido por http continua abrindo pedido.
 */
export function newOrderId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ORDER_ID_BYTES));
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

  return `${ORDER_ID_PREFIX}${hex.toUpperCase()}`;
}

/** Venda que entra no faturamento e baixa o estoque. Cancelada sai, mesmo já paga. */
export function isPaidOrder(order: Order): boolean {
  return order.paymentStatus === 'aprovado' && order.status !== 'cancelado';
}

/**
 * Baixa de estoque das vendas pagas, por unidade e por item. Sai dos pedidos, e não de
 * um contador à parte, então a fusão entre abas e o cancelamento já saem certos.
 */
export function computeStockUsed(orders: Order[]): StockUsed {
  let stockUsed: StockUsed = {};

  for (const order of orders) {
    if (!isPaidOrder(order)) {
      continue;
    }

    stockUsed = addStockUsed(stockUsed, order.unitId, order.lines);
  }

  return stockUsed;
}

/** Pedido do mês de referência, que é o recorte da meta mensal de cada unidade. */
export function isInMonth(order: Order, reference: Date): boolean {
  const created = new Date(order.createdAtIso);

  return (
    created.getFullYear() === reference.getFullYear() && created.getMonth() === reference.getMonth()
  );
}

/**
 * Data do histórico semeado, sempre no mês corrente, para a meta mensal ter o que
 * comparar em qualquer mês. O dia nunca passa de hoje, senão haveria venda no futuro.
 */
function seededIso(day: number, hour: number, minute: number): string {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), Math.min(day, now.getDate()), hour, minute).toISOString();
}

/**
 * Histórico usado para a matriz ter o que consolidar já na primeira execução.
 * Dados fixos no pacote, porque o protótipo não tem serviço de
 * relatórios. A matriz consolida só o que este aparelho gravou.
 */
export const SEEDED_ORDERS: Order[] = [
  {
    id: 'RN-A1B2C3D4E5F6',
    unitId: 'recife-boa-viagem',
    channel: 'totem',
    lines: [
      { productId: 'cuscuz-carne-sol', quantity: 2 },
      { productId: 'cafe-coado', quantity: 2 },
    ],
    totalCents: 5960,
    discountCents: 0,
    pointsEarned: 59,
    paymentMethod: 'credito',
    paymentStatus: 'aprovado',
    status: 'entregue',
    createdAtIso: seededIso(14, 8, 20),
  },
  {
    id: 'RN-B2C3D4E5F6A1',
    unitId: 'recife-centro',
    channel: 'balcao',
    lines: [{ productId: 'tapioca-queijo', quantity: 3 }],
    totalCents: 4470,
    discountCents: 0,
    pointsEarned: 44,
    paymentMethod: 'pix',
    paymentStatus: 'aprovado',
    status: 'entregue',
    createdAtIso: seededIso(14, 10, 5),
  },
  {
    id: 'RN-C3D4E5F6A1B2',
    unitId: 'caruaru-shopping',
    channel: 'app',
    lines: [
      { productId: 'cafe-manha-completo', quantity: 1 },
      { productId: 'suco-caja', quantity: 1 },
    ],
    totalCents: 4351,
    discountCents: 229,
    pointsEarned: 43,
    paymentMethod: 'pix',
    paymentStatus: 'aprovado',
    status: 'entregue',
    createdAtIso: seededIso(15, 9, 40),
  },
  {
    id: 'RN-D4E5F6A1B2C3',
    unitId: 'fortaleza-aldeota',
    channel: 'pickup',
    lines: [{ productId: 'suco-caja', quantity: 2 }],
    totalCents: 2180,
    discountCents: 0,
    pointsEarned: 21,
    paymentMethod: 'debito',
    paymentStatus: 'negado',
    status: 'pagamento_recusado',
    createdAtIso: seededIso(15, 10, 12),
  },
];
