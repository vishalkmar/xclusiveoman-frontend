import { Link } from 'react-router-dom';
import { LuStamp } from 'react-icons/lu';
import { Amount } from '../ledger/Amount.jsx';
import { StatusBadge } from '../ledger/StatusBadge.jsx';
import { formatLedgerDate, formatLedgerTime, shortId } from '../ledger/ledgerUtils.js';
import { isVisa, paymentMethod, transactionStatus } from './transactionMeta.js';

const Dot = () => <span aria-hidden className="h-0.5 w-0.5 flex-none rounded-full bg-bk-muted" />;

function MethodLabel({ method }) {
  const { label, icon: Icon } = paymentMethod(method);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13.5px] font-semibold text-bk-ink">
      <Icon strokeWidth={1.75} aria-hidden className="h-4 w-4 text-bk-accent" />
      {label}
    </span>
  );
}

function Status({ status }) {
  const { label, tone } = transactionStatus(status);
  return <StatusBadge tone={tone} label={label} />;
}

const BookingRef = ({ id }) => (
  <span className="font-mono text-[12.5px] tracking-tight text-bk-ink" title={id}>
    #{shortId(id)}
  </span>
);

// What the payment was for: a booking, or a visa application's fee (links to
// the application, with the visa and traveller count underneath).
function PaymentFor({ t }) {
  if (!isVisa(t)) return <BookingRef id={t.bookingId} />;
  return (
    <span className="block min-w-0">
      <Link
        to={`/agent/visa/applications/${t.applicationId}`}
        className="inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-semibold text-bk-accent-strong hover:underline"
        title={t.applicationId}
      >
        <LuStamp strokeWidth={1.75} aria-hidden className="h-3.5 w-3.5" />
        Visa fee · #{shortId(t.applicationId)}
      </Link>
      <span className="mt-0.5 block truncate text-[11.5px] text-bk-muted" title={`${t.visaType} · ${t.visaCategory}`}>
        {t.visaType} · {t.travellers} {t.travellers === 1 ? 'traveller' : 'travellers'}
      </span>
    </span>
  );
}

export function TransactionsList({ transactions }) {
  return (
    <>
      {/* xl and up: fixed columns so amounts line up row to row. */}
      <div className="hidden overflow-x-auto xl:block">
        <table className="w-full min-w-[860px] table-fixed text-left">
          <colgroup>
            <col />
            <col className="w-[210px]" />
            <col className="w-[150px]" />
            <col className="w-[170px]" />
            <col className="w-[210px]" />
          </colgroup>
          <thead>
            <tr className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-bk-muted">
              <th scope="col" className="px-5 pb-3 pt-4 font-semibold">Payment</th>
              <th scope="col" className="px-3 pb-3 pt-4 font-semibold">For</th>
              <th scope="col" className="px-3 pb-3 pt-4 font-semibold">Date</th>
              <th scope="col" className="px-3 pb-3 pt-4 text-right font-semibold">Amount</th>
              <th scope="col" className="pb-3 pl-8 pr-5 pt-4 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => {
              const failed = transactionStatus(t.status).group === 'failed';
              return (
                <tr key={`${t.kind}-${t.id}`} className="border-t border-bk-line-soft transition-colors hover:bg-bk-hover">
                  <td className="px-5 py-4 align-middle">
                    <MethodLabel method={t.method} />
                    <span className="mt-1 block font-mono text-[12px] tracking-tight text-bk-muted" title={t.id}>
                      Ref #{shortId(t.id)}
                    </span>
                  </td>
                  <td className="px-3 py-4 align-middle">
                    <PaymentFor t={t} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 align-middle tabular-nums">
                    <span className="block text-[13px] text-bk-ink">{formatLedgerDate(t.createdAt)}</span>
                    <span className="mt-0.5 block text-[11.5px] text-bk-muted">{formatLedgerTime(t.createdAt)}</span>
                  </td>
                  <td className="px-3 py-4 align-middle">
                    <Amount value={t.amount} align="right" muted={failed} />
                  </td>
                  <td className="py-4 pl-8 pr-5 align-middle">
                    <Status status={t.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Below xl: one card per payment (two across on tablets). */}
      <ul className="grid gap-3 p-3 sm:p-4 md:grid-cols-2 xl:hidden">
        {transactions.map((t) => {
          const failed = transactionStatus(t.status).group === 'failed';
          return (
            <li key={`${t.kind}-${t.id}`} className="rounded-xl border border-bk-line bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <MethodLabel method={t.method} />
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-bk-muted">
                    <span className="font-mono">Ref #{shortId(t.id)}</span>
                    <Dot />
                    <span className="tabular-nums">
                      {formatLedgerDate(t.createdAt)} {formatLedgerTime(t.createdAt)}
                    </span>
                  </p>
                </div>
                <Status status={t.status} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-bk-hover px-3.5 py-3">
                <div className="min-w-0">
                  <dt className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-bk-muted">Amount</dt>
                  <dd className="mt-1">
                    <Amount value={t.amount} muted={failed} />
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-bk-muted">For</dt>
                  <dd className="mt-1">
                    <PaymentFor t={t} />
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
    </>
  );
}
