import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import FdItineraryDocument from '../components/FdItineraryDocument.jsx';
import { exposeItineraryPdfBuilder } from '../lib/itineraryPdf.js';
import { getApiBaseUrl } from '../../shared/api/backendUrl.js';
import { fetchJson } from '../../shared/api/fetchJson.js';

// Same backend base URL as shared/api/createApiClient.js (not that module
// itself — this page authenticates with the short-lived pdfToken in the
// query string, not a login session's access token, and must never touch
// the session's own refresh-cookie flow (see AuthContext.jsx) which that
// client is wired into). Mirrors ItineraryPrint.jsx.
const BASE_URL = getApiBaseUrl();

function settleImageSet() {
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
  ).then(() => images.length);
}

// Settles once every <img> currently in the document has loaded or errored
// *and* that pass didn't itself change how many images are on the page — a
// broken image can trigger a re-render that swaps in a different <img> (see
// FdItineraryDocument.jsx's PhotoGallery onError fallback), and that new one
// still needs to be waited on. Bounded so a pathological render can't loop
// forever.
async function waitForImages() {
  let last = -1;
  for (let pass = 0; pass < 5; pass += 1) {
    const count = await settleImageSet();
    if (count === last) return;
    last = count;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

// Standalone print target for the FD departure itinerary's PDF download
// (lib/itineraryPdf.js loads it in a hidden iframe and builds the PDF from
// it) — deliberately outside AgentLayout/ProtectedRoute (see agent/App.jsx):
// it needs no login session, authenticated instead by the short-lived FD pdfToken in the query string
// (requireFdPdfToken, middleware/auth.js). Renders FdItineraryDocument.jsx
// unchanged, same "PDF matches the real design exactly" convention
// ItineraryPrint.jsx already established for Custom FIT.
export default function DepartureItineraryPrint() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const pdfToken = searchParams.get('pdfToken');
  const pdfPax = Math.max(1, Number(searchParams.get('pax')) || 1);
  const pdfRatePerPax = Number(searchParams.get('rate'));
  const pdfTotal = Number(searchParams.get('total'));
  const pdfDate = searchParams.get('date') || '';

  const [departure, setDeparture] = useState(null);
  const [branding, setBranding] = useState(null); // the downloading agent (itineraryBranding.service.js)
  const [error, setError] = useState('');

  // Lets the agent's "Download Itinerary" (lib/itineraryPdf.js), which loads
  // this page in a hidden iframe, build the PDF from this render.
  useEffect(() => {
    exposeItineraryPdfBuilder();
  }, []);

  useEffect(() => {
    if (!pdfToken) {
      setError('Missing pdfToken');
      return;
    }
    fetchJson(`${BASE_URL}/fd-itinerary-pdf/${id}/data?pdfToken=${encodeURIComponent(pdfToken)}`)
      .then((data) => {
        setBranding(data.branding || null);
        setDeparture({
          ...data.departure,
          pdfPax,
          pdfRatePerPax: Number.isFinite(pdfRatePerPax) ? pdfRatePerPax : data.departure.ratePerPax,
          pdfTotal: Number.isFinite(pdfTotal) ? pdfTotal : data.departure.ratePerPax,
          pdfDate,
        });
      })
      .catch((err) => setError(err.message || 'Unable to load itinerary'));
  }, [id, pdfToken]);

  // Signals readiness to the PDF download (lib/itineraryPdf.js polls for it)
  // once data has loaded (or failed) *and* every image in the document has
  // finished loading, so the capture never misses an image. Same convention as ItineraryPrint.jsx.
  useEffect(() => {
    if (!departure && !error) return undefined;
    if (error) {
      window.__PDF_ERROR__ = error;
      window.__PDF_READY__ = true;
      return undefined;
    }
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      waitForImages().then(() => {
        if (!cancelled) window.__PDF_READY__ = true;
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [departure, error]);

  if (error) {
    return <div className="p-8 font-mono text-sm text-red-600">Unable to load itinerary: {error}</div>;
  }

  if (!departure) {
    return <div className="p-8 font-mono text-xs text-agent-muted">Loading…</div>;
  }

  // No padding wrapper — the PDF builder adds real page margins
  // (FD_ITINERARY_MARGINS_MM, lib/itineraryPdf.js), so an extra p-6 here
  // would just double the page-one gap on top of them.
  return (
    <div className="bg-white" data-itinerary-pdf-root>
      <FdItineraryDocument departure={departure} branding={branding} />
    </div>
  );
}
