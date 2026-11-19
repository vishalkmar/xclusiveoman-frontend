import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api/client.js';
import { buildRequestParams, DEFAULT_REQUEST_FILTERS } from './requestMeta.js';

// State + data loading shared by the Quote Inbox and MICE Requests pages:
// filters, paging, the paginated list, the /stats call that feeds the status
// cards, tabs and insights, plus the agency / lead-manager option lists.
// Requests are debounced (typing in search) and stale responses are dropped,
// so a slow early request can never overwrite a newer one.

const DEBOUNCE_MS = 250;

function useLatest() {
  const seq = useRef(0);
  return useCallback(() => {
    const id = ++seq.current;
    return () => id === seq.current;
  }, []);
}

/**
 * @param {object} cfg
 * @param {string} cfg.basePath   '/admin/package-requests' | '/admin/mice-rfqs'
 * @param {string} cfg.listKey    response key holding the rows
 * @param {string} cfg.errorLabel used in error messages
 */
export function useRequestPage({ basePath, listKey, errorLabel }) {
  const [filters, setFilters] = useState(DEFAULT_REQUEST_FILTERS);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [agencies, setAgencies] = useState([]);
  const [leadManagers, setLeadManagers] = useState([]);
  const latestList = useLatest();
  const latestStats = useLatest();

  useEffect(() => {
    api.get('/admin/agencies?page=1&pageSize=100').then((res) => setAgencies(res?.agencies || [])).catch(() => setAgencies([]));
    api.get(`${basePath}/lead-manager-candidates`).then((res) => setLeadManagers(res?.staff || [])).catch(() => setLeadManagers([]));
  }, [basePath]);

  // A custom submission range waits until it has at least one bound.
  const customPending = filters.submissionRange === 'custom' && !filters.submittedFrom && !filters.submittedTo;

  useEffect(() => {
    if (customPending) return undefined;
    const isLatest = latestList();
    setLoading(true);
    const timer = window.setTimeout(() => {
      const params = buildRequestParams(filters);
      if (filters.status) params.set('status', filters.status);
      params.set('page', String(page));
      api
        .get(`${basePath}?${params}`)
        .then((res) => {
          if (!isLatest()) return;
          setItems(res?.[listKey] || []);
          setPagination(res?.pagination || { total: 0, page: 1, pageSize: 20, totalPages: 1 });
          setError('');
        })
        .catch((err) => isLatest() && setError(err.message || `Unable to load ${errorLabel}`))
        .finally(() => isLatest() && setLoading(false));
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [basePath, listKey, errorLabel, filters, page, customPending, latestList]);

  // Stats ignore `status` and paging — so changing either doesn't refetch.
  const { status: _status, ...statsFilters } = filters;
  const statsKey = JSON.stringify(statsFilters);
  useEffect(() => {
    if (customPending) return undefined;
    const isLatest = latestStats();
    setStatsLoading(true);
    const timer = window.setTimeout(() => {
      const params = buildRequestParams(JSON.parse(statsKey));
      params.set('tz', String(new Date().getTimezoneOffset()));
      api
        .get(`${basePath}/stats?${params}`)
        .then((res) => isLatest() && setStats(res))
        .catch(() => {
          // The list's own error message already covers a failing backend;
          // stats just keep their last good numbers.
        })
        .finally(() => isLatest() && setStatsLoading(false));
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [basePath, statsKey, customPending, latestStats]);

  const updateFilters = useCallback((patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_REQUEST_FILTERS);
    setPage(1);
  }, []);

  return { filters, updateFilters, clearFilters, page, setPage, items, pagination, loading, error, stats, statsLoading, agencies, leadManagers };
}
