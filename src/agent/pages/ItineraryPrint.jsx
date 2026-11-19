import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import ItineraryDocument from '../components/ItineraryDocument.jsx';
import { exposeItineraryPdfBuilder } from '../lib/itineraryPdf.js';
import { computeDayCount } from '../../shared/itinerary/index.js';
import { getApiBaseUrl } from '../../shared/api/backendUrl.js';
import { fetchJson } from '../../shared/api/fetchJson.js';

// Same backend base URL as shared/api/createApiClient.js (not that module
// itself — this page authenticates with the short-lived pdfToken in the
// query string, not a login session's access token, and must never touch
// the session's own refresh-cookie flow (see AuthContext.jsx) which that
// client is wired into).
const BASE_URL = getApiBaseUrl();

// Fills gaps in the backend's composed itinerary (composeItinerary in
// packageRequests.model.js) so every day 1..dayCount renders — the composed
// shape only carries days that actually have notes/items (serializeItinerary
// omits empty days when saving), but ItineraryDocument expects the full
// day-by-day range, same as PackageBuilder.jsx's buildFullItineraryDays
// gives it on screen.
function fillItineraryDays(composedDays, dayCount) {
  const byDay = new Map((composedDays || []).map((d) => [d.dayNumber, d]));
  return Array.from({ length: dayCount }, (_, i) => {
    const n = i + 1;
    return byDay.get(n) || { dayNumber: n, notes: '', items: [] };
  });
}

function waitForImages() {
  const images = Array.from(document.images);
  return Promise.all(
    images.map(
      (img) =>
        img.complete ||
        new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true }); // a broken image shouldn't hang the PDF forever
        })
    )
  );
}

// Standalone print target for the itinerary PDF download (lib/itineraryPdf.js
// loads it in a hidden iframe and builds the PDF from it) — deliberately
// outside AgentLayout/ProtectedRoute (see agent/App.jsx): it needs no login
// session, authenticated instead by the short-lived pdfToken in the
// query string (requirePdfToken, middleware/auth.js). Renders the exact same
// ItineraryDocument.jsx the Review & Submit step shows on screen — reused
// as-is, unmodified — so the PDF matches that design exactly instead of
// drifting from it the way browser print-to-PDF used to.
export default function ItineraryPrint() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const pdfToken = searchParams.get('pdfToken');

  const [packageRequest, setPackageRequest] = useState(null);
  const [branding, setBranding] = useState(null); // the downloading agent (itineraryBranding.service.js)
  const [error, setError] = useState('');

  // Lets PackageBuilder's "Download PDF" (lib/itineraryPdf.js), which loads
  // this page in a hidden iframe, build the PDF from this render.
  useEffect(() => {
    exposeItineraryPdfBuilder();
  }, []);

  useEffect(() => {
    if (!pdfToken) {
      setError('Missing pdfToken');
      return;
    }
    fetchJson(`${BASE_URL}/itinerary-pdf/${id}/data?pdfToken=${encodeURIComponent(pdfToken)}`)
      .then((data) => {
        setBranding(data.branding || null);
        setPackageRequest(data.packageRequest);
      })
      .catch((err) => setError(err.message || 'Unable to load itinerary'));
  }, [id, pdfToken]);

  // Signals readiness to the PDF download (lib/itineraryPdf.js polls for it)
  // once data has loaded (or failed) *and* every image in the document has
  // finished loading, so the capture never misses an image.
  useEffect(() => {
    if (!packageRequest && !error) return undefined;
    if (error) {
      window.__PDF_ERROR__ = error;
      window.__PDF_READY__ = true;
      return undefined;
    }
    let cancelled = false;
    // Defer one frame so the just-rendered <img> tags actually exist in the
    // DOM before checking their .complete state.
    const raf = requestAnimationFrame(() => {
      waitForImages().then(() => {
        if (!cancelled) window.__PDF_READY__ = true;
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [packageRequest, error]);

  if (error) {
    return <div className="p-8 font-mono text-sm text-red-600">Unable to load itinerary: {error}</div>;
  }

  if (!packageRequest) {
    return <div className="p-8 font-mono text-xs text-agent-muted">Loading…</div>;
  }

  const dayCount = computeDayCount(packageRequest.dateFrom, packageRequest.dateTo);

  // Same "how many itinerary days does this hotel actually appear on" proxy
  // for nights that PackageBuilder.jsx's own Review step computes, just
  // sourced from the backend's already-composed itinerary instead of local
  // wizard state.
  const hotelNightsById = {};
  for (const day of packageRequest.itinerary || []) {
    for (const item of day.items || []) {
      if (item.type === 'hotel') hotelNightsById[item.id] = (hotelNightsById[item.id] || 0) + 1;
    }
  }
  const hotelsForDocument = (packageRequest.hotels || []).map((h) => ({ ...h, nights: hotelNightsById[h.id] || 0 }));

  const selectedCounts = {
    hotels: packageRequest.hotels?.length || 0,
    tours: packageRequest.tours?.length || 0,
    transfers: packageRequest.transfers?.length || 0,
    activities: packageRequest.activities?.length || 0,
  };

  return (
    // No padding wrapper — the PDF builder adds real page margins
    // (FIT_ITINERARY_MARGINS_MM, lib/itineraryPdf.js) on every page.
    <div className="bg-white" data-itinerary-pdf-root>
      <ItineraryDocument
        destination={packageRequest.destination}
        dateFrom={packageRequest.dateFrom}
        dateTo={packageRequest.dateTo}
        paxAdults={packageRequest.paxAdults}
        paxChildren={packageRequest.paxChildren}
        dayCount={dayCount}
        hotels={hotelsForDocument}
        days={fillItineraryDays(packageRequest.itinerary, dayCount)}
        selectedCounts={selectedCounts}
        coverImages={[
          ...(packageRequest.tours || []).flatMap((t) => t.images || []),
          ...(packageRequest.hotels || []).flatMap((h) => h.images || []),
          ...(packageRequest.activities || []).flatMap((a) => a.images || []),
        ]}
        branding={branding}
      />
    </div>
  );
}
