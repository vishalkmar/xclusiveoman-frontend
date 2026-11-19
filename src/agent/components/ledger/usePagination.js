import { useEffect, useState } from 'react';
import { PAGE_SIZES } from './ledgerUtils.js';

// Client-side pages over a list already held in memory. Changing any of
// `resetKeys` (the filters) or the page size goes back to page 1, and the
// page is clamped in case the list shrank under it. `scrollTargetId` is
// scrolled into view on every page change.
export function usePagination(list, resetKeys, scrollTargetId) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setPage(1), [...resetKeys, pageSize]);

  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  function goToPage(next) {
    setPage(Math.min(Math.max(1, next), totalPages));
    if (scrollTargetId) document.getElementById(scrollTargetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // `pagination` spreads straight onto <Pagination />.
  return {
    rows: list.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    pagination: { page: currentPage, pageSize, total: list.length, onPageChange: goToPage, onPageSizeChange: setPageSize },
  };
}
