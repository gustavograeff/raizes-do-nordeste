import { describe, expect, it } from 'vitest';
import { SEEDED_ORDERS } from './domain/order';
import {
  EMPTY_CUSTOMER,
  INITIAL_STATE,
  MAX_ACCESS_ENTRIES,
  adoptStoredState,
  applyApprovedPayment,
  applyCancellation,
  mergeAccessLog,
  mergeOrders,
  parseState,
} from './state';

describe('leitura do estado gravado', () => {
  it('descarta linha de item que saiu do catálogo, que a sacola não conseguiria remover', () => {
    const raw = JSON.stringify({
      unitId: 'recife-boa-viagem',
      channel: 'app',
      lines: [
        { productId: 'item-descontinuado', quantity: 2 },
        { productId: 'cafe-coado', quantity: 1 },
      ],
    });

    expect(parseState(raw).lines).toEqual([{ productId: 'cafe-coado', quantity: 1 }]);
  });

  it('corrige o canal quando a unidade gravada deixou de operá-lo', () => {
    const raw = JSON.stringify({ unitId: 'recife-centro', channel: 'totem' });

    expect(parseState(raw).channel).toBe('app');
  });

  it('não devolve o canal de balcão, que libera o painel da matriz sem novo código', () => {
    const raw = JSON.stringify({ unitId: 'recife-centro', channel: 'balcao' });

    expect(parseState(raw).channel).toBe('app');
  });

  it('volta ao estado inicial quando a unidade gravada não existe mais', () => {
    const raw = JSON.stringify({ unitId: 'unidade-fechada', channel: 'app' });

    expect(parseState(raw)).toEqual(INITIAL_STATE);
  });

  it('descarta pedido gravado sem total, que a tela mostraria como R$ NaN', () => {
    const raw = JSON.stringify({
      unitId: 'recife-boa-viagem',
      channel: 'app',
      orders: [{ id: 'RN-0009', lines: [] }, SEEDED_ORDERS[0]],
    });

    expect(parseState(raw).orders).toEqual([SEEDED_ORDERS[0]]);
  });

  it('descarta pedido com total infinito, que a tela mostraria como R$ Infinity', () => {
    // 1e999 volta do JSON como Infinity e passa por typeof number.
    const raw = `{"unitId":"recife-boa-viagem","channel":"app","orders":[{"id":"RN-0009","unitId":"recife-boa-viagem","channel":"app","createdAtIso":"2026-08-15T12:00:00.000Z","totalCents":1e999,"discountCents":0,"pointsEarned":0,"status":"confirmado","paymentStatus":"aprovado","paymentMethod":"pix","lines":[]}]}`;

    expect(parseState(raw).orders).toEqual([]);
  });

  it('descarta pedido cujo status veio do protótipo do objeto', () => {
    const raw = JSON.stringify({
      unitId: 'recife-boa-viagem',
      channel: 'app',
      orders: [{ ...SEEDED_ORDERS[0], status: 'constructor' }],
    });

    expect(parseState(raw).orders).toEqual([]);
  });

  it('descarta pedido com desfecho de pagamento desconhecido, que ficaria fora do faturamento e da recusa', () => {
    const raw = JSON.stringify({
      unitId: 'recife-boa-viagem',
      channel: 'app',
      orders: [{ ...SEEDED_ORDERS[0], paymentStatus: 'estornado' }],
    });

    expect(parseState(raw).orders).toEqual([]);
  });

  it('descarta pedido com ajuste manual que não é número, que quebraria o total na auditoria', () => {
    const raw = JSON.stringify({
      unitId: 'recife-boa-viagem',
      channel: 'app',
      orders: [{ ...SEEDED_ORDERS[0], adjustmentCents: 'cortesia' }],
    });

    expect(parseState(raw).orders).toEqual([]);
  });

  it('descarta pedido com desconto negativo, que somaria a mais no faturamento da matriz', () => {
    const raw = JSON.stringify({
      unitId: 'recife-boa-viagem',
      channel: 'app',
      orders: [{ ...SEEDED_ORDERS[0], discountCents: -5000 }],
    });

    expect(parseState(raw).orders).toEqual([]);
  });

  it('descarta pedido com quantidade fracionada, que a cozinha não consegue produzir', () => {
    const raw = JSON.stringify({
      unitId: 'recife-boa-viagem',
      channel: 'app',
      orders: [{ ...SEEDED_ORDERS[0], lines: [{ productId: 'cafe-coado', quantity: 1.5 }] }],
    });

    expect(parseState(raw).orders).toEqual([]);
  });

  it('mantém uma linha por item, porque duas do mesmo produto somariam duas vezes no total', () => {
    const raw = JSON.stringify({
      unitId: 'recife-boa-viagem',
      channel: 'app',
      lines: [
        { productId: 'cafe-coado', quantity: 1 },
        { productId: 'cafe-coado', quantity: 3 },
      ],
    });

    expect(parseState(raw).lines).toEqual([{ productId: 'cafe-coado', quantity: 1 }]);
  });

  it('não aceita cliente com consentimento implícito no registro gravado', () => {
    const raw = JSON.stringify({
      unitId: 'recife-boa-viagem',
      channel: 'app',
      customer: { name: 'Maria', points: 'muitos', hasConsent: 'sim' },
    });

    expect(parseState(raw).customer.hasConsent).toBe(false);
    expect(parseState(raw).customer.points).toBe(0);
  });
});

