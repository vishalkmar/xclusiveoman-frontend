import { useEffect, useMemo, useState } from 'react';
import { LuReceipt, LuSearchX } from 'react-icons/lu';
import { api } from '../api/client.js';
import { ErrorText } from '../components/ui.jsx';
import { EmptyState, ListCaption, ListSkeleton } from '../components/ledger/ListStates.jsx';
import { PageHeading } from '../components/ledger/PageHeading.jsx';
import { Pagination } from '../components/ledger/Pagination.jsx';
import { SearchFilters } from '../components/ledger/SearchFilters.jsx';
import { UnderlineTabs } from '../components/ledger/UnderlineTabs.jsx';
import { matchesQuery } from '../components/ledger/ledgerUtils.js';
import { usePagination } from '../components/ledger/usePagination.js';
import { TransactionsList } from '../components/transactions/TransactionsList.jsx';
import { TransactionsOverview } from '../components/transactions/TransactionsOverview.jsx';
import {
  METHOD_TABS,
  TRANSACTION_GROUPS,
  TYPE_FILTERS,
  isVisa,
  paymentMethod,
  transactionStatus,
} from '../components/transactions/transactionMeta.js';

const TABS = [{ key: 'all', label: 'All payments' }, ...METHOD_TABS];

// Search over transaction ref, booking / visa application ID, visa, method
// and status.
const searchParts = (t) => [
  t.id,
  t.bookingId,
  t.applicationId,
  isVisa(t) ? `visa fee ${t.visaType} ${t.visaCategory}` : 'booking',
  t.method,
  paymentMethod(t.method).label,
  t.status,
  transactionStatus(t.status).label,
];

const ofType = (t, type) => type === 'all' || (type === 'visa') === isVisa(t);

// GET /agencies/me/transactions returns the agency's booking payments and
// visa fee payments. Type, method, status and search filtering and paging
// all run client-side.
export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [type, setType] = useState('all');
  const [group, setGroup] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    api
      .get('/agencies/me/transactions')
      .then(({ transactions: list }) => setTransactions(list || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const typed = useMemo(() => transactions.filter((t) => ofType(t, type)), [transactions, type]);
  const typeCounts = useMemo(
    () => Object.fromEntries(TYPE_FILTERS.map((f) => [f.key, transactions.filter((t) => ofType(t, f.key)).length])),
    [transactions]
  );

  const tabCounts = useMemo(() => {
    const counts = { all: typed.length };
    typed.forEach((t) => {
      const key = paymentMethod(t.method).tab;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [typed]);

  // The overview follows the method tab only; status/search then narrow the
  // list beneath it.
  const ofTab = useMemo(
    () => (tab === 'all' ? typed : typed.filter((t) => paymentMethod(t.method).tab === tab)),
    [typed, tab]
  );
  const visible = useMemo(
    () => ofTab.filter((t) => (group === 'all' || transactionStatus(t.status).group === group) && matchesQuery(searchParts(t), query)),
    [ofTab, group, query]
  );
  const pager = usePagination(visible, [type, tab, group, query], 'transactions-list');

  const typeLabel = { booking: 'booking', visa: 'visa fee' }[type];
  const tabLabel = TABS.find((t) => t.key === tab)?.label;
  const scopeLabel = typeLabel ? `${tabLabel} · ${type === 'visa' ? 'Visa fees' : 'Bookings'}` : tabLabel;
  const filtered = group !== 'all' || query.trim() !== '';

  function clearFilters() {
    setGroup('all');
    setQuery('');
  }

  return (
    <div className="w-full p-5 lg:p-8">
      <PageHeading title="Payment & Transaction History" subtitle="Every payment your agency has made for its bookings and visa applications.">
        <SearchFilters
          query={query}
          onQueryChange={setQuery}
          placeholder="Search ref, booking, visa or method"
          filter={group}
          onFilterChange={setGroup}
          options={TRANSACTION_GROUPS}
        />
      </PageHeading>

      <div className="mt-6 flex flex-wrap items-center gap-2" role="group" aria-label="Payment for">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={type === f.key}
            onClick={() => setType(f.key)}
            className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
              type === f.key
                ? 'border-bk-ink bg-bk-ink text-white'
                : 'border-bk-line bg-white text-bk-muted hover:text-bk-ink'
            }`}
          >
            {f.label}
            <span className={`ml-1.5 tabular-nums ${type === f.key ? 'text-white/70' : 'text-bk-muted'}`}>{typeCounts[f.key]}</span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        <UnderlineTabs label="Payment method" tabs={TABS} counts={tabCounts} active={tab} onChange={setTab} />
      </div>

      {error && (
        <div className="mt-6">
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      {!loading && transactions.length > 0 && (
        <div className="mt-6">
          <TransactionsOverview transactions={ofTab} scopeLabel={scopeLabel} activeGroup={group} onGroupChange={setGroup} />
        </div>
      )}

      <section
        id="transactions-list"
        aria-label="Transactions"
        className="mt-6 scroll-mt-6 overflow-hidden rounded-2xl border border-bk-line bg-white"
      >
        {!loading && transactions.length > 0 && (
          <ListCaption
            filtered={filtered}
            shown={visible.length}
            total={ofTab.length}
            noun="payment"
            scopeLabel={scopeLabel}
            filterLabel={TRANSACTION_GROUPS.find((g) => g.key === group)?.label}
            onClear={clearFilters}
          />
        )}

        {loading ? (
          <ListSkeleton />
        ) : transactions.length === 0 ? (
          error ? (
            <EmptyState icon={LuReceipt} title="Transactions couldn't be loaded">
              Refresh the page to try again.
            </EmptyState>
          ) : (
            <EmptyState icon={LuReceipt} title="No transactions yet">
              Payments for your bookings and visa applications will appear here.
            </EmptyState>
          )
        ) : visible.length === 0 ? (
          <EmptyState icon={LuSearchX} title="No payments match">
            {filtered ? (
              <button type="button" onClick={clearFilters} className="font-semibold text-bk-accent-strong hover:underline">
                Clear the search and status filter
              </button>
            ) : (
              `There are no ${typeLabel ? `${typeLabel} ` : ''}${tabLabel} payments yet.`
            )}
          </EmptyState>
        ) : (
          <>
            <TransactionsList transactions={pager.rows} />
            <Pagination {...pager.pagination} itemLabel="payments" />
          </>
        )}
      </section>
    </div>
  );
}
