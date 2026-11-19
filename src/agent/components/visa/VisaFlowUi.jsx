import { Link } from 'react-router-dom';
import { LuArrowLeft, LuCircleAlert, LuCircleCheck, LuHeadphones, LuInfo, LuTriangleAlert } from 'react-icons/lu';
import VisaStepper from './VisaStepper.jsx';
import { FOCUS, SERIF } from './visaFlowTokens.js';

// Shared look for the five visa application steps (VisaApply → VisaTravellers
// → VisaPhotos → VisaPassports (+ VisaPassportDetails) → VisaPayment), so they
// read as one flow: same page frame, Back + step bar row, heading, banners,
// buttons, status badges, traveller numbers and cards.
//
// Constants (SERIF, FOCUS, badge maps, visaSummaryLine) live in
// visaFlowTokens.js.
//
// Palette (warm, no blues/purples):
//   page #FFF9EF · card #FFFFFF · text #17243A · secondary #737D8C
//   accent #E87535 · amber #FFBF47 · light amber #FFF1DF · border #F0DFC7
//   success #168765 · error #D74747

// Page frame: background, max width, and the Back + step bar row on top.
// `tight` (the photo scan) trims the bottom padding so it fits one screen.
export function VisaFlowPage({ current, backTo, backLabel = 'Back', tight = false, children }) {
  return (
    <div className="min-h-[calc(100vh-62px)] bg-[#FFF9EF]">
      <div className={`mx-auto w-full max-w-[1360px] px-4 pt-6 sm:px-6 lg:px-10 lg:pt-8 ${tight ? 'pb-4' : 'pb-16'}`}>
        <VisaFlowTopBar current={current} backTo={backTo} backLabel={backLabel} />
        {children}
      </div>
    </div>
  );
}

