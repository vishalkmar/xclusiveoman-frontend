import { useEffect, useState } from 'react';
import { LuCircleDollarSign, LuCircleX, LuClock3, LuFileText, LuUserRound, LuUsers } from 'react-icons/lu';
import { Link, useNavigate } from 'react-router-dom';
import { Cell, Bar, BarChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { formatCurrency } from '../../shared/currency.js';
import { Badge, Button, Card, ErrorText, FieldLabel, Pagination, Select, Table, TextInput } from '../components/ui.jsx';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
];

const STATUS_BADGE = {
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
  suspended: 'grey',
};

const PAGE_SIZE = 10;
const CHART_COLORS = { pending: '#F59E0B', approved: '#10B981', rejected: '#F43F5E', suspended: '#94A3B8' };
const REGISTERED_DATE_OPTIONS = [
  { value: '', label: 'All registered dates' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'this_month', label: 'This month' },
  { value: 'previous_month', label: 'Previous month' },
  { value: 'last_3_months', label: 'Last 3 months' },
  { value: 'last_6_months', label: 'Last 6 months' },
  { value: 'last_year', label: 'Last year' },
  { value: 'custom', label: 'Custom date range' },
];

// Same page-chrome convention as every other paginated admin list
// (Support.jsx, QuoteInbox.jsx, OperationsList.jsx, BookingsDocuments.jsx):
// a centered `max-w-6xl` column, not a full-bleed table.
function Modal({ title, onClose, children, footer, size = 'md' }) {
  const sizeClass = size === 'xl' ? 'max-w-4xl' : size === 'lg' ? 'max-w-2xl' : 'max-w-md';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className={`relative z-10 flex max-h-[85vh] w-full ${sizeClass} flex-col rounded-lg border border-line-light bg-white p-5 shadow-lg sm:p-6`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-lg leading-none text-muted hover:text-ink">
            ×
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-line-light pt-4">{footer}</div>}
      </div>
    </div>
  );
}

function FieldTile({ label, children }) {
  return (
    <div className="rounded-md bg-panel px-3 py-2">
      <div className="text-[10px] font-semibold uppercase text-muted">{label}</div>
      <div>{children}</div>
    </div>
  );
}

// agencies.license_document_type, chosen at Agent Sign Up (Register.jsx).
const DOCUMENT_TYPE_LABEL = {
  iata: 'IATA',
  gst: 'GST',
  company_registration: 'Company Registration',
};

// The business proof and logo submitted at Sign Up — what an admin checks
// before approving. Agencies registered before these fields existed simply
// show dashes.
function SignUpDocumentTiles({ agency }) {
  return (
    <>
      <FieldTile label="Document type">{DOCUMENT_TYPE_LABEL[agency.licenseDocumentType] || '—'}</FieldTile>
      <FieldTile label="Document">
        {agency.licenseDocumentUrl ? (
          <a href={agency.licenseDocumentUrl} target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
            View uploaded document
          </a>
        ) : (
          '—'
        )}
      </FieldTile>
      <FieldTile label="Company logo">
        {agency.logoAssetUrl ? (
          <a href={agency.logoAssetUrl} target="_blank" rel="noreferrer">
            <img src={agency.logoAssetUrl} alt={`${agency.name} logo`} className="mt-1 h-10 max-w-[140px] object-contain" />
          </a>
        ) : (
          'Not provided'
        )}
      </FieldTile>
    </>
  );
}

function OverviewCard({ label, value, icon: Icon, tone }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-rose-50 text-rose-600',
  };

  return (
    <Card className="border-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</div>
          <div className="mt-2 text-2xl font-bold text-ink">{value}</div>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon size={17} />
        </div>
      </div>
    </Card>
  );
}

