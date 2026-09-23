/** Dados pessoais do cadastro, agrupados porque só entram no estado juntos, no aceite. */
export type CustomerIdentity = {
  name: string;
  phone: string;
  birthDateIso: string;
};

/**
 * Idade mínima para consentir sozinho. O enunciado não fixa um mínimo. A LGPD exige
 * consentimento do responsável legal para criança e adolescente.
 */
export const MIN_AGE_YEARS = 18;

const MIN_PHONE_DIGITS = 10;

/** Código do país, DDD e nove dígitos, que é o maior telefone brasileiro. */
const MAX_PHONE_DIGITS = 13;

const MAX_AGE_YEARS = 120;

/** Formato do valor de `input type="date"`, que é sempre AAAA-MM-DD. */
const BIRTH_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toPhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Compara os números escritos no campo, e não dois objetos Date, porque a data
 * do campo é meia-noite em UTC e o relógio da tela é local. Devolve undefined
 * quando a data não é legível, e o chamador decide a mensagem.
 */
export function getAge(birthDateIso: string, today: Date): number | undefined {
  const parts = BIRTH_DATE_PATTERN.exec(birthDateIso);

  if (parts === null) {
    return undefined;
  }

  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);

  // 31 de fevereiro casa com o padrão e não existe no calendário. Montar em UTC e
  // conferir o que voltou recusa o dia que o mês não tem, sem tabela de meses.
  // O ano entra na conferência porque Date.UTC manda 0 a 99 para 1900 a 1999, e
  // aí o bissexto conferido seria o de outro ano.
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  const isSameCalendarDate =
    calendarDate.getUTCFullYear() === year &&
    calendarDate.getUTCMonth() === month - 1 &&
    calendarDate.getUTCDate() === day;

  if (!isSameCalendarDate) {
    return undefined;
  }

  const monthToday = today.getMonth() + 1;
  const hasHadBirthdayThisYear = monthToday > month || (monthToday === month && today.getDate() >= day);
  const yearsSinceBirth = today.getFullYear() - year;

  if (hasHadBirthdayThisYear) {
    return yearsSinceBirth;
  }

  return yearsSinceBirth - 1;
}

export function getIdentityError(identity: CustomerIdentity, today: Date): string | undefined {
  if (identity.name.trim().length === 0) {
    return 'Informe o nome.';
  }

  const phoneDigits = toPhoneDigits(identity.phone);

  if (phoneDigits.length < MIN_PHONE_DIGITS || phoneDigits.length > MAX_PHONE_DIGITS) {
    return 'Informe um telefone com DDD.';
  }

  const age = getAge(identity.birthDateIso, today);

  if (age === undefined || age < 0 || age > MAX_AGE_YEARS) {
    return 'Informe uma data de nascimento válida.';
  }

  if (age < MIN_AGE_YEARS) {
    return `O cadastro é para quem tem ${MIN_AGE_YEARS} anos ou mais. Um responsável legal precisa fazer o cadastro e dar o consentimento.`;
  }

  return undefined;
}