// "← Back" pill and the step bar, on one line from sm up (stacked on phones).
export function VisaFlowTopBar({ current, backTo, backLabel = 'Back' }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
      {backTo && (
        <Link
          to={backTo}
          className={`inline-flex h-10 w-fit flex-none items-center gap-1.5 rounded-full border border-[#F0DFC7] bg-white px-4 text-sm font-semibold text-[#17243A] shadow-[0_4px_12px_-8px_rgba(23,36,58,0.3)] transition hover:border-[#FFBF47] ${FOCUS}`}
        >
          <LuArrowLeft size={16} /> {backLabel}
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <VisaStepper current={current} className="" />
      </div>
    </div>
  );
}

// Serif page title, a one-line subtitle, and "Need help?" on the right.
// `compact` (the photo scan) uses a smaller title on one line with the
// subtitle, so the scan fits on one screen.
export function VisaPageHeading({ title, subtitle, action, help = true, compact = false }) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-4 ${compact ? 'mb-4' : 'mb-4'}`}>
      <div className={`min-w-0 ${compact ? 'flex flex-wrap items-baseline gap-x-3 gap-y-1' : ''}`}>
        <h1
          className={`${SERIF} font-bold leading-[1.1] tracking-tight text-[#17243A] ${compact ? 'text-[26px] sm:text-[30px]' : 'text-[32px] sm:text-[40px]'}`}
        >
          {title}
        </h1>
        {subtitle && <div className={`text-[15px] text-[#737D8C] ${compact ? '' : 'mt-2'}`}>{subtitle}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {action}
        {help && (
          <Link
            to="/agent/support"
            className={`inline-flex h-10 items-center gap-2 rounded-full border border-[#F0DFC7] bg-white px-4 text-sm font-semibold text-[#17243A] transition hover:border-[#FFBF47] ${FOCUS}`}
          >
            <LuHeadphones size={16} className="text-[#E87535]" /> Need help?
          </Link>
        )}
      </div>
    </div>
  );
}

const BANNER = {
  info: { box: 'border-[#F3D9B5] bg-[#FFF1DF] text-[#17243A]', icon: 'bg-[#FFBF47] text-white', Icon: LuInfo },
  warn: { box: 'border-[#F3D9B5] bg-[#FFF1DF] text-[#17243A]', icon: 'bg-[#E87535] text-white', Icon: LuTriangleAlert },
  danger: { box: 'border-[#F2C9C9] bg-[#FDF1F1] text-[#8E2B2B]', icon: 'bg-[#D74747] text-white', Icon: LuCircleAlert },
  success: { box: 'border-[#BFE3D5] bg-[#EEF8F4] text-[#0F5E47]', icon: 'bg-[#168765] text-white', Icon: LuCircleCheck },
};

// Compact helper / status banner with a round icon.
export function InfoBanner({ tone = 'info', title, children, action, className = '' }) {
  const t = BANNER[tone] || BANNER.info;
  const Icon = t.Icon;
  return (
    <div className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${t.box} ${className}`}>
      <div className="flex min-w-0 items-start gap-3">
        <span className={`mt-px flex h-6 w-6 flex-none items-center justify-center rounded-full ${t.icon}`}>
          <Icon size={14} strokeWidth={2.5} />
        </span>
        <div className="min-w-0 text-sm leading-relaxed">
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
        </div>
      </div>
      {action && <div className="flex-none">{action}</div>}
    </div>
  );
}

const BUTTON_BASE = `inline-flex items-center justify-center gap-2 rounded-full font-bold transition disabled:cursor-not-allowed ${FOCUS}`;
const BUTTON_SIZES = { md: 'h-11 px-5 text-sm', lg: 'h-12 px-7 text-[15px]' };

export function PrimaryButton({ size = 'lg', className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      {...props}
      className={`${BUTTON_BASE} ${BUTTON_SIZES[size]} bg-[#FFBF47] text-[#17243A] shadow-[0_10px_22px_-12px_rgba(232,117,53,0.75)] hover:bg-[#F7AE2C] disabled:bg-[#FFE3B0] disabled:text-[#9AA0AA] disabled:shadow-none ${className}`}
    />
  );
}

export function SecondaryButton({ size = 'md', className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      {...props}
      className={`${BUTTON_BASE} ${BUTTON_SIZES[size]} border border-[#F0DFC7] bg-white text-[#17243A] hover:border-[#FFBF47] hover:bg-[#FFF9EF] disabled:opacity-50 ${className}`}
    />
  );
}

export function DangerIconButton({ label, className = '', children, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={`flex h-9 w-9 flex-none items-center justify-center rounded-full text-[#D74747] transition hover:bg-[#FDF1F1] disabled:opacity-40 ${FOCUS} ${className}`}
    >
      {children}
    </button>
  );
}

// Status pill used for photos, passports and payment states.
const BADGE = {
  neutral: 'bg-[#F5EFE6] text-[#737D8C]',
  pending: 'bg-[#FFF1DF] text-[#B4561F]',
  success: 'bg-[#E7F5EF] text-[#168765]',
  danger: 'bg-[#FBEBEB] text-[#D74747]',
};
const BADGE_DOT = { neutral: 'bg-[#B9BEC6]', pending: 'bg-[#E87535]', success: 'bg-[#168765]', danger: 'bg-[#D74747]' };

export function StatusBadge({ tone = 'neutral', icon: Icon, children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${BADGE[tone]} ${className}`}>
      {Icon ? <Icon size={13} strokeWidth={2.5} /> : <span className={`h-1.5 w-1.5 rounded-full ${BADGE_DOT[tone]}`} />}
      {children}
    </span>
  );
}

export function TravellerNumber({ n, done = false, className = '' }) {
  return (
    <span
      className={`flex h-10 w-10 flex-none items-center justify-center rounded-full text-[15px] font-bold ${
        done ? 'bg-[#E7F5EF] text-[#168765]' : 'bg-[#FFF1DF] text-[#E87535]'
      } ${className}`}
    >
      {n}
    </span>
  );
}

// White card with the flow's border, radius and soft shadow.
export function FlowCard({ as: Tag = 'div', selected = false, className = '', children, ...props }) {
  return (
    <Tag
      {...props}
      className={`rounded-2xl border bg-white shadow-[0_12px_30px_-26px_rgba(23,36,58,0.45)] transition ${
        selected ? 'border-[#FFBF47] ring-1 ring-[#FFBF47]' : 'border-[#F0DFC7]'
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

// Right-aligned primary action with an optional hint underneath.
export function FlowFooter({ children, hint }) {
  return (
    <div className="mt-8 flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">{children}</div>
      {hint && <div className="text-center text-[13px] text-[#737D8C] sm:text-right">{hint}</div>}
    </div>
  );
}

export function FlowLoading({ label = 'Loading…' }) {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-10 w-72 animate-pulse rounded-lg bg-[#FFF1DF]" />
      <div className="h-24 animate-pulse rounded-2xl border border-[#F0DFC7] bg-white/70" />
      <div className="h-24 animate-pulse rounded-2xl border border-[#F0DFC7] bg-white/70" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function FlowError({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl border border-[#F2C9C9] bg-[#FDF1F1] px-4 py-3 text-sm text-[#8E2B2B]">
      {children}
    </p>
  );
}
