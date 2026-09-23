import { useNavigate } from 'react-router-dom';
import { CHANNEL_LABELS, UNITS, isUnitOpen } from '../domain/catalog';
import { useStore } from '../store';
import { useToday } from '../useToday';
import { PageHeader } from '../components/ui';

export function UnitsPage() {
  const { unitId, setUnitId } = useStore();
  const navigate = useNavigate();
  const today = useToday();

  function selectUnit(nextUnitId: string) {
    setUnitId(nextUnitId);
    navigate('/cardapio');
  }

  return (
    <section>
      <PageHeader
        title="Escolha a unidade"
        description="O cardápio muda por unidade. Cozinha reduzida não prepara todos os itens, o horário de funcionamento é próprio de cada loja e o estoque é controlado localmente."
      />

      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {UNITS.map((unit) => (
          <li key={unit.id}>
            <button
              type="button"
              onClick={() => selectUnit(unit.id)}
              aria-current={unit.id === unitId ? 'true' : undefined}
              className={`flex h-full w-full flex-col rounded-2xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-barro hover:shadow-md ${
                unit.id === unitId ? 'border-barro bg-white ring-2 ring-barro/20' : 'border-palha bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-bold text-barro-escuro">{unit.name}</p>
                  <p className="text-sm text-stone-600">{unit.city}</p>
                </div>
                <span aria-hidden="true" className="text-2xl">
                  📍
                </span>
              </div>

              <p className="mt-3 text-sm">
                Cozinha <strong>{unit.kitchen}</strong>
              </p>
              <p className="mt-1 text-sm text-stone-600">
                Aberta das {unit.opensAtHour}h às {unit.closesAtHour}h
              </p>
              <p className={`mt-1 text-sm font-bold ${isUnitOpen(unit, today) ? 'text-folha' : 'text-barro'}`}>
                {isUnitOpen(unit, today) ? 'Aberta agora' : 'Fechada agora'}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                Canais: {unit.channels.map((channel) => CHANNEL_LABELS[channel]).join(', ')}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