function ApprovalCharts({ counts, loading }) {
  const data = STATUS_OPTIONS.slice(1).map(({ value, label }) => ({
    name: label,
    status: value,
    count: counts[value] || 0,
  }));
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
      <Card className="border-white p-4">
        <div className="mb-2"><h3 className="font-bold text-ink">Agency status</h3><p className="mt-1 text-xs text-muted">Current distribution of all agency accounts.</p></div>
        {loading ? <p className="py-16 text-center text-sm text-muted">Loading chart…</p> : total === 0 ? <p className="py-16 text-center text-sm text-muted">No agency data yet.</p> : <div className="h-56"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.filter((item) => item.count > 0)} dataKey="count" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={3}>{data.filter((item) => item.count > 0).map((item) => <Cell key={item.status} fill={CHART_COLORS[item.status]} />)}</Pie><Tooltip formatter={(value, name) => [value, name]} /></PieChart></ResponsiveContainer><div className="-mt-4 text-center text-xs text-muted">{total} total agencies</div></div>}
      </Card>
      <Card className="border-white p-4">
        <div className="mb-2"><h3 className="font-bold text-ink">Approval pipeline</h3><p className="mt-1 text-xs text-muted">Compare agencies by account status.</p></div>
        {loading ? <p className="py-16 text-center text-sm text-muted">Loading chart…</p> : <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: '#F8FAFC' }} /><Bar dataKey="count" name="Agencies" radius={[5, 5, 0, 0]}>{data.map((item) => <Cell key={item.status} fill={CHART_COLORS[item.status]} />)}</Bar></BarChart></ResponsiveContainer></div>}
      </Card>
    </div>
  );
}

// What the panel actually lets an admin *do* next depends entirely on the
// agency's current status — a pending agency gets the credit limit +
// Approve/Reject decision; an already-approved one only gets Deactivate; a suspended
// one only gets Reactivate; a rejected one has no further action here. Each
// status renders its own single, unambiguous action instead of always
// showing the pending-decision form (which is what made an already-approved
// agency still show an "Approve Agency" button).
const DECISION_COPY = {
  approved: {
    hint: 'This agency is active and can sign in, browse, and book. Deactivating suspends their access without deleting their data — their credit limit is kept for when they\'re reactivated.',
    actionLabel: 'Deactivate Agency',
    actionLabelBusy: 'Deactivating…',
    nextStatus: 'suspended',
    actionVariant: 'danger',
  },
  suspended: {
    hint: 'This agency is suspended and cannot sign in. Reactivating restores their previous credit limit.',
    actionLabel: 'Reactivate Agency',
    actionLabelBusy: 'Reactivating…',
    nextStatus: 'approved',
    actionVariant: 'accent',
  },
  rejected: {
    hint: 'This registration was rejected. No further action is available here.',
    actionLabel: null,
  },
};

