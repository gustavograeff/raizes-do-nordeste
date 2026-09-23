export type Channel = 'app' | 'totem' | 'balcao' | 'pickup';

export type KitchenType = 'completa' | 'reduzida';

export type Product = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  category: 'Salgados' | 'Doces' | 'Bebidas' | 'Café da manhã';
  emoji: string;
  /** Item que só sai de cozinha completa, por depender de forno ou fogão. */
  requiresFullKitchen: boolean;
  /** Item sazonal do período junino. Ausente quando o item vende o ano inteiro. */
  season?: 'junino';
  /** Hora local em que o item sai do cardápio do dia. Ausente quando vende o dia inteiro. */
  servedUntilHour?: number;
  /**
   * Diferença de receita por estado, que faz parte da identidade da marca. A chave é a
   * sigla do estado, a mesma que `getUnitRegion` devolve.
   */
  regionNotes?: Record<string, string>;
};

export type Unit = {
  id: string;
  name: string;
  city: string;
  kitchen: KitchenType;
  channels: Channel[];
  /**
   * Estoque do dia que a unidade abriu com, por item, quando difere do padrão da rede.
   * Zero é a ruptura declarada pela própria unidade.
   */
  stockOpened: Record<string, number>;
  /** Horário de funcionamento local, que é regra própria de cada unidade. */
  opensAtHour: number;
  closesAtHour: number;
  /** Meta de faturamento mensal definida pela matriz, para medir o desempenho da unidade. */
  monthlyRevenueGoalCents: number;
};

export type Availability =
  | 'disponivel'
  | 'sem_estoque'
  | 'fora_de_temporada'
  | 'cozinha_reduzida'
  | 'fora_do_horario'
  | 'unidade_fechada';

/** Quanto cada unidade já vendeu de cada item, por unidade e por produto. */
export type StockUsed = Record<string, Record<string, number>>;

/** Canal operado por funcionário, e o único que abre o painel da matriz. */
export const STAFF_CHANNEL: Channel = 'balcao';

export const CHANNEL_LABELS: Record<Channel, string> = {
  app: 'Aplicativo',
  totem: 'Totem de autoatendimento',
  balcao: 'Atendimento no balcão',
  pickup: 'Retirada rápida',
};

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  disponivel: 'Disponível',
  sem_estoque: 'Sem estoque suficiente nesta unidade',
  fora_de_temporada: 'Só no período junino',
  cozinha_reduzida: 'Indisponível em cozinha reduzida',
  fora_do_horario: 'Fora do horário de serviço do item',
  unidade_fechada: 'Unidade fechada neste horário',
};

export const PRODUCTS: Product[] = [
  {
    id: 'tapioca-queijo',
    name: 'Tapioca de queijo coalho',
    description: 'Goma fresca, queijo coalho e manteiga de garrafa.',
    priceCents: 1490,
    category: 'Salgados',
    emoji: '🫓',
    requiresFullKitchen: false,
    regionNotes: {
      PE: 'Em Pernambuco vai com manteiga de garrafa e queijo coalho grelhado.',
      CE: 'No Ceará leva coco ralado na goma, como pede a receita local.',
    },
  },
  {
    id: 'cuscuz-carne-sol',
    name: 'Cuscuz com carne de sol',
    description: 'Cuscuz de milho, carne de sol desfiada e queijo coalho.',
    priceCents: 2290,
    category: 'Salgados',
    emoji: '🍲',
    requiresFullKitchen: true,
    regionNotes: { CE: 'No Ceará a carne de sol vem com nata no lugar do queijo.' },
  },
  {
    id: 'bolo-macaxeira',
    name: 'Bolo de macaxeira',
    description: 'Fatia assada na casa, com coco ralado.',
    priceCents: 990,
    category: 'Doces',
    emoji: '🍰',
    requiresFullKitchen: true,
  },
  {
    id: 'canjica',
    name: 'Canjica cremosa',
    description: 'Milho branco, leite de coco e canela. Receita de festa junina.',
    priceCents: 1290,
    category: 'Doces',
    emoji: '🌽',
    requiresFullKitchen: true,
    season: 'junino',
  },
  {
    id: 'pamonha',
    name: 'Pamonha na palha',
    description: 'Milho verde ralado na hora. Receita de festa junina.',
    priceCents: 1190,
    category: 'Doces',
    emoji: '🌽',
    requiresFullKitchen: false,
    season: 'junino',
  },
  {
    id: 'cafe-coado',
    name: 'Café coado na hora',
    description: 'Coado no pano, servido em xícara de 180 ml.',
    priceCents: 690,
    category: 'Bebidas',
    emoji: '☕',
    requiresFullKitchen: false,
  },
  {
    id: 'suco-caja',
    name: 'Suco de cajá',
    description: 'Polpa regional batida na hora, 400 ml.',
    priceCents: 1090,
    category: 'Bebidas',
    emoji: '🥤',
    requiresFullKitchen: false,
  },
  {
    id: 'cafe-manha-completo',
    name: 'Café da manhã completo',
    description: 'Tapioca, café, suco e bolo. Servido até as 11h.',
    priceCents: 3490,
    category: 'Café da manhã',
    emoji: '🍳',
    requiresFullKitchen: true,
    servedUntilHour: 11,
  },
];

