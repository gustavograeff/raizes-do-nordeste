import {
  AVAILABILITY_LABELS,
  PRODUCTS,
  STAFF_CHANNEL,
  UNITS,
  findProduct,
  findUnit,
  formatPrice,
  getAvailability,
  getStockLeft,
  getUnitRegion,
} from '../domain/catalog';
import { PAYMENT_METHOD_LABELS } from '../domain/payment';
import type { PaymentMethod } from '../domain/payment';
import { getOrderTotal, isPaidOrder } from '../domain/order';
import {
  getRevenueByPaymentMethod,
  getRevenueByRegion,
  getRevenueByUnit,
  getTopProducts,
} from '../domain/reports';
import { CAMPAIGN_BY_FREQUENCY, buildCampaignProfile, countAudience } from '../domain/segments';
import { useStore } from '../store';
import { useToday } from '../useToday';
import { Card, PageHeader, SectionTitle } from '../components/ui';
import { DashboardLocked } from './DashboardLocked';

/** A barra da meta para de crescer nos 100%, para a unidade que passou não vazar do cartão. */
const GOAL_BAR_MAX_PERCENT = 100;

export function DashboardPage() {
  const { orders, channel, customer, stockUsed, accessLog } = useStore();
  const today = useToday();

  // O canal é o único sinal de papel disponível sem login, e o protótipo
  // não tem onde guardar perfil de usuário.
  if (channel !== STAFF_CHANNEL) {
    return <DashboardLocked />;
  }

  // Pedido cancelado não é faturamento, mesmo que o pagamento tenha sido aprovado antes.
  const paidOrders = orders.filter(isPaidOrder);
  const declinedOrders = orders.filter((order) => order.paymentStatus === 'negado');
  const canceledOrders = orders.filter((order) => order.status === 'cancelado');
  const adjustedOrders = orders.filter((order) => order.adjustmentCents !== undefined && order.adjustmentCents !== 0);

  const revenueByUnit = getRevenueByUnit(paidOrders, today);

  // Somado dos pedidos, e não das unidades. Pedido de unidade desativada continua sendo faturamento.
  const totalRevenueCents = paidOrders.reduce((sum, order) => sum + getOrderTotal(order), 0);
  const totalDiscountCents = paidOrders.reduce((sum, order) => sum + order.discountCents, 0);
  const topProducts = getTopProducts(paidOrders);
  const revenueByRegion = getRevenueByRegion(paidOrders);
  const revenueByPaymentMethod = getRevenueByPaymentMethod(paidOrders);

  // Público de campanha anonimizado. A matriz recebe faixa, e nunca nome ou telefone.
  const campaignProfile = buildCampaignProfile(customer, paidOrders.length, today);
  const audience = countAudience(campaignProfile === undefined ? [] : [campaignProfile]);

  return (
    <section>
      <PageHeader
        title="Painel da matriz"
        description="Consolidação de vendas, itens mais consumidos e disponibilidade por unidade."
      />

      <dl className="mt-6 grid gap-3 sm:grid-cols-4">
        <Card>
          <dt className="text-sm text-stone-600">Faturamento</dt>
          <dd className="text-2xl font-bold text-barro-escuro">{formatPrice(totalRevenueCents)}</dd>
        </Card>
        <Card>
          <dt className="text-sm text-stone-600">Pedidos pagos</dt>
          <dd className="text-2xl font-bold text-barro-escuro">{paidOrders.length}</dd>
        </Card>
        <Card>
          <dt className="text-sm text-stone-600">Descontos concedidos</dt>
          <dd className="text-2xl font-bold text-folha">{formatPrice(totalDiscountCents)}</dd>
        </Card>
        <Card>
          <dt className="text-sm text-stone-600">Pagamentos recusados</dt>
          <dd className="text-2xl font-bold text-barro">{declinedOrders.length}</dd>
        </Card>
        <Card>
          <dt className="text-sm text-stone-600">Pedidos cancelados</dt>
          <dd className="text-2xl font-bold text-barro">{canceledOrders.length}</dd>
        </Card>
      </dl>

      <SectionTitle className="mt-8">Vendas por unidade e meta mensal</SectionTitle>
      <ul className="mt-3 space-y-3">
        {revenueByUnit.map((entry) => (
          <li key={entry.unit.id}>
            <Card>
              <div className="flex justify-between">
                <span className="font-semibold">
                  {entry.unit.name} - {getUnitRegion(entry.unit)}
                </span>
                <span>
                  {formatPrice(entry.revenueCents)} · {entry.orderCount} pedido(s)
                </span>
              </div>

              <div className="mt-2 h-2 rounded-full bg-palha">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-milho to-barro transition-[width]"
                  style={{ width: `${Math.min(GOAL_BAR_MAX_PERCENT, entry.goalPercent)}%` }}
                />
              </div>

              <p className="mt-1 text-xs text-stone-500">
                {formatPrice(entry.monthRevenueCents)} no mês corrente, {entry.goalPercent}% da meta
                mensal ({formatPrice(entry.unit.monthlyRevenueGoalCents)})
              </p>
            </Card>
          </li>
        ))}
      </ul>

      <SectionTitle className="mt-8">Vendas por região</SectionTitle>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">
        {[...revenueByRegion.entries()].map(([region, revenueCents]) => (
          <li key={region}>
            <Card>
              <p className="text-sm text-stone-600">{region}</p>
              <p className="text-xl font-bold text-barro-escuro">{formatPrice(revenueCents)}</p>
            </Card>
          </li>
        ))}
      </ul>

      <SectionTitle className="mt-8">Relatório financeiro por forma de pagamento</SectionTitle>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">
        {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => (
          <li key={method}>
            <Card>
              <p className="text-sm text-stone-600">{PAYMENT_METHOD_LABELS[method]}</p>
              <p className="text-xl font-bold text-barro-escuro">
                {formatPrice(revenueByPaymentMethod.get(method) ?? 0)}
              </p>
            </Card>
          </li>
        ))}
      </ul>

      <SectionTitle className="mt-8">Produtos mais consumidos</SectionTitle>
      {topProducts.length === 0 ? (
        <p className="mt-2 text-stone-600">Ainda não há pedidos pagos.</p>
      ) : (
        <ol className="mt-3 divide-y divide-palha rounded-2xl border border-palha bg-white shadow-sm">
          {topProducts.map((entry, index) => (
            <li key={entry.productId} className="flex items-center justify-between gap-3 p-3">
              <span className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-milho/20 text-xs font-bold text-milho">
                  {index + 1}
                </span>
                {findProduct(entry.productId)?.name ?? entry.productId}
              </span>
              <span className="font-semibold">{entry.quantity} un.</span>
            </li>
          ))}
        </ol>
      )}

      <SectionTitle className="mt-8">Público das campanhas segmentadas</SectionTitle>
      <p className="mt-1 text-sm text-stone-600">
        Dado anonimizado. Entra quem autorizou campanhas, agrupado por faixa etária, frequência de
        consumo e faixa de fidelidade. Nome, telefone e data de nascimento não saem do aparelho do
        cliente.
      </p>
      {audience.length === 0 ? (
        <p className="mt-2 text-stone-600">Nenhum cliente autorizou campanhas segmentadas.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {audience.map((entry) => (
            <li key={entry.segment}>
              <Card>
                <div className="flex justify-between">
                  <span className="font-semibold">{entry.segment}</span>
                  <span>{entry.count} cliente(s)</span>
                </div>
                {campaignProfile !== undefined && (
                  <p className="mt-1 text-sm text-stone-600">
                    {CAMPAIGN_BY_FREQUENCY[campaignProfile.frequencyBand]}
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <SectionTitle className="mt-8">Auditoria de acessos ao painel</SectionTitle>
      {accessLog.length === 0 ? (
        <p className="mt-2 text-stone-600">Nenhuma tentativa registrada neste aparelho.</p>
      ) : (
        <ul className="mt-3 divide-y divide-palha rounded-2xl border border-palha bg-white shadow-sm">
          {[...accessLog].reverse().map((entry) => (
            <li key={`${entry.atIso}-${entry.outcome}`} className="flex justify-between p-3 text-sm">
              <span>{new Date(entry.atIso).toLocaleString('pt-BR')}</span>
              <span className={entry.outcome === 'concedido' ? 'font-semibold text-folha' : 'font-semibold text-barro'}>
                Acesso {entry.outcome}
              </span>
            </li>
          ))}
        </ul>
      )}

      <SectionTitle className="mt-8">Auditoria de operações sensíveis</SectionTitle>
      {canceledOrders.length === 0 && adjustedOrders.length === 0 ? (
        <p className="mt-2 text-stone-600">Nenhum cancelamento ou ajuste manual registrado.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {canceledOrders.map((order) => (
            <li key={order.id}>
              <Card className="border-red-200">
                <p className="font-semibold text-red-800">Pedido {order.id} cancelado</p>
                <p className="text-sm text-stone-600">
                  {findUnit(order.unitId)?.name ?? order.unitId} · {new Date(order.canceledAtIso ?? order.createdAtIso).toLocaleString('pt-BR')}
                </p>
                <p className="mt-1 text-sm">{order.cancelReason ?? 'Sem motivo registrado.'}</p>
              </Card>
            </li>
          ))}
          {adjustedOrders.map((order) => (
            <li key={order.id}>
              <Card className="border-milho/40">
                <p className="font-semibold text-barro-escuro">
                  Pedido {order.id} · ajuste de {formatPrice(order.adjustmentCents ?? 0)}
                </p>
                <p className="text-sm text-stone-600">
                  {findUnit(order.unitId)?.name ?? order.unitId} · total final {formatPrice(getOrderTotal(order))}
                </p>
                <p className="mt-1 text-sm">{order.adjustmentReason ?? 'Sem motivo registrado.'}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <SectionTitle className="mt-8">Estoque e disponibilidade por unidade</SectionTitle>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-palha bg-white shadow-sm">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-barro-escuro text-white">
            <tr>
              <th scope="col" className="p-3">
                Item
              </th>
              {UNITS.map((unit) => (
                <th key={unit.id} scope="col" className="p-3">
                  {unit.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PRODUCTS.map((product) => (
              <tr key={product.id} className="border-t border-palha even:bg-areia/60">
                <th scope="row" className="p-3 font-medium">
                  {product.name}
                </th>
                {UNITS.map((unit) => {
                  const availability = getAvailability(product, unit, today, stockUsed);
                  const stockLeft = getStockLeft(unit, product.id, stockUsed);

                  return (
                    <td
                      key={unit.id}
                      className={`p-3 font-medium ${availability === 'disponivel' ? 'text-folha' : 'text-barro'}`}
                    >
                      {availability === 'disponivel'
                        ? `Disponível · ${stockLeft} un.`
                        : AVAILABILITY_LABELS[availability]}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
