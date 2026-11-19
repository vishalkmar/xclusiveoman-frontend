import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  LuCalendarDays,
  LuCheck,
  LuCircleCheck,
  LuClock,
  LuCreditCard,
  LuFileText,
  LuLandmark,
  LuLock,
  LuShieldCheck,
  LuStamp,
  LuUpload,
  LuUser,
  LuUsers,
} from 'react-icons/lu';
import { api } from '../api/client.js';
import { formatCurrency, formatInr, formatOmr, getOmrToInrRate, subscribeOmrToInrRate } from '../../shared/currency.js';
import {
  FlowCard,
  FlowError,
  FlowLoading,
  InfoBanner,
  PrimaryButton,
  SecondaryButton,
  VisaFlowPage,
  VisaPageHeading,
} from '../components/visa/VisaFlowUi.jsx';
import { FOCUS, visaSummaryLine } from '../components/visa/visaFlowTokens.js';

// Visa application step 5 — pay the visa fee to submit the application.
// The amount is worked out by the server (fee per person × travellers, see
// visaPayments.controller.js) and only offered once every traveller is
// complete. Card goes through Cashfree's checkout (back on
// /agent/visa/payments/return); NEFT uploads a slip that finance verifies.
// Paying submits the application and locks the travellers.
//
// Layout (VisaFlowUi.jsx): payment method + its panel on the left, the
// selected visa summary (package, travellers, fee, total) on the right.

const METHODS = [
  { key: 'card', label: 'Pay online', hint: 'Card, UPI or net banking · instant', Icon: LuCreditCard },
  { key: 'neft', label: 'NEFT bank transfer', hint: 'Upload the slip · verified by finance', Icon: LuLandmark },
];

const CASHFREE_SDK_URL = 'https://sdk.cashfree.com/js/v3/cashfree.js';

function loadCashfreeSdk() {
  if (window.Cashfree) return Promise.resolve(window.Cashfree);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CASHFREE_SDK_URL;
    script.onload = () => resolve(window.Cashfree);
    script.onerror = () => reject(new Error('Unable to load the payment gateway'));
    document.body.appendChild(script);
  });
}

const days = (n) => `${n} ${Number(n) === 1 ? 'day' : 'days'}`;

function SummaryRow({ Icon, label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="flex items-center gap-2.5 text-[#737D8C]">
        <Icon size={16} className="flex-none text-[#E87535]" /> {label}
      </span>
      <span className="text-right font-semibold text-[#17243A]">{children}</span>
    </div>
  );
}

