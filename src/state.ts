import { MAX_LINE_QUANTITY } from './domain/cart';
import type { CartLine } from './domain/cart';
import {
  CHANNEL_LABELS,
  STAFF_CHANNEL,
  UNITS,
  findCustomerChannel,
  findProduct,
  findUnit,
} from './domain/catalog';
import type { Channel, Unit } from './domain/catalog';
import type { CustomerIdentity } from './domain/customer';
import { ORDER_STATUS_LABELS, SEEDED_ORDERS } from './domain/order';
import type { Order, OrderStatus } from './domain/order';
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from './domain/payment';

export type Customer = CustomerIdentity & {
  points: number;
  /** Consentimento explícito para o programa de fidelidade, exigido pela LGPD. */
  hasConsent: boolean;
  consentAtIso?: string;
  /** Aceite separado, porque campanha segmentada é finalidade distinta. */
  acceptsSegmentedCampaigns: boolean;
  /**
   * Última alteração do cadastro. A fusão entre abas mantém o cadastro mais novo, e
   * não o da gravação mais recente. Vazio perde de qualquer outro.
   */
  updatedAtIso: string;
};

/**
 * Tentativa de entrar no painel, guardada para a auditoria. Sem login não existe quem
 * identificar, e a matriz precisa saber quando alguém tentou e se conseguiu.
 */
export type AccessEntry = {
  atIso: string;
  outcome: 'concedido' | 'negado';
};

export type StoreState = {
  unitId: string;
  channel: Channel;
  lines: CartLine[];
  customer: Customer;
  orders: Order[];
  accessLog: AccessEntry[];
};

/** Teto do registro de acessos, para o armazenamento do navegador não crescer sem fim. */
export const MAX_ACCESS_ENTRIES = 50;

export const EMPTY_CUSTOMER: Customer = {
  name: '',
  phone: '',
  birthDateIso: '',
  points: 0,
  hasConsent: false,
  acceptsSegmentedCampaigns: false,
  updatedAtIso: '',
};

export const INITIAL_STATE: StoreState = {
  unitId: UNITS[0].id,
  channel: 'app',
  lines: [],
  customer: EMPTY_CUSTOMER,
  orders: SEEDED_ORDERS,
  accessLog: [],
};

/**
 * A versão faz parte da chave. Mudar o formato do estado descarta o que está
 * gravado, em vez de misturar campo novo com registro antigo.
 */
export const STORAGE_KEY = 'raizes-do-nordeste:state:6';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Número que dá para somar e mostrar. `1e999` no registro gravado volta do JSON
 * como Infinity, passa por `typeof` e chega à tela como "R$ Infinity".
 */
function isRealNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Valor de dinheiro e contagem de ponto. Negativo subtrairia do faturamento da matriz. */
function isNonNegativeNumber(value: unknown): value is number {
  return isRealNumber(value) && value >= 0;
}

/** Quantidade que a cozinha consegue produzir. Fracionada apareceria como "2.5x" na tela. */
function isLineQuantity(value: unknown): value is number {
  return isRealNumber(value) && Number.isInteger(value) && value >= 1 && value <= MAX_LINE_QUANTITY;
}

function parseLines(value: unknown): CartLine[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const parsed: CartLine[] = [];
  const takenProductIds = new Set<string>();

  for (const entry of value) {
    if (
      !isRecord(entry) ||
      typeof entry.productId !== 'string' ||
      !isRealNumber(entry.quantity) ||
      entry.quantity < 1
    ) {
      continue;
    }

    // Item saído do catálogo depois da gravação. A sacola não conseguiria mais removê-lo.
    if (findProduct(entry.productId) === undefined) {
      continue;
    }

    // `addLine` e `changeQuantity` mexem em toda linha do produto, então duas linhas
    // do mesmo item somariam duas vezes no total e mudariam juntas nos botões.
    if (takenProductIds.has(entry.productId)) {
      continue;
    }

    takenProductIds.add(entry.productId);
    parsed.push({
      productId: entry.productId,
      quantity: Math.min(Math.trunc(entry.quantity), MAX_LINE_QUANTITY),
    });
  }

  return parsed;
}

