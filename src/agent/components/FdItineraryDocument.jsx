import {
  durationNights,
  formatCurrency,
  formatNightsDays,
  parseDurationDays,
  splitLines,
} from '../../shared/fdPackage/index.js';
import { computeNightsByCity, dayDescription, dayDetailLines, dayTitle } from '../../shared/itinerary/index.js';
import LeisureDayDetails from './LeisureDayDetails.jsx';
import {
  AccommodationCard,
  BrochureHero,
  DayByDaySection,
  HERO_ICONS,
  InclusionsExclusions,
  PriceDetails,
  TripInclusionsCard,
} from './ItineraryBrochure.jsx';

// Client-facing FD / Readymade departure itinerary — the document
// DepartureItineraryPrint.jsx renders for "Download Itinerary" (built into a
// PDF in the agent's own browser, lib/itineraryPdf.js). A brochure layout
// (ItineraryBrochure.jsx): hero with the package overview, the downloading
// agent's branding and a cover photo; trip inclusions with a small gallery;
// the accommodation; one card per itinerary day; inclusions/exclusions; the
// booking terms; and the price details. Everything shown comes from the
// package data — nothing is added or reworded.

// `departure` is the exact shape GET /departures/:id (and this PDF's own
// data endpoint, getDepartureDataForPdf) return — see departures.
// controller.js's buildDepartureDetail. `branding` is the downloading agent's
// (itineraryBranding.service.js).
export default function FdItineraryDocument({ departure, branding }) {
  const itinerary = departure.itinerary || [];
  // N days (the admin's Duration, else the itinerary's day count) = N − 1
  // nights; the per-city split counts only those nights (the last day is
  // the departure day). Same rule as DepartureDetail.jsx.
  const totalDays = parseDurationDays(departure.duration) || itinerary.length || null;
  const nightsByCity = totalDays ? computeNightsByCity(itinerary, { nights: durationNights(totalDays) }) : [];
  const inclusionLines = splitLines(departure.inclusions);
  const exclusionLines = splitLines(departure.exclusions);

  // FD packages depart from their dated departure's location; Readymade
  // packages have no dates, so they list the cities they're offered from.
  const isReadymade = departure.type === 'readymade';
  const packageType = isReadymade ? 'Readymade Package' : 'FD Package';
  const exLocation = isReadymade
    ? departure.allCities
      ? 'All cities'
      : (departure.departureCities || []).join(', ') || null
    : departure.departureDates?.[0]?.location;

  // Every city the itinerary visits (including one only reached on the last day).
  const destination = computeNightsByCity(itinerary).map((c) => c.city).join(', ') || exLocation;
  // "5 Nights & 6 Days". The per-city split is only worth a mention across
  // 2+ cities.
  const duration = [
    totalDays ? formatNightsDays(totalDays) : String(departure.duration || '').trim(),
    nightsByCity.length > 1 ? `(${nightsByCity.map((c) => `${c.nights}N ${c.city}`).join(' | ')})` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const pax = departure.pdfPax || 1;
  const serviceTypes = itinerary.flatMap((day) => (day.items || []).map((item) => item.type));
  if (departure.hotel) serviceTypes.push('hotel');

  // Package photos: the first that loads is the hero; the next ones fill the
  // inclusions gallery and the image beside inclusions/exclusions.
  const photos = [...new Set([departure.heroImageUrl, ...(departure.images || [])].filter(Boolean))];
  const gallery = photos.slice(1, 4);
  const sideImage = photos[4] || photos[photos.length - 1] || null;

  const days = itinerary.map((day, index) => {
    let date = day.date || '';
    if (!date && departure.pdfDate) {
      const parsed = new Date(`${departure.pdfDate.slice(0, 10)}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) {
        parsed.setDate(parsed.getDate() + index);
        date = new Intl.DateTimeFormat('en-GB', {
          day: '2-digit', month: 'short', year: '2-digit', weekday: 'short',
        }).format(parsed);
      }
    }
    return {
      dayNumber: day.dayNumber,
      // Use the day's tour name as its heading, matching the live departure
      // detail view. Leisure days and days without a tour keep the shared
      // itinerary title fallback.
      title: day.items?.find((item) => item.type === 'tour' && item.name)?.name || dayTitle(day, { fromNotes: false }),
      details: dayDetailLines(day),
      description: dayDescription(day),
      city: day.items?.find((item) => item.city)?.city || '',
      date,
      items: day.items || [],
      leisureBody: day.leisure ? <LeisureDayDetails day={day} /> : null,
    };
  });

  return (
    // No outer padding — the PDF download (lib/itineraryPdf.js) adds real
    // page margins around every page.
    <div className="mx-auto max-w-3xl bg-white">
      <BrochureHero
        title={departure.title}
        branding={branding}
        badge={packageType}
        imageCandidates={photos}
        rows={[
          [HERO_ICONS.destination, 'Destination', destination],
          [HERO_ICONS.duration, 'Duration', duration],
          [HERO_ICONS.from, 'Departure from', exLocation],
          [HERO_ICONS.pax, 'No of Pax', `${pax} ${Number(pax) === 1 ? 'Guest' : 'Guests'}`],
          [
            HERO_ICONS.price,
            'Starting at',
            departure.ratePerPax != null ? (
              <>
                <b className="text-[13px] text-[#1F1B16]">{formatCurrency(departure.ratePerPax)}</b> per person (double
                occupancy)
              </>
            ) : null,
          ],
        ]}
      />

      <TripInclusionsCard types={serviceTypes} gallery={gallery} />

      <AccommodationCard hotel={departure.hotel} />

      <DayByDaySection days={days} />

      <InclusionsExclusions inclusions={inclusionLines} exclusions={exclusionLines} image={sideImage} />


      <PriceDetails
        pax={pax}
        ratePerPax={departure.pdfRatePerPax ?? departure.ratePerPax}
        total={departure.pdfTotal ?? departure.ratePerPax}
        selectedDate={departure.pdfDate}
      />
    </div>
  );
}
