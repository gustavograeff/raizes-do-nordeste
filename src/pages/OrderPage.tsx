import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CENTS_PER_REAL, STAFF_CHANNEL, findProduct, findUnit, formatPrice } from '../domain/catalog';
import { ORDER_PROGRESS_STEPS, ORDER_STATUS_LABELS, canCancelOrder, getNextStatus, getOrderTotal } from '../domain/order';
import type { Order } from '../domain/order';
import { PAYMENT_METHOD_LABELS } from '../domain/payment';
import { useStore } from '../store';
import { Button, Card, FIELD_CLASS, LinkButton } from '../components/ui';

/** Ritmo do avanço simulado da cozinha, curto o bastante para demonstrar a tela. */
const STEP_INTERVAL_MS = 5000;

type StaffOrderActionsProps = {
  onCancel: (reason: string) => void;
  onAdjust: (cents: number, reason: string) => void;
};

/** Cancelamento com motivo obrigatório e ajuste manual, restritos ao balcão, para a auditoria de RNF07. */
function StaffOrderActions({ onCancel, onAdjust }: StaffOrderActionsProps) {
  const [cancelReason, setCancelReason] = useState('');
  const [adjustmentReais, setAdjustmentReais] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');

  function submitCancel() {
    if (cancelReason.trim().length === 0) {
      return;
    }

    onCancel(cancelReason.trim());
  }

  function submitAdjustment() {
    const reais = Number(adjustmentReais.replace(',', '.'));

    if (!Number.isFinite(reais) || reais === 0 || adjustmentReason.trim().length === 0) {
      return;
    }

    onAdjust(Math.round(reais * CENTS_PER_REAL), adjustmentReason.trim());
    setAdjustmentReais('');
    setAdjustmentReason('');
  }

  return (
    <Card className="mt-4">
      <p className="font-bold text-barro-escuro">Ações do balcão</p>

      <div className="mt-3">
        <label className="block text-sm font-medium" htmlFor="cancel-reason">
          Cancelar pedido
        </label>
        <input
          id="cancel-reason"
          placeholder="Motivo do cancelamento"
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
          className={`${FIELD_CLASS} mt-1 w-full`}
        />
        <Button type="button" variant="danger" onClick={submitCancel} className="mt-2">
          Cancelar este pedido
        </Button>
      </div>

      <div className="mt-4 border-t border-palha pt-3">
        <label className="block text-sm font-medium" htmlFor="adjustment-value">
          Ajuste manual (R$, use negativo para cortesia)
        </label>
        <input
          id="adjustment-value"
          inputMode="decimal"
          placeholder="-10,00"
          value={adjustmentReais}
          onChange={(event) => setAdjustmentReais(event.target.value)}
          className={`${FIELD_CLASS} mt-1 w-full`}
        />
        <input
          placeholder="Motivo do ajuste"
          value={adjustmentReason}
          onChange={(event) => setAdjustmentReason(event.target.value)}
          className={`${FIELD_CLASS} mt-2 w-full`}
        />
        <Button type="button" variant="secondary" onClick={submitAdjustment} className="mt-2">
          Registrar ajuste
        </Button>
      </div>
    </Card>
  );
}

const DECLINED_MESSAGE =
  'O serviço de pagamento recusou a cobrança. Os itens seguem no carrinho para uma nova tentativa com outra forma de pagamento.';

const PENDING_MESSAGE =
  'A cobrança não foi concluída. Os itens seguem no carrinho, e a nova tentativa cobra este mesmo pedido, sem duplicar.';

type OrderOutcomeProps = { order: Order };