/**
 * O saldo vem do registro do aparelho, então quem editar o
 * armazenamento se dá a faixa ouro. A conferência trata o campo como entrada não
 * confiável. O servidor de fidelidade vira a fonte do saldo quando existir.
 */
function parseCustomer(value: unknown): Customer {
  if (!isRecord(value)) {
    return EMPTY_CUSTOMER;
  }

  return {
    name: typeof value.name === 'string' ? value.name : '',
    phone: typeof value.phone === 'string' ? value.phone : '',
    birthDateIso: typeof value.birthDateIso === 'string' ? value.birthDateIso : '',
    points: isNonNegativeNumber(value.points) ? Math.trunc(value.points) : 0,
    hasConsent: value.hasConsent === true,
    consentAtIso: typeof value.consentAtIso === 'string' ? value.consentAtIso : undefined,
    acceptsSegmentedCampaigns: value.acceptsSegmentedCampaigns === true,
    updatedAtIso: typeof value.updatedAtIso === 'string' ? value.updatedAtIso : '',
  };
}

function isAccessEntry(value: unknown): value is AccessEntry {
  return (
    isRecord(value) &&
    typeof value.atIso === 'string' &&
    (value.outcome === 'concedido' || value.outcome === 'negado')
  );
}

function parseAccessLog(value: unknown): AccessEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isAccessEntry).slice(-MAX_ACCESS_ENTRIES);
}

function isOrderLine(value: unknown): value is CartLine {
  return isRecord(value) && typeof value.productId === 'string' && isLineQuantity(value.quantity);
}

/**
 * Confere todo campo que a tela lê sem guarda. Um total ausente viraria "R$ NaN",
 * e um desfecho de pagamento desconhecido sairia do faturamento e da contagem de
 * recusas ao mesmo tempo. Venda sem item não existe, então pedido sem linha sai.
 */
function isOrder(value: unknown): value is Order {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.unitId === 'string' &&
    typeof value.createdAtIso === 'string' &&
    isNonNegativeNumber(value.totalCents) &&
    isNonNegativeNumber(value.discountCents) &&
    isNonNegativeNumber(value.pointsEarned) &&
    typeof value.paymentStatus === 'string' &&
    (value.paymentStatus === 'pendente' || Object.hasOwn(PAYMENT_STATUS_LABELS, value.paymentStatus)) &&
    typeof value.status === 'string' &&
    Object.hasOwn(ORDER_STATUS_LABELS, value.status) &&
    typeof value.channel === 'string' &&
    Object.hasOwn(CHANNEL_LABELS, value.channel) &&
    typeof value.paymentMethod === 'string' &&
    Object.hasOwn(PAYMENT_METHOD_LABELS, value.paymentMethod) &&
    (value.paymentExternalId === undefined || typeof value.paymentExternalId === 'string') &&
    (value.cancelReason === undefined || typeof value.cancelReason === 'string') &&
    (value.canceledAtIso === undefined || typeof value.canceledAtIso === 'string') &&
    (value.adjustmentCents === undefined || isRealNumber(value.adjustmentCents)) &&
    (value.adjustmentReason === undefined || typeof value.adjustmentReason === 'string') &&
    Array.isArray(value.lines) &&
    value.lines.length > 0 &&
    value.lines.every(isOrderLine)
  );
}

/**
 * Canal que a aba assume ao carregar, porque a unidade gravada pode ter deixado de
 * operar o canal gravado. O balcão nunca volta, porque libera o painel e RF17 exige
 * código de operador. Devolve undefined quando a unidade só opera o balcão.
 */
function parseChannel(unit: Unit, value: unknown): Channel | undefined {
  const stored = unit.channels.find((candidate) => candidate === value);

  if (stored !== undefined && stored !== STAFF_CHANNEL) {
    return stored;
  }

  return findCustomerChannel(unit);
}

