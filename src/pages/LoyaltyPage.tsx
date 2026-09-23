import { useState } from 'react';
import { TIER_LABELS, getDiscountPercent } from '../domain/cart';
import { MIN_AGE_YEARS, getIdentityError } from '../domain/customer';
import type { CustomerIdentity } from '../domain/customer';
import { isPaidOrder } from '../domain/order';
import { CAMPAIGN_BY_FREQUENCY, buildCampaignProfile } from '../domain/segments';
import { useStore } from '../store';
import { Button, Card, FIELD_CLASS, PageHeader, SectionTitle } from '../components/ui';

/** Tela de quem já consentiu: saldo, segmento e os dois botões de direito do titular. */
function LoyaltyMember() {
  const { customer, tier, orders, revokeConsent, eraseCustomerData } = useStore();
  const paidOrderCount = orders.filter(isPaidOrder).length;
  const profile = buildCampaignProfile(customer, paidOrderCount, new Date());

  return (
    <section>
      <PageHeader title="Programa de fidelidade" />

      <Card className="mt-4 bg-gradient-to-br from-white to-milho/10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-stone-600">Faixa atual</p>
            <p className="text-xl font-bold text-barro-escuro">
              {TIER_LABELS[tier]} · {getDiscountPercent(tier)}% de desconto
            </p>
          </div>
          <span aria-hidden="true" className="text-4xl">
            🏆
          </span>
        </div>

        <dl className="mt-4 space-y-1 border-t border-palha pt-4 text-sm">
          <div className="flex justify-between">
            <dt>Cliente</dt>
            <dd className="font-medium">{customer.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Pontos acumulados</dt>
            <dd className="font-bold text-milho">{customer.points}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Campanhas segmentadas</dt>
            <dd>{customer.acceptsSegmentedCampaigns ? 'autorizadas' : 'não autorizadas'}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Consentimento registrado em</dt>
            <dd>
              {customer.consentAtIso === undefined
                ? 'não registrado'
                : new Date(customer.consentAtIso).toLocaleString('pt-BR')}
            </dd>
          </div>
        </dl>
      </Card>

      <SectionTitle className="mt-6">Campanhas segmentadas</SectionTitle>
      {profile === undefined ? (
        <p className="mt-1 text-stone-600">
          Você não autorizou campanhas segmentadas, então seu perfil fica fora de qualquer público.
          O programa de pontos continua valendo.
        </p>
      ) : (
        <Card className="mt-2">
          <p className="text-sm text-stone-600">Seu segmento</p>
          <p className="font-bold text-barro-escuro">
            {profile.ageBand} anos · consumo {profile.frequencyBand} · faixa {TIER_LABELS[profile.tier]}
          </p>
          <p className="mt-2 text-sm text-stone-600">Campanha que você recebe</p>
          <p className="font-medium">{CAMPAIGN_BY_FREQUENCY[profile.frequencyBand]}</p>
          <p className="mt-3 border-t border-palha pt-3 text-sm text-stone-600">
            A matriz vê apenas a faixa etária, a frequência e a faixa de fidelidade. Nome, telefone e
            data de nascimento não entram na segmentação.
          </p>
        </Card>
      )}

      <SectionTitle className="mt-6">Seus direitos</SectionTitle>
      <p className="mt-1 text-stone-600">
        O consentimento pode ser retirado a qualquer momento, sem perder o acesso ao cardápio e aos
        pedidos. Ao retirar, apagamos o nome e a data de nascimento na hora. Ficam só o telefone e o
        saldo de pontos, neste aparelho, para você voltar ao programa. "Excluir meus dados" apaga
        também esses dois.
      </p>

      <div className="mt-3 flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={revokeConsent}>
          Retirar consentimento
        </Button>
        <Button type="button" variant="danger" onClick={eraseCustomerData}>
          Excluir meus dados
        </Button>
      </div>
    </section>
  );
}

/**
 * O formulário vive na tela, e não no estado gravado. Dado pessoal só atravessa
 * essa fronteira no aceite, nunca a cada tecla digitada.
 */
const EMPTY_FORM: CustomerIdentity = {
  name: '',
  phone: '',
  birthDateIso: '',
};

const DATA_USE_NOTICE = [
  'Nome e telefone identificam o cliente no balcão e no aplicativo.',
  'Data de nascimento confere a idade mínima e monta faixas etárias agregadas para campanhas.',
  'Histórico de pedidos calcula pontos e frequência de consumo.',
];

/** Tela de adesão. Monta-se do zero a cada entrada, então o consentimento retirado não volta num clique. */
function LoyaltySignup() {
  const { grantConsent } = useStore();
  const [form, setForm] = useState<CustomerIdentity>(EMPTY_FORM);
  const [acceptsTerms, setAcceptsTerms] = useState(false);
  const [acceptsCampaigns, setAcceptsCampaigns] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  function join() {
    const formError = getIdentityError(form, new Date());

    if (formError !== undefined) {
      setError(formError);

      return;
    }

    if (!acceptsTerms) {
      setError('O cadastro só é criado com consentimento explícito para o uso dos dados.');

      return;
    }

    setError(undefined);
    grantConsent(form, acceptsCampaigns);
  }

  return (
    <section>
      <PageHeader
        title="Programa de fidelidade"
        description={
          <>
            Acumule pontos e receba desconto progressivo. O cadastro é opcional: sem ele o pedido continua
            funcionando normalmente. Só quem tem {MIN_AGE_YEARS} anos ou mais pode se cadastrar, porque o
            consentimento de menor de idade é do responsável legal.
          </>
        }
      />

      <SectionTitle className="mt-6">Dados tratados e finalidade</SectionTitle>
      <ul className="mt-2 list-disc pl-5 text-stone-700">
        {DATA_USE_NOTICE.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <Card className="mt-6 grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Nome</span>
          <input
            className={FIELD_CLASS}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Telefone com DDD</span>
          <input
            className={FIELD_CLASS}
            inputMode="tel"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Data de nascimento</span>
          <input
            type="date"
            className={FIELD_CLASS}
            value={form.birthDateIso}
            onChange={(event) => setForm({ ...form, birthDateIso: event.target.value })}
          />
        </label>
      </Card>

      <label className="mt-4 flex items-start gap-2">
        <input
          type="checkbox"
          checked={acceptsTerms}
          onChange={(event) => setAcceptsTerms(event.target.checked)}
          className="mt-1 accent-barro"
        />
        <span>Autorizo o uso dos meus dados para o programa de fidelidade.</span>
      </label>

      <label className="mt-2 flex items-start gap-2">
        <input
          type="checkbox"
          checked={acceptsCampaigns}
          onChange={(event) => setAcceptsCampaigns(event.target.checked)}
          className="mt-1 accent-barro"
        />
        <span>Também aceito receber campanhas segmentadas por perfil de consumo.</span>
      </label>

      {error !== undefined && (
        <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-red-800">
          {error}
        </p>
      )}

      <Button type="button" onClick={join} className="mt-6">
        Criar cadastro
      </Button>
    </section>
  );
}

export function LoyaltyPage() {
  const { customer } = useStore();

  if (customer.hasConsent) {
    return <LoyaltyMember />;
  }

  return <LoyaltySignup />;
}
