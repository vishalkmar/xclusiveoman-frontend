import { dayTitle } from '../../shared/itinerary/index.js';
import {
  CoverImage,
  DayByDay,
  InclusionIcons,
  ItineraryHeader,
  ItineraryTitle,
  nightsAndDays,
  SectionTitle,
} from './ItineraryCover.jsx';

// Client-facing "Detailed Itinerary" for a Custom FIT trip — shown in the
// FIT Builder's Review & Submit step and downloaded as a PDF from there
// (ItineraryPrint.jsx, built in the agent's browser by lib/itineraryPdf.js).
// Same shared layout as the FD itinerary (ItineraryCover.jsx): the
// downloading agent's branding, "Trip to …" title rows, a cover photo, trip
// inclusions, accommodation and the day-by-day plan.
//
// FIT-6 (blind pricing) applies here as much as anywhere else in the
// builder: no cost, markup, or price field exists anywhere in this
// component. The selection summary + "pricing after submission" note are for
// the agent on screen only (print:hidden — the PDF is for their client).

const INK = 'text-[#2B2B2B]';
const MUTED = 'text-[#6B6B65]';

function Th({ children }) {
  return (
    <th className={`border-b-2 border-[#2B2B2B] px-3 py-2 text-left text-[11px] font-bold uppercase ${INK}`}>{children}</th>
  );
}

function Td({ children, className = '' }) {
  return <td className={`border-b border-[#E3E1DA] px-3 py-2 align-top ${className}`}>{children}</td>;
}

function SummaryTile({ label, value }) {
  return (
    <div className="rounded-md border border-agent-line-light bg-agent-panel px-3 py-2.5 text-center">
      <div className="text-lg font-bold text-agent-ink">{value}</div>
      <div className="text-[10px] font-semibold uppercase text-agent-muted">{label}</div>
    </div>
  );
}

// "07 Nov"
function dayMonth(date) {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function addDays(iso, n) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + n);
  return d;
}

// `hotels` is plural — the agent builder picks a hotel per day now, so a
// trip can have more than one (e.g. a different hotel per city). Each hotel
// entry may carry its own `nights` (how many itinerary days it actually
// appears on). `coverImages`: candidate photos for the cover, best first.
// `branding`: the downloading agent (PDF only).
export default function ItineraryDocument({
  destination,
  dateFrom,
  dateTo,
  paxAdults,
  paxChildren,
  dayCount,
  hotels,
  days,
  selectedCounts,
  coverImages = [],
  branding,
}) {
  const nights = Math.max(dayCount - 1, 0);
  // No "number of rooms" field exists anywhere in the builder yet — double
  // occupancy is the standard assumption this stands in for until one does.
  const rooms = Math.max(1, Math.ceil((paxAdults || 1) / 2));
  const hotelRows = hotels || [];

  const start = dateFrom ? addDays(dateFrom, 0) : null;
  const end = dateTo ? addDays(dateTo, 0) : null;
  const duration = [nightsAndDays(dayCount), start && end ? `(${dayMonth(start)} – ${dayMonth(end)})` : '']
    .filter(Boolean)
    .join(' ');
  const pax = [
    paxAdults ? `${paxAdults} Adult${paxAdults === 1 ? '' : 's'}` : '',
    paxChildren ? `${paxChildren} Child${paxChildren === 1 ? '' : 'ren'}` : '',
  ]
    .filter(Boolean)
    .join(', ');

  const serviceTypes = days.flatMap((day) => (day.items || []).map((item) => item.type));
  if (hotelRows.length > 0) serviceTypes.push('hotel');

  const dayBlocks = days.map((day) => {
    const date = dateFrom ? addDays(dateFrom, day.dayNumber - 1) : null;
    const title = (day.items || []).length > 0 || day.notes ? dayTitle(day) : 'Day at leisure';
    const lines = (day.items || []).map((item) => ({
      type: item.type,
      text: `${item.name || 'Item'}${item.note ? ` — ${item.note}` : ''}`,
    }));
    return {
      dayNumber: day.dayNumber,
      date: date ? date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : null,
      title,
      lines,
    };
  });

  return (
    <div className="rounded-lg border border-agent-line-light bg-white p-6 shadow-sm print:border-0 print:p-0 print:shadow-none sm:p-8">
      <ItineraryHeader branding={branding} />
      <ItineraryTitle
        title={`Trip to ${destination || 'Oman'}`}
        rows={[
          ['Destination', destination],
          ['Duration', duration],
          ['No of Pax', pax],
        ]}
      />
      <CoverImage candidates={[...coverImages, '/oman_pic.jpg']} />

      {serviceTypes.length > 0 && (
        <>
          <SectionTitle>Trip Inclusions</SectionTitle>
          <InclusionIcons types={serviceTypes} />
        </>
      )}

      <div className="mb-8">
        <SectionTitle>Accommodation</SectionTitle>
        {hotelRows.length === 0 ? (
          <p className={`text-sm ${MUTED}`}>No hotel selected yet.</p>
        ) : (
          // overflow-x-auto print:overflow-visible — this document also renders
          // inline in PackageBuilder.jsx's Review step on real phones, where a
          // wide table must scroll by itself rather than push the page sideways.
          <div className="overflow-x-auto print:overflow-visible">
            <table className={`w-full border-collapse text-sm ${INK}`}>
              <thead>
                <tr>
                  <Th>Hotel</Th>
                  <Th>Rating</Th>
                  <Th>Location</Th>
                  <Th>Rooms</Th>
                  <Th>Nights</Th>
                </tr>
              </thead>
              <tbody>
                {hotelRows.map((h) => (
                  <tr key={h.id}>
                    <Td className="font-bold">{h.name}</Td>
                    <Td>{h.category ? `${h.category}★` : '—'}</Td>
                    <Td>{[h.city, h.state].filter(Boolean).join(', ') || '—'}</Td>
                    <Td>{rooms}</Td>
                    <Td>{h.nights ?? (dayCount > 0 ? nights : '—')}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mb-8">
        <SectionTitle>Day by Day Itinerary</SectionTitle>
        {dayBlocks.length === 0 ? (
          <p className={`text-sm ${MUTED}`}>Set Travel Start/End Date in Trip Details to generate the day-wise itinerary.</p>
        ) : (
          <DayByDay days={dayBlocks} />
        )}
      </div>

      {/* Agent-only: selection counts + the blind-pricing note (FIT-6). */}
      {selectedCounts && (
        <div className="print:hidden">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryTile label="Hotels Selected" value={selectedCounts.hotels} />
            <SummaryTile label="Tours Selected" value={selectedCounts.tours} />
            <SummaryTile label="Transfers Selected" value={selectedCounts.transfers} />
            <SummaryTile label="Extras Selected" value={selectedCounts.activities} />
          </div>
          <p className="mt-3 rounded-md bg-agent-panel px-3 py-2.5 text-xs text-agent-muted">
            Pricing will be prepared by Xclusive Oman after submission — no cost, markup, or price is shown here.
          </p>
        </div>
      )}
    </div>
  );
}
