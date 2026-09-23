import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { countItems } from './domain/cart';
import { CHANNEL_LABELS, STAFF_CHANNEL, findCustomerChannel, findUnit } from './domain/catalog';
import { useStore } from './store';
import { UnitsPage } from './pages/UnitsPage';
import { MenuPage } from './pages/MenuPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderPage } from './pages/OrderPage';
import { LoyaltyPage } from './pages/LoyaltyPage';
import { DashboardPage } from './pages/DashboardPage';

const NAV_ITEMS: { to: string; label: string; staffOnly?: true }[] = [
  { to: '/', label: 'Unidades' },
  { to: '/cardapio', label: 'Cardápio' },
  { to: '/carrinho', label: 'Carrinho' },
  { to: '/fidelidade', label: 'Fidelidade' },
  { to: '/matriz', label: 'Matriz', staffOnly: true },
];

function navClass({ isActive }: { isActive: boolean }): string {
  const base = 'whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition';

  if (isActive) {
    return `${base} bg-white text-barro-escuro shadow-sm`;
  }

  return `${base} text-white/85 hover:bg-white/15 hover:text-white`;
}

export function App() {
  const { unitId, channel, lines, setChannel } = useStore();
  const unit = findUnit(unitId);
  const itemCount = countItems(lines);
  const location = useLocation();
  const isAdminRoute = location.pathname === '/matriz';
  // O canal de balcão libera o painel da matriz, então não pode estar na lista que o
  // cliente vê. Quem entra nele passa pelo código de operador, na própria tela do painel.
  const channelOptions = (unit?.channels ?? []).filter(
    (option) => option !== STAFF_CHANNEL || channel === STAFF_CHANNEL,
  );
  const navItems = NAV_ITEMS.filter((item) => !item.staffOnly || channel === STAFF_CHANNEL);

  function selectChannel(value: string) {
    const selected = channelOptions.find((option) => option === value);

    if (selected === undefined) {
      return;
    }

    setChannel(selected);
  }

  function leaveAdminArea() {
    if (unit === undefined) {
      return;
    }

    const customerChannel = findCustomerChannel(unit);

    if (customerChannel !== undefined) {
      setChannel(customerChannel);
    }
  }

  return (
    <div data-channel={channel} className={channel === 'totem' ? 'text-lg' : 'text-base'}>
      <header className="sticky top-0 z-10 bg-gradient-to-r from-barro-escuro to-barro shadow-lg">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="text-3xl">
              🌵
            </span>
            <div>
              <p className="text-xl font-bold text-white">
                Raízes do Nordeste{isAdminRoute ? ' · Painel administrativo' : ''}
              </p>
              <p className="text-sm text-white/80">
                {unit === undefined ? 'Selecione uma unidade' : `${unit.name} · ${unit.city}`}
              </p>
            </div>
          </div>

          {isAdminRoute ? (
            <Link
              to="/"
              onClick={leaveAdminArea}
              className="whitespace-nowrap rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white/85 transition hover:bg-white/15 hover:text-white"
            >
              Sair do painel
            </Link>
          ) : (
            <label className="flex items-center gap-2 text-sm text-white/90">
              <span>Canal</span>
              <select
                className="rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-white [color-scheme:dark]"
                value={channel}
                onChange={(event) => selectChannel(event.target.value)}
              >
                {channelOptions.map((option) => (
                  <option key={option} value={option} className="text-tinta">
                    {CHANNEL_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {!isAdminRoute && (
          <nav aria-label="Navegação principal" className="mx-auto max-w-5xl overflow-x-auto px-4 pt-3 pb-3">
            <ul className="flex gap-2">
              {navItems.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.to === '/'} className={navClass}>
                    {item.label}
                    {item.to === '/carrinho' && itemCount > 0 ? (
                      <span className="ml-1.5 rounded-full bg-milho px-1.5 py-0.5 text-xs text-tinta">
                        {itemCount}
                      </span>
                    ) : null}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Routes>
          <Route path="/" element={<UnitsPage />} />
          <Route path="/cardapio" element={<MenuPage />} />
          <Route path="/carrinho" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/pedido/:orderId" element={<OrderPage />} />
          <Route path="/fidelidade" element={<LoyaltyPage />} />
          <Route path="/matriz" element={<DashboardPage />} />
          <Route path="*" element={<p>Página não encontrada.</p>} />
        </Routes>
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-10 text-sm text-stone-500">
        Protótipo funcional da trilha Front-end. Pagamento simulado por serviço externo.
      </footer>
    </div>
  );
}
