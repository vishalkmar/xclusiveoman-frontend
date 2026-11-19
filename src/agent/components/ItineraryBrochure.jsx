import { useState } from 'react';
import DOMPurify from 'dompurify';
import { FaCircleCheck, FaCircleXmark, FaStar } from 'react-icons/fa6';
import {
  LuBadgeCheck,
  LuBedDouble,
  LuBinoculars,
  LuBus,
  LuCalendarDays,
  LuCar,
  LuClock,
  LuCoffee,
  LuMail,
  LuMapPin,
  LuPackage,
  LuPhone,
  LuPlane,
  LuPlaneTakeoff,
  LuSparkles,
  LuStamp,
  LuTag,
  LuUser,
  LuUsers,
  LuUtensils,
} from 'react-icons/lu';
import { formatCurrency } from '../../shared/fdPackage/index.js';

// Building blocks of the downloadable FD / Readymade itinerary brochure
// (FdItineraryDocument.jsx). Designed for the PDF's A4 content width
// (~700px, lib/itineraryPdf.js renders it in an iframe that wide): a hero with
// the package overview and a cover photo, trip inclusions with a small
// gallery, the accommodation, one card per itinerary day, inclusions /
// exclusions, the booking terms and the price details.
//
// Every card is a bordered box or marked break-inside-avoid, which
// lib/itineraryPdf.js treats as unsplittable when choosing page breaks, and
// section titles carry data-pdf-keep-with-next so they never end a page.
// Colours are literal hex (not theme tokens) so the PDF looks the same
// wherever it's rendered.

const C = {
  ink: '#1F1B16',
  body: '#4B4640',
  muted: '#7A736A',
  orange: '#E07A1F',
  orangeDeep: '#C2620F',
  orangeSoft: '#FDF1E3',
  cream: '#FBF6EE',
  line: '#EFE5D6',
};

const SERIF = { fontFamily: 'Georgia, "Times New Roman", serif' };

const REGISTRATION_LABEL = {
  iata: 'IATA No.',
  gst: 'GST No.',
  company_registration: 'Reg. No.',
};

export function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function itemImages(item) {
  const list = Array.isArray(item?.images) ? item.images : item?.images ? [item.images] : [];
  return list
    .map((img) => (typeof img === 'string' ? img : img?.imageUrl || img?.image_url || img?.url || ''))
    .filter(Boolean);
}

// An <img> that quietly removes itself when it can't load, so a dead link
// never leaves an empty frame in the PDF.
function SafeImg({ src, alt = '', className = '', style }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return <img src={src} alt={alt} className={className} style={style} onError={() => setFailed(true)} />;
}

// First candidate that loads, or nothing.
function FirstImage({ candidates, className = '', style, alt = '' }) {
  const urls = (candidates || []).filter(Boolean);
  const [index, setIndex] = useState(0);
  if (index >= urls.length) return null;
  return (
    <img
      src={urls[index]}
      alt={alt}
      className={className}
      style={style}
      onError={() => setIndex((i) => i + 1)}
    />
  );
}

// "| Accommodation" — orange bar + serif heading, kept on the same page as
// whatever follows it.
export function BrochureSectionTitle({ children, className = '' }) {
  return (
    <div data-pdf-keep-with-next className={`mb-3 flex items-center gap-2.5 break-inside-avoid ${className}`}>
      <span className="h-6 w-1 flex-none rounded-full" style={{ background: C.orange }} />
      <h2 className="text-[21px] font-bold leading-none" style={{ ...SERIF, color: C.ink }}>
        {children}
      </h2>
    </div>
  );
}

// ---- Hero ----------------------------------------------------------------

