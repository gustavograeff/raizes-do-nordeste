import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { addLine, changeQuantity, getTier, hasSameLineSet } from './domain/cart';
import type { CartLine, LoyaltyTier } from './domain/cart';
import { findCustomerChannel, findProduct, findUnit, getAvailability, getStockLeft } from './domain/catalog';
import type { Channel, StockUsed } from './domain/catalog';
import { getIdentityError, toPhoneDigits } from './domain/customer';
import type { CustomerIdentity } from './domain/customer';
import { computeStockUsed } from './domain/order';
import type { Order } from './domain/order';
import {
  EMPTY_CUSTOMER,
  MAX_ACCESS_ENTRIES,
  STORAGE_KEY,
  adoptStoredState,
  applyApprovedPayment,
  applyCancellation,
  readStoredState,
  writeState,
} from './state';
import type { AccessEntry, StoreState } from './state';

type StoreValue = StoreState & {
  tier: LoyaltyTier;
  /** Baixa de estoque das vendas pagas, que o cardápio e a sacola descontam. */
  stockUsed: StockUsed;
  setUnitId: (unitId: string) => void;
  setChannel: (channel: Channel) => void;
  addProduct: (productId: string) => void;
  changeProductQuantity: (productId: string, delta: number) => void;
  clearCart: () => void;
  clearChargedLines: (charged: CartLine[]) => void;
  confirmPayment: (orderId: string, paymentExternalId: string | undefined) => void;
  grantConsent: (identity: CustomerIdentity, acceptsSegmentedCampaigns: boolean) => void;
  revokeConsent: () => void;
  eraseCustomerData: () => void;
  saveOrder: (order: Order) => void;
  updateOrder: (orderId: string, patch: Partial<Order>) => void;
  cancelOrder: (orderId: string, reason: string) => void;
  logStaffAccess: (outcome: AccessEntry['outcome']) => void;
};

const StoreContext = createContext<StoreValue | undefined>(undefined);

type StoreProviderProps = { children: ReactNode };

