import { useCallback, useEffect, useRef, useState } from 'react';
import { LuArrowLeft, LuChartColumn, LuRefreshCw, LuTag, LuTimer } from 'react-icons/lu';
import { api } from '../../api/client.js';
import { getSocket } from '../../lib/socket.js';
import { useToast } from '../../../shared/components/ToastProvider.jsx';
import { downloadDocument } from '../../../shared/documents/downloadDocument.js';
import { StatusDonutChart } from '../charts.jsx';
import { AgentPerformance, MostActiveUsers } from './InsightTables.jsx';
import { AnalyticsFilters } from './AnalyticsFilters.jsx';
import { ChatDrawer } from './ChatDrawer.jsx';
import { ChatLogsTable } from './ChatLogsTable.jsx';
import { NeedsAttention, SupportPerformance } from './PerformanceSections.jsx';
import { SummaryCards } from './SummaryCards.jsx';
import { categoryRows, ChartLegend, ConversationVolumeChart, HorizontalBars, RESOLUTION_LEGEND, ResolutionOverviewChart, ResponseTimeTrendChart, VOLUME_LEGEND } from './SupportCharts.jsx';
import { buildAnalyticsQuery, DEFAULT_FILTERS, STATUS_COLOR_MAP, statusLabel } from './supportMeta.js';
import { EmptyState, Panel, Skeleton } from './SupportPrimitives.jsx';

// Support Center → "Show Analytics": Chat Logs & Analytics dashboard.
// Two requests per filter change, both against the same backend filter
// pipeline (services/supportAnalytics.service.js): /analytics for every
// card/chart/table, /analytics/logs for the paginated Chat Logs table.
// Requests are debounced so typing in a search box doesn't fire per key,
// and stale responses are dropped so a slow early request can't overwrite
// a newer one.

const DEBOUNCE_MS = 300;

function useLatestRequest() {
  const seq = useRef(0);
  return useCallback(() => {
    seq.current += 1;
    const id = seq.current;
    return () => id === seq.current;
  }, []);
}

function ChartPanel({ title, subtitle, icon, legend, loading, empty, emptyText, children }) {
  return (
    <Panel title={title} subtitle={subtitle} actions={legend}>
      {loading ? <Skeleton className="h-[240px]" /> : empty ? <EmptyState icon={icon} title={emptyText} className="h-[240px]" /> : children}
    </Panel>
  );
}

