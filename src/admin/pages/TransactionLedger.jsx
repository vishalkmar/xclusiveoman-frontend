import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { formatCurrency } from '../../shared/currency.js';
import { Badge, Select, Table } from '../components/ui.jsx';

// Every money movement, newest first: booking transactions
// (GET /admin/transactions — transactions.status: 'confirmed' kept only for
// historical rows, 'balance_due', 'fully_paid') and visa fee payments
// (GET /admin/visa-payments — 'confirmed', 'pending_verification' for an
// NEFT slip awaiting verification, 'rejected').
const STATUS_TONE = {
  confirmed: 'green',
  balance_due: 'amber',
  fully_paid: 'green',
  pending_verification: 'amber',
  rejected: 'red',
};
const STATUS_LABEL = {
  confirmed: 'Paid',
  balance_due: 'Balance due',
  fully_paid: 'Fully paid',
  pending_verification: 'NEFT in verification',
  rejected: 'Rejected',
};
const BOOKING_STATUSES = new Set(['balance_due', 'fully_paid', 'confirmed']);
const VISA_STATUSES = new Set(['confirmed', 'pending_verification', 'rejected']);
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'balance_due', label: 'Balance due (booking)' },
  { value: 'fully_paid', label: 'Fully paid (booking)' },
  { value: 'confirmed', label: 'Paid / confirmed' },
  { value: 'pending_verification', label: 'NEFT in verification (visa)' },
  { value: 'rejected', label: 'Rejected (visa)' },
];

export default function TransactionLedger() {
  const [bookingRows, setBookingRows] = useState([]);
  const [visaRows, setVisaRows] = useState([]);
  const [type, setType] = useState('');
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (method) params.set('method', method);
    if (status) params.set('status', status);
    // Only ask each source for statuses/methods it can have (visa fees are
    // never on credit terms).
    const wantBookings = type !== 'visa' && (!status || BOOKING_STATUSES.has(status));
    const wantVisa = type !== 'booking' && (!status || VISA_STATUSES.has(status)) && method !== 'credit_terms';

    setLoading(true);
    setError('');
    Promise.all([
      wantBookings ? api.get(`/admin/transactions?${params}`).then((r) => r.transactions) : Promise.resolve([]),
      wantVisa ? api.get(`/admin/visa-payments?${params}`).then((r) => r.payments) : Promise.resolve([]),
    ])
      .then(([b, v]) => {
        setBookingRows(b);
        setVisaRows(v);
      })
      .catch((err) => setError(err.message || 'Unable to load transactions'))
      .finally(() => setLoading(false));
  }, [type, method, status]);

  // One list, newest first.
  const rows = useMemo(
    () =>
      [
        ...bookingRows.map((t) => ({ ...t, kind: 'booking', ref: t.bookingId, detail: null })),
        ...visaRows.map((p) => ({
          ...p,
          kind: 'visa',
          ref: p.applicationId,
          detail: `${p.visaType} · ${p.visaCategory} · ${p.travellers} traveller${p.travellers === 1 ? '' : 's'}`,
        })),
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [bookingRows, visaRows]
  );

  const visaCollected = visaRows.filter((p) => p.status === 'confirmed').reduce((s, p) => s + p.amount, 0);

  return (
    <div className="min-h-screen bg-[#F4F7FF]">
      <div className="mx-auto max-w-6xl p-6 lg:p-10">
        <h2 className="mb-1 text-3xl font-bold">Transaction Ledger</h2>
        <p className="mb-5 text-sm text-muted">Booking payments and visa fee payments, newest first.</p>

        <div className="mb-5 flex flex-wrap gap-3">
          <Select className="max-w-[170px]" value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
            <option value="">All types</option>
            <option value="booking">Bookings</option>
            <option value="visa">Visa fees</option>
          </Select>
          <Select className="max-w-[160px]" value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Method">
            <option value="">All methods</option>
            <option value="cashfree">Cashfree</option>
            <option value="neft">NEFT</option>
            <option value="credit_terms">Credit Terms</option>
          </Select>
          <Select className="max-w-[230px]" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          {visaRows.length > 0 && (
            <span className="ml-auto self-center text-xs text-muted">
              Visa fees collected in this view: <b className="text-ink">{formatCurrency(visaCollected)}</b>
            </span>
          )}
        </div>

        {error && <p className="mb-3 text-sm text-[#a5162d]">{error}</p>}
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <Table
            columns={['Date', 'Agency', 'Type', 'Reference', 'Amount', 'Method', 'Status']}
            rows={rows}
            renderRow={(t) => (
              <tr key={`${t.kind}-${t.id}`} className="border-b border-line-light last:border-0">
                <td className="px-3 py-2">{new Date(t.createdAt).toLocaleDateString()}</td>
                <td className="px-3 py-2 font-semibold">{t.agencyName}</td>
                <td className="px-3 py-2">
                  {t.kind === 'visa' ? (
                    <Badge className="!border-[#C7D2FE] !bg-[#EEF0FF] !text-[#4338CA]">Visa fee</Badge>
                  ) : (
                    <Badge tone="grey">Booking</Badge>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className="font-mono text-[10px]">{String(t.ref || '').slice(0, 8)}</span>
                  {t.detail && <span className="block text-[11px] text-muted">{t.detail}</span>}
                </td>
                <td className="px-3 py-2">{formatCurrency(t.amount)}</td>
                <td className="px-3 py-2 uppercase">{t.method}</td>
                <td className="px-3 py-2">
                  <Badge tone={STATUS_TONE[t.status] || 'grey'}>{STATUS_LABEL[t.status] || t.status?.replace(/_/g, ' ')}</Badge>
                </td>
              </tr>
            )}
          />
        )}
      </div>
    </div>
  );
}