export function StoreProvider({ children }: StoreProviderProps) {
  const [state, setState] = useState<StoreState>(readStoredState);

  useEffect(() => {
    writeState(state);
  }, [state]);

  useEffect(() => {
    function adoptOtherTab(event: StorageEvent) {
      if (event.key !== STORAGE_KEY) {
        return;
      }

      // Chave apagada não é cadastro novo. Adotar o registro ausente apagaria o
      // cliente desta aba, e limpar o armazenamento não é retirada de consentimento.
      if (event.newValue === null) {
        return;
      }

      // A leitura fica fora do atualizador, que o React pode chamar duas vezes.
      const stored = readStoredState();

      setState((current) => adoptStoredState(current, stored));
    }

    window.addEventListener('storage', adoptOtherTab);

    return () => window.removeEventListener('storage', adoptOtherTab);
  }, []);

  const setUnitId = useCallback((unitId: string) => {
    setState((current) => {
      const unit = findUnit(unitId);

      // Tocar na unidade já selecionada não pode esvaziar a sacola montada.
      if (unit === undefined || unitId === current.unitId) {
        return current;
      }

      const keptChannel = unit.channels.find((candidate) => candidate === current.channel);
      const channel = keptChannel === undefined ? findCustomerChannel(unit) : keptChannel;

      // Unidade que só opera o balcão não tem canal para o cliente assumir, e cair
      // nele liberaria o painel da matriz sem código de operador.
      if (channel === undefined) {
        return current;
      }

      return { ...current, unitId, channel, lines: [] };
    });
  }, []);

  const setChannel = useCallback((channel: Channel) => {
    setState((current) => {
      const unit = findUnit(current.unitId);

      // Sem unidade não existe canal permitido, e o balcão libera o painel da matriz.
      if (unit === undefined || !unit.channels.includes(channel)) {
        return current;
      }

      return { ...current, channel };
    });
  }, []);

  const addProduct = useCallback((productId: string) => {
    const today = new Date();

    setState((current) => {
      const unit = findUnit(current.unitId);
      const product = findProduct(productId);

      if (unit === undefined || product === undefined) {
        return current;
      }

      const stockUsed = computeStockUsed(current.orders);

      // RF05 vale acima de qualquer outra regra, então a sacola confere de novo.
      if (getAvailability(product, unit, today, stockUsed) !== 'disponivel') {
        return current;
      }

      // A sacola inteira precisa caber no estoque restante, e não só a próxima unidade.
      const inCart = current.lines.find((line) => line.productId === productId)?.quantity ?? 0;

      if (inCart >= getStockLeft(unit, productId, stockUsed)) {
        return current;
      }

      return { ...current, lines: addLine(current.lines, productId) };
    });
  }, []);

  const changeProductQuantity = useCallback((productId: string, delta: number) => {
    setState((current) => ({ ...current, lines: changeQuantity(current.lines, productId, delta) }));
  }, []);

  const clearCart = useCallback(() => {
    setState((current) => ({ ...current, lines: [] }));
  }, []);

  /**
   * Esvazia a sacola depois da cobrança aprovada, e só quando ela continua sendo a que
   * foi cobrada. Quem remontou a sacola durante a cobrança não perde os itens novos.
   */
  const clearChargedLines = useCallback((charged: CartLine[]) => {
    setState((current) => {
      if (!hasSameLineSet(current.lines, charged)) {
        return current;
      }

      return { ...current, lines: [] };
    });
  }, []);

  const confirmPayment = useCallback((orderId: string, paymentExternalId: string | undefined) => {
    setState((current) => applyApprovedPayment(current, orderId, paymentExternalId));
  }, []);

  const grantConsent = useCallback((identity: CustomerIdentity, acceptsSegmentedCampaigns: boolean) => {
    const now = new Date();

    // RF13 é regra de cadastro, e não de formulário. O estado recusa a identidade
    // inválida mesmo que outra tela deixe de conferir antes de chamar.
    if (getIdentityError(identity, now) !== undefined) {
      return;
    }

    const nowIso = now.toISOString();

    setState((current) => {
      // Aparelho compartilhado. O saldo só continua quando é o mesmo telefone que
      // já havia consentido, senão o próximo cadastro herdaria pontos alheios.
      const isSameCustomer = toPhoneDigits(current.customer.phone) === toPhoneDigits(identity.phone);

      return {
        ...current,
        customer: {
          ...identity,
          name: identity.name.trim(),
          points: isSameCustomer ? current.customer.points : 0,
          hasConsent: true,
          consentAtIso: nowIso,
          acceptsSegmentedCampaigns,
          updatedAtIso: nowIso,
        },
      };
    });
  }, []);

  const revokeConsent = useCallback(() => {
    const updatedAtIso = new Date().toISOString();

    setState((current) => ({
      ...current,
      customer: {
        ...EMPTY_CUSTOMER,
        // Guarda só o que o cliente precisa para voltar ao programa neste
        // aparelho. Nome e data de nascimento saem, porque sem consentimento
        // não existe finalidade que justifique mantê-los gravados.
        phone: current.customer.phone,
        points: current.customer.points,
        updatedAtIso,
      },
    }));
  }, []);

  const eraseCustomerData = useCallback(() => {
    const updatedAtIso = new Date().toISOString();

    setState((current) => ({ ...current, customer: { ...EMPTY_CUSTOMER, updatedAtIso } }));
  }, []);

  const saveOrder = useCallback((order: Order) => {
    setState((current) => ({ ...current, orders: [...current.orders, order] }));
  }, []);

  const updateOrder = useCallback((orderId: string, patch: Partial<Order>) => {
    setState((current) => ({
      ...current,
      orders: current.orders.map((order) => {
        if (order.id !== orderId) {
          return order;
        }

        return { ...order, ...patch };
      }),
    }));
  }, []);

  const cancelOrder = useCallback((orderId: string, reason: string) => {
    setState((current) => applyCancellation(current, orderId, reason));
  }, []);

  /** Tentativa de entrar no painel da matriz, concedida ou negada, para a auditoria de acessos. */
  const logStaffAccess = useCallback((outcome: AccessEntry['outcome']) => {
    const entry: AccessEntry = { atIso: new Date().toISOString(), outcome };

    setState((current) => ({
      ...current,
      accessLog: [...current.accessLog, entry].slice(-MAX_ACCESS_ENTRIES),
    }));
  }, []);

  // Sai dos pedidos pagos, então o cancelamento devolve o item ao cardápio sozinho.
  const stockUsed = useMemo(() => computeStockUsed(state.orders), [state.orders]);

  const value = useMemo<StoreValue>(() => {
    return {
      ...state,
      tier: getTier(state.customer.points, state.customer.hasConsent),
      stockUsed,
      setUnitId,
      setChannel,
      addProduct,
      changeProductQuantity,
      clearCart,
      clearChargedLines,
      confirmPayment,
      grantConsent,
      revokeConsent,
      eraseCustomerData,
      saveOrder,
      updateOrder,
      cancelOrder,
      logStaffAccess,
    };
  }, [
    state,
    stockUsed,
    setUnitId,
    setChannel,
    addProduct,
    changeProductQuantity,
    clearCart,
    clearChargedLines,
    confirmPayment,
    grantConsent,
    revokeConsent,
    eraseCustomerData,
    saveOrder,
    updateOrder,
    cancelOrder,
    logStaffAccess,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);

  if (value === undefined) {
    throw new Error('useStore precisa estar dentro de StoreProvider.');
  }

  return value;
}
