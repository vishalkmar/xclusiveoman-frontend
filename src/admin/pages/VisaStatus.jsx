import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LuBadgeCheck, LuBuilding2, LuClock3, LuEye, LuLandmark, LuList, LuSearch, LuUsers, LuX } from 'react-icons/lu';
import { api } from '../api/client.js';
import { Button, Card, Select, Table, TextInput } from '../components/ui.jsx';
import { RequestStatusCards, RequestStatusTabs } from '../components/requests/RequestControls.jsx';
import { RequestStatusBadge } from '../components/visa/RequestStatusBadge.jsx';
import { VisaProgress } from '../components/visa/VisaProgress.jsx';
import { AgencyCard, AgencySummary } from '../components/visa/AgencyCard.jsx';
import { storedApplicationReference } from '../../agent/components/ledger/ledgerUtils.js';
import {
  DAY_OPTIONS,
  STATUS_CARDS,
  STATUS_TABS,
  ageLabel,
  fmtDate,
  plural,
  requestStatus,
} from '../components/visa/visaAdminMeta.js';

// Admin Application Tracker — every visa request an agent has applied for
// (paid, or with an NEFT slip in review). Two views of the same requests:
//  - Requests: newest first, filtered by agency, how recently it was applied,
//    status, or a reference / agent / traveller search.
//    GET /admin/visa/applications (server-side filters + paging).
//  - By agency (formerly "Visa Issuance"): one card per agency with visas
//    delivered vs. left; opening one shows the Requests view for that agency
//    under its summary. GET /admin/visa/agencies.
// Either way a request opens /admin/visa-requests/:id, where visas are
// uploaded. View and filters live in the URL so Back returns here intact.

const AGENCY_SORTS = {
  pending: { label: 'Most visas left', fn: (a, b) => b.pending - a.pending || new Date(b.lastAppliedAt) - new Date(a.lastAppliedAt) },
  recent: { label: 'Most recent', fn: (a, b) => new Date(b.lastAppliedAt) - new Date(a.lastAppliedAt) },
  name: { label: 'Agency name', fn: (a, b) => a.name.localeCompare(b.name) },
};

const VIEWS = [
  { key: 'requests', label: 'Requests', Icon: LuList },
  { key: 'agencies', label: 'By agency', Icon: LuBuilding2 },
];