export const UNITS: Unit[] = [
  {
    id: 'recife-boa-viagem',
    name: 'Raízes Boa Viagem',
    city: 'Recife, PE',
    kitchen: 'completa',
    channels: ['app', 'totem', 'balcao', 'pickup'],
    stockOpened: { 'suco-caja': 0 },
    opensAtHour: 6,
    closesAtHour: 22,
    monthlyRevenueGoalCents: 800000,
  },
  {
    id: 'recife-centro',
    name: 'Raízes Centro',
    city: 'Recife, PE',
    kitchen: 'reduzida',
    channels: ['app', 'balcao', 'pickup'],
    // Quiosque de rua, que abre para o café da manhã e fecha no fim da tarde.
    stockOpened: { 'tapioca-queijo': 6 },
    opensAtHour: 6,
    closesAtHour: 18,
    monthlyRevenueGoalCents: 400000,
  },
  {
    id: 'caruaru-shopping',
    name: 'Raízes Caruaru Shopping',
    city: 'Caruaru, PE',
    kitchen: 'completa',
    channels: ['app', 'totem', 'balcao'],
    stockOpened: { 'bolo-macaxeira': 0 },
    // Praça de alimentação de shopping, presa ao horário do centro comercial.
    opensAtHour: 10,
    closesAtHour: 22,
    monthlyRevenueGoalCents: 500000,
  },
  {
    id: 'fortaleza-aldeota',
    name: 'Raízes Aldeota',
    city: 'Fortaleza, CE',
    kitchen: 'reduzida',
    channels: ['app', 'totem', 'pickup'],
    stockOpened: { 'cafe-coado': 0 },
    opensAtHour: 7,
    closesAtHour: 20,
    monthlyRevenueGoalCents: 350000,
  },
];

/** Junho e julho, que é quando as unidades mantêm o cardápio junino no ar. */
const JUNINO_MONTHS = [5, 6];

/** Estoque do dia que a unidade recebe de um item, quando ela não declara outro número. */
export const DEFAULT_STOCK_OPENED = 20;

export function isUnitOpen(unit: Unit, date: Date): boolean {
  const hour = date.getHours();

  return hour >= unit.opensAtHour && hour < unit.closesAtHour;
}

/**
 * Quanto a unidade ainda pode vender do item hoje. A venda paga desconta daqui, então
 * a ruptura aparece sozinha no cardápio em vez de esperar alguém editar o catálogo.
 */
export function getStockLeft(unit: Unit, productId: string, stockUsed: StockUsed): number {
  const opened = unit.stockOpened[productId] ?? DEFAULT_STOCK_OPENED;
  const sold = stockUsed[unit.id]?.[productId] ?? 0;

  return Math.max(0, opened - sold);
}

export function getAvailability(
  product: Product,
  unit: Unit,
  date: Date,
  stockUsed: StockUsed,
): Availability {
  // Unidade fechada não prepara nada, então vem antes de qualquer regra de item.
  if (!isUnitOpen(unit, date)) {
    return 'unidade_fechada';
  }

  if (getStockLeft(unit, product.id, stockUsed) === 0) {
    return 'sem_estoque';
  }

  if (product.season === 'junino' && !JUNINO_MONTHS.includes(date.getMonth())) {
    return 'fora_de_temporada';
  }

  if (product.servedUntilHour !== undefined && date.getHours() >= product.servedUntilHour) {
    return 'fora_do_horario';
  }

  if (product.requiresFullKitchen && unit.kitchen === 'reduzida') {
    return 'cozinha_reduzida';
  }

  return 'disponivel';
}

/**
 * Baixa de estoque da venda paga. Recebe as linhas pela forma, e não pelo tipo da
 * sacola, porque o catálogo não conhece o carrinho.
 */
export function addStockUsed(
  stockUsed: StockUsed,
  unitId: string,
  lines: readonly { productId: string; quantity: number }[],
): StockUsed {
  const unitUsage = { ...(stockUsed[unitId] ?? {}) };

  for (const line of lines) {
    unitUsage[line.productId] = (unitUsage[line.productId] ?? 0) + line.quantity;
  }

  return { ...stockUsed, [unitId]: unitUsage };
}

export function findProduct(productId: string): Product | undefined {
  return PRODUCTS.find((product) => product.id === productId);
}

export function findUnit(unitId: string): Unit | undefined {
  return UNITS.find((unit) => unit.id === unitId);
}

/** Canal que o cliente assume sozinho. O balcão fica fora, porque abre o painel da matriz. */
export function findCustomerChannel(unit: Unit): Channel | undefined {
  return unit.channels.find((channel) => channel !== STAFF_CHANNEL);
}

/** Estado ao fim do nome da cidade ("Recife, PE" -> "PE"), a região que a matriz consolida. */
export function getUnitRegion(unit: Unit): string {
  return unit.city.split(', ').at(-1) ?? unit.city;
}

export const CENTS_PER_REAL = 100;

export function formatPrice(cents: number): string {
  return (cents / CENTS_PER_REAL).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** No teclado do celular o cliente digita "cafe", e o item se chama "Café coado na hora". */
export function foldAccents(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}
