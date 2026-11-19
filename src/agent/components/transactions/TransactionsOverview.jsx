import { useMemo } from 'react';
import { Amount } from '../ledger/Amount.jsx';
import { OverviewPanel, StatusMix } from '../ledger/StatusMix.jsx';
import { formatLedgerDate, plural, sumBy } from '../ledger/ledgerUtils.js';
import { TRANSACTION_GROUPS, isVisa, paymentMethod, transactionStatus } from './transactionMeta.js';
import { formatOmr } from '../../../shared/currency.js';

// Same composition as the Bookings overview: money received on the left,
// the received / pending / failed mix on the right (legend doubles as the
// status filter). Summed from the transactions of the selected method tab.
export function TransactionsOverview({ transactions, scopeLabel, activeGroup, onGroupChange }) {
  const stats = useMemo(() => {
    const groups = Object.fromEntries(TRANSACTION_GROUPS.map((g) => [g.key, []]));
    transactions.forEach((t) => groups[transactionStatus(t.status).group].push(t));
    const latest = groups.received.reduce(
      (best, t) => (!best || new Date(t.createdAt) > new Date(best.createdAt) ? t : best),
      null
    );
    return {
      groups,
      received: sumBy(groups.received, 'amount'),
      bookingsPaid: new Set(groups.received.filter((t) => !isVisa(t)).map((t) => t.bookingId)).size,
      visasPaid: new Set(groups.received.filter(isVisa).map((t) => t.applicationId)).size,
      latest,
    };
  }, [transactions]);

  const { received, pending } = stats.groups;
  const items = TRANSACTION_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    bar: g.bar,
    count: stats.groups[g.key].length,
    detail: formatOmr(sumBy(stats.groups[g.key], 'amount')),
  }));

  return (
    <OverviewPanel
      label="Payment overview"
      mix={<StatusMix total={transactions.length} noun="payment" items={items} active={activeGroup} onChange={onGroupChange} />}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bk-muted">Received · {scopeLabel}</p>
      <Amount value={stats.received} size="lg" className="mt-3" />
      <p className="mt-3 text-[12.5px] text-bk-muted">
        {received.length > 0
          ? `From ${received.length} successful ${plural(received.length, 'payment')} across ${[
              stats.bookingsPaid > 0 && `${stats.bookingsPaid} ${plural(stats.bookingsPaid, 'booking')}`,
              stats.visasPaid > 0 && `${stats.visasPaid} visa ${plural(stats.visasPaid, 'application')}`,
            ]
              .filter(Boolean)
              .join(' and ')}.`
          : 'No successful payments yet.'}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-dashed border-bk-line pt-5">
        <div>
          <dt className="text-[11.5px] text-bk-muted">Awaiting confirmation</dt>
          <dd className="mt-1">
            <Amount value={sumBy(pending, 'amount')} size="sm" />
            <span className="mt-1 block text-[11.5px] text-bk-muted">
              {pending.length} pending {plural(pending.length, 'payment')}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-[11.5px] text-bk-muted">Last payment received</dt>
          <dd className="mt-1">
            <span className="block whitespace-nowrap text-[15px] font-bold tabular-nums text-bk-ink">
              {stats.latest ? formatLedgerDate(stats.latest.createdAt) : '—'}
            </span>
            {stats.latest && (
              <span className="mt-1 block text-[11.5px] text-bk-muted">
                {formatOmr(stats.latest.amount)} · {paymentMethod(stats.latest.method).label}
              </span>
            )}
          </dd>
        </div>
      </dl>
    </OverviewPanel>
  );
}
