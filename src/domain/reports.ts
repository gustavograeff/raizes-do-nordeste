import { UNITS, findUnit, getUnitRegion } from './catalog';
import type { Unit } from './catalog';
import { getOrderTotal, isInMonth } from './order';
import type { Order } from './order';
import type { PaymentMethod } from './payment';

/** Consolidação que a matriz lê. Recebe só pedido pago, porque cancelado não fatura. */
export type UnitRevenue = {
  unit: Unit;
  orderCount: number;
  revenueCents: number;
  monthRevenueCents: number;
  goalPercent: number;
};

export type TopProduct = {
  productId: string;
  quantity: number;
};

const PERCENT_FACTOR = 100;

const TOP_PRODUCTS_LIMIT = 5;

function toPercent(part: number, whole: number): number {
  if (whole === 0) {
    return 0;
  }

  return Math.round((part / whole) * PERCENT_FACTOR);
}

/** Faturamento total e do mês corrente por unidade, com o quanto o mês cobre da meta. */
export function getRevenueByUnit(paidOrders: Order[], today: Date): UnitRevenue[] {
  return UNITS.map((unit) => {
    const unitOrders = paidOrders.filter((order) => order.unitId === unit.id);
    const revenueCents = unitOrders.reduce((sum, order) => sum + getOrderTotal(order), 0);
    // A meta é mensal, então só a venda do mês corrente entra na medida de desempenho.
    const monthRevenueCents = unitOrders
      .filter((order) => isInMonth(order, today))
      .reduce((sum, order) => sum + getOrderTotal(order), 0);

    return {
      unit,
      orderCount: unitOrders.length,
      revenueCents,
      monthRevenueCents,
      goalPercent: toPercent(monthRevenueCents, unit.monthlyRevenueGoalCents),
    };
  });
}

/** Pedido de unidade que saiu do catálogo fica fora, porque não tem região a somar. */
export function getRevenueByRegion(paidOrders: Order[]): Map<string, number> {
  const revenueByRegion = new Map<string, number>();

  for (const order of paidOrders) {
    const unit = findUnit(order.unitId);

    if (unit === undefined) {
      continue;
    }

    const region = getUnitRegion(unit);

    revenueByRegion.set(region, (revenueByRegion.get(region) ?? 0) + getOrderTotal(order));
  }

  return revenueByRegion;
}

export function getRevenueByPaymentMethod(paidOrders: Order[]): Map<PaymentMethod, number> {
  const revenueByMethod = new Map<PaymentMethod, number>();

  for (const order of paidOrders) {
    const current = revenueByMethod.get(order.paymentMethod) ?? 0;

    revenueByMethod.set(order.paymentMethod, current + getOrderTotal(order));
  }

  return revenueByMethod;
}

/** Itens mais vendidos, somados por produto ao longo de todos os pedidos pagos. */
export function getTopProducts(paidOrders: Order[]): TopProduct[] {
  const quantityByProduct = new Map<string, number>();

  for (const order of paidOrders) {
    for (const line of order.lines) {
      const current = quantityByProduct.get(line.productId) ?? 0;

      quantityByProduct.set(line.productId, current + line.quantity);
    }
  }

  return [...quantityByProduct.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, TOP_PRODUCTS_LIMIT)
    .map(([productId, quantity]) => ({ productId, quantity }));
}