describe('fusão do histórico entre abas', () => {
  it('mantém a venda confirmada na outra aba por cima da recusa registrada aqui', () => {
    const recusado = { ...SEEDED_ORDERS[0], status: 'pagamento_recusado' as const, paymentStatus: 'negado' as const };
    const confirmado = { ...SEEDED_ORDERS[0], status: 'confirmado' as const, paymentStatus: 'aprovado' as const };

    expect(mergeOrders([recusado], [confirmado])[0].status).toBe('confirmado');
    expect(mergeOrders([confirmado], [recusado])[0].status).toBe('confirmado');
  });

  it('reconhece a mesma venda pelo identificador, mesmo com o total mudado pela nova tentativa', () => {
    const totalMudou = { ...SEEDED_ORDERS[0], totalCents: 5364, discountCents: 596 };

    expect(mergeOrders([SEEDED_ORDERS[0]], [totalMudou])).toHaveLength(1);
  });

  it('incorpora a venda que só existe na outra aba, em vez de descartá-la', () => {
    const outraAba = { ...SEEDED_ORDERS[0], id: 'RN-0000AAAABBBB', totalCents: 1000 };
    const merged = mergeOrders([SEEDED_ORDERS[0]], [outraAba]);

    expect(merged).toHaveLength(2);
    expect(merged[1].totalCents).toBe(1000);
  });

  it('não duplica pedido quando as duas abas já têm o mesmo histórico', () => {
    expect(mergeOrders(SEEDED_ORDERS, SEEDED_ORDERS)).toEqual(SEEDED_ORDERS);
  });

  it('para de crescer quando as duas abas trocam o histórico repetidas vezes', () => {
    const outraAba = { ...SEEDED_ORDERS[0], id: 'RN-0000AAAABBBB', lines: [{ productId: 'cafe-coado', quantity: 9 }] };
    let aqui = [SEEDED_ORDERS[0]];
    let la = [outraAba];

    for (let round = 0; round < 3; round += 1) {
      aqui = mergeOrders(aqui, la);
      la = mergeOrders(la, aqui);
    }

    expect(aqui).toHaveLength(2);
    expect(la).toHaveLength(2);
  });

  it('mantém a confirmação da outra aba na venda que aqui ficou aguardando', () => {
    const daqui = { ...SEEDED_ORDERS[0], status: 'aguardando_pagamento' as const };
    const deLa = { ...SEEDED_ORDERS[0], status: 'confirmado' as const };
    const merged = mergeOrders([daqui], [deLa]);

    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe('confirmado');
  });
});

