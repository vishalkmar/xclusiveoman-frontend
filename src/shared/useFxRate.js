import { useEffect, useState } from 'react';
import { setOmrToInrRate } from './currency.js';

// Keeps the OMR -> INR display rate current without persisting it anywhere:
// the rate lives only in memory (currency.js), so a reload or a new browser
// never shows a stale figure left over from an earlier session.
//
// It is fetched on mount, then re-fetched on a timer and whenever the tab
// becomes visible again (a laptop that slept overnight, a tab left open for
// days). `fetchRate` resolves to the API's `{ rate }` body (GET /fx-rate).
const REFRESH_MS = 10 * 60 * 1000;
const MIN_GAP_MS = 60 * 1000; // don't re-fetch more often than this on focus

export function useFxRate(fetchRate) {
  const [, rerender] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let lastFetchAt = 0;

    async function load() {
      lastFetchAt = Date.now();
      try {
        const { rate } = await fetchRate();
        if (cancelled) return;
        setOmrToInrRate(rate);
        rerender((n) => n + 1);
      } catch {
        // Keep showing the last good in-memory rate; the next tick retries.
      }
    }

    function onVisible() {
      if (document.visibilityState === 'visible' && Date.now() - lastFetchAt > MIN_GAP_MS) load();
    }

    load();
    const timer = setInterval(load, REFRESH_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // fetchRate is a stable module-level api call at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