// Right column (first on phones): what's being paid for.
function PaymentSummary({ application, quote }) {
  useSyncExternalStore(subscribeOmrToInrRate, getOmrToInrRate);
  const pkg = application.visaPackage;
  const inrTotal = quote ? formatInr(quote.amount) : null;
  return (
    <FlowCard className="order-first p-5 sm:p-6 lg:sticky lg:top-24 lg:order-none">
      <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#737D8C]">Selected visa</div>
      <div className="mt-3 flex items-center gap-3">
        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[#FFF1DF] text-[#E87535]">
          <LuStamp size={22} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-lg font-bold text-[#17243A]">{application.visaType?.name}</div>
          <div className="truncate text-sm text-[#737D8C]">{application.visaCategory?.name}</div>
        </div>
      </div>

      <div className="mt-4 border-t border-[#F0DFC7] pt-3">
        {pkg && (
          <>
            <SummaryRow Icon={LuCalendarDays} label="Valid for">
              {days(pkg.validForDays)}
            </SummaryRow>
            <SummaryRow Icon={LuClock} label="Maximum stay">
              {days(pkg.maxStayDays)}
            </SummaryRow>
          </>
        )}
        {quote && (
          <>
            <SummaryRow Icon={LuUsers} label="Travellers">
              {quote.travellers}
            </SummaryRow>
            <SummaryRow Icon={LuUser} label="Fee per traveller">
              {formatOmr(quote.pricePerPerson)}
            </SummaryRow>
          </>
        )}
      </div>

      {quote && (
        <div className="mt-3 flex items-start justify-between gap-4 border-t border-[#F0DFC7] pt-4">
          <span className="text-[15px] font-semibold text-[#17243A]">Total amount</span>
          <span className="flex flex-col items-end leading-tight">
            <span className="text-2xl font-bold text-[#17243A]">{formatOmr(quote.amount)}</span>
            {inrTotal && <span className="mt-1 text-[13px] text-[#737D8C]">≈ {inrTotal}</span>}
          </span>
        </div>
      )}
      <p className="mt-4 flex items-start gap-2 text-[13px] text-[#737D8C]">
        <LuLock size={14} className="mt-0.5 flex-none" /> Paying submits the application — the travellers can&apos;t be changed afterwards.
      </p>
    </FlowCard>
  );
}

function CardPanel({ applicationId, amount, openAttempt, onChanged }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function startCheckout() {
    setError('');
    setBusy('start');
    try {
      const { paymentSessionId, cashfreeMode } = await api.post(`/visa/applications/${applicationId}/payment/cashfree`, {});
      if (!['production', 'sandbox'].includes(cashfreeMode)) {
        throw new Error('Payments are not configured for Cashfree. Please contact support.');
      }
      const Cashfree = await loadCashfreeSdk();
      Cashfree({ mode: cashfreeMode }).checkout({ paymentSessionId, redirectTarget: '_self' });
    } catch (err) {
      setError(err.message || 'Unable to start payment');
      setBusy('');
      onChanged();
    }
  }

  async function cancelAttempt() {
    setError('');
    setBusy('cancel');
    try {
      await api.post(`/visa/payments/${openAttempt.id}/abort`);
      onChanged();
    } catch (err) {
      setError(err.message || 'Unable to cancel this attempt');
    } finally {
      setBusy('');
    }
  }

  return (
    <FlowCard className="p-5 sm:p-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#17243A]">
        <LuShieldCheck size={17} className="text-[#168765]" /> Secure checkout by Cashfree
      </div>
      <p className="mt-1.5 text-sm text-[#737D8C]">You&apos;ll be redirected to Cashfree to pay by card, UPI or net banking, then brought back here.</p>
      {error && (
        <div className="mt-4">
          <FlowError>{error}</FlowError>
        </div>
      )}
      {openAttempt ? (
        <div className="mt-5 space-y-3">
          <InfoBanner tone="warn" title="A checkout is already open">
            Resume it to finish paying, or cancel it and start again.
          </InfoBanner>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton size="md" disabled={!!busy} onClick={startCheckout}>
              {busy === 'start' ? 'Opening…' : 'Resume payment'}
            </PrimaryButton>
            <SecondaryButton disabled={!!busy} onClick={cancelAttempt}>
              {busy === 'cancel' ? 'Cancelling…' : 'Cancel payment'}
            </SecondaryButton>
          </div>
        </div>
      ) : (
        <PrimaryButton className="mt-5 w-full" disabled={!!busy} onClick={startCheckout}>
          <LuLock size={16} /> {busy === 'start' ? 'Starting checkout…' : `Pay ${formatCurrency(amount)} now`}
        </PrimaryButton>
      )}
    </FlowCard>
  );
}

function NeftPanel({ applicationId, amount, onSubmitted }) {
  const [reference, setReference] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return setError('Upload the NEFT transfer slip.');
    if (!reference.trim()) return setError('Enter the transfer reference (UTR) number.');
    setError('');
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('slip', file);
      form.append('reference', reference.trim());
      await api.postForm(`/visa/applications/${applicationId}/payment/neft`, form);
      onSubmitted();
    } catch (err) {
      setError(err.message || 'Unable to submit the slip');
      setSubmitting(false);
    }
  }

  return (
    <FlowCard className="p-5 sm:p-6">
      <ol className="space-y-4">
        <li className="flex gap-3">
          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#FFF1DF] text-sm font-bold text-[#E87535]">1</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#17243A]">Transfer the amount</p>
            <div className="mt-2 rounded-xl border border-[#F0DFC7] bg-[#FFFCF7] px-4 py-3 text-sm leading-relaxed text-[#17243A]">
              <div>Bank: Bank Muscat · A/C: 0123456789 · IFSC/Swift: BMUSOMRXXXX</div>
              <div className="mt-1">
                Amount: <b>{formatCurrency(amount)}</b> · Reference: <b>{applicationId.slice(0, 8).toUpperCase()}</b>
              </div>
            </div>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#FFF1DF] text-sm font-bold text-[#E87535]">2</span>
          <form id="neft-form" onSubmit={handleSubmit} className="min-w-0 flex-1 space-y-3">
            <p className="text-sm font-semibold text-[#17243A]">Send us the transfer details</p>
            <input
              placeholder="Transfer reference (UTR) number"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              aria-label="Transfer reference (UTR) number"
              className="h-12 w-full rounded-xl border border-[#F0DFC7] bg-white px-4 text-[15px] text-[#17243A] outline-none transition placeholder:text-[#A9AFB8] focus:border-[#FFBF47] focus:ring-2 focus:ring-[#FFBF47]/30"
            />
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3 transition focus-within:ring-2 focus-within:ring-[#FFBF47]/40 ${
                file ? 'border-[#168765]/40 bg-[#EEF8F4]' : 'border-[#E9C99B] bg-[#FFFCF7] hover:border-[#FFBF47]'
              }`}
            >
              <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${file ? 'bg-white text-[#168765]' : 'bg-[#FFF1DF] text-[#E87535]'}`}>
                {file ? <LuCheck size={17} strokeWidth={2.5} /> : <LuUpload size={17} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[#17243A]">{file ? file.name : 'Upload the transfer slip'}</span>
                <span className="block text-[13px] text-[#737D8C]">JPG, PNG, WebP or PDF · up to 10 MB</span>
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="sr-only"
                aria-label="NEFT transfer slip"
              />
            </label>
          </form>
        </li>
      </ol>
      {error && (
        <div className="mt-4">
          <FlowError>{error}</FlowError>
        </div>
      )}
      <PrimaryButton type="submit" form="neft-form" className="mt-5 w-full" disabled={submitting}>
        {submitting ? 'Submitting…' : 'Submit payment for verification'}
      </PrimaryButton>
      <p className="mt-3 text-center text-[13px] text-[#737D8C]">
        The application is submitted once finance verifies the slip. Travellers can&apos;t be changed meanwhile.
      </p>
    </FlowCard>
  );
}

export default function VisaPayment() {
  const { id } = useParams();
  const [application, setApplication] = useState(null);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [method, setMethod] = useState('card');

  const load = useCallback(
    () =>
      Promise.all([api.get(`/visa/applications/${id}`), api.get(`/visa/applications/${id}/payment`)])
        .then(([a, p]) => {
          setApplication(a.application);
          setInfo(p);
        })
        .catch((err) => setError(err.status === 404 ? 'This application was not found.' : err.message)),
    [id]
  );

  useEffect(() => {
    load();
  }, [load]);

  const frame = (children) => (
    <VisaFlowPage current={4} backTo={`/agent/visa/${id}/passports`}>
      <VisaPageHeading title="Payment" subtitle={visaSummaryLine(application)} />
      {children}
    </VisaFlowPage>
  );

  if (error) return frame(<FlowError>{error}</FlowError>);
  if (!application || !info) return frame(<FlowLoading />);

  const latest = info.payments[0] || null;
  const openAttempt = info.payments.find((p) => p.method === 'cashfree' && ['pending', 'awaiting_payment'].includes(p.status)) || null;
  const pendingSlip = info.payments.find((p) => p.status === 'pending_verification') || null;
  const confirmed = info.payments.find((p) => p.status === 'confirmed') || null;
  const detailsLink = (
    <Link
      to={`/agent/visa/applications/${id}`}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#F0DFC7] bg-white px-5 text-sm font-bold text-[#17243A] transition hover:border-[#FFBF47] ${FOCUS}`}
    >
      View application
    </Link>
  );

  let main;
  if (application.status === 'submitted' || confirmed) {
    main = (
      <FlowCard className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E7F5EF] text-[#168765]">
          <LuCircleCheck size={34} />
        </span>
        <h2 className="text-2xl font-bold text-[#17243A]">Paid — application submitted</h2>
        <p className="max-w-md text-sm text-[#737D8C]">
          {formatCurrency(application.paidAmount ?? confirmed?.amount)} received
          {application.paidAt ? ` on ${new Date(application.paidAt).toLocaleDateString()}` : ''}. Our team will process the visa and keep
          you updated.
        </p>
        {detailsLink}
      </FlowCard>
    );
  } else if (application.status === 'payment_review' || pendingSlip) {
    main = (
      <div className="space-y-4">
        <InfoBanner tone="warn" title="NEFT slip under verification">
          {pendingSlip
            ? `${formatCurrency(pendingSlip.amount)} · reference ${pendingSlip.neftReference || '—'} · uploaded ${new Date(
                pendingSlip.createdAt
              ).toLocaleString()}. The application is submitted as soon as finance verifies it.`
            : 'The application is submitted as soon as finance verifies it.'}
        </InfoBanner>
        <div className="flex flex-wrap items-center gap-3">
          {detailsLink}
          {pendingSlip?.neftSlipUrl && (
            <a
              href={pendingSlip.neftSlipUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 rounded text-sm font-semibold text-[#E87535] hover:underline ${FOCUS}`}
            >
              <LuFileText size={15} /> View the uploaded slip
            </a>
          )}
        </div>
      </div>
    );
  } else if (info.blocked) {
    main = (
      <div className="space-y-4">
        <InfoBanner tone="danger" title="Payment isn't available yet">
          {info.blocked.message}
        </InfoBanner>
        <Link
          to={`/agent/visa/${id}/passports`}
          className={`inline-flex h-11 items-center gap-2 rounded-full border border-[#F0DFC7] bg-white px-5 text-sm font-bold text-[#17243A] transition hover:border-[#FFBF47] ${FOCUS}`}
        >
          Back to passports
        </Link>
      </div>
    );
  } else {
    main = (
      <div className="space-y-4">
        {latest?.status === 'rejected' && (
          <InfoBanner tone="danger" title="Your last NEFT slip was rejected">
            {latest.rejectionReason || 'It could not be verified.'} Please pay again.
          </InfoBanner>
        )}
        {!openAttempt && (latest?.status === 'failed' || latest?.status === 'cancelled') && latest.method === 'cashfree' && (
          <InfoBanner tone="warn" title={latest.status === 'failed' ? 'The last payment failed' : 'The last payment was cancelled'}>
            No money was taken. You can try again below.
          </InfoBanner>
        )}

        <div>
          <h2 className="mb-3 text-[15px] font-bold text-[#17243A]">Choose how to pay</h2>
          <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {METHODS.map(({ key, label, hint, Icon }) => {
              const on = method === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setMethod(key)}
                  className={`relative flex items-center gap-3 rounded-2xl border bg-white px-4 py-4 text-left transition ${FOCUS} ${
                    on ? 'border-[#FFBF47] bg-[#FFFCF6] ring-1 ring-[#FFBF47]' : 'border-[#F0DFC7] hover:border-[#FFD68A]'
                  }`}
                >
                  <span
                    className={`flex h-11 w-11 flex-none items-center justify-center rounded-full ${on ? 'bg-[#FFBF47] text-[#17243A]' : 'bg-[#FFF1DF] text-[#E87535]'}`}
                  >
                    <Icon size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold text-[#17243A]">{label}</span>
                    <span className="block text-[13px] text-[#737D8C]">{hint}</span>
                  </span>
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 flex-none items-center justify-center rounded-full ${on ? 'bg-[#FFBF47] text-[#17243A]' : 'border-2 border-[#E2D6C4]'}`}
                  >
                    {on && <LuCheck size={12} strokeWidth={3.5} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {method === 'card' ? (
          <CardPanel applicationId={id} amount={info.quote.amount} openAttempt={openAttempt} onChanged={load} />
        ) : (
          <NeftPanel applicationId={id} amount={info.quote.amount} onSubmitted={load} />
        )}
      </div>
    );
  }

  return frame(
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
      <div className="min-w-0">{main}</div>
      <PaymentSummary application={application} quote={info.quote} />
    </div>
  );
}
