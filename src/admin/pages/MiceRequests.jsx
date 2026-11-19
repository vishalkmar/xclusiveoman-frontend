import { Link } from 'react-router-dom';
import { LuCheck, LuCircleX, LuClock3, LuEye, LuFileText, LuHandshake, LuMailCheck, LuPresentation, LuSend } from 'react-icons/lu';
import { Badge, Button, Table } from '../components/ui.jsx';
import { RequestFilters, RequestStatusCards, RequestStatusTabs } from '../components/requests/RequestControls.jsx';
import { RequestInsights } from '../components/requests/RequestInsights.jsx';
import { MICE_PHASES } from '../components/requests/requestPhases.js';
import { formatStatus } from '../components/requests/requestMeta.js';
import { useRequestPage } from '../components/requests/useRequestPage.js';

// Admin MICE Requests — same layout as the Custom FIT Quote Inbox (status
// cards, filters, insights, status tabs, table), sharing its components in
// components/requests/. Statuses mirror mice_rfq_status (migration 0024).
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'rfp_dispatched', label: 'RFP Dispatched' },
  { value: 'supplier_responses_pending', label: 'Supplier Responses Pending' },
  { value: 'supplier_responses_received', label: 'Supplier Responses Received' },
  { value: 'costed', label: 'Costed' },
  { value: 'published', label: 'Published' },
  { value: 'revision_requested', label: 'Revision Requested' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' },
  { value: 'converted', label: 'Converted' },
];

const STATUS_TONE = {
  submitted: 'amber',
  rfp_dispatched: 'grey',
  supplier_responses_pending: 'grey',
  supplier_responses_received: 'grey',
  costed: 'grey',
  published: 'green',
  revision_requested: 'amber',
  accepted: 'green',
  negotiating: 'amber',
  declined: 'red',
  expired: 'red',
  converted: 'green',
};

const STATUS_CARDS = [
  { value: '', label: 'Total Requests', detail: 'All MICE RFQs', icon: LuFileText, tone: 'blue' },
  { value: 'submitted', label: 'New Requests', detail: 'Awaiting a lead manager', icon: LuClock3, tone: 'blue' },
  { value: 'rfp_dispatched', label: 'RFP Dispatched', detail: 'Sent to suppliers', icon: LuSend, tone: 'teal' },
  { value: 'supplier_responses_pending', label: 'Awaiting Suppliers', detail: 'Supplier quotes pending', icon: LuMailCheck, tone: 'amber' },
  { value: 'published', label: 'Proposal Sent', detail: 'Proposals with agents', icon: LuPresentation, tone: 'violet' },
  { value: 'negotiating', label: 'Negotiating', detail: 'Terms being agreed', icon: LuHandshake, tone: 'amber' },
  { value: 'accepted', label: 'Accepted', detail: 'Confirmed by agents', icon: LuCheck, tone: 'green' },
  { value: 'declined', label: 'Declined', detail: 'Declined or cancelled', icon: LuCircleX, tone: 'red' },
];

const INSIGHT_LABELS = {
  size: 'Avg. group size',
  people: 'delegates',
  upcoming: 'Upcoming events',
  sizeChart: 'Group size',
};

const fmtDate = (value) => new Date(value).toLocaleDateString();

export default function MiceRequests() {
  const {
    filters, updateFilters, clearFilters, setPage, items, pagination, loading, error, stats, statsLoading, agencies, leadManagers,
  } = useRequestPage({ basePath: '/admin/mice-rfqs', listKey: 'miceRfqs', errorLabel: 'MICE requests' });

  const selectStatus = (status) => updateFilters({ status });

  return (
    <div className="min-h-screen bg-[#F4F7FF]">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-10">
        <div className="mb-5">
          <h2 className="text-3xl font-bold text-ink">MICE Requests</h2>
          <p className="mt-1 text-sm text-muted">
            Every MICE RFQ submitted from the Agent MICE Curation screen. Assign a Lead Manager to start working a request.
          </p>
        </div>

        <RequestStatusCards cards={STATUS_CARDS} counts={stats?.statusCounts} total={stats?.total ?? 0} status={filters.status} onSelect={selectStatus} loading={statsLoading} />

        <RequestFilters
          filters={filters}
          onChange={updateFilters}
          onClear={clearFilters}
          statusOptions={STATUS_OPTIONS}
          agencies={agencies}
          leadManagers={leadManagers}
          searchPlaceholder="Search Quote ID, Company, Agent, Destination…"
          showEventDates
        />

        <RequestInsights stats={stats} loading={statsLoading} phases={MICE_PHASES} labels={INSIGHT_LABELS} />

        <RequestStatusTabs options={STATUS_OPTIONS} counts={stats?.statusCounts} status={filters.status} onSelect={selectStatus} />

        {error && <p className="mb-4 text-sm text-[#a5162d]">{error}</p>}
        {loading && items.length === 0 ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : items.length === 0 ? (
          <p className="rounded-lg border border-line-light bg-white px-4 py-8 text-center text-sm text-muted">No MICE requests match those filters.</p>
        ) : (
          <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <Table
              columns={['Quote ID', 'Company / Client', 'Agent', 'Destination', 'Event dates', 'Group size', 'Submitted', 'Status', 'Lead Manager', '']}
              rows={items}
              renderRow={(item) => (
                <tr key={item.id} className="border-b border-line-light last:border-0">
                  <td className="px-3 py-2 font-mono text-[10px]">{item.id.slice(0, 8)}</td>
                  <td className="px-3 py-2 font-semibold">{item.agencyName}</td>
                  <td className="px-3 py-2">{item.agentName}</td>
                  <td className="px-3 py-2">{item.destination}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {fmtDate(item.eventDateFrom)} – {fmtDate(item.eventDateTo)}
                  </td>
                  <td className="px-3 py-2">{item.groupSize}</td>
                  <td className="px-3 py-2">{fmtDate(item.submittedAt)}</td>
                  <td className="px-3 py-2">
                    <Badge tone={STATUS_TONE[item.status] || 'grey'}>{formatStatus(item.status)}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    {item.leadManager ? item.leadManager.fullName : <span className="text-muted">Unassigned</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      to={`/admin/mice-requests/${item.id}`}
                      aria-label="View MICE request"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line-light text-muted hover:border-accent hover:text-accent"
                    >
                      <LuEye size={14} />
                    </Link>
                  </td>
                </tr>
              )}
            />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
              </span>
              <div className="flex gap-2">
                <Button disabled={pagination.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
                <Button disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
