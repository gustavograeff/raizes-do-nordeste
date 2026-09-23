import { describe, expect, it } from 'vitest';
import {
  MAX_LINE_QUANTITY,
  addLine,
  changeQuantity,
  computeTotals,
  findUnavailableLines,
  getDiscountPercent,
  getTier,
  hasSameLineSet,
} from './cart';
import {
  DEFAULT_STOCK_OPENED,
  findProduct,
  findUnit,
  foldAccents,
  getAvailability,
  getStockLeft,
  getUnitRegion,
  isUnitOpen,
} from './catalog';
import type { StockUsed } from './catalog';
import { MIN_AGE_YEARS, getAge, getIdentityError } from './customer';
import type { Unit } from './catalog';
import {
  canCancelOrder,
  computeStockUsed,
  findRetriableOrder,
  getNextStatus,
  getOrderTotal,
  isInMonth,
  newOrderId,
} from './order';
import type { Order, OrderCharge } from './order';
import { setStubPaymentStatus, stubPaymentGateway } from './payment';
import { buildCampaignProfile, countAudience, getFrequencyBand } from './segments';

// Meio-dia local, dentro do horário de funcionamento de qualquer unidade da rede.
const JUNE = new Date(2026, 5, 15, 12, 0);
const AUGUST = new Date(2026, 7, 15, 12, 0);

/** Nenhuma venda registrada, que é o estado de estoque cheio em toda unidade. */
const SEM_VENDAS: StockUsed = {};

function product(id: string) {
  const found = findProduct(id);

  if (found === undefined) {
    throw new Error(`Produto de teste inexistente: ${id}`);
  }

  return found;
}

function unit(id: string) {
  const found = findUnit(id);

  if (found === undefined) {
    throw new Error(`Unidade de teste inexistente: ${id}`);
  }

  return found;
}

describe('disponibilidade de item por unidade', () => {
  it('libera item comum em unidade com cozinha completa', () => {
    expect(getAvailability(product('tapioca-queijo'), unit('recife-boa-viagem'), AUGUST, SEM_VENDAS)).toBe(
      'disponivel',
    );
  });

  it('bloqueia item de cozinha completa em unidade reduzida', () => {
    expect(getAvailability(product('cuscuz-carne-sol'), unit('recife-centro'), AUGUST, SEM_VENDAS)).toBe(
      'cozinha_reduzida',
    );
  });

  it('bloqueia item junino fora do período', () => {
    expect(getAvailability(product('pamonha'), unit('recife-boa-viagem'), AUGUST, SEM_VENDAS)).toBe(
      'fora_de_temporada',
    );
  });

  it('libera item junino dentro do período', () => {
    expect(getAvailability(product('pamonha'), unit('recife-boa-viagem'), JUNE, SEM_VENDAS)).toBe(
      'disponivel',
    );
  });

  it('trata falta de estoque local antes de qualquer outra regra', () => {
    expect(getAvailability(product('suco-caja'), unit('recife-boa-viagem'), AUGUST, SEM_VENDAS)).toBe(
      'sem_estoque',
    );
  });

  it('mostra falta de estoque, e não temporada, quando as duas regras valem', () => {
    const semPamonha: Unit = { ...unit('recife-boa-viagem'), stockOpened: { pamonha: 0 } };

    expect(getAvailability(product('pamonha'), semPamonha, JUNE, SEM_VENDAS)).toBe('sem_estoque');
  });

  it('mostra fora de temporada, e não cozinha reduzida, quando as duas regras valem', () => {
    expect(getAvailability(product('canjica'), unit('recife-centro'), AUGUST, SEM_VENDAS)).toBe(
      'fora_de_temporada',
    );
  });

  it('bloqueia o item do café da manhã depois da hora de serviço', () => {
    const almoco = new Date(2026, 7, 15, 11, 30);

    expect(
      getAvailability(product('cafe-manha-completo'), unit('recife-boa-viagem'), almoco, SEM_VENDAS),
    ).toBe('fora_do_horario');
  });

  it('libera o item do café da manhã dentro da hora de serviço', () => {
    const manha = new Date(2026, 7, 15, 9, 0);

    expect(
      getAvailability(product('cafe-manha-completo'), unit('recife-boa-viagem'), manha, SEM_VENDAS),
    ).toBe('disponivel');
  });

  it('bloqueia todo o cardápio quando a unidade está fechada', () => {
    const madrugada = new Date(2026, 7, 15, 4, 0);

    expect(getAvailability(product('tapioca-queijo'), unit('recife-boa-viagem'), madrugada, SEM_VENDAS)).toBe(
      'unidade_fechada',
    );
    expect(isUnitOpen(unit('recife-boa-viagem'), madrugada)).toBe(false);
  });

  it('fecha a unidade na hora exata do encerramento', () => {
    const fechamento = new Date(2026, 7, 15, 18, 0);

    expect(isUnitOpen(unit('recife-centro'), fechamento)).toBe(false);
    expect(isUnitOpen(unit('recife-centro'), new Date(2026, 7, 15, 17, 59))).toBe(true);
  });

  it('esgota o item quando a venda paga consome o estoque aberto do dia', () => {
    const unidade = unit('recife-boa-viagem');
    const vendido: StockUsed = { [unidade.id]: { 'tapioca-queijo': DEFAULT_STOCK_OPENED } };

    expect(getStockLeft(unidade, 'tapioca-queijo', vendido)).toBe(0);
    expect(getAvailability(product('tapioca-queijo'), unidade, AUGUST, vendido)).toBe('sem_estoque');
  });

  it('encontra item acentuado com o termo digitado sem acento', () => {
    expect(foldAccents(product('cafe-coado').name)).toContain(foldAccents('cafe'));
  });
});