function DecisionPanel({ agency, onDecided }) {
  const [creditLimit, setCreditLimit] = useState(agency.creditLimit ?? '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState('');

  useEffect(() => {
    setCreditLimit(agency.creditLimit ?? '');
    setError('');
  }, [agency.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function decide(status) {
    setError('');
    setSubmitting(status);
    try {
      const payload = { status };
      if (status === 'approved') {
        if (creditLimit !== '') payload.creditLimit = Number(creditLimit);
        // No rmUserId here — the backend assigns the next Relationship
        // Manager automatically (round-robin) the moment status flips to
        // 'approved'.
      }
      const { agency: updated } = await api.patch(`/admin/agencies/${agency.id}`, payload);
      onDecided(updated);
    } catch (err) {
      setError(err.message || 'Unable to update agency');
    } finally {
      setSubmitting('');
    }
  }

  const isPending = agency.status === 'pending';
  const decisionCopy = DECISION_COPY[agency.status];

  return (
    <Card label="Decision" className="border-white shadow-sm">
      <div className="space-y-4 text-sm">
        {isPending && (
          <>
            <div>
              <FieldLabel>Credit limit (OMR)</FieldLabel>
              <TextInput
                type="number"
                min="0"
                step="0.001"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                placeholder="e.g. 5000"
              />
            </div>
            <p className="rounded-md bg-panel px-3 py-2 text-xs text-muted">
              A Relationship Manager is assigned automatically (round-robin) on approval — no need to pick one.
            </p>
          </>
        )}

        {decisionCopy && <p className="rounded-md bg-panel px-3 py-2 text-xs text-muted">{decisionCopy.hint}</p>}

        <ErrorText>{error}</ErrorText>

        <div className="flex flex-wrap gap-2 pt-1">
          {isPending && (
            <>
              <Button variant="accent" className="flex-1 sm:flex-none" disabled={!!submitting} onClick={() => decide('approved')}>
                {submitting === 'approved' ? 'Approving…' : 'Approve Agency'}
              </Button>
              <Button variant="danger" disabled={!!submitting} onClick={() => decide('rejected')}>
                {submitting === 'rejected' ? 'Rejecting…' : 'Reject'}
              </Button>
            </>
          )}
          {decisionCopy?.actionLabel && (
            <Button variant={decisionCopy.actionVariant} disabled={!!submitting} onClick={() => decide(decisionCopy.nextStatus)}>
              {submitting === decisionCopy.nextStatus ? decisionCopy.actionLabelBusy : decisionCopy.actionLabel}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// A quick, read-only glance at who the agency is — no decision controls.
// "View Profile" and "View Details" both open a modal over the same table
// (there's no separate agency-profile route in this app to link out to);
// this is the shorter of the two, "View Details" below is the full
// submitted-details + decision workflow.
function AgencyProfileModal({ agency, onClose }) {
  return (
    <Modal title={agency.name} onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
      <div className="mb-4 flex items-center gap-2">
        <Badge tone={STATUS_BADGE[agency.status] || 'grey'}>{agency.status}</Badge>
        <span className="text-xs text-muted">Registered {new Date(agency.createdAt).toLocaleDateString()}</span>
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <FieldTile label="Type">{agency.type === 'mice_company' ? 'MICE Company' : 'Travel Agent'}</FieldTile>
        <FieldTile label="Country">{agency.country}</FieldTile>
        <FieldTile label="Document number">{agency.licenseNumber || '—'}</FieldTile>
        <SignUpDocumentTiles agency={agency} />
        <FieldTile label="Relationship Manager">{agency.rmName || '—'}</FieldTile>
        {agency.creditLimit != null && (
          <FieldTile label="Credit limit">{formatCurrency(agency.creditLimit)}</FieldTile>
        )}
      </div>
    </Modal>
  );
}

// The full workflow view — submitted details plus (for Super Admins) the
// approve/reject/deactivate/reactivate decision panel.
function AgencyDetailsModal({ agency, isSuperAdmin, onClose, onDecided }) {
  return (
    <Modal title={`${agency.name} — Details`} onClose={onClose} size="lg">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line-light bg-panel/60 p-4">
        <div className="text-sm text-muted">Registered {new Date(agency.createdAt).toLocaleDateString()}</div>
        <Badge tone={STATUS_BADGE[agency.status] || 'grey'}>{agency.status}</Badge>
      </div>

      <Card label="Submitted details" className="mb-5 border-white">
        <div className="grid gap-3 text-sm leading-relaxed sm:grid-cols-2">
          <FieldTile label="Type">{agency.type === 'mice_company' ? 'MICE Company' : 'Travel Agent'}</FieldTile>
          <FieldTile label="Country">{agency.country}</FieldTile>
          <FieldTile label="Document number">{agency.licenseNumber || '—'}</FieldTile>
          <SignUpDocumentTiles agency={agency} />
          {agency.creditLimit != null && (
            <FieldTile label="Credit limit">{formatCurrency(agency.creditLimit)}</FieldTile>
          )}
          {agency.rmUserId && (
            <div className="rounded-md bg-panel px-3 py-2">
              <div className="text-[10px] font-semibold uppercase text-muted">Relationship Manager</div>
              <div>{agency.rmName || 'Assigned'}</div>
              <div className="text-[10px] text-muted">Assigned automatically, round-robin</div>
            </div>
          )}
        </div>
      </Card>

      {isSuperAdmin ? (
        <DecisionPanel agency={agency} onDecided={onDecided} />
      ) : (
        <p className="rounded-lg border border-line-light bg-white p-4 text-sm text-muted shadow-sm">
          Only Super Admins can approve, reject, or reassign agencies — you're viewing this read-only.
        </p>
      )}
    </Modal>
  );
}

export default function AgentApprovals() {
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [registeredRange, setRegisteredRange] = useState('');
  const [registeredFrom, setRegisteredFrom] = useState('');
  const [registeredTo, setRegisteredTo] = useState('');

  const [agencies, setAgencies] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState({ total: 0, revenue: 0, pending: 0, rejected: 0, approved: 0, suspended: 0 });
  const [statusCounts, setStatusCounts] = useState({});
  const [overviewLoading, setOverviewLoading] = useState(true);

  const [detailsAgency, setDetailsAgency] = useState(null);

  function updateStatusFilter(v) {
    setStatusFilter(v);
    setPage(1);
  }
  function updateSearch(v) {
    setSearch(v);
    setPage(1);
  }

  // Pagination is fully server-side (Task: Agent Approvals table) — every
  // filter (status, search) *and* the page slicing itself round-trip to
  // GET /admin/agencies, matching the convention every other paginated
  // admin list already uses (Support.jsx, QuoteInbox.jsx). No page of
  // agencies beyond the current 10 is ever fetched to the browser.
  async function loadAgencies() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      if (registeredRange) params.set('registeredRange', registeredRange);
      if (registeredRange === 'custom' && registeredFrom) params.set('registeredFrom', registeredFrom);
      if (registeredRange === 'custom' && registeredTo) params.set('registeredTo', registeredTo);
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));

      const { agencies: list, pagination: p } = await api.get(`/admin/agencies?${params.toString()}`);
      setAgencies(list);
      setPagination(p);
    } catch (err) {
      setError(err.message || 'Unable to load agencies');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAgencies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, search, page, registeredRange, registeredFrom, registeredTo]);

  useEffect(() => {
    let cancelled = false;
    setOverviewLoading(true);
    Promise.all([
      api.get('/admin/analytics/summary'),
      api.get('/admin/agencies?status=pending&page=1&pageSize=1'),
      api.get('/admin/agencies?status=approved&page=1&pageSize=1'),
      api.get('/admin/agencies?status=rejected&page=1&pageSize=1'),
      api.get('/admin/agencies?status=suspended&page=1&pageSize=1'),
    ])
      .then(([summary, pending, approved, rejected, suspended]) => {
        if (cancelled) return;
        const counts = { pending: Number(pending.pagination?.total || 0), approved: Number(approved.pagination?.total || 0), rejected: Number(rejected.pagination?.total || 0), suspended: Number(suspended.pagination?.total || 0) };
        setStatusCounts(counts);
        setOverview({
          total: Number(summary.totalAgencies || 0),
          revenue: Number(summary.totalRevenue || 0),
          ...counts,
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Unable to load agency overview');
      })
      .finally(() => {
        if (!cancelled) setOverviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleDecided(updatedAgency) {
    setDetailsAgency(updatedAgency);
    // A status-filtered view (e.g. "Pending") should drop the agency, and
    // the total count for this view has changed either way — simplest to
    // just re-fetch the current page from the server rather than patch
    // local state and second-guess whether the count/ordering still match.
    if (statusFilter && updatedAgency.status !== statusFilter) {
      setDetailsAgency(null);
    }
    loadAgencies();
  }

  return (
    <div className="min-h-screen bg-[#F4F7FF]">
      <div className="mx-auto max-w-6xl p-6 lg:p-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Agent Approvals</h2>
            <p className="mt-1.5 text-sm text-muted">Review agency registrations and account status.</p>
          </div>
          <Link
            to="/admin/manage-agents"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#4F46E5] to-[#6366F1] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(79,70,229,0.2)] transition hover:from-[#4338CA] hover:to-[#4F46E5] sm:w-auto sm:min-w-[220px]"
          >
            <LuUsers size={20} />
            Manage Agents
          </Link>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <OverviewCard label="Total Agents" value={overviewLoading ? '—' : overview.total.toLocaleString('en-IN')} icon={LuUsers} tone="blue" />
          <OverviewCard
            label="Revenue"
            value={overviewLoading ? '—' : formatCurrency(overview.revenue)}
            icon={LuCircleDollarSign}
            tone="green"
          />
          <OverviewCard label="Pending" value={overviewLoading ? '—' : overview.pending.toLocaleString('en-IN')} icon={LuClock3} tone="amber" />
          <OverviewCard label="Rejected" value={overviewLoading ? '—' : overview.rejected.toLocaleString('en-IN')} icon={LuCircleX} tone="red" />
        </div>

        <ApprovalCharts counts={statusCounts} loading={overviewLoading} />

        <Card className="mb-5 border-white">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px] lg:items-center">
            <TextInput
              placeholder="Search by agency, country, or license no…"
              value={search}
              onChange={(e) => updateSearch(e.target.value)}
            />
            <Select aria-label="Filter agencies by status" value={statusFilter} onChange={(e) => updateStatusFilter(e.target.value)}>
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
            <Select aria-label="Filter agencies by registration date" value={registeredRange} onChange={(e) => { setRegisteredRange(e.target.value); setPage(1); }}>
              {REGISTERED_DATE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
          </div>
          {registeredRange === 'custom' && <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:max-w-[460px]"><div><FieldLabel>Registered from</FieldLabel><TextInput type="date" value={registeredFrom} onChange={(e) => { setRegisteredFrom(e.target.value); setPage(1); }} /></div><div><FieldLabel>Registered to</FieldLabel><TextInput type="date" value={registeredTo} onChange={(e) => { setRegisteredTo(e.target.value); setPage(1); }} /></div></div>}
        </Card>

        <ErrorText>{error}</ErrorText>

        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : agencies.length === 0 ? (
          <p className="rounded-lg border border-line-light bg-white p-5 text-sm text-muted shadow-sm">
            {search || statusFilter ? 'No agencies match this view.' : 'No agencies yet.'}
          </p>
        ) : (
          <>
            <Table
              columns={['Agency', 'Type', 'Country', 'Document no.', 'Relationship Manager', 'Status', { label: 'Actions', align: 'right' }]}
              rows={agencies}
              renderRow={(agency) => (
                <tr key={agency.id} className="border-b border-line-light transition-colors last:border-0 hover:bg-panel/50">
                  <td className="px-3 py-3 align-middle">
                    <div className="font-semibold text-ink">{agency.name}</div>
                    <div className="text-[11px] text-muted">Registered {new Date(agency.createdAt).toLocaleDateString()}</div>
                  </td>
                  <td className="px-3 py-3 align-middle whitespace-nowrap">{agency.type === 'mice_company' ? 'MICE Company' : 'Travel Agent'}</td>
                  <td className="px-3 py-3 align-middle whitespace-nowrap">{agency.country}</td>
                  <td className="px-3 py-3 align-middle">{agency.licenseNumber || '—'}</td>
                  <td className="px-3 py-3 align-middle">
                    {agency.rmName ? (
                      <>
                        <div className="whitespace-nowrap">{agency.rmName}</div>
                        <div className="whitespace-nowrap text-[11px] text-muted">Assigned automatically</div>
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <Badge tone={STATUS_BADGE[agency.status] || 'grey'}>{agency.status}</Badge>
                  </td>
                  <td className="px-3 py-3 align-middle">
                    {/* flex-nowrap, not flex-wrap — the previous version wrapped
                        onto two ragged rows even where there was room, because
                        the table's auto layout gave this column just enough
                        width to fit one button. Forcing one row here (the
                        outer overflow-x-auto wrapper scrolls horizontally on
                        a narrow viewport instead) keeps every row the same
                        height and the buttons flush to the column's right edge. */}
                    <div className="flex flex-nowrap items-center justify-end gap-2">
                      <Button size="sm" className="whitespace-nowrap" onClick={() => setDetailsAgency(agency)}>
                        <LuFileText className="mr-1.5 flex-shrink-0" size={14} />
                        View Details
                      </Button>
                      <Button size="sm" className="whitespace-nowrap" onClick={() => navigate(`/admin/manage-agents/${agency.id}`)}>
                        <LuUserRound className="mr-1.5 flex-shrink-0" size={14} />
                        View Profile
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            />

            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              pageSize={pagination.pageSize}
              onChange={setPage}
              itemLabel="agencies"
            />
          </>
        )}
      </div>

      {detailsAgency && (
        <AgencyDetailsModal
          agency={detailsAgency}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setDetailsAgency(null)}
          onDecided={handleDecided}
        />
      )}
    </div>
  );
}
