import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LuArrowDown,
  LuArrowRight,
  LuCalendarDays,
  LuCamera,
  LuBellRing,
  LuCheck,
  LuChevronDown,
  LuChevronRight,
  LuClock,
  LuFileDown,
  LuGlobe,
  LuHeadphones,
  LuLandmark,
  LuLifeBuoy,
  LuLock,
  LuLogIn,
  LuMinus,
  LuPlane,
  LuPlus,
  LuScanLine,
  LuStamp,
  LuUser,
  LuUsers,
  LuUsersRound,
} from 'react-icons/lu';
import { api } from '../api/client.js';
import { ErrorText } from '../components/ui.jsx';
import {
  VisaFlowTopBar,
} from '../components/visa/VisaFlowUi.jsx';
import OmanCitiesCarousel from '../components/visa/OmanCitiesCarousel.jsx';
import VisaFaq from '../components/visa/VisaFaq.jsx';
import { applicationStage, stageMeta } from '../components/visa/visaMeta.js';
import { formatInr, formatOmr, getOmrToInrRate, subscribeOmrToInrRate } from '../../shared/currency.js';

// Agent "Apply for Visa" — step 1: which visa (a Visa Package) -> how many
// travellers, then "Fill details" creates a draft application
// (POST /visa/applications) and moves on to the names page
// (VisaTravellers.jsx). Packages (duration, entry type, valid for, maximum
// stay) come from the admin "Visa Packages" page; the single per-person
// price from Payments → Package Controller → Visa (GET /visa/types →
// packages, pricePerPerson, heroImageUrl).
//
// Layout: a full-width hero (the admin-uploaded Hero Image behind the title
// and required documents), then two columns — visa options + "Process and
// documents" on the left, and the booking card (price per traveller, chosen
// visa, traveller counter, Fill details) on the right, sticky and centred in
// the viewport while the left side scrolls. Agent palette: ivory surfaces,
// #17243A ink, #FFC15A yellow accent.

const MIN_MEMBERS = 1;
const MAX_MEMBERS = 20;

const SERIF = "font-['Georgia','Cambria','Times_New_Roman',serif]";
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFBF47] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFF9EF]';

// What every application needs from each traveller (VisaPhotos.jsx,
// VisaPassports.jsx).
const REQUIRED_DOCUMENTS = [
  { label: 'Passport', Icon: LuGlobe },
  { label: 'Photo', Icon: LuCamera },
];

// How a visa request moves (agent flow → admin Visa Administration).
const PROCESS_STEPS = [
  { label: 'You apply', tone: 'text-[#17243A]' },
  { label: 'We verify & submit', tone: 'text-[#C2561C]' },
  { label: 'Visa processed', tone: 'text-[#17243A]' },
  { label: 'Visa issued!', tone: 'text-[#15803D]' },
];

// Per-traveller documents and what the portal does with them (passport scan
// + detail extraction, automatic photo check).
const DOCUMENT_CARDS = [
  { title: 'Passport', lines: ['You scan.', 'We extract.'], Icon: LuScanLine },
  { title: 'Photo', lines: ['You upload.', 'We check it.'], Icon: LuCamera },
];

// "Benefits included with your visa" — four things the portal really does
// for every application (photo check, passport scan, tracking +
// notifications, visa download).
const BENEFITS = [
  {
    title: 'Automatic photo check',
    Icon: LuCamera,
    summary: 'Every traveller photo is checked against visa photo rules before you submit.',
    details: [
      'Face position, eyes open, no sunglasses or hat, sharpness and lighting are checked the moment you upload.',
      "If something's off you'll see why, and can retake or replace the photo straight away.",
    ],
  },
  {
    title: 'Passport scan & auto-fill',
    Icon: LuScanLine,
    summary: 'Scan the passport pages — we read the details for you, no retyping.',
    details: [
      'Name, passport number, nationality, dates and more are filled in from the scan.',
      'You review and confirm every field, so mistakes are caught before submission.',
    ],
  },
  {
    title: 'Live tracking & alerts',
    Icon: LuBellRing,
    summary: 'Follow each application from documents to issued visa, with alerts at every step.',
    details: [
      'See the status of every application of your agency in Track Applications.',
      'You get a notification and an email as soon as visas are issued — or if one is refused, with the reason.',
    ],
  },
  {
    title: 'Visas delivered to your portal',
    Icon: LuFileDown,
    summary: 'Issued visas are uploaded per traveller, ready to download.',
    details: [
      'Each traveller gets their own visa file, visa number and validity date.',
      'Download them any time from the application — no email attachments to chase.',
    ],
  },
];