describe('revisão da sacola no pagamento', () => {
  it('acusa item que a unidade escolhida não prepara', () => {
    const lines = [{ productId: 'cuscuz-carne-sol', quantity: 1 }];
    const blocked = findUnavailableLines(lines, unit('recife-centro'), AUGUST, SEM_VENDAS);

    expect(blocked).toHaveLength(1);
    expect(blocked[0].availability).toBe('cozinha_reduzida');
  });

  it('acusa item junino quando a data virou depois de montada a sacola', () => {
    const lines = [{ productId: 'pamonha', quantity: 1 }];

    expect(findUnavailableLines(lines, unit('recife-boa-viagem'), JUNE, SEM_VENDAS)).toEqual([]);
    expect(findUnavailableLines(lines, unit('recife-boa-viagem'), AUGUST, SEM_VENDAS)).toHaveLength(1);
  });

  it('acusa a sacola que pede mais do que resta no estoque da unidade', () => {
    const unidade = unit('recife-boa-viagem');
    const lines = [{ productId: 'tapioca-queijo', quantity: 3 }];
    const vendido: StockUsed = { [unidade.id]: { 'tapioca-queijo': DEFAULT_STOCK_OPENED - 2 } };

    expect(findUnavailableLines(lines, unidade, AUGUST, SEM_VENDAS)).toEqual([]);

    const blocked = findUnavailableLines(lines, unidade, AUGUST, vendido);

    expect(blocked).toHaveLength(1);
    expect(blocked[0].availability).toBe('sem_estoque');
  });
});