function splitTitle(title) {
  const words = String(title || '').trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return [words.join(' '), ''];
  const cut = Math.floor(words.length / 2);
  return [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
}

function ConsultantBlock({ branding }) {
  const rows = [
    [LuUser, 'Consultant', branding?.consultantName],
    [LuPhone, 'Number', branding?.phone],
    [LuMail, 'Email', branding?.email],
    [LuBadgeCheck, REGISTRATION_LABEL[branding?.registrationType] || 'Reg. No.', branding?.registrationNumber],
  ].filter(([, , value]) => value);
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1 rounded-xl bg-white/90 px-3 py-2.5 text-[10.5px] leading-snug shadow-sm" style={{ color: C.body }}>
      {rows.map(([Icon, label, value]) => (
        <div key={label} className="flex items-start gap-1.5">
          <Icon size={11} className="mt-[1px] flex-none" style={{ color: C.ink }} />
          <span className="min-w-0 break-words">
            <span className="font-bold" style={{ color: C.ink }}>
              {label}:
            </span>{' '}
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

function AgencyMark({ branding }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const logo = branding?.logoUrl && !logoFailed ? branding.logoUrl : null;
  if (!logo && !branding?.agencyName) return null;
  return (
    <div className="mb-3 flex items-center gap-2">
      {logo && (
        <img
          src={logo}
          alt={branding.agencyName || 'Agency logo'}
          onError={() => setLogoFailed(true)}
          className="h-9 max-w-[150px] object-contain object-left"
        />
      )}
      {branding?.agencyName && (
        <span className="text-[13px] font-semibold" style={{ color: C.ink }}>
          {branding.agencyName}
        </span>
      )}
    </div>
  );
}

// `rows`: [[Icon, label, value]] — rows without a value are skipped. A value
// may be a node (the starting price uses bold + small text).
export function BrochureHero({ title, rows, branding, imageCandidates, badge }) {
  const [lead, rest] = splitTitle(title);
  const visible = rows.filter(([, , value]) => value);
  const hasImage = (imageCandidates || []).some(Boolean);
  return (
    <div
      className="relative mb-4 overflow-hidden rounded-2xl break-inside-avoid"
      style={{ background: C.cream, border: `1px solid ${C.line}` }}
    >
      <div className={`grid ${hasImage ? 'grid-cols-[1.08fr_1fr]' : 'grid-cols-1'}`}>
        <div className="relative z-10 px-6 pb-6 pt-5">
          <AgencyMark branding={branding} />
          {badge && (
            <span
              className="mb-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wider"
              style={{ background: C.orangeSoft, color: C.orangeDeep }}
            >
              <LuPackage size={11} />
              {badge}
            </span>
          )}
          <h1 className="text-[33px] font-bold leading-[1.08]" style={{ ...SERIF, color: C.ink }}>
            {lead}
            {rest && (
              <>
                {' '}
                <span style={{ color: C.orange }}>{rest}</span>
              </>
            )}
          </h1>
          <div className="mb-4 mt-3 h-[3px] w-14 rounded-full" style={{ background: C.orange }} />
          <div className="space-y-2">
            {visible.map(([Icon, label, value]) => (
              <div key={label} className="grid grid-cols-[18px_92px_1fr] items-start gap-2 text-[12px]">
                <Icon size={15} className="mt-[1px]" style={{ color: C.orange }} />
                <span className="font-bold" style={{ color: C.ink }}>
                  {label}
                </span>
                <span className="min-w-0 break-words" style={{ color: C.body }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
          {!hasImage && branding && (
            <div className="mt-4 max-w-[280px]">
              <ConsultantBlock branding={branding} />
            </div>
          )}
        </div>
        {hasImage && (
          <div className="relative min-h-[280px]">
            <FirstImage
              candidates={imageCandidates}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ borderTopLeftRadius: '160px 100%', borderBottomLeftRadius: '0' }}
            />
            <div className="absolute right-3 top-3 max-w-[230px]">
              <ConsultantBlock branding={branding} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Trip inclusions -------------------------------------------------------

const INCLUSION_ICONS = {
  flight: { label: 'Flights', Icon: LuPlane },
  hotel: { label: 'Hotels', Icon: LuBedDouble },
  tour: { label: 'Sightseeing', Icon: LuBinoculars },
  transfer: { label: 'Transfers', Icon: LuCar },
  activity: { label: 'Activities', Icon: LuSparkles },
  meal: { label: 'Meals', Icon: LuUtensils },
  visa: { label: 'Visa', Icon: LuStamp },
};
const INCLUSION_ORDER = ['flight', 'hotel', 'tour', 'transfer', 'activity', 'meal', 'visa'];

export function TripInclusionsCard({ types, gallery }) {
  const present = new Set(types);
  const shown = INCLUSION_ORDER.filter((t) => present.has(t));
  const photos = (gallery || []).filter(Boolean).slice(0, 3);
  if (shown.length === 0 && photos.length === 0) return null;
  return (
    <div
      data-pdf-flow
      className="mb-4 grid items-center gap-4 rounded-2xl bg-white p-4 break-inside-avoid"
      style={{
        border: `1px solid ${C.line}`,
        gridTemplateColumns: photos.length > 0 && shown.length > 0 ? 'minmax(0,1.15fr) minmax(0,1fr)' : 'minmax(0,1fr)',
      }}
    >
      {shown.length > 0 && (
        <div>
          <BrochureSectionTitle className="!mb-3">Trip Inclusions</BrochureSectionTitle>
          <div className="flex flex-wrap gap-x-2.5 gap-y-3">
            {shown.map((type) => {
              const { label, Icon } = INCLUSION_ICONS[type];
              return (
                <div key={type} className="flex w-[62px] flex-col items-center gap-1.5 text-center">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-full"
                    style={{ background: C.orangeSoft, color: C.orange }}
                  >
                    <Icon size={20} />
                  </span>
                  <span className="text-[11px]" style={{ color: C.ink }}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {photos.length > 0 && (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${photos.length}, minmax(0,1fr))` }}>
          {photos.map((src) => (
            <SafeImg key={src} src={src} className="h-[92px] w-full rounded-xl object-cover" />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Accommodation -------------------------------------------------------

function starCount(category) {
  const n = parseInt(String(category || ''), 10);
  return Number.isFinite(n) && n > 0 && n <= 7 ? n : 0;
}

export function AccommodationCard({ hotel }) {
  if (!hotel) return null;
  const stars = starCount(hotel.category);
  const description = stripHtml(hotel.description);
  const boardBasis = (hotel.boardBasisOptions || []).filter(Boolean);
  const location = [hotel.city, hotel.state].filter(Boolean).join(', ');
  return (
    <div data-pdf-flow className="mb-4 break-inside-avoid">
      <BrochureSectionTitle>Accommodation</BrochureSectionTitle>
      <div
        className="grid gap-4 rounded-2xl bg-white p-3"
        style={{
          border: `1px solid ${C.line}`,
          gridTemplateColumns: [
            hotel.images?.length ? '190px' : null,
            'minmax(0,1fr)',
            boardBasis.length ? '150px' : null,
          ]
            .filter(Boolean)
            .join(' '),
        }}
      >
        {hotel.images?.length > 0 && (
          <FirstImage candidates={hotel.images} alt={hotel.name || 'Accommodation'} className="h-[140px] w-full rounded-xl object-cover" />
        )}
        <div className="min-w-0 py-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[17px] font-bold" style={{ ...SERIF, color: C.ink }}>
              {hotel.name || 'Accommodation'}
            </span>
            {stars > 0 && (
              <span className="flex gap-0.5" style={{ color: '#F2A93B' }}>
                {Array.from({ length: stars }).map((_, i) => (
                  <FaStar key={i} size={12} />
                ))}
              </span>
            )}
          </div>
          {(location || hotel.category) && (
            <div className="mt-1 text-[11.5px]" style={{ color: C.muted }}>
              {[location, hotel.category && `${hotel.category}${stars ? '★' : ''} Hotel`].filter(Boolean).join('  •  ')}
            </div>
          )}
          {description && (
            <p className="mt-2 text-[11.5px] leading-relaxed" style={{ color: C.body }}>
              {description}
            </p>
          )}
        </div>
        {boardBasis.length > 0 && (
          <div className="self-start rounded-xl px-3 py-2.5" style={{ background: C.cream }}>
            <div className="mb-1.5 text-[9.5px] font-bold uppercase tracking-wider" style={{ color: C.orangeDeep }}>
              Meal plans
            </div>
            <ul className="space-y-1.5">
              {boardBasis.map((option) => (
                <li key={option} className="flex items-start gap-1.5 text-[11px]" style={{ color: C.body }}>
                  <LuCoffee size={12} className="mt-[1px] flex-none" style={{ color: C.orange }} />
                  {option}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Day by day ------------------------------------------------------------

const ITEM_BADGE = {
  tour: { label: 'Sightseeing', Icon: LuBinoculars, bg: '#FDF1E3', fg: '#C2620F' },
  activity: { label: 'Activities', Icon: LuSparkles, bg: '#E9F6EC', fg: '#2E7D46' },
  transfer: { label: 'Transfer', Icon: LuCar, bg: '#E8F0FB', fg: '#2D5DA8' },
};

function ItemRow({ item }) {
  const badge = ITEM_BADGE[item.type] || { label: 'Details', Icon: LuSparkles, bg: C.cream, fg: C.muted };
  const images = itemImages(item);
  const main = images[0];
  const thumbs = images.slice(1, 5);
  const description = stripHtml(item.description);
  const facts = [
    item.duration && [LuClock, 'Duration', item.duration],
    item.pickupTime && [LuBus, 'Pickup', item.pickupTime],
    item.vehicleLabel && [LuCar, 'Vehicle', item.vehicleLabel],
  ].filter(Boolean);
  const hasSide = facts.length > 0 || thumbs.length > 0;
  return (
    <div
      className="grid gap-3 break-inside-avoid"
      style={{
        gridTemplateColumns: [main ? '132px' : null, 'minmax(0,1fr)', hasSide ? '122px' : null].filter(Boolean).join(' '),
      }}
    >
      {main && <FirstImage candidates={images} alt={item.name || badge.label} className="h-[90px] w-full rounded-xl object-cover" />}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-bold leading-snug" style={{ ...SERIF, color: C.ink }}>
            {item.name || badge.label}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[8.5px] font-bold uppercase tracking-wider"
            style={{ background: badge.bg, color: badge.fg }}
          >
            <badge.Icon size={9} />
            {badge.label}
          </span>
        </div>
        {item.city && (
          <div className="mt-0.5 flex items-center gap-1 text-[10.5px]" style={{ color: C.muted }}>
            <LuMapPin size={10} />
            {item.city}
          </div>
        )}
        {description && (
          <p className="mt-1 text-[11px] leading-[1.55]" style={{ color: C.body }}>
            {description}
          </p>
        )}
        {item.note && (
          <p className="mt-1.5 text-[10.5px] italic leading-relaxed" style={{ color: C.muted }}>
            {item.note}
          </p>
        )}
      </div>
      {hasSide && (
        <div className="space-y-1.5 border-l pl-3" style={{ borderColor: C.line }}>
          {facts.map(([Icon, label, value]) => (
            <div key={label} className="flex items-start gap-1.5 text-[10.5px]" style={{ color: C.body }}>
              <Icon size={12} className="mt-[1px] flex-none" style={{ color: C.orange }} />
              <span className="min-w-0 break-words">
                <span className="font-semibold" style={{ color: C.ink }}>
                  {label}:
                </span>{' '}
                {value}
              </span>
            </div>
          ))}
          {thumbs.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              {thumbs.map((src) => (
                <SafeImg key={src} src={src} className="h-[46px] w-full rounded-md object-cover" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// `day`: { dayNumber, title, city, date, items, leisureBody, notes }.
export function DayCard({ day }) {
  const items = (day.items || []).filter((item) => item && item.id);
  const activities = items.filter((item) => item.type !== 'hotel');
  const stays = items.filter((item) => item.type === 'hotel' && item.name);
  return (
    <div data-pdf-card data-pdf-flow className="rounded-2xl px-3 pb-3 pt-2.5 break-inside-avoid" style={{ background: '#FFFCF7', boxShadow: `inset 0 0 0 1px ${C.line}` }}>
      <div data-pdf-keep-with-next className="mb-2.5 flex items-center gap-3 break-inside-avoid">
        <span
          className="flex-none rounded-lg px-2.5 py-1 text-[12px] font-bold tracking-wide text-white"
          style={{ background: C.orange }}
        >
          DAY {String(day.dayNumber).padStart(2, '0')}
        </span>
        <div className="min-w-0 flex-1">
          {day.title && (
            <div className="text-[14px] font-bold leading-snug" style={{ ...SERIF, color: C.ink }}>
              {day.title}
            </div>
          )}
        </div>
        {(day.city || day.date) && (
          <div className="flex-none text-right text-[10.5px] leading-tight" style={{ color: C.muted }}>
            {day.city && (
              <div className="flex items-center justify-end gap-1 font-semibold" style={{ color: C.body }}>
                <LuMapPin size={10} />
                {day.city}
              </div>
            )}
            {day.date && <div>{day.date}</div>}
          </div>
        )}
      </div>
      {day.description && (
        <p className="mb-2.5 whitespace-pre-line break-words text-[11.5px] leading-relaxed" style={{ color: C.body }}>
          {day.description}
        </p>
      )}
      {day.leisureBody ? (
        day.leisureBody
      ) : activities.length > 0 ? (
        <ul className="list-disc space-y-1.5 pl-5 text-[11.5px] leading-relaxed" style={{ color: C.body }}>
          {activities.filter((item) => item.name !== day.title).map((item, idx) => (
            <li key={`${item.type}:${item.id}:${idx}`}>
              {[item.name, item.note].filter(Boolean).join(' ')}
            </li>
          ))}
        </ul>
      ) : stays.length === 0 && !day.description ? (
        <p className="text-[11.5px]" style={{ color: C.muted }}>
          Day at leisure.
        </p>
      ) : null}
      {!day.leisureBody && stays.length > 0 && (
        <div className={`flex flex-wrap gap-2 ${activities.length > 0 ? 'mt-3' : ''}`}>
          {stays.map((stay, idx) => (
            <span
              key={`${stay.id}:${idx}`}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px]"
              style={{ background: C.cream, color: C.body }}
            >
              <LuBedDouble size={12} style={{ color: C.orange }} />
              <span className="font-semibold" style={{ color: C.ink }}>
                Stay:
              </span>{' '}
              {[stay.name, stay.city].filter(Boolean).join(' · ')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function DayByDaySection({ days }) {
  if (!days?.length) return null;
  return (
    <div data-pdf-flow className="mb-4">
      <BrochureSectionTitle>Day by Day Itinerary</BrochureSectionTitle>
      <div className="space-y-2.5">
        {days.map((day) => (
          <DayCard key={day.dayNumber} day={day} />
        ))}
      </div>
    </div>
  );
}

// ---- Inclusions & exclusions --------------------------------------------

function ListCard({ title, lines, tone }) {
  const green = tone === 'green';
  const Icon = green ? FaCircleCheck : FaCircleXmark;
  return (
    <div
      className="rounded-2xl px-4 py-3.5 break-inside-avoid"
      style={{
        background: green ? '#F1F8F2' : '#FDF2F1',
        border: `1px solid ${green ? '#D7EBDB' : '#F6D9D6'}`,
      }}
    >
      <h3 className="mb-2.5 text-[14px] font-bold" style={{ ...SERIF, color: green ? '#2E7D46' : '#C0392B' }}>
        {title}
      </h3>
      <ul className="space-y-1.5">
        {lines.map((line, idx) => (
          <li key={idx} className="flex items-start gap-2 text-[11.5px] leading-snug" style={{ color: C.body }}>
            <Icon size={13} className="mt-[1px] flex-none" style={{ color: green ? '#2E9E57' : '#E5483B' }} />
            <span className="min-w-0 break-words">{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function InclusionsExclusions({ inclusions, exclusions, image }) {
  if (inclusions.length === 0 && exclusions.length === 0) return null;
  const columns = [inclusions.length > 0, exclusions.length > 0, Boolean(image)].filter(Boolean).length;
  return (
    <div data-pdf-flow className="mb-4 break-inside-avoid">
      <BrochureSectionTitle>Inclusions &amp; Exclusions</BrochureSectionTitle>
      <div className="grid items-stretch gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
        {inclusions.length > 0 && <ListCard title="Inclusions" lines={inclusions} tone="green" />}
        {exclusions.length > 0 && <ListCard title="Exclusions" lines={exclusions} tone="red" />}
        {image && (
          <div className="relative min-h-[120px] overflow-hidden rounded-2xl break-inside-avoid">
            <SafeImg src={image} className="absolute inset-0 h-full w-full object-cover" />
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Terms ---------------------------------------------------------------

function sanitizeHtml(html) {
  return DOMPurify.sanitize(html || '', { USE_PROFILES: { html: true } });
}

// The admin-authored booking terms (site_terms HTML), rendered exactly as
// written — only the typography is styled. No surrounding box, so long terms
// can flow over several pages without a border being cut.
export function TermsSection({ html }) {
  if (!stripHtml(html)) return null;
  return (
    <div data-pdf-flow className="mb-4">
      <BrochureSectionTitle>Terms &amp; Conditions</BrochureSectionTitle>
      <div
        className="text-[11.5px] leading-[1.65] text-[#4B4640] [&_a]:text-[#C2620F] [&_a]:underline [&_blockquote]:mb-2 [&_blockquote]:border-l-4 [&_blockquote]:border-[#EFE5D6] [&_blockquote]:pl-3 [&_blockquote]:italic [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:break-inside-avoid [&_h1]:text-[17px] [&_h1]:font-bold [&_h1]:text-[#1F1B16] [&_h2]:mb-1.5 [&_h2]:mt-4 [&_h2]:break-inside-avoid [&_h2]:text-[15px] [&_h2]:font-bold [&_h2]:text-[#1F1B16] [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:break-inside-avoid [&_h3]:text-[13px] [&_h3]:font-bold [&_h3]:text-[#1F1B16] [&_h4]:mb-1 [&_h4]:mt-3 [&_h4]:font-bold [&_h4]:text-[#1F1B16] [&_hr]:my-4 [&_hr]:border-[#EFE5D6] [&_img]:max-w-full [&_img]:rounded-md [&_li]:mb-1 [&_li]:break-inside-avoid [&_ol]:mb-2.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_strong]:text-[#1F1B16] [&_table]:mb-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[#EFE5D6] [&_td]:p-2 [&_th]:border [&_th]:border-[#EFE5D6] [&_th]:bg-[#FBF6EE] [&_th]:p-2 [&_th]:text-left [&_th]:font-semibold [&_ul]:mb-2.5 [&_ul]:list-disc [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
      />
    </div>
  );
}

// ---- Price details ---------------------------------------------------------

export function PriceDetails({ pax, ratePerPax, total, selectedDate }) {
  const cell = 'px-3 py-2.5';
  return (
    <div data-pdf-flow className="break-inside-avoid">
      <BrochureSectionTitle>Price Details</BrochureSectionTitle>
      <div className="overflow-hidden rounded-2xl" style={{ border: `1px solid ${C.line}` }}>
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="text-left text-[10.5px] uppercase tracking-wider" style={{ background: C.orangeSoft, color: C.orangeDeep }}>
              <th className={`${cell} font-bold`}>Pax Type</th>
              <th className={`${cell} text-center font-bold`}>No of Pax</th>
              <th className={`${cell} text-right font-bold`}>Cost Per Person</th>
              <th className={`${cell} text-right font-bold`}>Total Cost</th>
            </tr>
          </thead>
          <tbody style={{ color: C.body }}>
            <tr style={{ borderTop: `1px solid ${C.line}` }}>
              <td className={`${cell} font-semibold`} style={{ color: C.ink }}>
                Package (Adult / Twin Sharing)
              </td>
              <td className={`${cell} text-center`}>{pax}</td>
              <td className={`${cell} text-right`}>{formatCurrency(ratePerPax)}</td>
              <td className={`${cell} text-right`}>{formatCurrency(total)}</td>
            </tr>
            <tr className="font-bold" style={{ borderTop: `1px solid ${C.line}`, background: C.cream, color: C.ink }}>
              <td className={cell}>Total Package Cost</td>
              <td className={`${cell} text-center`}>{pax}</td>
              <td className={cell} />
              <td className={`${cell} text-right`}>{formatCurrency(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {selectedDate && (
        <p className="mt-2.5 flex items-center gap-1.5 text-[11.5px]" style={{ color: C.body }}>
          <LuCalendarDays size={13} style={{ color: C.orange }} />
          Selected departure: {selectedDate}
        </p>
      )}
      <div
        className="mt-3 flex items-center justify-between rounded-2xl px-5 py-4 text-white"
        style={{ background: `linear-gradient(90deg, ${C.orangeDeep}, ${C.orange})` }}
      >
        <span className="text-[13px] font-semibold uppercase tracking-wider">Total Package Cost</span>
        <span className="text-[20px] font-bold" style={SERIF}>
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}

// Icons for the hero rows (kept here so the document file stays about data).
export const HERO_ICONS = {
  type: LuPackage,
  destination: LuMapPin,
  duration: LuCalendarDays,
  from: LuPlaneTakeoff,
  pax: LuUsers,
  price: LuTag,
};
