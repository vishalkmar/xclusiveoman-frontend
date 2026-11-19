import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  LuBedDouble,
  LuBuilding2,
  LuCalendarClock,
  LuCalendarDays,
  LuCamera,
  LuCar,
  LuClock,
  LuInfo,
  LuMap,
  LuMapPin,
  LuPlane,
  LuPlaneLanding,
  LuPlaneTakeoff,
  LuStar,
  LuTag,
  LuTicket,
  LuUsers,
  LuUtensils,
} from "react-icons/lu";
import CloseButton from "../../shared/components/CloseButton.jsx";
import ImageSlider from "../../shared/components/ImageSlider.jsx";
import { RichTextDisplay } from "../../shared/components/RichTextEditor.jsx";
import { formatShortDate, formatTime } from "../../shared/fdPackage/index.js";

// "View details" popup for the Hotel/Sightseeing/Meals/Transfers/Flight
// overview tabs on DepartureDetail.jsx — photo slider on the left behind a
// curved orange edge, details on a warm cream panel on the right with an
// Omani skyline along the bottom. Stacks vertically on small screens.

// Local hexes, not agent-* tokens: the reference leans a deeper orange than
// the portal's #FFC15A gold, and this is the only place that uses it.
const ORANGE = "#EE8A1F";

// Pill shown over the photo, per kind of item that was opened.
function badgeFor(kind, item) {
  switch (kind) {
    case "hotel":
      return { label: "Hotel Accommodation", Icon: LuBuilding2 };
    case "tour":
    case "activity":
      return {
        label: item.city ? `Explore ${item.city}` : "Sightseeing",
        Icon: LuCamera,
      };
    case "meal":
      return { label: "Dining", Icon: LuUtensils };
    case "transfer":
      return { label: "Transfer", Icon: LuCar };
    case "flight":
      return { label: "Flight", Icon: LuPlane };
    default:
      return { label: "Details", Icon: LuInfo };
  }
}

// Known fields get a friendly label + icon and a fixed display order; any
// other field the API returns still shows, after these, with a generic icon.
const FIELD_META = {
  type: { label: "Type", Icon: LuMap },
  duration: { label: "Duration", Icon: LuCalendarClock },
  name: { label: "Name", Icon: LuTag },
  city: { label: "City", Icon: LuMapPin },
  state: { label: "State", Icon: LuMap },
  category: { label: "Category", Icon: LuStar },
  pickupTime: { label: "Pickup Time", Icon: LuClock },
  pickup_time: { label: "Pickup Time", Icon: LuClock },
  source: { label: "From", Icon: LuPlaneTakeoff },
  destination: { label: "To", Icon: LuPlaneLanding },
  departureDate: { label: "Departure Date", Icon: LuCalendarDays },
  departureTime: { label: "Departure Time", Icon: LuClock },
  airline: { label: "Airline", Icon: LuPlane },
  flightNumber: { label: "Flight Number", Icon: LuTicket },
  boardBasisOptions: { label: "Board Basis", Icon: LuUtensils },
  roomTypes: { label: "Room Types", Icon: LuBedDouble },
  capacity: { label: "Capacity", Icon: LuUsers },
};
const FIELD_ORDER = Object.keys(FIELD_META);

const HIDDEN_KEYS = new Set([
  "description",
  "shortDescription",
  "images",
  "image",
  "title",
  "createdAt",
  "updatedAt",
  "created_at",
  "updated_at",
]);

function humanizeKey(key) {
  const spaced = key.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Display string for a field, or null when it isn't worth a card (nested
// objects, empty values).
function formatValue(key, value) {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    const flat = value.filter((v) => v != null && typeof v !== "object");
    return flat.length ? flat.join(", ") : null;
  }
  if (typeof value === "object") return null;
  const str = String(value);
  if (/time/i.test(key) && /^\d{1,2}:\d{2}/.test(str)) return formatTime(str);
  if (/date/i.test(key) && !Number.isNaN(Date.parse(str))) {
    return formatShortDate(str);
  }
  if (key === "type") return str.charAt(0).toUpperCase() + str.slice(1);
  return str;
}

function detailFields(item) {
  const fields = Object.entries(item)
    .filter(
      ([key]) =>
        !HIDDEN_KEYS.has(key) &&
        !/^id$|Id$|_id$/.test(key) &&
        !/price|cost|amount/i.test(key)
    )
    .map(([key, value]) => ({
      key,
      value: formatValue(key, value),
      label: FIELD_META[key]?.label || humanizeKey(key),
      Icon: FIELD_META[key]?.Icon || LuInfo,
    }))
    .filter((f) => f.value);
  const rank = (key) => {
    const i = FIELD_ORDER.indexOf(key);
    return i === -1 ? FIELD_ORDER.length : i;
  };
  return fields.sort((a, b) => rank(a.key) - rank(b.key));
}