describe('carrinho e fidelidade', () => {
  it('soma linha repetida em vez de duplicar item', () => {
    const lines = addLine(addLine([], 'cafe-coado'), 'cafe-coado');

    expect(lines).toEqual([{ productId: 'cafe-coado', quantity: 2 }]);
  });

  it('remove a linha quando a quantidade chega a zero', () => {
    const lines = changeQuantity([{ productId: 'cafe-coado', quantity: 1 }], 'cafe-coado', -1);

    expect(lines).toEqual([]);
  });

  it('não concede desconto sem consentimento, mesmo com pontos de faixa alta', () => {
    expect(getTier(900, false)).toBe('nenhum');
    expect(getDiscountPercent(getTier(900, false))).toBe(0);
  });

  it('troca de faixa no ponto exato do limite', () => {
    expect(getTier(199, true)).toBe('bronze');
    expect(getTier(200, true)).toBe('prata');
    expect(getTier(499, true)).toBe('prata');
    expect(getTier(500, true)).toBe('ouro');
  });

  it('para de somar a linha no teto por item', () => {
    const lines = changeQuantity([{ productId: 'cafe-coado', quantity: MAX_LINE_QUANTITY }], 'cafe-coado', 1);

    expect(lines).toEqual([{ productId: 'cafe-coado', quantity: MAX_LINE_QUANTITY }]);
  });

  it('respeita o teto por item também pelo botão de adicionar do cardápio', () => {
    const lines = addLine([{ productId: 'cafe-coado', quantity: MAX_LINE_QUANTITY }], 'cafe-coado');

    expect(lines).toEqual([{ productId: 'cafe-coado', quantity: MAX_LINE_QUANTITY }]);
  });

  it('não promete ponto para quem não consentiu', () => {
    const lines = [{ productId: 'cafe-manha-completo', quantity: 2 }];
    const totals = computeTotals(lines, getTier(600, false));

    expect(totals.totalCents).toBe(6980);
    expect(totals.pointsEarned).toBe(0);
  });

  it('reconhece a mesma sacola paga mesmo com as linhas em outra ordem', () => {
    const antes = [
      { productId: 'cafe-coado', quantity: 1 },
      { productId: 'tapioca-queijo', quantity: 2 },
    ];
    const depois = [
      { productId: 'tapioca-queijo', quantity: 2 },
      { productId: 'cafe-coado', quantity: 1 },
    ];

    expect(hasSameLineSet(antes, depois)).toBe(true);
  });

  it('não confunde sacola reordenada com sacola de quantidade diferente', () => {
    const antes = [
      { productId: 'cafe-coado', quantity: 1 },
      { productId: 'tapioca-queijo', quantity: 2 },
    ];
    const depois = [
      { productId: 'tapioca-queijo', quantity: 3 },
      { productId: 'cafe-coado', quantity: 1 },
    ];

    expect(hasSameLineSet(antes, depois)).toBe(false);
  });

  it('ignora no total a linha de item que saiu do catálogo', () => {
    const totals = computeTotals([{ productId: 'item-inexistente', quantity: 3 }], 'ouro');

    expect(totals.subtotalCents).toBe(0);
    expect(totals.totalCents).toBe(0);
    expect(totals.pointsEarned).toBe(0);
  });

  it('aplica desconto progressivo por faixa e credita ponto sobre o valor pago', () => {
    const lines = [{ productId: 'cafe-manha-completo', quantity: 2 }];
    const totals = computeTotals(lines, getTier(600, true));

    expect(totals.subtotalCents).toBe(6980);
    expect(totals.discountCents).toBe(698);
    expect(totals.totalCents).toBe(6282);
    expect(totals.pointsEarned).toBe(62);
  });
});