export default function SupportAnalytics({ onBack, onOpenInChat }) {
  const toast = useToast();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('lastActivity');
  const [dashboard, setDashboard] = useState(null);
  const [logs, setLogs] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [agents, setAgents] = useState([]);
  const [drawer, setDrawer] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [dashboardFailed, setDashboardFailed] = useState(false);
  const latestDashboard = useLatestRequest();
  const latestLogs = useLatestRequest();

  const showError = useCallback((message) => toast.error(message), [toast]);

  useEffect(() => {
    api.get('/admin/support/tickets/assignees').then((res) => setAgents(Array.isArray(res?.agents) ? res.agents : [])).catch(() => {});
  }, []);

  // A custom range waits until both dates are picked.
  const customIncomplete = filters.range === 'custom' && (!filters.from || !filters.to);

  useEffect(() => {
    if (customIncomplete) return undefined;
    const isLatest = latestDashboard();
    setLoadingDashboard(true);
    const timer = window.setTimeout(() => {
      api
        .get(`/admin/support/tickets/analytics?${buildAnalyticsQuery(filters)}`)
        .then((res) => {
          if (!isLatest()) return;
          setDashboard(res);
          setDashboardFailed(false);
          setUpdatedAt(new Date());
        })
        .catch((err) => {
          if (!isLatest()) return;
          setDashboardFailed(true);
          showError(err.message || 'Unable to load support analytics');
        })
        .finally(() => isLatest() && setLoadingDashboard(false));
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [filters, refreshKey, customIncomplete, latestDashboard, showError]);

  useEffect(() => {
    if (customIncomplete) return undefined;
    const isLatest = latestLogs();
    setLoadingLogs(true);
    const timer = window.setTimeout(() => {
      api
        .get(`/admin/support/tickets/analytics/logs?${buildAnalyticsQuery(filters, { page, pageSize: 10, sort })}`)
        .then((res) => isLatest() && setLogs(res))
        .catch((err) => isLatest() && showError(err.message || 'Unable to load chat logs'))
        .finally(() => isLatest() && setLoadingLogs(false));
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [filters, page, sort, refreshKey, customIncomplete, latestLogs, showError]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // New messages / workflow changes from anyone refresh the numbers live.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    let timer = null;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(refresh, 1500);
    };
    socket.on('ticket:new_message', schedule);
    socket.on('ticket:updated', schedule);
    return () => {
      window.clearTimeout(timer);
      socket.off('ticket:new_message', schedule);
      socket.off('ticket:updated', schedule);
    };
  }, [refresh]);

  const updateFilters = useCallback((patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }, []);

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }

  async function updateConversation(id, patch) {
    setBusyId(id);
    try {
      await api.patch(`/admin/support/tickets/${id}`, patch);
      const what = patch.status ? (patch.status === 'resolved' ? 'Marked as resolved' : 'Conversation reopened') : patch.priority ? 'Priority updated' : patch.category ? 'Category updated' : patch.assignedToUserId ? 'Conversation assigned' : 'Conversation unassigned';
      toast.success(`${what}.`);
      refresh();
    } catch (err) {
      showError(err.message || 'Unable to update this conversation');
    } finally {
      setBusyId(null);
    }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadDocument(api, `/admin/support/tickets/analytics/export?${buildAnalyticsQuery(filters, { sort })}`, 'chat-logs.csv');
    } catch (err) {
      showError(err.message || 'Unable to export chat logs');
    } finally {
      setExporting(false);
    }
  }

  const openConversation = useCallback((id) => setDrawer({ type: 'conversation', id }), []);
  const firstLoad = loadingDashboard && !dashboard;
  const trends = dashboard?.trends;
  const hasVolume = trends?.volume.some((b) => b.created || b.resolved);
  const hasResponse = trends?.responseTime.some((b) => b.avgMinutes != null);
  const categories = dashboard ? categoryRows(dashboard.categories) : [];

  return (
    <div className="min-h-[calc(100vh-57px)] overflow-x-hidden bg-[#F6F8FD]">
      <div className="mx-auto max-w-[1600px] space-y-4 p-4 sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <button type="button" onClick={onBack} aria-label="Back to conversations" className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-md border border-[#D7DDF0] bg-white text-muted hover:border-[#6366F1] hover:text-[#4F46E5]">
              <LuArrowLeft size={17} />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg font-bold uppercase tracking-wide text-ink sm:text-xl">Chat Logs &amp; Analytics</h1>
              <p className="mt-0.5 text-sm text-muted">Overview of support conversations and performance</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {updatedAt && <span className="hidden text-[11px] text-muted sm:inline">Updated {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
            <button type="button" onClick={refresh} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#D7DDF0] bg-white px-3 text-xs font-semibold text-ink hover:border-[#6366F1] hover:text-[#4F46E5]">
              <LuRefreshCw size={14} className={loadingDashboard ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </header>

        {dashboardFailed && !loadingDashboard && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#FECACA] bg-[#FFF7F7] px-4 py-2.5 text-xs text-[#B91C1C]">
            <span>{dashboard ? 'Couldn’t refresh analytics — showing the last loaded numbers.' : 'Couldn’t load support analytics.'}</span>
            <button type="button" onClick={refresh} className="font-semibold underline underline-offset-2">Try again</button>
          </div>
        )}

        <SummaryCards summary={dashboard?.summary} loading={loadingDashboard} />

        <AnalyticsFilters filters={filters} onChange={updateFilters} onReset={resetFilters} onExport={exportCsv} exporting={exporting} agents={agents} />
        {customIncomplete && <p className="text-xs text-muted">Pick both a start and an end date to apply the custom range.</p>}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <ChartPanel title="Conversation Volume" subtitle="New vs resolved conversations" icon={LuChartColumn} legend={<ChartLegend items={VOLUME_LEGEND} />} loading={firstLoad} empty={!hasVolume} emptyText="No conversations in this range">
              <ConversationVolumeChart data={trends?.volume || []} unit={trends?.unit} />
            </ChartPanel>
          </div>
          <Panel title="Status Breakdown" subtitle="Current status of conversations in view">
            {firstLoad ? (
              <Skeleton className="h-[240px]" />
            ) : (
              <StatusDonutChart data={dashboard?.statusBreakdown || []} statusLabel={statusLabel} colorMap={STATUS_COLOR_MAP} unit="conversation(s)" emptyText="No conversations found" />
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartPanel title="Resolution Overview" subtitle="Received, resolved and still pending — by calendar period" icon={LuChartColumn} legend={<ChartLegend items={RESOLUTION_LEGEND} />} loading={firstLoad} empty={!dashboard?.resolutionOverview.some((r) => r.received || r.resolved)} emptyText="Nothing received or resolved this year">
            <ResolutionOverviewChart rows={dashboard?.resolutionOverview || []} />
          </ChartPanel>
          <ChartPanel title="Response Time Trend" subtitle="Average first-response time" icon={LuTimer} loading={firstLoad} empty={!hasResponse} emptyText="No replied conversations in this range">
            <ResponseTimeTrendChart data={trends?.responseTime || []} unit={trends?.unit} />
          </ChartPanel>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <SupportPerformance performance={dashboard?.performance} loading={loadingDashboard} onOpenConversation={openConversation} />
          <NeedsAttention data={dashboard?.needsAttention} loading={loadingDashboard} onOpenConversation={openConversation} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <MostActiveUsers users={dashboard?.topUsers} loading={loadingDashboard} onOpenUser={(user) => setDrawer({ type: 'user', user })} />
          <Panel title="Top Support Reasons" subtitle="Conversations by category">
            {firstLoad ? (
              <Skeleton className="h-[240px]" />
            ) : categories.every((c) => c.count === 0) ? (
              <EmptyState icon={LuTag} title="No conversations found" className="h-[240px]" />
            ) : (
              <HorizontalBars data={categories} labelKey="label" valueKey="count" valueLabel="Conversations" height={250} />
            )}
          </Panel>
        </div>

        <AgentPerformance agents={dashboard?.agents} loading={loadingDashboard} onFilterAgent={(agent) => updateFilters({ agent })} />

        <ChatLogsTable
          logs={logs?.logs}
          pagination={logs?.pagination}
          loading={loadingLogs}
          filters={filters}
          onFilterChange={updateFilters}
          sort={sort}
          onSortChange={(value) => {
            setSort(value);
            setPage(1);
          }}
          onPageChange={setPage}
          agents={agents}
          onView={openConversation}
          onUpdate={updateConversation}
          busyId={busyId}
        />
      </div>

      <ChatDrawer target={drawer} onClose={() => setDrawer(null)} agents={agents} onUpdate={updateConversation} onOpenInChat={onOpenInChat} refreshKey={refreshKey} onError={showError} />
    </div>
  );
}