export function parseState(raw: string): StoreState {
  const stored: unknown = JSON.parse(raw);

  if (!isRecord(stored)) {
    return INITIAL_STATE;
  }

  const unit = typeof stored.unitId === 'string' ? findUnit(stored.unitId) : undefined;

  if (unit === undefined) {
    return INITIAL_STATE;
  }

  const channel = parseChannel(unit, stored.channel);

  if (channel === undefined) {
    return INITIAL_STATE;
  }

  return {
    unitId: unit.id,
    channel,
    lines: parseLines(stored.lines),
    customer: parseCustomer(stored.customer),
    orders: Array.isArray(stored.orders) ? stored.orders.filter(isOrder) : INITIAL_STATE.orders,
    accessLog: parseAccessLog(stored.accessLog),
  };
}

export function readStoredState(): StoreState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (raw === null) {
      return INITIAL_STATE;
    }

    return parseState(raw);
  } catch {
    // Armazenamento bloqueado pelo navegador ou registro ilegível. Começa limpo.
    return INITIAL_STATE;
  }
}

/**
 * Apaga o registro anterior. Sem isso, "excluir meus dados" deixaria nome e
 * telefone no aparelho e o próximo carregamento os traria de volta.
 */
function clearStoredState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Armazenamento bloqueado pelo navegador. Não há registro a apagar.
  }
}

export function writeState(state: StoreState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    return;
  } catch {
    // Cota cheia ou modo privado. O cadastro sai primeiro, porque a venda paga só
    // existe aqui. O carimbo vazio perde de qualquer outro, então a outra aba não
    // toma o registro reduzido por exclusão de dados.
  }

  try {
    const withoutCustomer: StoreState = { ...state, customer: EMPTY_CUSTOMER };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(withoutCustomer));
  } catch {
    // Nem o registro reduzido cabe. A sessão continua valendo em memória.
    clearStoredState();
  }
}

/**
 * Aprovação gravada no pedido e no saldo de uma vez, senão o pedido prometeria um ponto
 * que ninguém creditou. RF15: sem consentimento não existe saldo a creditar, e o pedido
 * também não registra ponto ganho.
 */
export function applyApprovedPayment(
  state: StoreState,
  orderId: string,
  paymentExternalId: string | undefined,
): StoreState {
  const charged = state.orders.find((order) => order.id === orderId);

  if (charged === undefined) {
    return state;
  }

  const pointsEarned = state.customer.hasConsent ? charged.pointsEarned : 0;
  const orders = state.orders.map((order) => {
    if (order.id !== orderId) {
      return order;
    }

    return {
      ...order,
      paymentStatus: 'aprovado' as const,
      status: 'confirmado' as const,
      paymentExternalId,
      pointsEarned,
    };
  });

  if (pointsEarned === 0) {
    return { ...state, orders };
  }

  const points = state.customer.points + pointsEarned;

  return {
    ...state,
    orders,
    customer: { ...state.customer, points, updatedAtIso: new Date().toISOString() },
  };
}

/**
 * Cancelamento gravado no pedido e no saldo de uma vez, senão o cliente manteria o ponto
 * de uma venda que não aconteceu. Só a venda aprovada creditou ponto. O saldo para em
 * zero, porque o cliente pode ter trocado de cadastro depois do crédito.
 */
export function applyCancellation(state: StoreState, orderId: string, reason: string): StoreState {
  const canceled = state.orders.find((order) => order.id === orderId);

  if (canceled === undefined || canceled.status === 'cancelado') {
    return state;
  }

  const nowIso = new Date().toISOString();
  const orders = state.orders.map((order) => {
    if (order.id !== orderId) {
      return order;
    }

    return { ...order, status: 'cancelado' as const, cancelReason: reason, canceledAtIso: nowIso };
  });

  if (canceled.paymentStatus !== 'aprovado' || canceled.pointsEarned === 0) {
    return { ...state, orders };
  }

  const points = Math.max(0, state.customer.points - canceled.pointsEarned);

  return {
    ...state,
    orders,
    customer: { ...state.customer, points, updatedAtIso: nowIso },
  };
}