describe('cadastro no programa de fidelidade', () => {
  it('calcula a idade pelo dia do aniversário, e não pelo ano', () => {
    expect(getAge('2008-08-15', AUGUST)).toBe(18);
    expect(getAge('2008-08-16', AUGUST)).toBe(17);
  });

  it('recusa data que casa com o padrão e não existe no calendário', () => {
    expect(getAge('2008-02-31', AUGUST)).toBeUndefined();
    expect(getAge('2008-00-10', AUGUST)).toBeUndefined();
    expect(getAge('2008-02-29', AUGUST)).toBe(18);
  });

  it('recusa ano de dois dígitos, que o calendário mandaria para o século 20', () => {
    expect(getAge('0050-06-15', AUGUST)).toBeUndefined();
  });

  it('aceita o cadastro de quem já tem a idade mínima', () => {
    const identity = { name: 'Ana', phone: '81 99999-9999', birthDateIso: '2000-05-05' };

    expect(getIdentityError(identity, AUGUST)).toBeUndefined();
  });

  it('recusa o cadastro de menor de idade pedindo o responsável legal', () => {
    const identity = { name: 'Ana', phone: '81 99999-9999', birthDateIso: '2010-01-01' };
    const error = getIdentityError(identity, AUGUST);

    expect(error).toContain(String(MIN_AGE_YEARS));
    expect(error).toContain('responsável legal');
  });

  it('recusa cadastro sem nome, sem telefone completo e sem data legível', () => {
    const valid = { name: 'Ana', phone: '81 99999-9999', birthDateIso: '2000-05-05' };

    expect(getIdentityError({ ...valid, name: '  ' }, AUGUST)).toBe('Informe o nome.');
    expect(getIdentityError({ ...valid, phone: '81999' }, AUGUST)).toBe('Informe um telefone com DDD.');
    expect(getIdentityError({ ...valid, birthDateIso: '' }, AUGUST)).toBe(
      'Informe uma data de nascimento válida.',
    );
  });
});

describe('ciclo de vida do pedido', () => {
  it('avança na trilha feliz até entregue e para lá', () => {
    expect(getNextStatus('confirmado')).toBe('em_preparo');
    expect(getNextStatus('pronto')).toBe('entregue');
    expect(getNextStatus('entregue')).toBe('entregue');
  });

  it('não avança um pedido recusado', () => {
    expect(getNextStatus('pagamento_recusado')).toBe('pagamento_recusado');
  });

  it('sorteia um identificador novo a cada pedido, para duas abas não emitirem o mesmo', () => {
    const sorteados = new Set(Array.from({ length: 500 }, () => newOrderId()));

    expect(sorteados.size).toBe(500);
    expect([...sorteados].every((id) => /^RN-[0-9A-F]{12}$/.test(id))).toBe(true);
  });
});

describe('cancelamento e ajuste manual, para a auditoria da matriz', () => {
  const base: Order = {
    id: 'RN-0200',
    unitId: 'recife-boa-viagem',
    channel: 'balcao',
    lines: [{ productId: 'cafe-coado', quantity: 1 }],
    totalCents: 700,
    discountCents: 0,
    pointsEarned: 7,
    paymentMethod: 'pix',
    paymentStatus: 'aprovado',
    status: 'confirmado',
    createdAtIso: '2026-08-15T12:00:00.000Z',
  };

  it('permite cancelar um pedido em andamento', () => {
    expect(canCancelOrder(base)).toBe(true);
  });

  it('não permite cancelar um pedido que já foi para a cozinha', () => {
    expect(canCancelOrder({ ...base, status: 'em_preparo' })).toBe(false);
    expect(canCancelOrder({ ...base, status: 'pronto' })).toBe(false);
    expect(canCancelOrder({ ...base, status: 'entregue' })).toBe(false);
    expect(canCancelOrder({ ...base, status: 'cancelado' })).toBe(false);
  });

  it('não avança um pedido cancelado', () => {
    expect(getNextStatus('cancelado')).toBe('cancelado');
  });

  it('soma o ajuste manual ao total cobrado', () => {
    expect(getOrderTotal({ ...base, adjustmentCents: -200 })).toBe(500);
  });

  it('mantém o total cobrado quando não há ajuste', () => {
    expect(getOrderTotal(base)).toBe(700);
  });
});

describe('região da unidade, para o painel consolidar por estado', () => {
  it('extrai o estado do fim do nome da cidade', () => {
    expect(getUnitRegion(unit('recife-boa-viagem'))).toBe('PE');
    expect(getUnitRegion(unit('fortaleza-aldeota'))).toBe('CE');
  });
});

