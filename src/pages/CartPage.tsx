import { TIER_LABELS, computeTotals, getDiscountPercent } from '../domain/cart';
import { findProduct, findUnit, formatPrice, getAvailability, getStockLeft } from '../domain/catalog';
import { useStore } from '../store';
import { useToday } from '../useToday';
import { Button, Card, LinkButton, PageHeader } from '../components/ui';

export function CartPage() {
  const { unitId, lines, tier, changeProductQuantity, clearCart, stockUsed } = useStore();
  const unit = findUnit(unitId);
  const today = useToday();
  const totals = computeTotals(lines, tier);
  const discountPercent = getDiscountPercent(tier);

  if (lines.length === 0) {
    return (
      <section>
        <PageHeader title="Carrinho" />
        <p className="mt-2 text-stone-600">Seu carrinho está vazio.</p>
        <LinkButton to="/cardapio" className="mt-4">
          Ir para o cardápio
        </LinkButton>
      </section>
    );
  }

  return (
    <section>
      <PageHeader title="Carrinho" />

      <ul className="mt-4 divide-y divide-palha rounded-2xl border border-palha bg-white shadow-sm">
        {lines.map((line) => {
          const product = findProduct(line.productId);

          if (product === undefined) {
            return null;
          }

          // RF05 vale acima de qualquer outra regra, então somar mais uma unidade confere de novo,
          // inclusive contra o que resta no estoque da unidade.
          const canIncrement =
            unit !== undefined &&
            getAvailability(product, unit, today, stockUsed) === 'disponivel' &&
            line.quantity < getStockLeft(unit, line.productId, stockUsed);

          return (
            <li key={line.productId} className="flex items-center gap-3 p-4">
              <span
                aria-hidden="true"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-areia text-2xl"
              >
                {product.emoji}
              </span>

              <div className="flex-1">
                <p className="font-bold text-barro-escuro">{product.name}</p>
                <p className="text-sm text-stone-600">{formatPrice(product.priceCents)} cada</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label={`Remover uma unidade de ${product.name}`}
                  onClick={() => changeProductQuantity(line.productId, -1)}
                  className="h-9 w-9 rounded-full border border-palha text-lg font-bold text-barro-escuro shadow-sm transition hover:border-barro hover:bg-areia"
                >
                  −
                </button>
                <span aria-live="polite" className="w-6 text-center font-semibold">
                  {line.quantity}
                </span>
                <button
                  type="button"
                  aria-label={`Adicionar uma unidade de ${product.name}`}
                  onClick={() => changeProductQuantity(line.productId, 1)}
                  disabled={!canIncrement}
                  className="h-9 w-9 rounded-full border border-palha text-lg font-bold text-barro-escuro shadow-sm transition hover:border-barro hover:bg-areia disabled:cursor-not-allowed disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <Card className="mt-4 space-y-1">
        <dl className="space-y-1">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatPrice(totals.subtotalCents)}</dd>
          </div>
          <div className="flex justify-between text-folha">
            <dt>
              Desconto fidelidade ({TIER_LABELS[tier]}
              {discountPercent > 0 ? `, ${discountPercent}%` : ''})
            </dt>
            <dd>− {formatPrice(totals.discountCents)}</dd>
          </div>
          <div className="flex justify-between border-t border-palha pt-2 text-lg font-bold text-barro-escuro">
            <dt>Total</dt>
            <dd>{formatPrice(totals.totalCents)}</dd>
          </div>
          <div className="flex justify-between text-sm text-stone-600">
            <dt>Pontos a creditar</dt>
            <dd className="font-semibold text-milho">{totals.pointsEarned}</dd>
          </div>
        </dl>
      </Card>

      <div className="mt-4 flex flex-wrap gap-3">
        <LinkButton to="/checkout">Ir para o pagamento</LinkButton>
        <Button type="button" variant="secondary" onClick={clearCart}>
          Esvaziar carrinho
        </Button>
      </div>
    </section>
  );
}
