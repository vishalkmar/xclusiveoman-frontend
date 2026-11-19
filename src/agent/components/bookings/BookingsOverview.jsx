import { useMemo } from 'react';
import { Amount } from '../ledger/Amount.jsx';
import { OverviewPanel, StatusMix } from '../ledger/StatusMix.jsx';
import { plural, sumBy } from '../ledger/ledgerUtils.js';
import { STATUS_GROUPS, bookingStatus } from './bookingMeta.js';
import { formatOmr } from '../../../shared/currency.js';

// One composed overview instead of a row of stat tiles: the live booked value
// on the left, and the status mix (a proportional bar plus a legend that
// doubles as the status filter) on the right. Every figure is summed from the
// bookings passed in — the list already scoped to the selected booking type.
export function BookingsOverview({ bookings, scopeLabel, activeGroup, onGroupChange }) {
  const stats = useMemo(() => {
    const groups = Object.fromEntries(STATUS_GROUPS.map((g) => [g.key, []]));
    bookings.forEach((b) => groups[bookingStatus(b.status).group].push(b));
    const live = bookings.filter((b) => bookingStatus(b.status).group !== 'cancelled');
    return {
      groups,
      live: live.length,
      liveValue: sumBy(live, 'totalPrice'),
      outstanding: sumBy(live, 'balanceDue'),
      owingCount: live.filter((b) => Number(b.balanceDue) > 0).length,
      travellers: sumBy(live, 'pax'),
    };
  }, [bookings]);

  const cancelled = stats.groups.cancelled;
  const items = STATUS_GROUPS.filter((g) => g.key !== 'progress' || stats.groups.progress.length > 0).map((g) => ({
    key: g.key,
    label: g.label,
    bar: g.bar,
    count: stats.groups[g.key].length,
    detail: `${formatOmr(sumBy(stats.groups[g.key], g.amount))}${g.amount === 'balanceDue' ? ' due' : ''}`,
  }));

  return (
    <OverviewPanel
      label="Booking overview"
      mix={<StatusMix total={bookings.length} noun="booking" items={items} active={activeGroup} onChange={onGroupChange} />}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bk-muted">Booked value · {scopeLabel}</p>
      <Amount value={stats.liveValue} size="lg" className="mt-3" />
      <p className="mt-3 text-[12.5px] text-bk-muted">
        {cancelled.length > 0
          ? `Excludes ${cancelled.length} cancelled ${plural(cancelled.length, 'booking')} (${formatOmr(sumBy(cancelled, 'totalPrice'))}).`
          : 'Across every active booking.'}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-dashed border-bk-line pt-5">
        <div>
          <dt className="text-[11.5px] text-bk-muted">Outstanding</dt>
          <dd className="mt-1">
            <Amount value={stats.outstanding} size="sm" />
            <span className="mt-1 block text-[11.5px] text-bk-muted">
              {stats.owingCount} {plural(stats.owingCount, 'booking owes', 'bookings owe')} a balance
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-[11.5px] text-bk-muted">Travellers</dt>
          <dd className="mt-1">
            <span className="block text-[15px] font-bold tabular-nums text-bk-ink">{stats.travellers}</span>
            <span className="mt-1 block text-[11.5px] text-bk-muted">
              on {stats.live} active {plural(stats.live, 'booking')}
            </span>
          </dd>
        </div>
      </dl>
    </OverviewPanel>
  );
}
