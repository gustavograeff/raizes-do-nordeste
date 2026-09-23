import { useState } from 'react';
import { STAFF_CHANNEL, findUnit } from '../domain/catalog';
import type { AccessEntry } from '../state';
import { useStore } from '../store';
import { Button, Card, FIELD_CLASS, PageHeader } from '../components/ui';

// O código viaja no pacote entregue ao navegador, então evita o cliente
// que tropeça na tela, e não protege o dado. Protótipo sem servidor não tem como
// autenticar o funcionário, e o painel consolida só o que este aparelho gravou.
const STAFF_CODE = import.meta.env.VITE_STAFF_CODE ?? 'raizes-matriz';

type StaffCodeGateProps = {
  onUnlock: () => void;
  onAttempt: (outcome: AccessEntry['outcome']) => void;
};

function StaffCodeGate({ onUnlock, onAttempt }: StaffCodeGateProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  function unlock() {
    if (code !== STAFF_CODE) {
      setError('Código de operador inválido.');
      onAttempt('negado');

      return;
    }

    setError(undefined);
    setCode('');
    onAttempt('concedido');
    onUnlock();
  }

  return (
    <Card className="mt-4 max-w-sm">
      <label className="block text-sm font-medium" htmlFor="staff-code">
        Código de operador
      </label>
      <input
        id="staff-code"
        type="password"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        className={`${FIELD_CLASS} mt-1 w-full`}
      />

      {error !== undefined && (
        <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <Button type="button" onClick={unlock} className="mt-3">
        Entrar como funcionário
      </Button>
    </Card>
  );
}

/** Painel fechado para o cliente, com o código de operador quando a unidade tem balcão. */
export function DashboardLocked() {
  const { unitId, setChannel, logStaffAccess } = useStore();
  const unit = findUnit(unitId);
  const hasStaffChannel = unit !== undefined && unit.channels.includes(STAFF_CHANNEL);

  return (
    <section>
      <PageHeader
        title="Painel da matriz"
        description="Consolidação de vendas da rede é informação interna. Disponível apenas no canal de balcão, operado por funcionário."
      />

      {hasStaffChannel ? (
        <StaffCodeGate onUnlock={() => setChannel(STAFF_CHANNEL)} onAttempt={logStaffAccess} />
      ) : (
        <p className="mt-4 text-stone-600">
          A unidade selecionada não opera o canal de balcão. Escolha uma unidade com balcão para
          liberar o painel.
        </p>
      )}
    </section>
  );
}
