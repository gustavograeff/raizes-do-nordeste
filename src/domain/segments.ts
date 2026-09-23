import { getTier } from './cart';
import type { LoyaltyTier } from './cart';
import { getAge } from './customer';

/**
 * Segmentação de campanha. Trabalha com faixas, e nunca com nome, telefone ou data de
 * nascimento, porque a finalidade é agrupar público. A LGPD pede anonimização quando o
 * identificador não é necessário para a finalidade, e para montar campanha ele não é.
 */
export type AgeBand = '18 a 24' | '25 a 39' | '40 a 59' | '60 ou mais';

export type FrequencyBand = 'novo' | 'ocasional' | 'recorrente';

export type CampaignProfile = {
  ageBand: AgeBand;
  frequencyBand: FrequencyBand;
  tier: LoyaltyTier;
};

/** Campos do cadastro que a segmentação lê. O identificador fica de fora de propósito. */
export type CampaignSubject = {
  hasConsent: boolean;
  acceptsSegmentedCampaigns: boolean;
  birthDateIso: string;
  points: number;
};

const AGE_BANDS: { minAge: number; band: AgeBand }[] = [
  { minAge: 60, band: '60 ou mais' },
  { minAge: 40, band: '40 a 59' },
  { minAge: 25, band: '25 a 39' },
  { minAge: 0, band: '18 a 24' },
];

const OCASIONAL_MIN_ORDERS = 2;
const RECORRENTE_MIN_ORDERS = 5;

/** Campanha que cada faixa de frequência recebe, para a matriz ver o que sai para quem. */
export const CAMPAIGN_BY_FREQUENCY: Record<FrequencyBand, string> = {
  novo: 'Boas-vindas, brinde no segundo pedido',
  ocasional: 'Volte na semana, desconto no café da manhã',
  recorrente: 'Clube da casa, item junino em pré-venda',
};

export function getAgeBand(age: number): AgeBand {
  const found = AGE_BANDS.find((entry) => age >= entry.minAge);

  // A lista termina em zero, então só uma idade negativa chegaria sem faixa.
  return found?.band ?? '18 a 24';
}

export function getFrequencyBand(paidOrderCount: number): FrequencyBand {
  if (paidOrderCount >= RECORRENTE_MIN_ORDERS) {
    return 'recorrente';
  }

  if (paidOrderCount >= OCASIONAL_MIN_ORDERS) {
    return 'ocasional';
  }

  return 'novo';
}

/**
 * Perfil de campanha do cliente, ou nada. Sem consentimento do programa não existe
 * cadastro, e sem o aceite separado de campanha a segmentação não tem finalidade,
 * então o cliente fica fora do público em vez de entrar anonimizado.
 */
export function buildCampaignProfile(
  subject: CampaignSubject,
  paidOrderCount: number,
  today: Date,
): CampaignProfile | undefined {
  if (!subject.hasConsent || !subject.acceptsSegmentedCampaigns) {
    return undefined;
  }

  const age = getAge(subject.birthDateIso, today);

  if (age === undefined) {
    return undefined;
  }

  return {
    ageBand: getAgeBand(age),
    frequencyBand: getFrequencyBand(paidOrderCount),
    tier: getTier(subject.points, subject.hasConsent),
  };
}

export function describeSegment(profile: CampaignProfile): string {
  return `${profile.ageBand} anos · ${profile.frequencyBand} · ${profile.tier}`;
}

/** Público por segmento, que é o que a matriz precisa ver para decidir a campanha. */
export function countAudience(profiles: CampaignProfile[]): { segment: string; count: number }[] {
  const countBySegment = new Map<string, number>();

  for (const profile of profiles) {
    const segment = describeSegment(profile);

    countBySegment.set(segment, (countBySegment.get(segment) ?? 0) + 1);
  }

  return [...countBySegment.entries()].map(([segment, count]) => ({ segment, count }));
}