// Icon from the package's entry type (admin presets or a custom label);
// anything unrecognised gets a neutral stamp icon.
function entryIcon(entryType = '') {
  const n = entryType.toLowerCase();
  if (/multi|multiple|repeat/.test(n)) return LuUsersRound;
  if (/double|two/.test(n)) return LuUsers;
  if (/transit|layover/.test(n)) return LuPlane;
  if (/single|one/.test(n)) return LuUser;
  return LuStamp;
}

const days = (n) => `${n} ${Number(n) === 1 ? 'day' : 'days'}`;
const packageTitle = (p) => `${p.durationDays}-day visa`;
// "Single-Entry" -> "Single" for the "Entry" fact.
const entryShort = (entryType = '') => entryType.replace(/[-\s]*entry$/i, '') || entryType;

function useInrRate() {
  useSyncExternalStore(subscribeOmrToInrRate, getOmrToInrRate);
}

// "10 Days", "6 Months", "1 Year" — whole years, then whole months from 180
// days up, otherwise days (30 / 90 stay "30 Days" / "90 Days").
function durationLabel(n) {
  const d = Number(n);
  if (d >= 365 && d % 365 === 0) return `${d / 365} ${d === 365 ? 'Year' : 'Years'}`;
  if (d >= 180 && d % 30 === 0) return `${d / 30} Months`;
  return `${d} ${d === 1 ? 'Day' : 'Days'}`;
}

function PackageFact({ Icon, label, value }) {
  return (
    <span className="flex min-w-0 items-start gap-2">
      <Icon size={17} className="mt-0.5 flex-none text-[#E87535]" aria-hidden />
      <span className="min-w-0">
        <span className="block break-words text-[13px] leading-tight text-[#737D8C]">{label}</span>
        <span className="mt-0.5 block break-words text-[15px] font-bold leading-snug text-[#17243A]">{value}</span>
      </span>
    </span>
  );
}

