import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LuCircleCheck, LuCircleX, LuLoader } from 'react-icons/lu';
import { api } from '../api/client.js';
import { Button, Card } from '../components/ui.jsx';
import { formatCurrency } from '../../shared/currency.js';

// Where Cashfree sends the agent back after a visa fee checkout
// (?order_id=…). The redirect itself proves nothing — the payment's real
// state comes from the server (GET /visa/payments/by-order/:orderId, which
// checks the order with Cashfree). While it's still settling it's re-checked
// for a short while; the webhook finishes it otherwise.

const OPEN = new Set(['pending', 'awaiting_payment']);
const POLL_MS = 2500;
const MAX_POLLS = 12;

export default function VisaPaymentReturn() {
  const [params] = useSearchParams();
  const orderId = params.get('order_id');
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState('');
  const [polls, setPolls] = useState(0);

  useEffect(() => {
    if (!orderId) {
      setError('Missing payment reference.');
      return undefined;
    }
    let cancelled = false;
    let timer;
    async function check(n) {
      try {
        const { payment: p } = await api.get(`/visa/payments/by-order/${encodeURIComponent(orderId)}`);
        if (cancelled) return;
        setPayment(p);
        setPolls(n);
        if (OPEN.has(p.status) && n < MAX_POLLS) timer = setTimeout(() => check(n + 1), POLL_MS);
      } catch (err) {
        if (!cancelled) setError(err.status === 404 ? 'This payment was not found.' : err.message);
      }
    }
    check(1);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderId]);

  const appId = payment?.applicationId;
  const settling = payment && OPEN.has(payment.status);

  return (
    <div className="mx-auto w-full max-w-xl p-5 lg:p-8">
      <Card className="border-white">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          {error ? (
            <>
              <LuCircleX size={40} className="text-[#B91C1C]" />
              <h2 className="text-xl font-extrabold text-agent-ink">Couldn't check the payment</h2>
              <p className="text-sm text-agent-muted">{error}</p>
              <Link to="/agent/visa/applications">
                <Button>Visa applications</Button>
              </Link>
            </>
          ) : !payment || settling ? (
            <>
              <LuLoader size={36} className="animate-spin text-agent-accent-dark" />
              <h2 className="text-xl font-extrabold text-agent-ink">Confirming your payment…</h2>
              <p className="text-sm text-agent-muted">
                {polls >= MAX_POLLS
                  ? "This is taking longer than usual. You'll get a notification once it's confirmed — no need to pay again."
                  : 'This takes a few seconds. Please keep this page open.'}
              </p>
              {polls >= MAX_POLLS && appId && (
                <Link to={`/agent/visa/applications/${appId}`}>
                  <Button>View application</Button>
                </Link>
              )}
            </>
          ) : payment.status === 'confirmed' ? (
            <>
              <LuCircleCheck size={40} className="text-[#047857]" />
              <h2 className="text-xl font-extrabold text-agent-ink">Payment received</h2>
              <p className="text-sm text-agent-muted">
                {formatCurrency(payment.amount)} paid for {payment.travellers} {payment.travellers === 1 ? 'traveller' : 'travellers'}. Your visa
                application has been submitted.
              </p>
              <Link to={`/agent/visa/applications/${appId}`}>
                <Button variant="accent">View application</Button>
              </Link>
            </>
          ) : (
            <>
              <LuCircleX size={40} className="text-[#B91C1C]" />
              <h2 className="text-xl font-extrabold text-agent-ink">
                {payment.status === 'failed' ? 'Payment failed' : 'Payment cancelled'}
              </h2>
              <p className="text-sm text-agent-muted">No money was taken. You can try again.</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Link to={`/agent/visa/${appId}/pay`}>
                  <Button variant="accent">Try again</Button>
                </Link>
                <Link to={`/agent/visa/applications/${appId}`}>
                  <Button>View application</Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