describe('nova tentativa de cobrança', () => {
  const charge: OrderCharge = {
    unitId: 'recife-boa-viagem',
    channel: 'app',
    lines: [{ productId: 'cafe-coado', quantity: 1 }],
    totalCents: 700,
    discountCents: 0,
    pointsEarned: 7,
    paymentMethod: 'pix',
  };
  const pending = {
    ...charge,
    id: 'RN-0100',
    paymentStatus: 'pendente' as const,
    status: 'aguardando_pagamento' as const,
    createdAtIso: '2026-08-15T12:00:00.000Z',
  };

  it('reaproveita o número do pedido que ficou aguardando esta mesma cobrança', () => {
    expect(findRetriableOrder([pending], charge)?.id).toBe('RN-0100');
  });

  it('aceita outra forma de pagamento, porque tentar outro cartão é a mesma compra', () => {
    expect(findRetriableOrder([pending], { ...charge, paymentMethod: 'credito' })?.id).toBe('RN-0100');
  });

  it('reaproveita o número mesmo com o total mudado por troca de faixa de fidelidade', () => {
    const totalMudou: OrderCharge = { ...charge, totalCents: 630, discountCents: 70 };

    expect(findRetriableOrder([pending], totalMudou)?.id).toBe('RN-0100');
  });

  it('reaproveita o número quando o cliente remove e recoloca o item, mudando só a ordem', () => {
    const doisItens = {
      ...pending,
      lines: [
        { productId: 'cafe-coado', quantity: 1 },
        { productId: 'tapioca-queijo', quantity: 2 },
      ],
    };
    const reordenada: OrderCharge = {
      ...charge,
      lines: [
        { productId: 'tapioca-queijo', quantity: 2 },
        { productId: 'cafe-coado', quantity: 1 },
      ],
    };

    expect(findRetriableOrder([doisItens], reordenada)?.id).toBe('RN-0100');
  });

  it('não reaproveita o número quando a sacola é outra, para não juntar duas vendas', () => {
    const outraSacola: OrderCharge = {
      ...charge,
      lines: [{ productId: 'cafe-coado', quantity: 2 }],
      totalCents: 1400,
    };

    expect(findRetriableOrder([pending], outraSacola)).toBeUndefined();
  });

  it('não reaproveita o número de pedido já pago', () => {
    const pago = { ...pending, paymentStatus: 'aprovado' as const, status: 'confirmado' as const };

    expect(findRetriableOrder([pago], charge)).toBeUndefined();
  });
});

describe('porta de pagamento', () => {
  function request(key: string) {
    return { orderId: 'RN-9999', amountCents: 1000, method: 'pix' as const, idempotencyKey: key };
  }

  it('devolve os três resultados previstos pelo contrato', async () => {
    setStubPaymentStatus('aprovado');
    expect((await stubPaymentGateway.charge(request('k-aprovado'))).status).toBe('aprovado');

    setStubPaymentStatus('negado');
    expect((await stubPaymentGateway.charge(request('k-negado'))).status).toBe('negado');

    setStubPaymentStatus('falha');
    expect((await stubPaymentGateway.charge(request('k-falha'))).status).toBe('falha');
  });

  it('repete o desfecho da chave já cobrada, em vez de cobrar o cliente de novo', async () => {
    setStubPaymentStatus('aprovado');
    const primeira = await stubPaymentGateway.charge(request('k-repetida'));

    // Mesmo com o simulador em negado, a chave já tem desfecho e é ele que volta.
    setStubPaymentStatus('negado');
    const segunda = await stubPaymentGateway.charge(request('k-repetida'));

    expect(segunda).toEqual(primeira);
  });

  it('deixa a falha ser reenviada, porque não é resposta do emissor', async () => {
    setStubPaymentStatus('falha');
    expect((await stubPaymentGateway.charge(request('k-reenvio'))).status).toBe('falha');

    setStubPaymentStatus('aprovado');
    expect((await stubPaymentGateway.charge(request('k-reenvio'))).status).toBe('aprovado');
  });
});