// Curved orange edge between the photo and the cream panel (sm+ only). The
// cream fill hides the photo to the right of the curve; non-scaling strokes
// keep the band an even thickness however tall the modal gets.
function CurvedEdge() {
  const curve = "M38 0 C72 22 8 44 30 64 C46 78 22 90 40 100";
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 80 100'
      preserveAspectRatio='none'
      className='pointer-events-none absolute inset-y-0 right-0 hidden h-full w-20 sm:block'
    >
      <defs>
        <linearGradient id='overview-edge' x1='0' y1='0' x2='0' y2='1'>
          <stop offset='0%' stopColor='#F7B04A' />
          <stop offset='55%' stopColor={ORANGE} />
          <stop offset='100%' stopColor='#F5A33A' />
        </linearGradient>
      </defs>
      <path d={`${curve} L80 100 L80 0 Z`} fill='#FFF8EC' />
      <path
        d={curve}
        fill='none'
        stroke='url(#overview-edge)'
        strokeWidth='9'
        vectorEffect='non-scaling-stroke'
      />
      <path
        d={curve}
        fill='none'
        stroke='#FFE2B3'
        strokeWidth='2'
        strokeOpacity='0.7'
        vectorEffect='non-scaling-stroke'
        transform='translate(3 0)'
      />
    </svg>
  );
}

// Decorative Omani skyline — fort wall, domes, minarets, palms and a plane —
// faded into the bottom of the details panel.
function OmanSkyline() {
  return (
    <div
      aria-hidden='true'
      className='pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32 select-none sm:h-36'
    >
      <svg
        viewBox='0 0 480 140'
        preserveAspectRatio='xMidYMax slice'
        className='h-full w-full'
      >
        {/* distant hills */}
        <path
          d='M0 110 Q60 70 120 96 T240 88 T360 92 T480 84 V140 H0 Z'
          fill='#F9DDB0'
          opacity='0.45'
        />
        <g fill='#F4C27E' opacity='0.55'>
          {/* fort wall with crenellations */}
          <path d='M70 140 V112 h8 v-5 h6 v5 h8 v-5 h6 v5 h8 v-5 h6 v5 h8 v-5 h6 v5 h8 V140 Z' />
          <path d='M300 140 V114 h8 v-5 h6 v5 h8 v-5 h6 v5 h8 v-5 h6 v5 h8 v-5 h6 v5 h8 V140 Z' />
          {/* left minaret */}
          <path d='M176 140 V62 h-3 l5 -10 5 10 h-3 V140 Z' />
          <circle cx='178' cy='48' r='3' />
          <rect x='172' y='78' width='12' height='4' rx='1' />
          {/* main mosque + dome */}
          <path d='M196 140 V100 h88 V140 Z' />
          <path d='M206 100 Q240 52 274 100 Z' />
          <rect x='238' y='44' width='4' height='14' />
          <path d='M214 100 Q222 86 230 100 Z M250 100 Q258 86 266 100 Z' />
          {/* right minaret */}
          <path d='M300 140 V58 h-3 l5 -10 5 10 h-3 V140 Z' />
          <circle cx='302' cy='44' r='3' />
          <rect x='296' y='74' width='12' height='4' rx='1' />
          {/* small towers */}
          <path d='M140 140 V96 q8 -10 16 0 V140 Z' />
          <path d='M350 140 V100 q8 -10 16 0 V140 Z' />
        </g>
        {/* doorway arches */}
        <g fill='#FFF8EC' opacity='0.8'>
          <path d='M232 140 v-18 q8 -10 16 0 v18 Z' />
          <path d='M212 128 v-10 q5 -6 10 0 v10 Z M258 128 v-10 q5 -6 10 0 v10 Z' />
        </g>
        {/* palms */}
        <g fill='#EDA94C' opacity='0.85'>
          <path d='M28 140 Q30 112 36 92 l3 1 Q34 114 33 140 Z' />
          <path d='M37 92 q-16 -8 -30 4 q14 -4 30 -4 Z M37 92 q-6 -16 -22 -16 q14 6 22 16 Z M37 92 q4 -16 20 -18 q-12 8 -20 18 Z M37 92 q16 -4 28 8 q-14 -4 -28 -8 Z M37 92 q-14 4 -20 18 q8 -12 20 -18 Z' />
          <path d='M446 140 Q444 110 438 92 l-3 1 Q440 114 441 140 Z' />
          <path d='M437 92 q16 -8 30 4 q-14 -4 -30 -4 Z M437 92 q6 -16 22 -16 q-14 6 -22 16 Z M437 92 q-4 -16 -20 -18 q12 8 20 18 Z M437 92 q-16 -4 -28 8 q14 -4 28 -8 Z M437 92 q14 4 20 18 q-8 -12 -20 -18 Z' />
        </g>
        {/* plane + trail */}
        <path
          d='M330 46 Q372 40 410 22'
          fill='none'
          stroke={ORANGE}
          strokeWidth='1.5'
          strokeDasharray='4 4'
          opacity='0.7'
        />
        <path
          d='M408 20 l14 -9 3 1 -8 10 9 3 3 -3 2 1 -3 6 -6 2 -2 -1 1 -4 -9 -2 -5 8 -3 0 2 -9 Z'
          fill={ORANGE}
        />
      </svg>
    </div>
  );
}

