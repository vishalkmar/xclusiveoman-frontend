import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { LuArrowRight, LuBadgeCheck, LuCalendarDays, LuCheck, LuCircleCheck, LuClock, LuCopy, LuCreditCard, LuInfo, LuLandmark, LuShieldCheck, LuUsers, LuZap } from 'react-icons/lu';
import { api } from '../api/client.js';
import { Button, Card, ErrorText, TextInput } from '../components/ui.jsx';
import { formatCurrency, formatInr, formatOmr } from '../../shared/currency.js';
import { useFxRate } from '../../shared/useFxRate.js';
import { usePaymentAttempt } from '../lib/usePaymentAttempt.js';
import { PaymentAttemptStatus } from '../components/PaymentAttemptStatus.jsx';

// Card vs NEFT — a proper two-option selector (icon + name + a one-line
// distinguisher) rather than a pair of generic filter pills, since this is
// the one real decision this page asks the agent to make, not a filter over
// a list. `hint` is the thing that actually differs between the two
// (instant vs. manually verified), not a repeat of the label itself.
const PAYMENT_METHODS = [
  { key: 'card', label: 'Pay by Card', hint: 'Instant, via secure checkout', Icon: LuCreditCard },
  { key: 'neft', label: 'Pay via NEFT', hint: 'Bank transfer, verified manually', Icon: LuLandmark },
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

function newAttemptToken() {
  return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Card checkout with attempt reconciliation (spec J/K/L). The attempt id lives
// in both the URL (?attempt=) and sessionStorage so a browser Back/Forward or
// bfcache restore lands back here, reads it, and reconciles the real state via
// GET /api/payments/:id instead of blindly opening a second checkout.
function CardPanel({ booking, dueNow }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const storageKey = `pay:${booking.id}`;

  const storedAttempt =
    typeof window !== 'undefined' ? (() => { try { return window.sessionStorage.getItem(storageKey); } catch { return null; } })() : null;
  const attemptId = searchParams.get('attempt') || storedAttempt || null;

  const { payment, refetch } = usePaymentAttempt(attemptId);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(''); // '' | 'start' | 'cancel'

  const status = payment?.status;

  // A stored/URL attempt id is meant to reconcile a Back/Forward or bfcache
  // restore mid-checkout, not to be remembered forever — once it's actually
  // confirmed (e.g. the deposit succeeded) but a fresh amount is now due
  // (e.g. the remaining balance, opened via "Complete Payment"), that old
  // attempt no longer describes what a new click does. Drop it so the Pay
  // button reappears instead of permanently showing the old "confirmed".
  useEffect(() => {
    if (status !== 'confirmed' || !(dueNow > 0)) return;
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {
      /* private mode — nothing was persisted to clear */
    }
    const next = new URLSearchParams(searchParams);
    next.delete('attempt');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, dueNow]);

  function persistAttempt(id) {
    try {
      window.sessionStorage.setItem(storageKey, id);
    } catch {
      /* private mode — URL param still carries it */
    }
    const next = new URLSearchParams(searchParams);
    next.set('attempt', id);
    setSearchParams(next, { replace: true });
  }

  // "Pay" / "Resume" / "Try again" are the same call — the backend decides
  // whether to reuse the current active order or supersede a stale one; a
  // fresh token per click is the per-request idempotency key.
  async function startCheckout() {
    setError('');
    setBusy('start');
    try {
      const { paymentId, paymentSessionId, cashfreeMode } = await api.post('/payments/cashfree/create-order', {
        bookingId: booking.id,
        amount: dueNow,
        clientAttemptToken: newAttemptToken(),
      });
      if (!['production', 'sandbox'].includes(cashfreeMode)) {
        throw new Error('Payments are not configured for Cashfree. Please contact support.');
      }
      if (paymentId) persistAttempt(paymentId);
      await refetch();
      if (!paymentSessionId) return; // reuse path with no fresh session (e.g. already paid)
      const Cashfree = await loadCashfreeSdk();
      // Live Cashfree only (the backend's env.cashfree is fixed to the live
      // API). A backend reporting anything else is misconfigured — refuse
      // rather than open a checkout that can't match the order.
      Cashfree({ mode: cashfreeMode }).checkout({ paymentSessionId, redirectTarget: '_self' });
    } catch (err) {
      setError(err.message || 'Unable to start payment');
    } finally {
      setBusy('');
    }
  }

  async function cancelAttempt() {
    if (!attemptId) return;
    setError('');
    setBusy('cancel');
    try {
      await api.post(`/payments/${attemptId}/abort`);
      await refetch();
    } catch (err) {
      setError(err.message || 'Unable to cancel this attempt');
    } finally {
      setBusy('');
    }
  }

  return (
    <Card className="border-[#F0DFC7] p-6 sm:p-7">
      <div className="mb-1 flex items-center gap-2">
        <LuShieldCheck size={14} className="flex-none text-agent-accent-dark" />
        <span className="text-[11px] font-semibold uppercase text-agent-accent-dark">Secure checkout</span>
      </div>
      <p className="mb-5 text-sm text-[#737D8C]">
        You'll be redirected to Cashfree's secure checkout to complete card payment.
      </p>
      <ErrorText>{error}</ErrorText>

      {(status === 'pending' || status === 'awaiting_payment') && (
        <PaymentAttemptStatus
          status={status}
          actions={
            <>
          <Button variant="accent" className="!h-12 !w-full !rounded-xl !bg-[#FFBF47] !text-[#17243A]" disabled={!!busy} onClick={startCheckout}>
                {busy === 'start' ? 'Resuming…' : 'Resume'}
              </Button>
              <Button disabled={!!busy} onClick={cancelAttempt}>
                {busy === 'cancel' ? 'Cancelling…' : 'Cancel payment'}
              </Button>
            </>
          }
        />
      )}

      {status === 'awaiting_confirmation' && <PaymentAttemptStatus status={status} />}

      {status === 'confirmed' && <PaymentAttemptStatus status={status} />}

      {(status === 'failed' || status === 'cancelled') && (
        <PaymentAttemptStatus
          status={status}
          actions={
            <Button variant="accent" className="!h-12 !w-full !rounded-xl !bg-[#FFBF47] !text-[#17243A]" disabled={!!busy} onClick={startCheckout}>
              {busy === 'start' ? 'Starting…' : 'Try again'}
            </Button>
          }
        />
      )}

      {!status && (
        <Button
          variant="accent"
          className="group !h-14 w-full !rounded-xl !bg-[#FFBF47] !text-[#17243A] text-sm"
          disabled={!!busy}
          onClick={startCheckout}
        >
          {busy === 'start' ? 'Starting checkout…' : <><span className="flex items-center gap-2"><LuShieldCheck size={18} />Pay {formatOmr(dueNow)} Now</span><span className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#17243A]/10 transition-transform group-hover:translate-x-1"><LuArrowRight size={19} /></span></>}
        </Button>
      )}
    </Card>
  );
}

function NeftPanel({ booking, dueNow }) {
  const [reference, setReference] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setError('Upload the NEFT transfer slip');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('slip', file);
      formData.append('amount', String(dueNow));
      formData.append('reference', reference);
      await api.postForm(`/payments/${booking.id}/neft-slip`, formData);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Unable to submit slip');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <Card className="border-white">
        <p className="text-sm font-semibold text-[#227647]">Slip submitted for verification.</p>
        <p className="mt-1 text-xs text-agent-muted">Booking confirms once admin verifies the slip.</p>
      </Card>
    );
  }

  return (
    <Card className="border-[#F0DFC7] p-6 sm:p-7">
      <h3 className="mb-1 text-lg font-bold text-[#17243A]">Pay via NEFT</h3>
      <p className="mb-5 text-sm text-[#737D8C]">Transfer the amount below and submit your slip for manual verification.</p>
      <div className="mb-5 rounded-xl border border-[#F0DFC7] bg-[#FFF1DF] px-4 py-4 text-sm leading-relaxed text-[#17243A]">
        <div>Bank: Bank Muscat · A/C: 0123456789 · IFSC/Swift: BMUSOMRXXXX</div>
        <div className="mt-1">
          Reference to booking: <b>{booking.id.slice(0, 8)}</b>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <TextInput
          aria-label="NEFT slip reference number"
          placeholder="Slip reference number"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full rounded-xl border border-[#F0DFC7] bg-white px-3 py-3 text-sm"
        />
        <ErrorText>{error}</ErrorText>
        <Button variant="accent" type="submit" className="!h-14 w-full !rounded-xl !bg-[#FFBF47] !text-[#17243A] text-sm" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit Slip for Verification'}
        </Button>
      </form>
    </Card>
  );
}

// Cashfree's checkout shows no clock for the order expiry, so the page counts
// the seat hold down itself. Time is measured from the server's clock (the
// booking carries serverNow) so a wrong device clock can't skew it. At zero the
// booking is re-read until the backend's release job has cancelled it, which
// swaps this page for the "booking has expired" card.
function HoldCountdown({ expiresAt, serverNow, onElapsed }) {
  const skew = new Date(serverNow).getTime() - Date.now();
  const target = new Date(expiresAt).getTime();
  const remainingMs = () => Math.max(0, target - (Date.now() + skew));
  const [left, setLeft] = useState(remainingMs);

  useEffect(() => {
    const timer = setInterval(() => {
      const next = remainingMs();
      setLeft(next);
      if (next <= 0) onElapsed?.();
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt, serverNow]);

  const total = Math.ceil(left / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  const lapsed = left <= 0;
  const urgent = !lapsed && total <= 120;

  return (
    <div
      role="timer"
      aria-live="off"
      className={`mb-5 flex items-center gap-3 rounded-lg px-4 py-3 text-sm ${
        lapsed
          ? 'bg-red-50 text-red-800'
          : urgent
            ? 'bg-red-50 text-red-700'
            : 'bg-amber-50 text-amber-800'
      }`}
    >
      <LuClock size={18} className="flex-none" />
      {lapsed ? (
        <span>The time to pay has run out. Your seats are being released.</span>
      ) : (
        <span>
          Complete payment within <b className="tabular-nums">{mm}:{ss}</b> to keep your seats.
        </span>
      )}
    </div>
  );
}

function PaymentSummary({ booking, dueNow, remaining, isPartPayment }) {
  const total = formatCurrency(booking.totalPrice);
  const inr = formatInr(dueNow);
  return <>
    <Card className="overflow-hidden border-[#F0DFC7] p-0">
      <div className="bg-gradient-to-br from-[#8A531D] to-[#D97732] px-6 py-5 text-white"><h2 className="text-xl font-bold">Payment Summary</h2><p className="mt-1 text-sm text-white/80">Booking payment details</p></div>
      <div className="p-6">
        <div className="text-xs font-bold uppercase tracking-[0.12em] text-[#D97732]">Amount Due Now</div>
        <div className="mt-2 text-4xl font-extrabold tracking-tight text-[#17243A]">{formatOmr(dueNow)}</div>
        {inr && <div className="mt-1 text-lg font-semibold text-[#737D8C]">≈ {inr}</div>}
        <div className="my-5 border-t border-[#F0DFC7]" />
        <div className="flex items-center justify-between text-sm text-[#737D8C]"><span>Total Booking Value</span><b className="text-[#17243A]">{total}</b></div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-[#FFF1DF] px-3 py-3 text-sm"><span className="font-semibold text-[#17243A]">Amount Payable Now</span><b className="text-[#17243A]">{formatCurrency(dueNow)}</b></div>
        {isPartPayment && <div className="mt-3 flex items-center justify-between text-sm text-[#737D8C]"><span>Remaining balance</span><b className="text-[#17243A]">{formatCurrency(remaining)}</b></div>}
        <div className="mt-4 flex gap-2 rounded-xl bg-[#FFF1DF] px-3 py-3 text-xs leading-relaxed text-[#76502B]"><LuInfo className="mt-0.5 flex-none" size={15} /><span>Visa fees are calculated per traveller and may vary by nationality and service type.</span></div>
      </div>
    </Card>
    <Card className="border-[#F0DFC7] p-6">
      <h2 className="text-lg font-bold text-[#17243A]">Booking Details</h2>
      <div className="mt-4 divide-y divide-[#F0DFC7] text-sm">
        <div className="flex justify-between gap-4 py-3"><span className="text-[#737D8C]">Booking Reference</span><b className="flex max-w-[65%] items-center gap-1 break-all text-right text-[#17243A]">{booking.id}<button type="button" title="Copy booking reference" onClick={() => navigator.clipboard?.writeText(booking.id)} className="flex-none text-[#D97732]"><LuCopy size={14} /></button></b></div>
        {booking.packageName && <div className="flex justify-between gap-4 py-3"><span className="text-[#737D8C]">Package</span><b className="text-right text-[#17243A]">{booking.packageName}</b></div>}
        {Array.isArray(booking.travelers) && <div className="flex justify-between gap-4 py-3"><span className="text-[#737D8C]">Travellers</span><b className="text-[#17243A]"><LuUsers className="mr-1 inline" size={14} />{booking.travelers.length}</b></div>}
        {booking.createdAt && <div className="flex justify-between gap-4 py-3"><span className="text-[#737D8C]">Booking Date</span><b className="text-right text-[#17243A]"><LuCalendarDays className="mr-1 inline" size={14} />{new Date(booking.createdAt).toLocaleString()}</b></div>}
      </div>
    </Card>
  </>;
}

function CheckoutTrust() {
  return <section className="rounded-2xl border border-[#F0DFC7] bg-[#FFF1DF] px-5 py-5 sm:px-7"><h2 className="text-lg font-bold text-[#17243A]">Why Book with Xclusive Oman?</h2><div className="mt-4 grid gap-3 text-sm text-[#76502B] sm:grid-cols-4"><span className="flex items-center gap-2"><LuShieldCheck className="text-[#D97732]" /> Secure payment handling</span><span className="flex items-center gap-2"><LuBadgeCheck className="text-[#D97732]" /> Payment confirmation</span><span className="flex items-center gap-2"><LuUsers className="text-[#D97732]" /> Dedicated support</span><span className="flex items-center gap-2"><LuCheck className="text-[#D97732]" /> Visa assistance</span></div></section>;
}

export default function Payment() {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState(null);
  const [method, setMethod] = useState('card');
  const [error, setError] = useState('');
  useFxRate(() => api.get('/fx-rate'));

  const loadBooking = useCallback(
    () =>
      api
        .get(`/bookings/${bookingId}`)
        .then(({ booking: b }) => setBooking(b))
        .catch((err) => setError(err.message)),
    [bookingId]
  );

  useEffect(() => {
    loadBooking();
  }, [loadBooking]);

  // Once the hold has run out, poll until the release job cancels the booking.
  const [holdElapsed, setHoldElapsed] = useState(false);
  useEffect(() => {
    if (!holdElapsed) return undefined;
    const timer = setInterval(loadBooking, 4000);
    return () => clearInterval(timer);
  }, [holdElapsed, loadBooking]);

  if (error) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <ErrorText>{error}</ErrorText>
      </div>
    );
  }
  if (!booking) {
    return <div className="p-8 text-sm text-agent-muted">Loading…</div>;
  }

  // An unpaid booking whose payment failed, was cancelled or wasn't completed
  // in time is cancelled by the backend and its seats released
  // (seatHold.service.js) — it can't be paid any more, only booked again.
  if (booking.status === 'cancelled' && !(booking.depositPaid > 0)) {
    return (
      <div className="mx-auto max-w-xl p-5 lg:p-8">
        <h2 className="mb-5 text-2xl font-bold text-agent-ink">Payment</h2>
        <Card className="border-white">
          <p className="text-sm font-semibold text-agent-ink">This booking has expired</p>
          <p className="mt-1 text-xs text-agent-muted">
            The payment wasn't completed, so the seats were released and the booking was cancelled. Book again to
            reserve seats.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {booking.sourceType === 'fd_package' && booking.sourceId && (
              <Link to={`/agent/departures/${booking.sourceId}`}>
                <Button variant="accent">Book again</Button>
              </Link>
            )}
            <Link to="/agent/bookings">
              <Button>My bookings</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // booking.amountDueNow is the policy-scheduled amount (the flat deposit, or
  // the full price within 15 days of departure) — it's 0 once that's already
  // been paid, even if a balance still remains for later. If nothing is
  // scheduled due right now but the booking still carries an outstanding
  // balance (the deposit's already in and the agent opened this page via
  // "Complete Payment" to settle early), let them pay off that whole balance
  // instead of a non-actionable 0.
  const scheduledDueNow = booking.amountDueNow ?? booking.balanceDue;
  const outstandingBalance = booking.remainingBalance ?? Math.max(0, booking.balanceDue - scheduledDueNow);
  const dueNow = scheduledDueNow > 0 ? scheduledDueNow : outstandingBalance;
  const remaining = dueNow === scheduledDueNow ? outstandingBalance : 0;
  const isPartPayment = remaining > 0;

  return (
    <div className="w-full bg-[#FFF9EF] px-5 py-6 text-[#17243A] sm:px-7 lg:px-9 lg:py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-5">
        <div><Link to="/agent/dashboard" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#17243A] hover:text-[#D97732]"><span className="text-lg">←</span> Back to dashboard</Link><h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Complete Your Payment</h1><p className="mt-2 text-base text-[#737D8C]">Secure and quick payment to confirm your booking.</p></div>
        <div className="flex items-center gap-2 rounded-full border border-[#F0DFC7] bg-white px-3 py-2 text-xs font-semibold text-[#76502B]"><LuShieldCheck className="text-[#D97732]" size={16} /> Secure Checkout</div>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,0.95fr)]">
        <div className="space-y-6">
          {booking.seatHoldExpiresAt && booking.status === 'pending_payment' && !(booking.depositPaid > 0) && <HoldCountdown expiresAt={booking.seatHoldExpiresAt} serverNow={booking.serverNow} onElapsed={() => setHoldElapsed(true)} />}
          <Card className="border-[#F0DFC7] p-6 sm:p-7">
            <div className="mb-1 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF1DF] text-[#D97732]"><LuCreditCard size={23} /></span><div><h2 className="text-xl font-bold">Choose a Payment Method</h2><p className="mt-1 text-sm text-[#737D8C]">Select your preferred mode of payment to complete the booking.</p></div></div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
        {PAYMENT_METHODS.map(({ key, label, hint, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setMethod(key)}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition ${
              method === key
                ? 'border-[#D97732] bg-[#FFF1DF] shadow-md shadow-[#D97732]/10'
                : 'border-[#F0DFC7] bg-white hover:border-[#D97732]'
            }`}
          >
            <span
              className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${
                method === key ? 'bg-[#FFBF47] text-[#17243A]' : 'bg-[#FFF1DF] text-[#76502B]'
              }`}
            >
              <Icon size={17} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-[#17243A]">{label}</span>
              <span className="block truncate text-[11px] text-[#737D8C]">{key === 'card' ? 'Instant and secure payment via Cashfree.' : 'Bank transfer with manual verification.'}</span>
            </span>
          </button>
        ))}
            </div>
            {method === 'card' && <div className="mt-5 rounded-xl bg-[#F4F1FF] px-4 py-4 text-sm text-[#17243A]"><div className="flex items-center gap-2 font-bold"><LuBadgeCheck className="text-[#D97732]" /> Pay by Card — Recommended</div><div className="mt-3 grid gap-3 text-xs text-[#737D8C] sm:grid-cols-3"><span className="flex items-center gap-2"><LuShieldCheck className="flex-none text-[#D97732]" size={16} />Secure checkout</span><span className="flex items-center gap-2"><LuZap className="flex-none text-[#D97732]" size={16} />Instant verification</span><span className="flex items-center gap-2"><LuCircleCheck className="flex-none text-[#D97732]" size={16} />Payment confirmation</span></div></div>}
            <div className="mt-5">{method === 'card' ? <CardPanel booking={booking} dueNow={dueNow} /> : <NeftPanel booking={booking} dueNow={dueNow} />}</div>
          </Card>
          <CheckoutTrust />
        </div>
        <aside className="space-y-6 xl:sticky xl:top-24"><PaymentSummary booking={booking} dueNow={dueNow} remaining={remaining} isPartPayment={isPartPayment} /></aside>
      </div>
    </div>
  );
}