describe('baixa de estoque das vendas pagas', () => {
  const pago: Order = {
    id: 'RN-0300',
    unitId: 'recife-boa-viagem',
    channel: 'balcao',
    lines: [{ productId: 'tapioca-queijo', quantity: 2 }],
    totalCents: 2980,
    discountCents: 0,
    pointsEarned: 29,
    paymentMethod: 'pix',
    paymentStatus: 'aprovado',
    status: 'entregue',
    createdAtIso: AUGUST.toISOString(),
  };

  it('soma as linhas dos pedidos pagos da mesma unidade', () => {
    const usado = computeStockUsed([pago, { ...pago, id: 'RN-0301' }]);

    expect(usado['recife-boa-viagem']['tapioca-queijo']).toBe(4);
  });

  it('ignora o pedido recusado, que ninguém levou', () => {
    const recusado: Order = { ...pago, paymentStatus: 'negado', status: 'pagamento_recusado' };

    expect(computeStockUsed([recusado])).toEqual({});
  });

  it('devolve o item ao cardápio quando o pedido pago é cancelado', () => {
    const cancelado: Order = { ...pago, status: 'cancelado' };

    expect(computeStockUsed([cancelado])).toEqual({});
    expect(getStockLeft(unit('recife-boa-viagem'), 'tapioca-queijo', computeStockUsed([cancelado]))).toBe(
      DEFAULT_STOCK_OPENED,
    );
  });

  it('desconta do estoque aberto da unidade, e não do estoque padrão da rede', () => {
    const centro: Order = { ...pago, unitId: 'recife-centro' };

    // O Centro abre com seis tapiocas, e a venda leva duas.
    expect(getStockLeft(unit('recife-centro'), 'tapioca-queijo', computeStockUsed([centro]))).toBe(4);
  });
});

describe('recorte mensal da meta da unidade', () => {
  const pedido: Order = {
    id: 'RN-0400',
    unitId: 'recife-boa-viagem',
    channel: 'app',
    lines: [{ productId: 'cafe-coado', quantity: 1 }],
    totalCents: 690,
    discountCents: 0,
    pointsEarned: 6,
    paymentMethod: 'pix',
    paymentStatus: 'aprovado',
    status: 'entregue',
    createdAtIso: new Date(2026, 7, 15, 12, 0).toISOString(),
  };

  it('conta o pedido do mês de referência', () => {
    expect(isInMonth(pedido, AUGUST)).toBe(true);
  });

  it('deixa de fora o pedido do mês anterior, que já foi medido na sua própria meta', () => {
    expect(isInMonth(pedido, new Date(2026, 8, 1, 12, 0))).toBe(false);
    expect(isInMonth(pedido, new Date(2025, 7, 15, 12, 0))).toBe(false);
  });
});

describe('segmentação de campanha, com dado anonimizado', () => {
  const consentido = {
    hasConsent: true,
    acceptsSegmentedCampaigns: true,
    birthDateIso: '1990-05-05',
    points: 250,
  };

  it('monta o perfil por faixa, sem nenhum identificador do cliente', () => {
    const profile = buildCampaignProfile(consentido, 3, AUGUST);

    expect(profile).toEqual({ ageBand: '25 a 39', frequencyBand: 'ocasional', tier: 'prata' });
  });

  it('deixa fora do público quem não aceitou campanha, mesmo tendo cadastro', () => {
    expect(buildCampaignProfile({ ...consentido, acceptsSegmentedCampaigns: false }, 3, AUGUST)).toBeUndefined();
  });

  it('deixa fora do público quem retirou o consentimento', () => {
    expect(buildCampaignProfile({ ...consentido, hasConsent: false }, 3, AUGUST)).toBeUndefined();
  });

  it('separa a frequência de consumo pelo número de pedidos pagos', () => {
    expect(getFrequencyBand(0)).toBe('novo');
    expect(getFrequencyBand(2)).toBe('ocasional');
    expect(getFrequencyBand(5)).toBe('recorrente');
  });

  it('agrupa o público por segmento, e não por pessoa', () => {
    const profile = buildCampaignProfile(consentido, 3, AUGUST);
    const audiencia = countAudience(profile === undefined ? [] : [profile, profile]);

    expect(audiencia).toEqual([{ segment: '25 a 39 anos · ocasional · prata', count: 2 }]);
  });
});