describe('estado adotado depois da gravação de outra aba', () => {
  const local = { ...INITIAL_STATE, lines: [{ productId: 'cafe-coado', quantity: 1 }] };

  function customerAt(updatedAtIso: string, points: number) {
    return { ...EMPTY_CUSTOMER, phone: '81999990000', points, hasConsent: true, updatedAtIso };
  }

  it('traz o ponto ganho no outro caixa e preserva a sacola desta aba', () => {
    const outraAba = { ...INITIAL_STATE, customer: customerAt('2026-08-15T10:00:00.000Z', 40) };
    const adopted = adoptStoredState(local, outraAba);

    expect(adopted.customer.points).toBe(40);
    expect(adopted.lines).toEqual(local.lines);
  });

  it('devolve o mesmo estado quando nada mudou, para não redesenhar a tela', () => {
    expect(adoptStoredState(local, INITIAL_STATE)).toBe(local);
  });

  it('mantém o cadastro desta aba quando o gravado é mais velho', () => {
    const comPontoNovo = { ...local, customer: customerAt('2026-08-15T12:00:00.000Z', 62) };
    const outraAba = { ...INITIAL_STATE, customer: customerAt('2026-08-15T10:00:00.000Z', 0) };

    expect(adoptStoredState(comPontoNovo, outraAba).customer.points).toBe(62);
  });

  it('mantém a retirada de consentimento da outra aba, mesmo com ponto creditado depois', () => {
    const creditadoDepois = {
      ...local,
      customer: { ...customerAt('2026-08-15T12:00:00.000Z', 62), consentAtIso: '2026-08-15T10:00:00.000Z' },
    };
    const retirado = {
      ...INITIAL_STATE,
      customer: { ...EMPTY_CUSTOMER, phone: '81999990000', points: 62, updatedAtIso: '2026-08-15T11:00:00.000Z' },
    };

    expect(adoptStoredState(creditadoDepois, retirado).customer.hasConsent).toBe(false);
  });

  it('mantém o consentimento renovado aqui depois da retirada gravada na outra aba', () => {
    const renovado = {
      ...local,
      customer: { ...customerAt('2026-08-15T12:00:00.000Z', 0), consentAtIso: '2026-08-15T12:00:00.000Z' },
    };
    const retirado = {
      ...INITIAL_STATE,
      customer: { ...EMPTY_CUSTOMER, updatedAtIso: '2026-08-15T11:00:00.000Z' },
    };

    expect(adoptStoredState(renovado, retirado).customer.hasConsent).toBe(true);
  });

  it('propaga a exclusão de dados feita na outra aba', () => {
    const comCliente = { ...local, customer: customerAt('2026-08-15T10:00:00.000Z', 40) };
    const apagado = { ...INITIAL_STATE, customer: { ...EMPTY_CUSTOMER, updatedAtIso: '2026-08-15T12:00:00.000Z' } };

    expect(adoptStoredState(comCliente, apagado).customer.points).toBe(0);
    expect(adoptStoredState(comCliente, apagado).customer.hasConsent).toBe(false);
  });
});

describe('pagamento aprovado', () => {
  const pendente = {
    ...SEEDED_ORDERS[0],
    paymentStatus: 'pendente' as const,
    status: 'aguardando_pagamento' as const,
    pointsEarned: 59,
  };
  const comConsentimento = {
    ...INITIAL_STATE,
    orders: [pendente],
    customer: { ...EMPTY_CUSTOMER, hasConsent: true, points: 10, updatedAtIso: '2026-08-15T10:00:00.000Z' },
  };

  it('credita o ponto do pedido no saldo e confirma a venda', () => {
    const applied = applyApprovedPayment(comConsentimento, pendente.id, 'stub-1');

    expect(applied.customer.points).toBe(69);
    expect(applied.orders[0].status).toBe('confirmado');
    expect(applied.orders[0].paymentExternalId).toBe('stub-1');
  });

  it('zera o ponto do pedido quando o consentimento saiu antes da aprovação', () => {
    const semConsentimento = { ...comConsentimento, customer: EMPTY_CUSTOMER };
    const applied = applyApprovedPayment(semConsentimento, pendente.id, 'stub-1');

    expect(applied.customer.points).toBe(0);
    expect(applied.orders[0].pointsEarned).toBe(0);
    expect(applied.orders[0].status).toBe('confirmado');
  });

  it('não mexe no estado quando o pedido cobrado saiu do histórico', () => {
    expect(applyApprovedPayment(comConsentimento, 'RN-INEXISTENTE', undefined)).toBe(comConsentimento);
  });
});

