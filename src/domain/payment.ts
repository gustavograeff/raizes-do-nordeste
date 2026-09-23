/**
 * Porta de pagamento. O nome descreve a função, nunca o fornecedor, porque a
 * rede troca de adquirente sem trocar de sistema. Nenhum tipo do fornecedor
 * atravessa este arquivo. Cada implementação traduz para os tipos daqui.
 */

export type PaymentMethod = 'pix' | 'credito' | 'debito';

export type PaymentRequest = {
  orderId: string;
  amountCents: number;
  method: PaymentMethod;
  /**
   * Identifica a cobrança para o serviço externo. A nova tentativa depois de um
   * tempo esgotado repete a chave, então o serviço reconhece a cobrança que já
   * recebeu e devolve o mesmo desfecho, em vez de cobrar o cliente duas vezes.
   */
  idempotencyKey: string;
};

export type PaymentStatus = 'aprovado' | 'negado' | 'falha';

export type PaymentResult = {
  status: PaymentStatus;
  /** Identificador devolvido pelo serviço externo, guardado para auditoria. */
  externalId?: string;
  reason?: string;
};

export type PaymentGateway = {
  charge: (request: PaymentRequest) => Promise<PaymentResult>;
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: 'Pix',
  credito: 'Cartão de crédito',
  debito: 'Cartão de débito',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  aprovado: 'Pagamento aprovado',
  negado: 'Pagamento negado pelo emissor',
  falha: 'Falha de comunicação com o serviço de pagamento',
};

/**
 * Resultado que o stub devolve na próxima cobrança. O checkout escreve aqui para
 * demonstrar os caminhos negativos sem mudar a assinatura da porta.
 */
let nextStubStatus: PaymentStatus = 'aprovado';

export function setStubPaymentStatus(status: PaymentStatus): void {
  nextStubStatus = status;
}

const STUB_LATENCY_MS = 1200;

/** Prazo da cobrança. Sem ele, um serviço travado deixa o caixa esperando sem resposta. */
const CHARGE_TIMEOUT_MS = 15000;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * Desfecho definitivo por chave. Repetir a chave devolve o mesmo resultado, que é o que
 * a tela do caixa espera de um adquirente. Falha fica de fora, porque não é resposta do
 * emissor e a cobrança precisa ser reenviada.
 */
const settledByKey = new Map<string, PaymentResult>();

export const stubPaymentGateway: PaymentGateway = {
  charge: async (request) => {
    const settled = settledByKey.get(request.idempotencyKey);

    if (settled !== undefined) {
      return settled;
    }

    await delay(STUB_LATENCY_MS);

    if (nextStubStatus === 'falha') {
      return { status: 'falha', reason: 'Tempo de resposta excedido' };
    }

    const externalId = `stub-${request.orderId}`;
    const result: PaymentResult =
      nextStubStatus === 'negado'
        ? { status: 'negado', reason: 'Saldo insuficiente', externalId }
        : { status: 'aprovado', externalId };

    settledByKey.set(request.idempotencyKey, result);

    return result;
  },
};

/**
 * Seleção por configuração no ponto de composição, nunca inferida da presença
 * de credencial. Trocar de adquirente é criar um arquivo novo e mudar esta
 * variável, sem tocar em nenhuma tela.
 */
function resolvePaymentGateway(): PaymentGateway {
  const driver = import.meta.env.VITE_PAYMENT_DRIVER ?? 'stub';

  if (driver !== 'stub') {
    throw new Error(`Driver de pagamento não implementado: ${driver}`);
  }

  return stubPaymentGateway;
}

/**
 * Única porta de entrada das telas. Resolve o driver na cobrança, para configuração
 * errada não derrubar o aplicativo no carregamento, e traduz qualquer erro externo para
 * o desfecho "falha". O texto do erro fica no console, e não na tela do caixa.
 */
export async function requestCharge(request: PaymentRequest): Promise<PaymentResult> {
  let timer: ReturnType<typeof setTimeout> | undefined = undefined;

  try {
    const gateway = resolvePaymentGateway();

    // O prazo devolve o controle à tela, e não cancela a cobrança enviada.
    // Quem impede a cobrança dobrada é a chave de idempotência, que a nova tentativa
    // repete. Adquirente real precisa receber um sinal de cancelamento nesta porta.
    const timeout = new Promise<PaymentResult>((resolve) => {
      timer = setTimeout(() => {
        resolve({ status: 'falha', reason: 'O serviço de pagamento não respondeu no prazo' });
      }, CHARGE_TIMEOUT_MS);
    });

    return await Promise.race([gateway.charge(request), timeout]);
  } catch (error) {
    console.error('Falha ao cobrar no serviço de pagamento', error);

    return { status: 'falha', reason: PAYMENT_STATUS_LABELS.falha };
  } finally {
    // O perdedor do Promise.race continua pendente, e o temporizador de 15 s
    // ficaria vivo em cada cobrança de um terminal aberto o dia inteiro.
    clearTimeout(timer);
  }
}