function FieldLabel({ children }) {
  return <span className="mb-1 block text-[10px] font-semibold uppercase text-muted">{children}</span>;
}

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <Card className="border-white p-4">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${tone}`}>
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</div>
          <div className="text-2xl font-bold tabular-nums text-ink">{value}</div>
        </div>
      </div>
    </Card>
  );
}

export default function VisaStatus() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'agencies' ? 'agencies' : 'requests';
  const filters = {
    search: params.get('q') || '',
    agencyId: params.get('agency') || '',
    days: params.get('days') || '',
    status: params.get('status') || '',
  };
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [search, setSearch] = useState(filters.search);
  const [data, setData] = useState({ applications: [], pagination: { page: 1, totalPages: 1, total: 0 }, statusCounts: {}, total: 0 });
  const [agencies, setAgencies] = useState([]);
  const [agenciesLoading, setAgenciesLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [agencyQuery, setAgencyQuery] = useState('');
  const [onlyPending, setOnlyPending] = useState(false);
  const [agencySort, setAgencySort] = useState('pending');

  // Merge a patch into the URL; empty values drop out. Any filter change
  // goes back to page 1 unless the patch sets the page itself.
  const update = useCallback(
    (patch) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === '' || v == null) next.delete(k);
            else next.set(k, String(v));
          }
          if (!('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  // Loaded once; serves both the agency filter and the By agency view.
  useEffect(() => {
    api
      .get('/admin/visa/agencies')
      .then(({ agencies: list }) => setAgencies(list || []))
      .catch((err) => setError(err.message || 'Unable to load agencies'))
      .finally(() => setAgenciesLoading(false));
  }, []);

  // Search is typed — wait for a pause before asking the server.
  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() !== filters.search) update({ q: search.trim() });
    }, 350);
    return () => clearTimeout(t);
  }, [search, filters.search, update]);

  useEffect(() => {
    if (view !== 'requests') return;
    const q = new URLSearchParams({ page: String(page), page_size: '15' });
    if (filters.status) q.set('status', filters.status);
    if (filters.agencyId) q.set('agency_id', filters.agencyId);
    if (filters.days) q.set('days', filters.days);
    if (filters.search) q.set('search', filters.search);
    setLoading(true);
    setError('');
    api
      .get(`/admin/visa/applications?${q}`)
      .then(setData)
      .catch((err) => setError(err.message || 'Unable to load visa requests'))
      .finally(() => setLoading(false));
  }, [view, page, filters.status, filters.agencyId, filters.days, filters.search]);

  function clear() {
    setSearch('');
    update({ q: '', agency: '', days: '', status: '' });
  }

  const active = [filters.agencyId, filters.days, filters.status, search.trim()].filter(Boolean).length;
  const selectedAgency = agencies.find((a) => String(a.id) === String(filters.agencyId));
  const { applications, pagination } = data;

  const agencyTotals = useMemo(
    () =>
      agencies.reduce(
        (t, a) => ({
          travellers: t.travellers + a.travellers,
          issued: t.issued + a.issued,
          pending: t.pending + a.pending,
          awaiting: t.awaiting + a.awaitingPayment,
        }),
        { travellers: 0, issued: 0, pending: 0, awaiting: 0 }
      ),
    [agencies]
  );

  const visibleAgencies = useMemo(() => {
    const q = agencyQuery.trim().toLowerCase();
    return agencies
      .filter((a) => (!onlyPending || a.pending > 0) && (!q || `${a.name} ${a.country || ''}`.toLowerCase().includes(q)))
      .sort(AGENCY_SORTS[agencySort].fn);
  }, [agencies, agencyQuery, onlyPending, agencySort]);

  return (
    <div className="min-h-screen bg-[#F4F7FF]">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-10">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-ink">Application Tracker</h2>
            <p className="mt-1 text-sm text-muted">
              Every visa request applied for by agents — who applied, for how many travellers, and how far each one has got. Open a request to
              check documents and upload visas.
            </p>
          </div>
          <div className="flex flex-none gap-1 rounded-lg border border-line-light bg-white p-1" role="tablist" aria-label="View">
            {VIEWS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                onClick={() => update({ view: key === 'requests' ? '' : key })}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold ${
                  view === key ? 'bg-accent text-white' : 'text-muted hover:bg-panel hover:text-ink'
                }`}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="mb-4 text-sm text-[#a5162d]">{error}</p>}

        {view === 'agencies' ? (
          <>
            <div className="mb-5 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
              <Stat icon={LuBuilding2} label="Agents with requests" value={agencies.length} tone="bg-blue-50 text-blue-600" />
              <Stat icon={LuUsers} label="Travellers" value={agencyTotals.travellers} tone="bg-violet-50 text-violet-600" />
              <Stat icon={LuBadgeCheck} label="Visas delivered" value={agencyTotals.issued} tone="bg-emerald-50 text-emerald-600" />
              <Stat icon={LuClock3} label="Visas left" value={agencyTotals.pending} tone="bg-amber-50 text-amber-600" />
            </div>

            <Card className="mb-5 border-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="relative block flex-1">
                  <LuSearch size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <TextInput
                    className="pl-9"
                    placeholder="Search agents…"
                    value={agencyQuery}
                    onChange={(e) => setAgencyQuery(e.target.value)}
                    aria-label="Search agents"
                  />
                </label>
                <Select className="sm:max-w-[200px]" value={agencySort} onChange={(e) => setAgencySort(e.target.value)} aria-label="Sort agents">
                  {Object.entries(AGENCY_SORTS).map(([key, s]) => (
                    <option key={key} value={key}>
                      {s.label}
                    </option>
                  ))}
                </Select>
                <button
                  type="button"
                  aria-pressed={onlyPending}
                  onClick={() => setOnlyPending((v) => !v)}
                  className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-semibold transition ${
                    onlyPending ? 'border-accent bg-accent text-white' : 'border-line-light bg-white text-muted hover:text-ink'
                  }`}
                >
                  Has visas left
                </button>
              </div>
              {agencyTotals.awaiting > 0 && (
                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
                  <LuLandmark size={13} /> {plural(agencyTotals.awaiting, 'request')} waiting on NEFT payment verification aren&apos;t counted as left yet.
                </p>
              )}
            </Card>

            {agenciesLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-[250px] animate-pulse rounded-2xl border border-[#E4E9FB] bg-white" />
                ))}
              </div>
            ) : visibleAgencies.length === 0 ? (
              <p className="rounded-lg border border-line-light bg-white px-4 py-10 text-center text-sm text-muted">
                {agencies.length === 0 ? 'No visa requests yet — agents appear here once they pay for a visa request.' : 'No agents match.'}
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visibleAgencies.map((a, i) => (
                  <AgencyCard key={a.id} agency={a} index={i} onSelect={(agency) => update({ view: '', agency: agency.id, status: '' })} />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {selectedAgency ? (
              <AgencySummary agency={selectedAgency} onClear={() => update({ agency: '' })} />
            ) : (
              <RequestStatusCards
                cards={STATUS_CARDS}
                counts={data.statusCounts}
                total={data.total}
                status={filters.status}
                onSelect={(status) => update({ status })}
                loading={loading}
              />
            )}

            <Card className="mb-4 border-white p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <label className="relative block sm:col-span-2 lg:col-span-2">
                  <FieldLabel>Search</FieldLabel>
                  <LuSearch size={15} className="pointer-events-none absolute bottom-3.5 left-3 text-[#94A3B8]" />
                  <TextInput
                    className="pl-9"
                    placeholder="Reference, agent, traveller or visa…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <label className="block">
                  <FieldLabel>Agent / agency</FieldLabel>
                  <Select value={filters.agencyId} onChange={(e) => update({ agency: e.target.value })}>
                    <option value="">All agencies</option>
                    {agencies.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="block">
                  <FieldLabel>Applied</FieldLabel>
                  <Select value={filters.days} onChange={(e) => update({ days: e.target.value })}>
                    {DAY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="block">
                  <FieldLabel>Status</FieldLabel>
                  <Select value={filters.status} onChange={(e) => update({ status: e.target.value })}>
                    {STATUS_TABS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.value ? requestStatus(o.value).label : 'All statuses'}
                      </option>
                    ))}
                  </Select>
                </label>
                <div className="flex items-end">
                  <Button className="w-full justify-center" disabled={!active} onClick={clear}>
                    <LuX size={14} className="mr-1" /> Clear{active ? ` (${active})` : ''}
                  </Button>
                </div>
              </div>
            </Card>

            <RequestStatusTabs options={STATUS_TABS} counts={data.statusCounts} status={filters.status} onSelect={(status) => update({ status })} />

            {loading && applications.length === 0 ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : applications.length === 0 ? (
              <p className="rounded-lg border border-line-light bg-white px-4 py-10 text-center text-sm text-muted">
                {active ? 'No visa requests match those filters.' : 'No visa requests yet — they appear here once an agent pays for one.'}
              </p>
            ) : (
              <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
                <Table
                  columns={['Request', 'Agency / agent', 'Visa', 'Travellers', 'Visas', 'Applied', 'Status', '']}
                  rows={applications}
                  renderRow={(a) => (
                    <tr key={a.id} className="border-b border-line-light align-top last:border-0">
                      <td className="px-3 py-3">
                        <Link to={`/admin/visa-requests/${a.id}`} className="font-mono text-[11px] font-semibold text-accent hover:underline">
                          #{a.reference}
                        </Link>
                        <div className="mt-0.5 truncate font-mono text-[10px] text-muted" title={a.id}>Application ID: {storedApplicationReference(a)}</div>
                        {a.paidAmount != null && <div className="mt-0.5 text-[10px] text-muted">Paid OMR {a.paidAmount.toFixed(3)}</div>}
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => update({ agency: a.agency.id })}
                          className="text-left font-semibold text-ink hover:text-accent hover:underline"
                          title={`Show only ${a.agency.name}'s requests`}
                        >
                          {a.agency.name}
                        </button>
                        <div className="text-[11px] text-muted">{a.createdBy.name || '—'}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-ink">{a.visaType.name}</div>
                        <div className="text-[11px] text-muted">{a.visaCategory.name}</div>
                      </td>
                      <td className="max-w-[220px] px-3 py-3">
                        <div className="font-medium text-ink">{plural(a.travellers, 'traveller')}</div>
                        <div className="truncate text-[11px] text-muted" title={a.travellerNames.join(', ')}>
                          {a.travellerNames.join(', ') || '—'}
                        </div>
                      </td>
                      <td className="min-w-[140px] px-3 py-3">
                        <VisaProgress issued={a.visasIssued} rejected={a.visasRejected} total={a.travellers} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <div className="text-ink">{fmtDate(a.appliedAt)}</div>
                        <div className="text-[10px] text-muted">{ageLabel(a.appliedAt)}</div>
                      </td>
                      <td className="px-3 py-3">
                        <RequestStatusBadge status={a.status} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link
                          to={`/admin/visa-requests/${a.id}`}
                          aria-label={`Open visa request ${a.reference}`}
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
                    Page {pagination.page} of {pagination.totalPages} · {plural(pagination.total, 'request')}
                  </span>
                  <div className="flex gap-2">
                    <Button disabled={pagination.page <= 1} onClick={() => update({ page: page > 2 ? page - 1 : '' })}>
                      Previous
                    </Button>
                    <Button disabled={pagination.page >= pagination.totalPages} onClick={() => update({ page: page + 1 })}>
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