describe('cancelamento', () => {
  const confirmado = {
    ...SEEDED_ORDERS[0],
    paymentStatus: 'aprovado' as const,
    status: 'confirmado' as const,
    pointsEarned: 59,
  };
  const comSaldo = {
    ...INITIAL_STATE,
    orders: [confirmado],
    customer: { ...EMPTY_CUSTOMER, hasConsent: true, points: 69, updatedAtIso: '2026-08-15T10:00:00.000Z' },
  };

  it('estorna o ponto creditado pela venda aprovada', () => {
    const applied = applyCancellation(comSaldo, confirmado.id, 'Cliente desistiu');

    expect(applied.customer.points).toBe(10);
    expect(applied.orders[0].status).toBe('cancelado');
    expect(applied.orders[0].cancelReason).toBe('Cliente desistiu');
  });

  it('não estorna duas vezes o pedido já cancelado', () => {
    const once = applyCancellation(comSaldo, confirmado.id, 'Cliente desistiu');

    expect(applyCancellation(once, confirmado.id, 'Cliente desistiu')).toBe(once);
  });

  it('não mexe no saldo quando o pagamento não foi aprovado', () => {
    const pendente = { ...confirmado, paymentStatus: 'pendente' as const, status: 'aguardando_pagamento' as const };
    const applied = applyCancellation({ ...comSaldo, orders: [pendente] }, pendente.id, 'Cliente desistiu');

    expect(applied.customer.points).toBe(69);
  });

  it('para o saldo em zero quando o cliente já gastou ou trocou o cadastro', () => {
    const semSaldo = { ...comSaldo, customer: { ...comSaldo.customer, points: 20 } };

    expect(applyCancellation(semSaldo, confirmado.id, 'Cliente desistiu').customer.points).toBe(0);
  });
});

describe('auditoria de acessos ao painel', () => {
  const concedido = { atIso: '2026-09-19T12:00:00.000Z', outcome: 'concedido' as const };
  const negado = { atIso: '2026-09-19T11:00:00.000Z', outcome: 'negado' as const };

  it('une as tentativas das duas abas, da mais antiga à mais nova', () => {
    expect(mergeAccessLog([concedido], [negado])).toEqual([negado, concedido]);
  });

  it('não duplica a tentativa que as duas abas já tinham', () => {
    expect(mergeAccessLog([negado, concedido], [concedido])).toEqual([negado, concedido]);
  });

  it('guarda no máximo o teto de registros, mantendo os mais novos', () => {
    const muitos = Array.from({ length: MAX_ACCESS_ENTRIES + 10 }, (_, index) => ({
      atIso: new Date(Date.UTC(2026, 8, 19, 0, index)).toISOString(),
      outcome: 'negado' as const,
    }));
    const merged = mergeAccessLog(muitos, []);

    expect(merged).toHaveLength(MAX_ACCESS_ENTRIES);
    expect(merged.at(-1)).toEqual(muitos.at(-1));
  });

  it('descarta registro de acesso ilegível do armazenamento', () => {
    const raw = JSON.stringify({
      unitId: 'recife-boa-viagem',
      channel: 'app',
      accessLog: [concedido, { atIso: 42, outcome: 'concedido' }, { atIso: '2026-09-19T13:00:00.000Z' }],
    });

    expect(parseState(raw).accessLog).toEqual([concedido]);
  });
});
