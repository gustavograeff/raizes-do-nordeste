import { useEffect, useState } from 'react';

/** Menor intervalo que ainda pega a virada do dia sem redesenhar a tela toda hora. */
const TICK_MS = 60_000;

/**
 * Data atual que se atualiza sozinha. Totem ligado desde a manhã continuaria oferecendo
 * o item junino depois da virada do dia, contra RF05.
 */
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setToday(new Date()), TICK_MS);

    return () => clearInterval(timer);
  }, []);

  return today;
}
