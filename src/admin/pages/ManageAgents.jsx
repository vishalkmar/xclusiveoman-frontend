import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LuCalendarDays,
  LuCircleDollarSign,
  LuCircleX,
  LuClock3,
  LuEye,
  LuFileText,
  LuFilter,
  LuMapPin,
  LuSearch,
  LuUserRound,
  LuUsers,
} from 'react-icons/lu';
import { api } from '../api/client.js';
import { formatCurrency as formatOmr } from '../../shared/currency.js';
import { Badge, Card, ErrorText, Pagination, Select, Table, TextInput } from '../components/ui.jsx';

const PAGE_SIZE = 10;
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'approved', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
];
const STATUS_BADGE = { approved: 'green', pending: 'amber', rejected: 'red', suspended: 'grey' };

function formatCurrency(value) {
  return formatOmr(value || 0);
}

function StatCard({ label, value, detail, icon: Icon, tone }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-rose-50 text-rose-600',
  };

  return (
    <Card className="border-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</div>
          <div className="mt-2 text-2xl font-bold text-ink">{value}</div>
          <div className="mt-1 text-[11px] text-muted">{detail}</div>
        </div>
        <div className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${tones[tone]}`}>
          <Icon size={17} />
        </div>
      </div>
    </Card>
  );
}

function AgentAvatar({ name }) {
  return (
    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
      {(name || 'A').slice(0, 2).toUpperCase()}
    </span>
  );
}

export default function ManageAgents() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [type, setType] = useState('');
  const [rm, setRm] = useState('');
  const [page, setPage] = useState(1);
  const [agencies, setAgencies] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 });
  const [stats, setStats] = useState({ total: 0, active: 0, pending: 0, rejected: 0, revenue: 0, bookings: 0, outstanding: 0, newThisMonth: 0 });
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState('');

  function updateFilter(setter, value) {
    setter(value);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (country) params.set('country', country);
    if (city) params.set('city', city);
    if (type) params.set('type', type);
    if (rm) params.set('rmUserId', rm);

    api.get(`/admin/agencies?${params.toString()}`)
      .then(({ agencies: list, pagination: p }) => {
        console.groupCollapsed('[ManageAgents] Agency contact data');
        console.log('API agencies response:', list);
        console.table((list || []).map((agent) => ({
          id: agent.id,
          name: agent.name,
          email: agent.email,
          phone: agent.phone,
          contactPerson: agent.contactPerson,
          contactName: agent.contactName,
          createdByName: agent.createdByName,
        })));
        console.groupEnd();
        if (!cancelled) {
          setAgencies(list || []);
          setPagination(p || { total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 });
        }
      })
      .catch((err) => !cancelled && setError(err.message || 'Unable to load agents'))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [search, status, country, city, type, rm, page]);

  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);
    Promise.all([
      api.get('/admin/analytics/summary'),
      api.get('/admin/agencies?status=approved&page=1&pageSize=1'),
      api.get('/admin/agencies?status=pending&page=1&pageSize=1'),
      api.get('/admin/agencies?status=rejected&page=1&pageSize=1'),
      api.get('/admin/analytics/top-agencies?page=1&pageSize=1'),
    ])
      .then(([summary, active, pending, rejected, topAgencies]) => {
        if (cancelled) return;
        const top = topAgencies?.agencies?.[0];
        setStats({
          total: Number(summary.totalAgencies || 0),
          active: Number(active.pagination?.total || 0),
          pending: Number(pending.pagination?.total || 0),
          rejected: Number(rejected.pagination?.total || 0),
          revenue: Number(summary.totalRevenue || 0),
          bookings: Number(summary.totalBookings || 0),
          outstanding: Number(summary.outstanding || 0),
          newThisMonth: Number(summary.newAgenciesThisMonth || 0),
          topRevenue: Number(top?.revenue || 0),
        });
      })
      .catch((err) => !cancelled && setError(err.message || 'Unable to load agent statistics'))
      .finally(() => !cancelled && setStatsLoading(false));
    return () => { cancelled = true; };
  }, []);

  const locations = useMemo(() => [...new Set(agencies.map((agent) => agent.country).filter(Boolean))], [agencies]);
  const cities = useMemo(() => [...new Set(agencies.map((agent) => agent.city).filter(Boolean))], [agencies]);
  const rms = useMemo(() => [...new Map(agencies.filter((agent) => agent.rmUserId).map((agent) => [agent.rmUserId, agent.rmName || 'Assigned RM']))], [agencies]);

  return (
    <div className="min-h-screen bg-[#F4F7FF]">
      <div className="mx-auto max-w-7xl p-6 lg:p-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-1 text-xs text-muted"><Link to="/admin/support" className="hover:text-accent">Back to Support</Link></div>
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">Manage Agents</h2>
            <p className="mt-1 text-sm text-muted">View, approve and manage all registered agents and agencies.</p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Agents" value={statsLoading ? '—' : stats.total.toLocaleString('en-IN')} detail="All registered agents" icon={LuUsers} tone="blue" />
          <StatCard label="Active Agents" value={statsLoading ? '—' : stats.active.toLocaleString('en-IN')} detail="Approved agents" icon={LuUserRound} tone="green" />
          <StatCard label="Pending Approvals" value={statsLoading ? '—' : stats.pending.toLocaleString('en-IN')} detail="Awaiting approval" icon={LuClock3} tone="amber" />
          <StatCard label="Total Revenue" value={statsLoading ? '—' : formatCurrency(stats.revenue)} detail="From agent bookings" icon={LuCircleDollarSign} tone="green" />
          <StatCard label="Total Bookings" value={statsLoading ? '—' : stats.bookings.toLocaleString('en-IN')} detail="All agent bookings" icon={LuCalendarDays} tone="blue" />
          <StatCard label="Outstanding Payments" value={statsLoading ? '—' : formatCurrency(stats.outstanding)} detail="Pending balance" icon={LuCircleDollarSign} tone="red" />
          <StatCard label="New Agents This Month" value={statsLoading ? '—' : stats.newThisMonth.toLocaleString('en-IN')} detail="Registered this month" icon={LuUserRound} tone="blue" />
          <StatCard label="Rejected Agents" value={statsLoading ? '—' : stats.rejected.toLocaleString('en-IN')} detail="Rejected registrations" icon={LuCircleX} tone="red" />
        </div>

        <Card className="mb-5 border-white p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.5fr)_repeat(5,minmax(120px,1fr))_auto]">
            <div className="relative md:col-span-2 xl:col-span-1">
              <LuSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <TextInput className="pl-9" placeholder="Search by agent name, email, phone, country, or license…" value={search} onChange={(e) => updateFilter(setSearch, e.target.value)} />
            </div>
            <Select aria-label="Filter by status" value={status} onChange={(e) => updateFilter(setStatus, e.target.value)}>{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select>
            <Select aria-label="Filter by country" value={country} onChange={(e) => updateFilter(setCountry, e.target.value)}><option value="">All countries</option>{locations.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
            <Select aria-label="Filter by city" value={city} onChange={(e) => updateFilter(setCity, e.target.value)}><option value="">All cities</option>{cities.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
            <Select aria-label="Filter by agency type" value={type} onChange={(e) => updateFilter(setType, e.target.value)}><option value="">All types</option><option value="mice_company">MICE Company</option><option value="travel_agent">Travel Agent</option></Select>
            <Select aria-label="Filter by relationship manager" value={rm} onChange={(e) => updateFilter(setRm, e.target.value)}><option value="">All managers</option>{rms.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Select>
            <button type="button" onClick={() => { updateFilter(setSearch, ''); updateFilter(setStatus, ''); updateFilter(setCountry, ''); updateFilter(setCity, ''); updateFilter(setType, ''); updateFilter(setRm, ''); }} className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line-light bg-white px-3 py-2 text-xs font-semibold text-ink hover:border-accent hover:text-accent"><LuFilter size={14} /> Clear</button>
          </div>
        </Card>

        <ErrorText>{error}</ErrorText>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-ink">All Agents <span className="ml-1 text-xs font-normal text-muted">{pagination.total}</span></h3>
          <span className="text-xs text-muted">Sorted by newest first</span>
        </div>

        {loading ? <p className="text-sm text-muted">Loading agents…</p> : agencies.length === 0 ? <p className="rounded-lg border border-line-light bg-white p-5 text-sm text-muted">No agents match these filters.</p> : (
          <>
            <Table columns={['Agent / Company', 'Contact details', 'Location', 'Type', 'Status', 'Relationship Manager', 'Bookings', 'Revenue', 'Outstanding', 'Last booking', { label: 'Actions', align: 'right' }]} rows={agencies} renderRow={(agent) => (
              <tr
                key={agent.id}
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/admin/manage-agents/${agent.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/admin/manage-agents/${agent.id}`);
                  }
                }}
                className="cursor-pointer border-b border-line-light last:border-0 hover:bg-indigo-50/50 focus:bg-indigo-50/50 focus:outline-none"
              >
                <td className="px-3 py-3"><div className="flex min-w-[170px] items-center gap-2"><AgentAvatar name={agent.name} /><div><div className="font-semibold text-ink">{agent.name}</div><div className="text-[10px] text-muted">Registered {agent.createdAt ? new Date(agent.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</div></div></div></td>
                <td className="px-3 py-3"><div className="min-w-[170px] text-[11px] text-ink">{agent.email || '—'}</div><div className="text-[11px] text-muted">{agent.phone || '—'}</div></td>
                <td className="px-3 py-3 whitespace-nowrap"><div className="flex items-center gap-1 text-[11px]"><LuMapPin size={12} className="text-red-500" />{agent.city || agent.country || '—'}</div><div className="text-[10px] text-muted">{agent.country || '—'}</div></td>
                <td className="px-3 py-3 whitespace-nowrap text-[11px]">{agent.type === 'mice_company' ? 'MICE' : 'Travel Agent'}</td>
                <td className="px-3 py-3"><Badge tone={STATUS_BADGE[agent.status] || 'grey'}>{agent.status}</Badge></td>
                <td className="px-3 py-3 whitespace-nowrap text-[11px]">{agent.rmName || '—'}</td>
                <td className="px-3 py-3 text-center text-[11px]">{agent.bookingStats?.totalBookings ?? agent.bookingCount ?? '—'}</td>
                <td className="px-3 py-3 whitespace-nowrap text-[11px]">{formatCurrency(agent.bookingStats?.totalValue ?? agent.revenue)}</td>
                <td className="px-3 py-3 whitespace-nowrap text-[11px] text-red-600">{formatCurrency(agent.bookingStats?.outstandingAmount ?? agent.outstanding)}</td>
                <td className="px-3 py-3 whitespace-nowrap text-[11px] text-muted">{agent.lastBookingAt ? new Date(agent.lastBookingAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                <td className="px-3 py-3"><div className="flex justify-end gap-1"><Link onClick={(event) => event.stopPropagation()} to={`/admin/manage-agents/${agent.id}`} aria-label={`View ${agent.name}`} className="flex h-7 w-7 items-center justify-center rounded-md border border-line-light text-muted hover:border-accent hover:text-accent"><LuEye size={14} /></Link><Link onClick={(event) => event.stopPropagation()} to={`/admin/bookings-documents?agency=${agent.id}`} aria-label={`View bookings for ${agent.name}`} className="flex h-7 w-7 items-center justify-center rounded-md border border-line-light text-muted hover:border-accent hover:text-accent"><LuFileText size={14} /></Link></div></td>
              </tr>
            )} />
            <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pagination.pageSize} onChange={setPage} itemLabel="agents" />
          </>
        )}
      </div>
    </div>
  );
}
