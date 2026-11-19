import { useEffect, useMemo, useState } from 'react';
import { LuInbox, LuSearchX } from 'react-icons/lu';
import { api } from '../api/client.js';
import { ErrorText } from '../components/ui.jsx';
import { BookingsList } from '../components/bookings/BookingsList.jsx';
import { BookingsOverview } from '../components/bookings/BookingsOverview.jsx';
import { BOOKING_TYPES, STATUS_GROUPS, bookingStatus, bookingType } from '../components/bookings/bookingMeta.js';
import { EmptyState, ListCaption, ListSkeleton } from '../components/ledger/ListStates.jsx';
import { PageHeading } from '../components/ledger/PageHeading.jsx';
import { Pagination } from '../components/ledger/Pagination.jsx';
import { SearchFilters } from '../components/ledger/SearchFilters.jsx';
import { UnderlineTabs } from '../components/ledger/UnderlineTabs.jsx';
import { matchesQuery } from '../components/ledger/ledgerUtils.js';
import { usePagination } from '../components/ledger/usePagination.js';

const TYPE_TABS = [{ key: 'all', label: 'All bookings' }, ...BOOKING_TYPES.map((t) => ({ key: t.key, label: t.plural }))];

// Free-text search over what the ledger shows: full or short booking ID, the
// booking type and the status label.
const searchParts = (b) => [b.id, bookingType(b.sourceType).label, bookingStatus(b.status).label, b.status];

// Reuses the existing GET /bookings ("My Bookings") endpoint — no new API.
// Type, status and search filtering and paging all run client-side over that
// one list.
export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('all');
  const [group, setGroup] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    api
      .get('/bookings')
      .then(({ bookings: list }) => setBookings(list || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const typeCounts = useMemo(() => {
    const counts = { all: bookings.length };
    bookings.forEach((b) => (counts[b.sourceType] = (counts[b.sourceType] || 0) + 1));
    return counts;
  }, [bookings]);

  // The overview follows the type tab only, so it describes the whole
  // product line; status/search then narrow the list beneath it.
  const ofType = useMemo(() => (type === 'all' ? bookings : bookings.filter((b) => b.sourceType === type)), [bookings, type]);
  const visible = useMemo(
    () => ofType.filter((b) => (group === 'all' || bookingStatus(b.status).group === group) && matchesQuery(searchParts(b), query)),
    [ofType, group, query]
  );
  const pager = usePagination(visible, [type, group, query], 'bookings-list');

  const scopeLabel = TYPE_TABS.find((t) => t.key === type)?.label;
  const filtered = group !== 'all' || query.trim() !== '';

  function clearFilters() {
    setGroup('all');
    setQuery('');
  }

  return (
    <div className="w-full p-5 lg:p-8">
      <PageHeading title="Bookings" subtitle="Every booking your agency has made across Fixed Departures, Custom FIT, and MICE.">
        <SearchFilters
          query={query}
          onQueryChange={setQuery}
          placeholder="Search ID, type or status"
          filter={group}
          onFilterChange={setGroup}
          options={STATUS_GROUPS}
        />
      </PageHeading>

      <div className="mt-6">
        <UnderlineTabs label="Booking type" tabs={TYPE_TABS} counts={typeCounts} active={type} onChange={setType} />
      </div>

      {error && (
        <div className="mt-6">
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      {!loading && bookings.length > 0 && (
        <div className="mt-6">
          <BookingsOverview bookings={ofType} scopeLabel={scopeLabel} activeGroup={group} onGroupChange={setGroup} />
        </div>
      )}

      <section id="bookings-list" aria-label="Bookings" className="mt-6 scroll-mt-6 overflow-hidden rounded-2xl border border-bk-line bg-white">
        {!loading && bookings.length > 0 && (
          <ListCaption
            filtered={filtered}
            shown={visible.length}
            total={ofType.length}
            noun="booking"
            scopeLabel={scopeLabel}
            filterLabel={STATUS_GROUPS.find((g) => g.key === group)?.label}
            onClear={clearFilters}
          />
        )}

        {loading ? (
          <ListSkeleton />
        ) : bookings.length === 0 ? (
          error ? (
            <EmptyState icon={LuInbox} title="Bookings couldn't be loaded">
              Refresh the page to try again.
            </EmptyState>
          ) : (
            <EmptyState icon={LuInbox} title="No bookings yet">
              Bookings for Fixed Departures, Custom FIT and MICE will appear here once your agency makes them.
            </EmptyState>
          )
        ) : visible.length === 0 ? (
          <EmptyState icon={LuSearchX} title="No bookings match">
            {filtered ? (
              <button type="button" onClick={clearFilters} className="font-semibold text-bk-accent-strong hover:underline">
                Clear the search and status filter
              </button>
            ) : (
              `There are no ${scopeLabel} bookings yet.`
            )}
          </EmptyState>
        ) : (
          <>
            <BookingsList bookings={pager.rows} />
            <Pagination {...pager.pagination} itemLabel="bookings" />
          </>
        )}
      </section>
    </div>
  );
}
