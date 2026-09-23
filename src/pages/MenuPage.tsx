import { useState } from 'react';
import {
  AVAILABILITY_LABELS,
  PRODUCTS,
  findUnit,
  foldAccents,
  formatPrice,
  getAvailability,
  getStockLeft,
  getUnitRegion,
  isUnitOpen,
} from '../domain/catalog';
import type { Product } from '../domain/catalog';
import { countItems } from '../domain/cart';
import { useStore } from '../store';
import { useToday } from '../useToday';
import { LinkButton, PageHeader } from '../components/ui';

const CATEGORIES = ['Todos', 'Café da manhã', 'Salgados', 'Doces', 'Bebidas'] as const;

/** A partir daqui o cardápio avisa quanto resta, para o cliente não montar uma sacola que não cabe. */
const LOW_STOCK_THRESHOLD = 5;

type CategoryFilter = (typeof CATEGORIES)[number];

function matchesCategory(product: Product, filter: CategoryFilter): boolean {
  if (filter === 'Todos') {
    return true;
  }

  return product.category === filter;
}

export function MenuPage() {
  const { unitId, lines, addProduct, stockUsed } = useStore();
  const [category, setCategory] = useState<CategoryFilter>('Todos');
  const [search, setSearch] = useState('');

  const unit = findUnit(unitId);
  const today = useToday();

  if (unit === undefined) {
    return <p>Selecione uma unidade para ver o cardápio.</p>;
  }

  const term = foldAccents(search);
  const visibleProducts = PRODUCTS.filter((product) => {
    return matchesCategory(product, category) && foldAccents(product.name).includes(term);
  });

  const itemCount = countItems(lines);
  const region = getUnitRegion(unit);

  return (
    <section>
      <PageHeader
        title={`Cardápio · ${unit.name}`}
        description="Itens indisponíveis continuam visíveis, com o motivo, para você ver a diferença entre as unidades."
      />

      {!isUnitOpen(unit, today) && (
        <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
          {unit.name} está fechada agora. O atendimento vai das {unit.opensAtHour}h às{' '}
          {unit.closesAtHour}h. Escolha outra unidade para pedir neste horário.
        </p>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex-1">
          <span className="sr-only">Buscar item</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar item"
            className="w-full rounded-xl border border-palha bg-white px-4 py-2.5 shadow-sm outline-none transition focus:border-barro"
          />
        </label>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoria">
          {CATEGORIES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setCategory(option)}
              aria-pressed={option === category}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold shadow-sm transition ${
                option === category
                  ? 'bg-barro text-white shadow-barro/30'
                  : 'bg-white text-barro-escuro hover:bg-palha'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {visibleProducts.map((product) => {
          const availability = getAvailability(product, unit, today, stockUsed);
          const stockLeft = getStockLeft(unit, product.id, stockUsed);
          const inCart = lines.find((line) => line.productId === product.id)?.quantity ?? 0;
          const isAvailable = availability === 'disponivel' && inCart < stockLeft;
          const regionNote = product.regionNotes?.[region];

          return (
            <li
              key={product.id}
              className={`flex gap-4 rounded-2xl border border-palha bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                isAvailable ? '' : 'opacity-75'
              }`}
            >
              <span
                aria-hidden="true"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-areia text-3xl"
              >
                {product.emoji}
              </span>

              <div className="flex-1">
                <p className="font-bold text-barro-escuro">{product.name}</p>
                <p className="text-sm text-stone-600">{product.description}</p>

                {regionNote !== undefined && (
                  <p className="mt-1 text-sm text-folha">Receita de {region}. {regionNote}</p>
                )}

                <p className="mt-2 font-bold text-milho">{formatPrice(product.priceCents)}</p>

                {!isAvailable && (
                  <p className="mt-1 text-sm font-medium text-barro">
                    {availability === 'disponivel'
                      ? `Você já tem no carrinho as ${stockLeft} unidades que restam hoje.`
                      : AVAILABILITY_LABELS[availability]}
                  </p>
                )}

                {isAvailable && stockLeft <= LOW_STOCK_THRESHOLD && (
                  <p className="mt-1 text-sm font-medium text-barro">Últimas {stockLeft} unidades hoje</p>
                )}

                <button
                  type="button"
                  disabled={!isAvailable}
                  onClick={() => addProduct(product.id)}
                  className="mt-3 rounded-lg bg-barro px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-barro-escuro disabled:cursor-not-allowed disabled:bg-stone-300 disabled:shadow-none"
                >
                  {isAvailable ? 'Adicionar' : 'Indisponível'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {visibleProducts.length === 0 && (
        <p className="mt-6 text-stone-600">Nenhum item encontrado para esse filtro.</p>
      )}

      {itemCount > 0 && (
        <LinkButton to="/carrinho" className="fixed bottom-6 left-1/2 -translate-x-1/2 shadow-xl sm:static sm:mt-6 sm:translate-x-0">
          Ver carrinho ({itemCount})
        </LinkButton>
      )}
    </section>
  );
}
