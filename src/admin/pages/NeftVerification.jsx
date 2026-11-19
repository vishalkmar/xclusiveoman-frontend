import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { formatCurrency } from '../../shared/currency.js';
import { Badge, Button, Card, ErrorText, TextInput } from '../components/ui.jsx';

// NEFT slips waiting for verification — booking payments
// (GET /admin/neft-verifications, POST /admin/payments/:id/verify) and visa
// fee payments (GET /admin/visa-payments/neft-pending,
// POST /admin/visa-payments/:id/verify). Approving a visa slip submits the
// visa application; rejecting it lets the agent pay again.

const KINDS = {
  booking: {
    label: 'Booking',
    verifyUrl: (id) => `/admin/payments/${id}/verify`,
    approveLabel: 'Approve — Confirm Booking',
  },
  visa: {
    label: 'Visa fee',
    verifyUrl: (id) => `/admin/visa-payments/${id}/verify`,
    approveLabel: 'Approve — Submit Visa Application',
  },
};

function PendingSlip({ payment, onDecided }) {
  const kind = KINDS[payment.kind];
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState('');

  async function decide(approve) {
    setError('');
    setSubmitting(approve ? 'approve' : 'reject');
    try {
      await api.post(kind.verifyUrl(payment.id), { approve, reason: approve ? undefined : reason });
      onDecided(payment);
    } catch (err) {
      setError(err.message || 'Unable to update payment');
    } finally {
      setSubmitting('');
    }
  }

  return (
    <Card label={`Pending slip — ${payment.agencyName}`} className="mb-4 border-white">
      <div className="mb-3">
        {payment.kind === 'visa' ? (
          <Badge className="!border-[#C7D2FE] !bg-[#EEF0FF] !text-[#4338CA]">Visa fee</Badge>
        ) : (
          <Badge tone="grey">Booking</Badge>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          {payment.neftSlipUrl ? (
            <a href={payment.neftSlipUrl} target="_blank" rel="noopener noreferrer">
              <img
                src={payment.neftSlipUrl}
                alt="NEFT slip"
                className="max-h-40 rounded-md border border-line-light object-contain"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
              <div className="mt-1 text-xs text-accent hover:underline">View full slip</div>
            </a>
          ) : (
            <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-line-light text-xs text-muted">
              No slip preview
            </div>
          )}
          <div className="mt-2 text-[10px] text-muted">Uploaded {new Date(payment.createdAt).toLocaleString()}</div>
        </div>
        <div className="space-y-2 text-sm">
          <div>
            Expected amount — <b>{formatCurrency(payment.amount)}</b>
          </div>
          <div>Slip reference — {payment.neftReference || '—'}</div>
          {payment.kind === 'visa' && (
            <>
              <div>
                Visa — {payment.visaType} · {payment.visaCategory}
              </div>
              <div>
                {payment.travellers} traveller{payment.travellers === 1 ? '' : 's'} × {formatCurrency(payment.pricePerPerson)}
              </div>
              <div className="text-xs text-muted">
                Application <span className="font-mono">{payment.applicationId.slice(0, 8)}</span>
                {payment.createdByName ? ` · by ${payment.createdByName}` : ''}
              </div>
            </>
          )}
          <div>
            <TextInput placeholder="Reason (required to reject)" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="accent" disabled={!!submitting} onClick={() => decide(true)}>
          {submitting === 'approve' ? 'Approving…' : kind.approveLabel}
        </Button>
        <Button variant="danger" disabled={!!submitting || !reason.trim()} onClick={() => decide(false)}>
          {submitting === 'reject' ? 'Rejecting…' : 'Reject — Notify Agent'}
        </Button>
      </div>
    </Card>
  );
}

export default function NeftVerification() {
  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/admin/neft-verifications').then((r) => r.payments.map((p) => ({ ...p, kind: 'booking' }))),
      api.get('/admin/visa-payments/neft-pending').then((r) => r.payments.map((p) => ({ ...p, kind: 'visa' }))),
    ])
      .then(([b, v]) => setPayments([...b, ...v].sort((x, y) => new Date(x.createdAt) - new Date(y.createdAt))))
      .catch((err) => setError(err.message || 'Unable to load slips'))
      .finally(() => setLoading(false));
  }, []);

  function handleDecided(decided) {
    setPayments((list) => list.filter((p) => !(p.id === decided.id && p.kind === decided.kind)));
  }

  const counts = {
    all: payments.length,
    booking: payments.filter((p) => p.kind === 'booking').length,
    visa: payments.filter((p) => p.kind === 'visa').length,
  };
  const visible = filter === 'all' ? payments : payments.filter((p) => p.kind === filter);

  return (
    <div className="min-h-screen bg-[#F4F7FF]">
      <div className="mx-auto max-w-4xl p-6 lg:p-10">
        <h2 className="mb-5 text-3xl font-bold">NEFT Verification</h2>
        <div className="mb-5 flex flex-wrap gap-2">
          {[
            ['all', 'All'],
            ['booking', 'Bookings'],
            ['visa', 'Visa fees'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                filter === key ? 'border-ink bg-ink text-white' : 'border-line-light bg-white text-muted hover:text-ink'
              }`}
            >
              {label} · {counts[key]} pending
            </button>
          ))}
        </div>

        <ErrorText>{error}</ErrorText>
        {loading && <p className="text-sm text-muted">Loading…</p>}
        {!loading && visible.length === 0 && <p className="text-sm text-muted">No slips awaiting verification.</p>}
        {visible.map((p) => (
          <PendingSlip key={`${p.kind}-${p.id}`} payment={p} onDecided={handleDecided} />
        ))}
      </div>
    </div>
  );
}
