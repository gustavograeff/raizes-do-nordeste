import { findProduct, getAvailability, getStockLeft } from './catalog';
import type { Availability, Product, StockUsed, Unit } from './catalog';

export type CartLine = {
  productId: string;
  quantity: number;
};

export type UnavailableLine = {
  product: Product;
  availability: Availability;
};

export type LoyaltyTier = 'nenhum' | 'bronze' | 'prata' | 'ouro';

export type CartTotals = {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  pointsEarned: number;
};

export const TIER_LABELS: Record<LoyaltyTier, string> = {
  nenhum: 'Sem programa de fidelidade',
  bronze: 'Bronze',
  prata: 'Prata',
  ouro: 'Ouro',
};

/** Desconto progressivo por faixa, em pontos percentuais sobre o subtotal. */
const TIER_DISCOUNT_PERCENT: Record<LoyaltyTier, number> = {
  nenhum: 0,
  bronze: 0,
  prata: 5,
  ouro: 10,
};

const PRATA_MIN_POINTS = 200;
const OURO_MIN_POINTS = 500;

/** Um ponto a cada real gasto, contado sobre o valor efetivamente pago. */
const CENTS_PER_POINT = 100;

const PERCENT_FACTOR = 100;

/**
 * Teto por item da sacola. Existe para um clique preso no botão de somar não
 * gerar um pedido que a cozinha não consegue produzir.
 */
export const MAX_LINE_QUANTITY = 99;

export function getTier(points: number, hasConsent: boolean): LoyaltyTier {
  if (!hasConsent) {
    return 'nenhum';
  }

  if (points >= OURO_MIN_POINTS) {
    return 'ouro';
  }

  if (points >= PRATA_MIN_POINTS) {
    return 'prata';
  }

  return 'bronze';
}

export function getDiscountPercent(tier: LoyaltyTier): number {
  return TIER_DISCOUNT_PERCENT[tier];
}

export function computeTotals(lines: CartLine[], tier: LoyaltyTier): CartTotals {
  const subtotalCents = lines.reduce((sum, line) => {
    const product = findProduct(line.productId);

    if (product === undefined) {
      return sum;
    }

    return sum + product.priceCents * line.quantity;
  }, 0);

  const discountCents = Math.round((subtotalCents * getDiscountPercent(tier)) / PERCENT_FACTOR);
  const totalCents = subtotalCents - discountCents;

  // RF15: sem consentimento não existe saldo, então a tela não pode prometer ponto
  // que o crédito vai recusar depois.
  const pointsEarned = tier === 'nenhum' ? 0 : Math.floor(totalCents / CENTS_PER_POINT);

  return { subtotalCents, discountCents, totalCents, pointsEarned };
}

export function changeQuantity(lines: CartLine[], productId: string, delta: number): CartLine[] {
  const updated = lines.map((line) => {
    if (line.productId !== productId) {
      return line;
    }

    return { ...line, quantity: Math.min(line.quantity + delta, MAX_LINE_QUANTITY) };
  });

  return updated.filter((line) => line.quantity > 0);
}

export function addLine(lines: CartLine[], productId: string): CartLine[] {
  const existing = lines.find((line) => line.productId === productId);

  if (existing === undefined) {
    return [...lines, { productId, quantity: 1 }];
  }

  return changeQuantity(lines, productId, 1);
}

/**
 * Reavalia a sacola inteira. Entre o desenho do cardápio e o pagamento a data, o
 * estoque e a unidade mudam. A quantidade entra na conta, porque o estoque restante
 * pode cobrir um item e não os três da sacola.
 */
export function findUnavailableLines(
  lines: CartLine[],
  unit: Unit,
  date: Date,
  stockUsed: StockUsed,
): UnavailableLine[] {
  const blocked: UnavailableLine[] = [];

  for (const line of lines) {
    const product = findProduct(line.productId);

    if (product === undefined) {
      continue;
    }

    const stockLeft = getStockLeft(unit, line.productId, stockUsed);
    const availability: Availability =
      line.quantity > stockLeft ? 'sem_estoque' : getAvailability(product, unit, date, stockUsed);

    if (availability === 'disponivel') {
      continue;
    }

    blocked.push({ product, availability });
  }

  return blocked;
}

export function countItems(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

function sortedByProduct(lines: CartLine[]): CartLine[] {
  return [...lines].sort((left, right) => left.productId.localeCompare(right.productId));
}

/**
 * Mesmos itens e quantidades, em qualquer ordem. Remover e recolocar um item muda a
 * posição da linha, e não a compra. É o critério de identidade de sacola no sistema.
 */
export function hasSameLineSet(left: CartLine[], right: CartLine[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = sortedByProduct(left);
  const sortedRight = sortedByProduct(right);

  return sortedLeft.every((line, index) => {
    return line.productId === sortedRight[index].productId && line.quantity === sortedRight[index].quantity;
  });
}
