import { useState } from 'react';
import { LuBedDouble, LuBinoculars, LuCar, LuPlane, LuSparkles, LuStamp, LuUtensils } from 'react-icons/lu';

// Building blocks for the downloadable itinerary PDFs (FdItineraryDocument.jsx
// for Fixed Departures, ItineraryDocument.jsx for Custom FIT) — one shared
// client-facing look: the agent's own branding top right, a big "Trip to …"
// title over label : value rows, a full-width cover photo, centred section
// titles ruled on both sides, round inclusion icons, and the day-by-day plan.
// The PDF is something the agent hands to their client, so it's branded for
// the agent who downloaded it (`branding`, from the backend's
// itineraryBranding.service.js) rather than for Xclusive Oman; on screen
// (no branding) the Xclusive Oman logo stands in.

const INK = 'text-[#2B2B2B]';
const MUTED = 'text-[#6B6B65]';
const RULE = 'bg-[#2B2B2B]';

const REGISTRATION_LABEL = {
  iata: 'IATA No.',
  gst: 'GST No.',
  company_registration: 'Reg. No.',
};

// Agency logo (or name) on the left, consultant contact block on the right.
export function ItineraryHeader({ branding }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const logo = branding?.logoUrl && !logoFailed ? branding.logoUrl : null;
  const contact = [
    ['Consultant', branding?.consultantName],
    ['Number', branding?.phone],
    ['Email', branding?.email],
    [REGISTRATION_LABEL[branding?.registrationType] || 'Reg. No.', branding?.registrationNumber],
  ].filter(([, value]) => value);
  const agencyName = branding?.agencyName;
  if (!logo && !agencyName && contact.length === 0) return null;

  return (
    <div className="flex items-start justify-between gap-6 pb-4">
      <div className="min-w-0">
        {logo ? (
          <img
            src={logo}
            alt={branding.agencyName || 'Agency logo'}
            onError={() => setLogoFailed(true)}
            className="h-14 max-w-[200px] object-contain object-left"
          />
        ) : branding?.agencyName ? (
          <div className={`text-lg font-bold ${INK}`}>{branding.agencyName}</div>
        ) : null}
        {logo && branding.agencyName && <div className={`mt-1 text-xs font-semibold ${INK}`}>{branding.agencyName}</div>}
      </div>
      {contact.length > 0 && (
        <div className="flex-none text-right text-xs leading-relaxed">
          {contact.map(([label, value]) => (
            <div key={label}>
              <span className={`font-bold ${INK}`}>{label}:</span> <span className={MUTED}>{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// "Trip to Muscat" + Destination / Duration / No of Pax style rows.
export function ItineraryTitle({ title, rows }) {
  const visible = rows.filter(([, value]) => value);
  return (
    <div className="pb-6">
      <h1 className={`text-4xl font-bold leading-tight ${INK}`}>{title}</h1>
      {visible.length > 0 && (
        <table className="mt-4 text-sm">
          <tbody>
            {visible.map(([label, value]) => (
              <tr key={label}>
                <td className={`w-40 py-1.5 pr-4 align-top text-base font-bold ${INK}`}>{label}</td>
                <td className={`py-1.5 pr-2 align-top font-bold ${INK}`}>:</td>
                <td className={`py-1.5 align-top ${INK}`}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Full-width cover photo. Tries each candidate in turn and drops the block
// if none loads, so a missing image never leaves an empty frame in the PDF.
export function CoverImage({ candidates }) {
  const urls = (candidates || []).filter(Boolean);
  const [index, setIndex] = useState(0);
  if (index >= urls.length) return null;
  return (
    <div className="mb-8 break-inside-avoid overflow-hidden">
      <img
        src={urls[index]}
        alt=""
        onError={() => setIndex((i) => i + 1)}
        className="h-80 w-full object-cover object-center"
      />
    </div>
  );
}

// ──── TRIP INCLUSIONS ──── style heading. data-pdf-keep-with-next keeps it
// on the same PDF page as the content right after it (lib/itineraryPdf.js).
export function SectionTitle({ children }) {
  return (
    <div data-pdf-keep-with-next className="mb-5 flex items-center gap-5 break-inside-avoid">
      <span className={`h-px flex-1 ${RULE}`} />
      <h2 className={`text-xl font-bold uppercase tracking-wide ${INK}`}>{children}</h2>
      <span className={`h-px flex-1 ${RULE}`} />
    </div>
  );
}

const INCLUSION_ICONS = {
  hotel: { label: 'Hotels', Icon: LuBedDouble },
  tour: { label: 'Sightseeing', Icon: LuBinoculars },
  transfer: { label: 'Transfers', Icon: LuCar },
  activity: { label: 'Activities', Icon: LuSparkles },
  meal: { label: 'Meals', Icon: LuUtensils },
  flight: { label: 'Flights', Icon: LuPlane },
  visa: { label: 'Visa', Icon: LuStamp },
};

const INCLUSION_ORDER = ['flight', 'hotel', 'tour', 'transfer', 'activity', 'meal', 'visa'];

// Round outline icons for each kind of service the trip includes, in a fixed
// order. `types` is any iterable of itinerary item types.
export function InclusionIcons({ types }) {
  const present = new Set(types);
  const shown = INCLUSION_ORDER.filter((t) => present.has(t));
  if (shown.length === 0) return null;
  return (
    <div className="mb-8 flex flex-wrap justify-center gap-x-8 gap-y-4 break-inside-avoid">
      {shown.map((type) => {
        const { label, Icon } = INCLUSION_ICONS[type];
        return (
          <div key={type} className="flex w-20 flex-col items-center gap-2 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#9A9A94] text-[#7A7A74]">
              <Icon size={20} />
            </span>
            <span className={`text-xs font-bold ${INK}`}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function itineraryItemImage(item) {
  const first = Array.isArray(item.images) ? item.images[0] : item.images;
  if (typeof first === 'string') return first;
  return first?.imageUrl || first?.image_url || first?.url || item.imageUrl || item.image_url || '';
}

// The day-by-day plan in the same style: each day a ruled block with a dark
// "DAY 01" tab, its date (when known) and title, then one line per planned
// service with its round type icon. `days`: [{ dayNumber, date?, title,
// lines: [{ type, text }], body? }] — `body` replaces the lines for days with
// their own layout (e.g. FD leisure days).
export function DayByDay({ days }) {
  if (!days?.length) return null;
  return (
    <div className="mb-8 space-y-5">
      {days.map((day) => (
        <div key={day.dayNumber} className="break-inside-avoid border-b border-[#E3E1DA] pb-5 last:border-b-0">
          <div className="flex items-baseline gap-3">
            <span className="flex-none rounded-sm bg-[#2B2B2B] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
              Day {String(day.dayNumber).padStart(2, '0')}
            </span>
            <div className="min-w-0">
              <div className={`text-base font-bold ${INK}`}>{day.title}</div>
              {day.date && <div className={`text-xs ${MUTED}`}>{day.date}</div>}
            </div>
          </div>
          <div className="mt-3 pl-1">
            {day.body ? (
              day.body
            ) : day.items?.filter((item) => item && item.id).length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
                {day.items.filter((item) => item && item.id).map((item, idx) => {
                  const image = itineraryItemImage(item);
                  const label = INCLUSION_ICONS[item.type]?.label || 'Details';
                  const description = String(item.description || '')
                    .replace(/<[^>]*>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                  return (
                    <div key={`${item.type}:${item.id || idx}:${idx}`} className="flex break-inside-avoid items-start gap-3 rounded-lg border border-[#E3E1DA] p-2">
                      {image && <img src={image} alt={item.name || label} className="h-20 w-28 flex-none object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
                      <div className="min-w-0">
                        <div className={`text-[10px] font-bold uppercase tracking-wide ${MUTED}`}>{label}</div>
                        <div className={`mt-0.5 text-sm font-bold ${INK}`}>{item.name || label}</div>
                        {(item.city || item.note) && <div className={`mt-1 text-sm ${INK}`}>{[item.city, item.note].filter(Boolean).join(' · ')}</div>}
                        {description && <div className={`mt-1 text-xs leading-relaxed ${INK}`}>{description}</div>}
                        {(item.duration || item.pickupTime) && (
                          <div className={`mt-1 text-xs ${MUTED}`}>
                            {[item.duration && `Duration: ${item.duration}`, item.pickupTime && `Pickup: ${item.pickupTime}`].filter(Boolean).join(' · ')}
                          </div>
                        )}
                        {!image && !item.name && <div className={`text-sm ${INK}`}>{day.lines?.[idx]?.text}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={`text-sm ${MUTED}`}>Day at leisure.</p>
            )}
            {day.notes && day.items?.filter((item) => item && item.id).length > 0 && <p className={`mt-2 text-sm ${INK}`}>{day.notes}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// "9 Nights & 10 Days"
export function nightsAndDays(dayCount) {
  if (!(dayCount > 0)) return '';
  const nights = Math.max(dayCount - 1, 0);
  return `${nights} Night${nights === 1 ? '' : 's'} & ${dayCount} Day${dayCount === 1 ? '' : 's'}`;
}