/** Desfecho do pedido. Volta ao caixa, cancelamento ou a trilha de preparo. */
function OrderOutcome({ order }: OrderOutcomeProps) {
  // Pedido que ficou aguardando pagamento também precisa de caminho de volta ao caixa.
  if (order.status === 'pagamento_recusado' || order.status === 'aguardando_pagamento') {
    const message = order.status === 'pagamento_recusado' ? DECLINED_MESSAGE : PENDING_MESSAGE;

    return (
      <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
        <p>{message}</p>
        <LinkButton to="/checkout" className="mt-3">
          Voltar ao pagamento
        </LinkButton>
      </div>
    );
  }

  if (order.status === 'cancelado') {
    return (
      <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
        <p>Pedido cancelado. {order.cancelReason ?? 'Sem motivo registrado.'}</p>
      </div>
    );
  }

  const currentStep = ORDER_PROGRESS_STEPS.indexOf(order.status);

  return (
    <ol className="mt-4 grid gap-2 sm:grid-cols-4">
      {ORDER_PROGRESS_STEPS.map((step, index) => (
        <li
          key={step}
          className={`rounded-xl border p-3 text-sm transition ${
            index <= currentStep
              ? 'border-folha bg-folha/10 font-bold text-folha shadow-sm'
              : 'border-palha bg-white/50 text-stone-500'
          }`}
        >
          {ORDER_STATUS_LABELS[step]}
        </li>
      ))}
    </ol>
  );
}

export function OrderPage() {
  const { orderId } = useParams();
  const { channel, orders, updateOrder, cancelOrder } = useStore();
  const order = orders.find((candidate) => candidate.id === orderId);
  const status = order?.status;

  useEffect(() => {
    if (orderId === undefined || status === undefined) {
      return;
    }

    const nextStatus = getNextStatus(status);

    if (nextStatus === status) {
      return;
    }

    const timer = setTimeout(() => {
      updateOrder(orderId, { status: nextStatus });
    }, STEP_INTERVAL_MS);

    return () => clearTimeout(timer);
  }, [orderId, status, updateOrder]);

  if (order === undefined) {
    return <p>Pedido não encontrado.</p>;
  }

  const unit = findUnit(order.unitId);
  const { id } = order;

  function cancel(reason: string) {
    cancelOrder(id, reason);
  }

  return (
    <section>
      <h1 className="text-3xl font-bold text-barro-escuro">Pedido {order.id}</h1>
      <p className="mt-1 text-stone-600">{unit === undefined ? '' : `${unit.name} · ${unit.city}`}</p>

      <p
        aria-live="polite"
        className="mt-4 rounded-2xl border border-palha bg-white p-4 text-lg font-semibold text-barro-escuro shadow-sm"
      >
        {ORDER_STATUS_LABELS[order.status]}
      </p>

      <OrderOutcome order={order} />

      <ul className="mt-6 divide-y divide-palha rounded-2xl border border-palha bg-white shadow-sm">
        {order.lines.map((line) => {
          const product = findProduct(line.productId);

          if (product === undefined) {
            return null;
          }

          return (
            <li key={line.productId} className="flex justify-between p-3">
              <span>
                {line.quantity}× {product.name}
              </span>
              <span className="font-medium">{formatPrice(product.priceCents * line.quantity)}</span>
            </li>
          );
        })}
      </ul>

      <Card className="mt-4">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt>Total pago</dt>
            <dd className="font-bold text-barro-escuro">{formatPrice(order.totalCents)}</dd>
          </div>
          {order.adjustmentCents !== undefined && order.adjustmentCents !== 0 && (
            <>
              <div className="flex justify-between">
                <dt>Ajuste manual</dt>
                <dd>{formatPrice(order.adjustmentCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Total após ajuste</dt>
                <dd className="font-bold text-barro-escuro">{formatPrice(getOrderTotal(order))}</dd>
              </div>
            </>
          )}
          <div className="flex justify-between">
            <dt>Forma de pagamento</dt>
            <dd>{PAYMENT_METHOD_LABELS[order.paymentMethod]}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Identificador no serviço externo</dt>
            <dd>{order.paymentExternalId ?? 'não informado'}</dd>
          </div>
        </dl>
      </Card>

      {canCancelOrder(order) &&
        (channel === STAFF_CHANNEL ? (
          <StaffOrderActions
            onCancel={cancel}
            onAdjust={(cents, reason) => updateOrder(order.id, { adjustmentCents: cents, adjustmentReason: reason })}
          />
        ) : (
          <Button
            variant="danger"
            className="mt-4"
            onClick={() => {
              if (window.confirm('Cancelar este pedido?')) {
                cancel('Cancelado pelo cliente');
              }
            }}
          >
            Cancelar pedido
          </Button>
        ))}
    </section>
  );
}