// One visa option as a card: icon disc, "10 Days" + entry type, the price
// and a row of facts — valid for, maximum stay, entry. Clicking the card
// selects it (radio semantics, feeds the booking card); "Apply for Visa"
// starts an application for this visa straight away with the traveller
// count from the booking card.
//
// When the package has an image (admin Create Visa), hovering the card with
// a mouse flips it over to that image. The back repeats the name, price and
// "Apply for Visa" so nothing is out of reach while it's flipped (clicking
// the back selects the package, like the front). Touch screens and keyboard
// users never flip — they keep the front, which has everything.
function PackageCard({ pkg, selected, onSelect, onApply, applying, busy, pricePerPerson }) {
  const effectivePrice = pkg.pricePerPerson ?? pricePerPerson;
  const flips = !!pkg.imageUrl;
  return (
    <div className="group/flip relative h-full [perspective:1400px]">
      <div
        className={`relative h-full transition-transform duration-500 ease-out [transform-style:preserve-3d] motion-reduce:duration-0 ${
          flips ? '[@media(hover:hover)]:group-hover/flip:[transform:rotateY(180deg)]' : ''
        }`}
      >
        {/* Front */}
        <div
          className={`group relative flex h-full w-full flex-col rounded-[22px] border-2 bg-white p-5 transition duration-200 [backface-visibility:hidden] [transform:rotateY(180deg)] ${
            selected
              ? 'border-[#FFBF47] bg-[#FFFCF6] shadow-[0_16px_36px_-22px_rgba(245,166,35,0.8)]'
              : 'border-transparent shadow-[0_10px_30px_-22px_rgba(22,27,39,0.35)] ring-1 ring-[#F0DFC7]/80 hover:ring-[#FFD68A]'
          }`}
        >
          <button
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${packageTitle(pkg)}, ${pkg.entryType}, valid for ${days(pkg.validForDays)}, maximum stay ${days(pkg.maxStayDays)}`}
            onClick={onSelect}
            className={`flex flex-1 flex-col rounded-xl text-left ${FOCUS}`}
          >
            <span
              aria-hidden="true"
              className={`absolute right-3.5 top-3.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#FFBF47] text-[#17243A] shadow-sm transition ${
                selected ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
              }`}
            >
              <LuCheck size={15} strokeWidth={3.5} />
            </span>

            {/* Wraps (price under the name) when the card is narrow — e.g. a
                small screen with the sidebar open. */}
            <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span
                className={`flex h-16 w-16 flex-none items-center justify-center rounded-full transition ${
                  selected ? 'bg-[#FFE6C7] text-[#C2561C]' : 'bg-[#FFF1DF] text-[#E87535]'
                }`}
              >
                <LuLandmark size={26} />
              </span>
              <span className="min-w-[7rem] flex-1">
                <span className="block text-xl font-bold leading-tight text-[#17243A]">{durationLabel(pkg.durationDays)}</span>
                <span className="mt-1 block break-words text-[15px] leading-snug text-[#737D8C]">{pkg.entryType}</span>
              </span>
              <span className="ml-auto flex flex-none items-center gap-1.5 pr-6">
                {effectivePrice != null && <span className="text-lg font-bold text-[#17243A]">{formatOmr(effectivePrice)}</span>}
                <LuChevronRight size={18} className="text-[#8C8F96] transition group-hover:translate-x-0.5" aria-hidden />
              </span>
            </span>

            {/* Three facts side by side; they flow onto a second row rather
                than squeezing when the card is narrow. */}
            <span className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-x-3 gap-y-3 border-t border-[#F0DFC7] pt-4">
              <PackageFact Icon={LuCalendarDays} label="Valid for" value={days(pkg.validForDays)} />
              <PackageFact Icon={LuClock} label="Max stay" value={days(pkg.maxStayDays)} />
              <PackageFact Icon={LuLogIn} label="Entry" value={entryShort(pkg.entryType)} />
            </span>
          </button>

          <button
            type="button"
            onClick={onApply}
            disabled={busy}
            aria-label={`Apply for Visa — ${packageTitle(pkg)}, ${pkg.entryType}`}
            className={`mt-5 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-[15px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS} ${
              selected
                ? 'bg-[#FFBF47] text-[#17243A] shadow-[0_10px_22px_-12px_rgba(245,166,35,0.95)] hover:bg-[#F7AE2C]'
                : 'border border-[#FFBF47] bg-white text-[#17243A] hover:bg-[#FFF1DF]'
            }`}
          >
            {applying ? 'Starting…' : 'Apply for Visa'} <LuArrowRight size={17} />
          </button>
        </div>

        {/* Back — the package image (mouse hover only; hidden from screen readers, the front has it all). */}
        {flips && (
          <div
            aria-hidden="true"
            data-card-back
            onClick={onSelect}
            className={`absolute inset-0 flex cursor-pointer flex-col justify-end overflow-hidden rounded-[22px] [backface-visibility:hidden] ${
              selected ? 'border-[#FFBF47]' : 'border-transparent'
            }`}
          >
            <img src={pkg.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute inset-0 bg-gradient-to-t from-[#17243A]/90 via-[#17243A]/35 to-transparent" />
            {selected && (
              <span className="absolute right-3.5 top-3.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#FFBF47] text-[#17243A] shadow-sm">
                <LuCheck size={15} strokeWidth={3.5} />
              </span>
            )}
            <div className="relative p-5 text-white">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xl font-bold leading-tight">{durationLabel(pkg.durationDays)}</p>
                  <p className="mt-0.5 break-words text-[15px] leading-snug text-white/80">
                    {pkg.entryType} · valid {days(pkg.validForDays)}
                  </p>
                </div>
                {effectivePrice != null && <p className="flex-none text-lg font-bold">{formatOmr(effectivePrice)}</p>}
              </div>
              <button
                type="button"
                tabIndex={-1}
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  onApply();
                }}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#FFBF47] px-5 py-3 text-[15px] font-bold text-[#17243A] shadow-[0_10px_22px_-12px_rgba(245,166,35,0.95)] transition hover:bg-[#F7AE2C] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {applying ? 'Starting…' : 'Apply for Visa'} <LuArrowRight size={17} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// One benefit row: icon disc, title, one-line summary; the chevron opens
// the details underneath.
function BenefitItem({ benefit }) {
  const [open, setOpen] = useState(false);
  const { title, Icon, summary, details } = benefit;
  const id = `benefit-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return (
    <li className="border-b border-[#F0DFC7] last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-start gap-5 py-6 text-left ${FOCUS}`}
      >
        <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full border border-[#F0DFC7] bg-white text-[#E87535] shadow-[0_6px_16px_-12px_rgba(22,27,39,0.35)]">
          <Icon size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-semibold text-[#17243A]">{title}</span>
          <span className="mt-1.5 block text-[15px] leading-relaxed text-[#737D8C]">{summary}</span>
        </span>
        <LuChevronDown
          size={20}
          aria-hidden
          className={`mt-1 flex-none text-[#17243A] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <ul id={id} className="-mt-2 mb-6 ml-[76px] space-y-2">
          {details.map((d) => (
            <li key={d} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-[#3E4757]">
              <LuCheck size={16} strokeWidth={3} className="mt-1 flex-none text-[#E87535]" aria-hidden />
              {d}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function CardRow({ Icon, label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-[15px]">
      <span className="flex items-center gap-2.5 text-[#17243A]">
        <Icon size={17} className="flex-none text-[#17243A]" /> {label}
      </span>
      <span className="min-w-0 text-right font-semibold text-[#17243A]">{children}</span>
    </div>
  );
}

// The white booking card: price per traveller, the chosen visa, how many
// travellers, the total and "Fill details".
function BookingCard({ loading, packages, selected, pricePerPerson, members, onMembers, ready, creating, onFill, error }) {
  useInrRate();
  const total = pricePerPerson != null ? pricePerPerson * members : null;
  const inrPer = pricePerPerson != null ? formatInr(pricePerPerson) : null;
  const inrTotal = total != null ? formatInr(total) : null;
  const shell = 'rounded-[28px] border border-[#F0DFC7]/80 bg-white shadow-[0_24px_60px_-28px_rgba(22,27,39,0.45)]';

  if (loading) {
    return (
      <div className={`space-y-4 p-6 ${shell}`} aria-busy="true">
        <div className="h-10 w-40 animate-pulse rounded-lg bg-[#FFF1DF]" />
        <div className="h-16 animate-pulse rounded-2xl bg-[#FFF9EF]" />
        <div className="h-14 animate-pulse rounded-full bg-[#FFF1DF]" />
        <span className="sr-only">Loading visa options…</span>
      </div>
    );
  }

  if (packages.length === 0) {
    return (
      <div className={`p-6 text-center sm:p-7 ${shell}`}>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF1DF] text-[#E87535]">
          <LuStamp size={26} />
        </div>
        <h2 className={`${SERIF} mt-4 text-2xl font-bold text-[#17243A]`}>No visas available yet</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[#737D8C]">
          {error || "Visas haven't been set up for your account yet. Please check back later, or reach out to support."}
        </p>
        <Link
          to="/agent/support"
          className={`mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#FFBF47] px-5 py-2.5 text-sm font-bold text-[#17243A] transition hover:bg-[#F7AE2C] ${FOCUS}`}
        >
          <LuLifeBuoy size={15} /> Contact support
        </Link>
      </div>
    );
  }

  return (
    <aside aria-label="Price summary" className={`p-5 sm:px-6 sm:py-5 ${shell}`}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        {pricePerPerson != null ? (
          <>
            <span className="text-[32px] font-bold leading-none tracking-tight text-[#17243A]">{formatOmr(pricePerPerson)}</span>
            <span className="text-base text-[#8C8F96]">/ traveller</span>
          </>
        ) : (
          <span className="text-xl font-bold text-[#17243A]">Visa fee to be confirmed</span>
        )}
      </div>
      {inrPer && <div className="mt-1 text-sm text-[#737D8C]">≈ {inrPer} per traveller</div>}

      <div className="mt-3.5">
        <CardRow Icon={LuStamp} label="Visa">
          {selected ? (
            durationLabel(selected.durationDays)
          ) : (
            <a href="#visa-packages" className="inline-flex items-center gap-1 font-semibold text-[#C2561C] underline underline-offset-4">
              Choose one <LuArrowDown size={14} />
            </a>
          )}
        </CardRow>
      </div>
      {/* The chosen visa's details on one row — always there ("—" until a
          visa is chosen) so the card keeps the same height and stays inside
          the hero. */}
      <div className="mt-2 grid grid-cols-3 divide-x divide-[#F0DFC7] rounded-2xl bg-[#FFF9EF] px-1 py-2.5" aria-live="polite">
        <span className="min-w-0 px-2.5">
          <PackageFact Icon={selected ? entryIcon(selected.entryType) : LuLogIn} label="Entry" value={selected ? entryShort(selected.entryType) : '—'} />
        </span>
        <span className="min-w-0 px-2.5">
          <PackageFact Icon={LuCalendarDays} label="Valid for" value={selected ? days(selected.validForDays) : '—'} />
        </span>
        <span className="min-w-0 px-2.5">
          <PackageFact Icon={LuClock} label="Max stay" value={selected ? days(selected.maxStayDays) : '—'} />
        </span>
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-3 rounded-2xl border border-[#F0DFC7] px-4 py-3 sm:px-5">
        <span className="flex items-center gap-2.5 text-[15px] font-medium text-[#17243A]">
          <LuUser size={18} /> How many travellers
        </span>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            aria-label="Decrease travellers"
            onClick={() => onMembers(-1)}
            disabled={members <= MIN_MEMBERS}
            className={`flex h-7 w-7 items-center justify-center rounded-full border border-[#D9DCE2] text-[#17243A] transition hover:border-[#FFBF47] hover:bg-[#FFF1DF] disabled:cursor-not-allowed disabled:opacity-35 ${FOCUS}`}
          >
            <LuMinus size={14} strokeWidth={2.5} />
          </button>
          <output
            aria-live="polite"
            aria-label={`${members} ${members === 1 ? 'traveller' : 'travellers'}`}
            className="w-6 text-center text-lg font-bold tabular-nums text-[#17243A]"
          >
            {members}
          </output>
          <button
            type="button"
            aria-label="Increase travellers"
            onClick={() => onMembers(1)}
            disabled={members >= MAX_MEMBERS}
            className={`flex h-7 w-7 items-center justify-center rounded-full border border-[#D9DCE2] text-[#17243A] transition hover:border-[#FFBF47] hover:bg-[#FFF1DF] disabled:cursor-not-allowed disabled:opacity-35 ${FOCUS}`}
          >
            <LuPlus size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {total != null && (
        <div className="mt-3.5 flex items-start justify-between gap-4">
          <span className="text-[15px] font-semibold text-[#17243A]">
            Total for {members} {members === 1 ? 'traveller' : 'travellers'}
          </span>
          <span className="flex flex-col items-end leading-tight">
            <span className="text-xl font-bold text-[#17243A]">{formatOmr(total)}</span>
            {inrTotal && <span className="mt-0.5 text-xs text-[#737D8C]">{inrTotal}</span>}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={onFill}
        disabled={!ready || creating}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#FFBF47] px-6 py-3 text-base font-bold text-[#17243A] shadow-[0_10px_22px_-10px_rgba(245,166,35,0.95)] transition hover:bg-[#F7AE2C] disabled:cursor-not-allowed disabled:bg-[#FFE3B0] disabled:text-[#8C8F96] disabled:shadow-none ${FOCUS}`}
      >
        {creating ? 'Starting…' : 'Fill details'} <LuArrowRight size={19} />
      </button>
      <p className="mt-2 flex items-center justify-center gap-2 text-center text-xs text-[#737D8C]">
        <LuLock size={13} className="flex-none" />
        {ready ? 'You can review all details in the next steps.' : 'Choose a visa to continue.'}
      </p>
      {error && (
        <div className="mt-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      {/* Help, at the foot of the card. */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#F0DFC7] pt-3.5">
        <div>
          <div className="text-[15px] font-semibold text-[#17243A]">Have queries?</div>
          <div className="text-[13px] text-[#737D8C]">Documents, process, price, etc.</div>
        </div>
        <Link
          to="/agent/support"
          className={`inline-flex items-center gap-1.5 rounded-full border border-[#FFBF47] bg-white px-4 py-2 text-sm font-semibold text-[#17243A] transition hover:bg-[#FFF1DF] ${FOCUS}`}
        >
          <LuHeadphones size={15} className="text-[#E87535]" /> Contact support
        </Link>
      </div>
    </aside>
  );
}

// At the top of the page the booking card sits on the hero. The hero keeps
// its 500px design height and only grows when the card (plus its offset
// and a bottom margin) wouldn't fit — e.g. long INR amounts — so the card
// never hangs over the hero's edge.
const CARD_OFFSET_PX = 32; // lg:mt-8 on the sticky column
const HERO_BOTTOM_GAP_PX = 22;

function useHeroFitsCard(cardWrapRef) {
  const [minHeight, setMinHeight] = useState(0);
  useLayoutEffect(() => {
    const el = cardWrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const update = () => setMinHeight(Math.ceil(el.getBoundingClientRect().height) + CARD_OFFSET_PX + HERO_BOTTOM_GAP_PX);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cardWrapRef]);
  return minHeight;
}

export default function VisaApply() {
  const navigate = useNavigate();
  const cardWrapRef = useRef(null);
  const heroFit = useHeroFitsCard(cardWrapRef);
  const [packages, setPackages] = useState([]);
  const [pricePerPerson, setPricePerPerson] = useState(null);
  // Hero image set by the admin (Visa Packages → Hero Image), or null.
  const [heroImageUrl, setHeroImageUrl] = useState(null);
  const [heroBroken, setHeroBroken] = useState(false);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [packageId, setPackageId] = useState('');
  const [members, setMembers] = useState(MIN_MEMBERS);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/visa/types'), api.get('/visa/applications')])
      .then(([t, a]) => {
        const list = t.packages || [];
        setPackages(list);
        setPricePerPerson(t.pricePerPerson ?? null);
        setHeroImageUrl(t.heroImageUrl || null);
        setApplications(a.applications);
        if (list.length === 1) setPackageId(list[0].id);
      })
      .catch((err) => setError(err.message || 'Unable to load visa options'))
      .finally(() => setLoading(false));
  }, []);

  const selected = packages.find((p) => p.id === packageId);
  const selectedPrice = selected?.pricePerPerson ?? pricePerPerson;
  const ready = !!selected;
  const showHeroImage = heroImageUrl && !heroBroken;

  function changeMembers(delta) {
    setMembers((m) => Math.min(MAX_MEMBERS, Math.max(MIN_MEMBERS, m + delta)));
  }

  // Starts the application for `id` — the booking card's selection, or the
  // card whose "Apply for Visa" was clicked (which also selects it).
  async function fillDetails(id = packageId) {
    if (!id || creating) return;
    setPackageId(id);
    setError('');
    setCreating(id);
    try {
      const { application } = await api.post('/visa/applications', {
        visaPackageId: id,
        members,
      });
      navigate(`/agent/visa/${application.id}/travellers`);
    } catch (err) {
      setError(err.message || 'Unable to start the application');
      setCreating(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-62px)] bg-[#FFF9EF]">
      <div className="mx-auto max-w-[1360px] px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-8">
        {/* Back + step bar first, full width (shared with every step, see
            VisaFlowUi.jsx) — inside the left column the sticky booking card
            would cover "Payment". */}
        <VisaFlowTopBar current={0} backTo="/agent/dashboard" />

        {/* ── Hero + visa options (left) and the booking card (right) ────────
            One grid: the hero sits in the left column, but its photo stretches
            right under the card column, so the card starts on the hero and then
            stays centred in the viewport (sticky) while the options and
            "Process and documents" scroll past. On phones the card follows the
            hero and nothing is sticky. */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-x-12 xl:grid-cols-[minmax(0,1fr)_450px]">
          <header className="relative isolate lg:col-start-1 lg:row-start-1">
            <div
              className="absolute inset-0 -z-10 overflow-hidden rounded-[32px] bg-[#1C2230] shadow-[0_28px_60px_-30px_rgba(22,27,39,0.7)] lg:-right-[468px] xl:-right-[498px]"
            >
              {showHeroImage ? (
                <img
                  src={heroImageUrl}
                  alt=""
                  onError={() => setHeroBroken(true)}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div
                  aria-hidden
                  className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_10%,rgba(255,193,90,0.28),transparent_55%),linear-gradient(135deg,#17243A_0%,#2A3245_55%,#3B3424_100%)]"
                />
              )}
              {/* Darken the left (text side) and the bottom so white text stays readable on any photo. */}
              <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[#17243A]/85 via-[#17243A]/40 to-transparent" />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#17243A]/45 via-transparent to-transparent" />
            </div>
            <div
              className="flex min-h-[300px] flex-col justify-center px-5 py-9 sm:px-10 sm:py-12 lg:min-h-[max(500px,var(--hero-fit,0px))] lg:px-14"
              style={{ '--hero-fit': `${heroFit}px` }}
            >
              <div className="max-w-xl">
                <h1 className={`${SERIF} text-[38px] font-bold leading-[1.05] tracking-tight text-white drop-shadow sm:text-[54px]`}>
                  Apply for Visa
                  <span className="mt-1 block font-agent-highlight font-medium italic text-[#FFC15A] underline decoration-[#FFC15A] decoration-2 underline-offset-[10px]">
                    in a few simple steps
                  </span>
                </h1>
                <p className="mt-5 max-w-md text-base leading-relaxed text-white/85 sm:text-[17px]">
                  Choose the visa and how many travellers need it — then add their names, photos and passports.
                </p>
                <div className="mt-8">
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-white/90">Required documents</div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {REQUIRED_DOCUMENTS.map(({ label, Icon }) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/15 px-4 py-2.5 text-[15px] font-semibold text-white backdrop-blur-md"
                      >
                        <Icon size={18} /> {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Sticky: starts on the hero, then stays centred in the viewport. */}
          <div className="relative z-10 w-full space-y-4 self-start lg:sticky lg:top-[max(4.75rem,calc(50vh_-_20rem))] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mr-8 lg:mt-8 lg:w-auto">
            <div ref={cardWrapRef}>
            <BookingCard
              loading={loading}
              packages={packages}
              selected={selected}
              pricePerPerson={selectedPrice}
              members={members}
              onMembers={changeMembers}
              ready={ready}
              creating={creating}
              onFill={() => fillDetails()}
              error={error}
            />
            </div>
          </div>

          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            {(loading || packages.length > 0) && (
              <section id="visa-packages" aria-labelledby="visa-package-heading" className="scroll-mt-24">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 id="visa-package-heading" className={`${SERIF} text-[28px] font-bold leading-tight text-[#17243A]`}>
                      Choose your visa
                    </h2>
                    <p className="mt-1 text-sm text-[#737D8C]">Select the visa your travellers need.</p>
                  </div>
                  <Link
                    to="/agent/support"
                    className={`inline-flex items-center gap-1.5 rounded-full border border-[#F0DFC7] bg-white px-4 py-2 text-xs font-semibold text-[#17243A] transition hover:border-[#FFBF47] ${FOCUS}`}
                  >
                    <LuHeadphones size={14} className="text-[#E87535]" /> Need help choosing?
                  </Link>
                </div>
                {loading ? (
                  <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))]">
                    {[0, 1].map((i) => (
                      <div key={i} className="h-48 animate-pulse rounded-[22px] border border-[#F0DFC7]/60 bg-white/70" />
                    ))}
                  </div>
                ) : (
                  <div role="radiogroup" aria-labelledby="visa-package-heading" className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))]">
                    {packages.map((p) => (
                      <PackageCard
                        key={p.id}
                        pkg={p}
                        selected={p.id === packageId}
                        onSelect={() => setPackageId(p.id)}
                        onApply={() => fillDetails(p.id)}
                        applying={creating === p.id}
                        busy={!!creating}
                        pricePerPerson={p.pricePerPerson ?? pricePerPerson}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            <section aria-labelledby="visa-process-heading" className="mt-12 border-t border-[#F0DFC7] pt-10">
              <h2 id="visa-process-heading" className={`${SERIF} text-[28px] font-bold leading-tight text-[#17243A]`}>
                Process and documents
              </h2>
              <p className="mt-3 flex items-start gap-3 text-[15px] leading-relaxed text-[#737D8C]">
                <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#FFF1DF] text-[#E87535]">
                  <LuStamp size={17} />
                </span>
                <span>
                  <b className="font-semibold text-[#17243A]">Only a passport and a visa photo</b> are needed for each traveller to
                  submit a visa application.
                </span>
              </p>
              <ol className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] font-semibold">
                {PROCESS_STEPS.map((step, i) => (
                  <li key={step.label} className="flex items-center gap-3">
                    <span className={step.tone}>{step.label}</span>
                    {i < PROCESS_STEPS.length - 1 && <LuChevronRight size={16} className="text-[#A0A6B1]" aria-hidden />}
                  </li>
                ))}
              </ol>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {DOCUMENT_CARDS.map(({ title, lines, Icon }) => (
                  <div key={title} className="flex items-center gap-5 rounded-[22px] border border-[#F0DFC7] bg-white p-5">
                    <span className="flex h-20 w-16 flex-none items-center justify-center rounded-xl bg-[#17243A] text-[#FFC15A]">
                      <Icon size={28} />
                    </span>
                    <span>
                      <span className="block text-lg font-semibold text-[#17243A]">{title}</span>
                      {lines.map((l) => (
                        <span key={l} className="block text-[15px] text-[#737D8C]">
                          {l}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section aria-labelledby="visa-benefits-heading" className="mt-12 border-t border-[#F0DFC7] pt-10">
              <h2 id="visa-benefits-heading" className={`${SERIF} text-[28px] font-bold leading-tight text-[#17243A]`}>
                Benefits included with your visa
              </h2>
              <ul className="mt-4">
                {BENEFITS.map((b) => (
                  <BenefitItem key={b.title} benefit={b} />
                ))}
              </ul>
            </section>
          </div>
        </div>

        {/* Full width: the sticky card is released before this. */}
        {!loading && packages.length > 0 && (
          <OmanCitiesCarousel
            onApply={() => document.getElementById('visa-packages')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          />
        )}

        {/* {applications.length > 0 && (
          <section className="mt-14" aria-labelledby="visa-applications-heading">
            <div className="mb-4 flex items-end justify-between gap-3">
              <h2 id="visa-applications-heading" className={`${SERIF} text-[22px] font-bold text-[#17243A]`}>
                Recent applications
              </h2>
              <Link
                to="/agent/visa/applications"
                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-[#C2561C] transition hover:text-[#17243A] ${FOCUS}`}
              >
                View all {applications.length > 3 ? `(${applications.length})` : ''} <LuArrowRight size={15} />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {applications.slice(0, 3).map((a) => (
                <Link
                  key={a.id}
                  to={`/agent/visa/applications/${a.id}`}
                  className={`rounded-2xl border border-[#F0DFC7]/70 bg-white p-4 transition hover:border-[#FFBF47] hover:shadow-[0_8px_20px_-14px_rgba(22,27,39,0.25)] ${FOCUS}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-bold text-[#17243A]">{a.visaType.name}</div>
                      <div className="truncate text-sm text-[#737D8C]">{a.visaCategory.name}</div>
                    </div>
                    <span className="flex-none rounded-full bg-[#FFF1DF] px-2.5 py-0.5 text-[11px] font-bold text-[#C2561C]">
                      {stageMeta(applicationStage(a)).label}
                    </span>
                  </div>
                  <div className="mt-3 text-xs text-[#737D8C]">
                    {a.applicantCount} {a.applicantCount === 1 ? 'traveller' : 'travellers'} · {a.photosDone}/{a.applicantCount} photos ·{' '}
                    {a.passportsDone ?? 0}/{a.applicantCount} passports · {new Date(a.createdAt).toLocaleDateString()}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )} */}

        <VisaFaq />
      </div>
    </div>
  );
}