/**
 * Progresso do desfecho, para a venda registrada nas duas abas ficar com o status mais
 * adiantado. Recusa fica adiante de "aguardando", porque encerra a tentativa, e atrás de
 * "confirmado", porque a aba que aprovou viu o dinheiro entrar. Cada status tem posto
 * próprio, senão o empate deixaria as abas em desacordo para sempre.
 */
const STATUS_RANK: Record<OrderStatus, number> = {
  aguardando_pagamento: 0,
  pagamento_recusado: 1,
  confirmado: 2,
  em_preparo: 3,
  pronto: 4,
  entregue: 5,
  // Cancelamento é decisão manual do funcionário, e vence qualquer estágio de preparo
  // que a outra aba tenha avançado antes de a decisão chegar até ela.
  cancelado: 6,
};

/**
 * Incorpora o histórico de outra aba. O identificador é sorteado, então a venda que
 * aparece nas duas é a mesma, e fica com o status mais adiantado. A que só existe de um
 * lado entra.
 */
export function mergeOrders(local: Order[], remote: Order[]): Order[] {
  const merged = [...local];

  for (const order of remote) {
    const sameIndex = merged.findIndex((candidate) => candidate.id === order.id);

    if (sameIndex === -1) {
      merged.push(order);

      continue;
    }

    if (STATUS_RANK[order.status] > STATUS_RANK[merged[sameIndex].status]) {
      merged[sameIndex] = order;
    }
  }

  return merged;
}

/**
 * União dos registros de acesso das duas abas, do mais antigo ao mais novo. A tentativa
 * feita em um balcão não pode sumir da auditoria porque outra aba gravou depois.
 */
export function mergeAccessLog(local: AccessEntry[], stored: AccessEntry[]): AccessEntry[] {
  const seen = new Set<string>();
  const merged: AccessEntry[] = [];

  for (const entry of [...local, ...stored]) {
    const key = `${entry.atIso}:${entry.outcome}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(entry);
  }

  return merged.sort((left, right) => left.atIso.localeCompare(right.atIso)).slice(-MAX_ACCESS_ENTRIES);
}

/** Entrada trocada por uma vinda da outra aba conta como mudança, mesmo sem alterar o tamanho. */
function ordersChanged(before: Order[], after: Order[]): boolean {
  return before.length !== after.length || before.some((order, index) => order !== after[index]);
}

/**
 * Cadastro que vale depois da gravação de outra aba. Vence o carimbo mais novo, menos
 * quando a outra aba retirou o consentimento depois do aceite daqui. Sem a exceção, a
 * aba que creditou ponto logo depois da retirada devolveria o consentimento.
 */
function pickCustomer(current: Customer, stored: Customer): Customer {
  const consentAtIso = current.consentAtIso ?? '';
  const isRevokedAfterConsent =
    current.hasConsent && !stored.hasConsent && consentAtIso < stored.updatedAtIso;

  if (isRevokedAfterConsent) {
    return stored;
  }

  if (stored.updatedAtIso > current.updatedAtIso) {
    return stored;
  }

  return current;
}

/**
 * Estado desta aba depois de outra aba gravar. O histórico é a união, porque nenhuma
 * venda pode desaparecer. O cadastro vale pelo carimbo da alteração, e não pela ordem
 * das gravações, senão a aba que perdeu um evento gravaria um cadastro velho por cima.
 * Sacola, unidade e canal ficam por aba, porque são o que o operador está montando.
 * Empate de milissegundo deixa a local por cima. O relógio do aparelho é o
 * único critério para ordenar as gravações.
 */
export function adoptStoredState(current: StoreState, stored: StoreState): StoreState {
  const orders = mergeOrders(current.orders, stored.orders);
  const customer = pickCustomer(current.customer, stored.customer);
  const accessLog = mergeAccessLog(current.accessLog, stored.accessLog);
  const hasNewAccess =
    accessLog.length !== current.accessLog.length ||
    accessLog.at(-1)?.atIso !== current.accessLog.at(-1)?.atIso;

  if (!ordersChanged(current.orders, orders) && customer === current.customer && !hasNewAccess) {
    return current;
  }

  return { ...current, orders, customer, accessLog };
}
