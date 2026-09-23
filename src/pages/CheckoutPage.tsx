import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { computeTotals, findUnavailableLines } from '../domain/cart';
import { AVAILABILITY_LABELS, findUnit, formatPrice } from '../domain/catalog';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  requestCharge,
  setStubPaymentStatus,
} from '../domain/payment';
import type { PaymentMethod, PaymentResult, PaymentStatus } from '../domain/payment';
import { findRetriableOrder, newOrderId } from '../domain/order';
import type { Order, OrderCharge } from '../domain/order';
import { useStore } from '../store';
import { useToday } from '../useToday';
import { Button, LinkButton, PageHeader } from '../components/ui';

const SIMULATION_OPTIONS: PaymentStatus[] = ['aprovado', 'negado', 'falha'];

export function CheckoutPage() {
  const store = useStore();
  const navigate = useNavigate();

  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [simulated, setSimulated] = useState<PaymentStatus>('aprovado');
  const [isCharging, setIsCharging] = useState(false);
  const [failure, setFailure] = useState<string | undefined>(undefined);
  const today = useToday();
  // `isCharging` só chega à tela no próximo render, e um clique duplo antes disso
  // rodaria pay() duas vezes com o mesmo pedido pendente. A ref trava na hora.
  const isChargingRef = useRef(false);

  const unit = findUnit(store.unitId);
  const totals = computeTotals(store.lines, store.tier);

  if (store.lines.length === 0 || unit === undefined) {
    return (
      <section>
        <PageHeader title="Pagamento" />
        <p className="mt-2 text-stone-600">Não há itens para pagar.</p>
        <LinkButton to="/cardapio" className="mt-4">
          Ir para o cardápio
        </LinkButton>
      </section>
    );
  }

  const blocked = findUnavailableLines(store.lines, unit, today, store.stockUsed);

  /**
   * Pedido a cobrar. Nova tentativa desta mesma cobrança reaproveita o registro,
   * e outra compra no mesmo aparelho abre registro próprio.
   */
  function openOrder(charged: OrderCharge): Order {
    const retriable = findRetriableOrder(store.orders, charged);

    if (retriable !== undefined) {
      // O registro passa a valer pelo que está sendo cobrado agora, inclusive a forma.
      store.updateOrder(retriable.id, charged);

      return { ...retriable, ...charged };
    }

    const order: Order = {
      ...charged,
      id: newOrderId(),
      paymentStatus: 'pendente',
      status: 'aguardando_pagamento',
      createdAtIso: new Date().toISOString(),
    };

    store.saveOrder(order);

    return order;
  }

  /** Registra o desfecho da cobrança no pedido e leva a tela para onde ele terminou. */
  function applyResult(order: Order, result: PaymentResult) {
    if (result.status === 'falha') {
      const reason = result.reason ?? PAYMENT_STATUS_LABELS.falha;

      setFailure(`${reason}. O pedido ${order.id} continua aguardando pagamento. Tente novamente.`);

      return;
    }

    if (result.status === 'negado') {
      store.updateOrder(order.id, {
        paymentStatus: 'negado',
        status: 'pagamento_recusado',
        paymentExternalId: result.externalId,
      });
      navigate(`/pedido/${order.id}`);

      return;
    }

    store.confirmPayment(order.id, result.externalId);
    store.clearChargedLines(order.lines);
    navigate(`/pedido/${order.id}`);
  }

  async function pay() {
    if (isChargingRef.current) {
      return;
    }

    // `blocked` foi calculado no render, e o dia pode ter virado depois disso. Cobrar
    // pelo valor fechado despacharia um item que a cozinha já não pode preparar.
    const chargedUnit = findUnit(store.unitId);

    if (
      chargedUnit === undefined ||
      findUnavailableLines(store.lines, chargedUnit, new Date(), store.stockUsed).length > 0
    ) {
      setFailure('A disponibilidade mudou enquanto esta tela estava aberta. Revise a sacola.');

      return;
    }

    isChargingRef.current = true;
    setIsCharging(true);
    setFailure(undefined);
    setStubPaymentStatus(simulated);

    try {
      const charged: OrderCharge = {
        unitId: store.unitId,
        channel: store.channel,
        lines: store.lines,
        totalCents: totals.totalCents,
        discountCents: totals.discountCents,
        pointsEarned: totals.pointsEarned,
        paymentMethod: method,
      };

      const order = openOrder(charged);

      // A chave é a do pedido, e não o valor cobrado. Trocar a forma de pagamento
      // depois de um tempo esgotado repete a chave, então o serviço externo devolve
      // o desfecho da cobrança que já recebeu em vez de cobrar o cliente de novo.
      const result = await requestCharge({
        orderId: order.id,
        amountCents: totals.totalCents,
        method,
        idempotencyKey: order.id,
      });

      applyResult(order, result);
    } catch (error) {
      // `requestCharge` já traduz o erro do serviço externo. O que chega aqui é erro
      // da própria tela, e sem mensagem o caixa clicaria de novo sem saber se a
      // cobrança saiu.
      console.error('Falha inesperada ao registrar o pagamento', error);

      setFailure('Não foi possível concluir o pagamento. Verifique o pedido antes de cobrar de novo.');
    } finally {
      // Todo caminho passa por aqui, inclusive o erro inesperado, senão o botão
      // ficaria desabilitado e o caixa perderia a venda.
      isChargingRef.current = false;
      setIsCharging(false);
    }
  }

  return (
    <section>
      <PageHeader
        title="Pagamento"
        description="O pagamento é processado por um serviço externo. Esta tela solicita a cobrança e registra o resultado no pedido."
      />

      <p className="mt-4 rounded-2xl border border-milho/40 bg-milho/10 px-4 py-3 text-lg">
        Total a pagar: <strong className="text-barro-escuro">{formatPrice(totals.totalCents)}</strong>
      </p>

      <fieldset className="mt-6 rounded-2xl border border-palha bg-white p-4 shadow-sm">
        <legend className="px-1 font-bold text-barro-escuro">Forma de pagamento</legend>
        {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((option) => (
          <label key={option} className="mt-2 flex items-center gap-2">
            <input
              type="radio"
              name="payment-method"
              value={option}
              checked={method === option}
              onChange={() => setMethod(option)}
              className="accent-barro"
            />
            {PAYMENT_METHOD_LABELS[option]}
          </label>
        ))}
      </fieldset>

      <fieldset className="mt-4 rounded-2xl border border-dashed border-palha bg-white p-4">
        <legend className="px-1 font-bold text-barro-escuro">Simulação do serviço externo</legend>
        <p className="text-sm text-stone-600">
          Controle de teste. Permite exercitar os caminhos negativos sem depender do serviço real.
        </p>
        {SIMULATION_OPTIONS.map((option) => (
          <label key={option} className="mt-2 flex items-center gap-2">
            <input
              type="radio"
              name="payment-simulation"
              value={option}
              checked={simulated === option}
              onChange={() => setSimulated(option)}
              className="accent-barro"
            />
            {PAYMENT_STATUS_LABELS[option]}
          </label>
        ))}
      </fieldset>

      {blocked.length > 0 && (
        <div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
          <p>A sacola tem itens que a unidade não pode preparar agora:</p>
          <ul className="mt-1 list-disc pl-5">
            {blocked.map((line) => (
              <li key={line.product.id}>
                {line.product.name} · {AVAILABILITY_LABELS[line.availability]}
              </li>
            ))}
          </ul>
          <Link to="/carrinho" className="mt-2 inline-block font-semibold underline">
            Revisar a sacola
          </Link>
        </div>
      )}

      {failure !== undefined && (
        <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
          {failure}
        </p>
      )}

      <Button type="button" onClick={pay} disabled={isCharging || blocked.length > 0} className="mt-6 px-8 py-4 text-base">
        {isCharging ? 'Processando pagamento…' : 'Pagar agora'}
      </Button>
    </section>
  );
}