export default function OverviewDetailModal({ item, kind, onClose }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  const title = item.title || item.name || item.label || "Details";
  const description = item.description || item.shortDescription;
  const images = (item.images?.length ? item.images : [item.image]).filter(
    Boolean
  );
  const location = item.city || item.destination;
  const fields = detailFields(item);
  const { label: badgeLabel, Icon: BadgeIcon } = badgeFor(kind, item);

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-6'
      onClick={onClose}
    >
      <motion.div
        role='dialog'
        aria-modal='true'
        aria-label={title}
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        onClick={(event) => event.stopPropagation()}
        className='flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-[#FFF8EC] shadow-2xl shadow-black/30 sm:min-h-[540px] sm:flex-row'
      >
        {/* Photo side */}
        <div className='relative h-64 flex-none border-b-4 border-[#EE8A1F] sm:h-auto sm:w-[46%] sm:border-b-0'>
          {images.length > 0 ? (
            <ImageSlider
              images={images}
              alt={title}
              keyboard
              controlsClassName='sm:pr-20'
            />
          ) : (
            <div className='flex h-full w-full items-center justify-center bg-gradient-to-br from-[#F7B04A] to-[#E07B12] text-white/80'>
              <BadgeIcon size={64} />
            </div>
          )}
          <span
            className='absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-black/20 sm:left-6 sm:top-6'
            style={{ backgroundColor: ORANGE }}
          >
            <BadgeIcon size={16} />
            {badgeLabel}
          </span>
          <CurvedEdge />
        </div>

        {/* Details side */}
        <div className='flex min-h-0 flex-1 flex-col overflow-y-auto'>
          <div className='relative isolate flex-1 px-5 pb-36 pt-5 sm:px-8 sm:pb-40 sm:pl-4 sm:pt-7'>
            <div className='flex items-start justify-between gap-4'>
              {location ? (
                <span className='inline-flex items-center gap-1.5 rounded-full bg-[#FDE9CC] px-3.5 py-1.5 text-sm font-semibold text-[#E07B12]'>
                  <LuMapPin size={15} />
                  {location}
                </span>
              ) : (
                <span />
              )}
              <CloseButton onClick={onClose} label='Close details' />
            </div>

            <h3 className='mt-3 font-serif text-3xl font-extrabold leading-tight text-agent-ink-dark sm:text-4xl'>
              {title}
            </h3>
            <div
              className='mt-3 h-1 w-14 rounded-full'
              style={{ backgroundColor: ORANGE }}
            />

            {description && (
              <RichTextDisplay
                html={description}
                className='mt-4 text-[15px] leading-relaxed text-agent-ink/75'
              />
            )}

            {fields.length > 0 && (
              <div className='mt-6 grid gap-3 sm:grid-cols-2'>
                {fields.map(({ key, label, value, Icon }, idx) => (
                  <div
                    key={key}
                    className={`flex items-center gap-3 rounded-2xl border border-[#F6DDB4] bg-white/60 p-3 backdrop-blur-[2px] ${
                      fields.length % 2 === 1 && idx === fields.length - 1
                        ? "sm:col-span-2"
                        : ""
                    }`}
                  >
                    <span className='flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[#FDE9CC] text-[#E07B12]'>
                      <Icon size={22} />
                    </span>
                    <div className='min-w-0'>
                      <div className='text-xs font-medium text-agent-muted'>
                        {label}
                      </div>
                      <div className='mt-0.5 break-words text-sm font-bold text-agent-ink-dark'>
                        {value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <OmanSkyline />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
