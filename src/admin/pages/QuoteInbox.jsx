import { Link } from "react-router-dom";
import {
  LuCheck,
  LuCircleX,
  LuClock3,
  LuEye,
  LuFileText,
  LuSend,
  LuTimer,
  LuRefreshCw,
} from "react-icons/lu";
import { Badge, Button, Table } from "../components/ui.jsx";
import { RequestFilters, RequestStatusCards, RequestStatusTabs } from "../components/requests/RequestControls.jsx";
import { RequestInsights } from "../components/requests/RequestInsights.jsx";
import { FIT_PHASES } from "../components/requests/requestPhases.js";
import { formatStatus } from "../components/requests/requestMeta.js";
import { useRequestPage } from "../components/requests/useRequestPage.js";

// Mirrors package_request_status (migrations 0016/0017) minus 'draft', which
// the inbox never shows (item 1 of this task).
const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "submitted", label: "Submitted" },
  { value: "assigned", label: "Assigned" },
  { value: "costed", label: "Costed" },
  { value: "published", label: "Published" },
  { value: "accepted", label: "Accepted" },
  { value: "revision_requested", label: "Revision Requested" },
  { value: "declined", label: "Declined" },
  { value: "expired", label: "Expired" },
  { value: "converted", label: "Converted" },
];

const STATUS_TONE = {
  submitted: "amber",
  assigned: "grey",
  costed: "grey",
  published: "green",
  accepted: "green",
  revision_requested: "amber",
  declined: "red",
  expired: "red",
  converted: "green",
};

const STATUS_CARDS = [
  { value: "", label: "Total Requests", detail: "All Custom FIT requests", icon: LuFileText, tone: "blue" },
  { value: "submitted", label: "New Requests", detail: "Submitted recently", icon: LuClock3, tone: "blue" },
  { value: "assigned", label: "Under Review", detail: "Being worked on", icon: LuRefreshCw, tone: "amber" },
  { value: "revision_requested", label: "Needs Information", detail: "Waiting for agent reply", icon: LuSend, tone: "amber" },
  { value: "published", label: "Quoted", detail: "Quotes sent to agents", icon: LuFileText, tone: "violet" },
  { value: "accepted", label: "Accepted", detail: "Confirmed by agents", icon: LuCheck, tone: "green" },
  { value: "expired", label: "Expired", detail: "No longer valid", icon: LuTimer, tone: "grey" },
  { value: "declined", label: "Cancelled", detail: "Declined or cancelled", icon: LuCircleX, tone: "red" },
];

const INSIGHT_LABELS = {
  size: "Avg. travellers per request",
  people: "travellers",
  upcoming: "Upcoming departures",
  sizeChart: "Party size",
};

export default function QuoteInbox() {
  const {
    filters, updateFilters, clearFilters, setPage, items, pagination, loading, error, stats, statsLoading, agencies, leadManagers,
  } = useRequestPage({ basePath: "/admin/package-requests", listKey: "packageRequests", errorLabel: "quote inbox" });

  const selectStatus = (status) => updateFilters({ status });

  return (
    <div className='min-h-screen bg-[#F4F7FF]'>
      <div className='mx-auto max-w-7xl p-4 sm:p-6 lg:p-10'>
        <div className='mb-5'>
          <h2 className='text-3xl font-bold text-ink'>Quote Inbox — Custom FIT</h2>
          <p className='mt-1 text-sm text-muted'>
            Every Custom FIT request submitted from the Agent Package Builder.
            Assign a Lead Manager to start working a request.
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
          searchPlaceholder='Search Quote ID, Agent, Agency, Destination…'
        />

        <RequestInsights stats={stats} loading={statsLoading} phases={FIT_PHASES} labels={INSIGHT_LABELS} />

        <RequestStatusTabs options={STATUS_OPTIONS} counts={stats?.statusCounts} status={filters.status} onSelect={selectStatus} />

        {error && <p className='mb-4 text-sm text-[#a5162d]'>{error}</p>}
        {loading && items.length === 0 ? (
          <p className='text-sm text-muted'>Loading…</p>
        ) : items.length === 0 ? (
          <p className='rounded-lg border border-line-light bg-white px-4 py-8 text-center text-sm text-muted'>
            No Custom FIT requests match those filters.
          </p>
        ) : (
          <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <Table
              columns={["Quote ID", "Agency", "Agent", "Destination", "Travel dates", "Adults", "Children", "Submitted", "Status", "Lead Manager", ""]}
              rows={items}
              renderRow={(item) => (
                <tr key={item.id} className='border-b border-line-light last:border-0'>
                  <td className='px-3 py-2 font-mono text-[10px]'>{item.id.slice(0, 8)}</td>
                  <td className='px-3 py-2 font-semibold'>{item.agencyName}</td>
                  <td className='px-3 py-2'>{item.agentName}</td>
                  <td className='px-3 py-2'>{item.destination}</td>
                  <td className='whitespace-nowrap px-3 py-2'>
                    {new Date(item.dateFrom).toLocaleDateString()} – {new Date(item.dateTo).toLocaleDateString()}
                  </td>
                  <td className='px-3 py-2'>{item.paxAdults}</td>
                  <td className='px-3 py-2'>{item.paxChildren}</td>
                  <td className='px-3 py-2'>{new Date(item.submittedAt).toLocaleDateString()}</td>
                  <td className='px-3 py-2'>
                    <Badge tone={STATUS_TONE[item.status] || "grey"}>{formatStatus(item.status)}</Badge>
                  </td>
                  <td className='px-3 py-2'>
                    {item.leadManager ? item.leadManager.fullName : <span className='text-muted'>Unassigned</span>}
                  </td>
                  <td className='px-3 py-2 text-right'>
                    <Link
                      to={`/admin/quote-inbox/${item.id}`}
                      aria-label='View quote'
                      className='inline-flex h-7 w-7 items-center justify-center rounded-md border border-line-light text-muted hover:border-accent hover:text-accent'
                    >
                      <LuEye size={14} />
                    </Link>
                  </td>
                </tr>
              )}
            />

            <div className='mt-4 flex flex-wrap items-center justify-between gap-2'>
              <span className='text-xs text-muted'>
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
              </span>
              <div className='flex gap-2'>
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
