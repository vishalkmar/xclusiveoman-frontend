import { useSyncExternalStore } from 'react';
import { formatInr, formatOmr, getOmrToInrRate, subscribeOmrToInrRate } from '../../../shared/currency.js';

const SIZES = {
  md: { omr: 'text-[14px] font-semibold', inr: 'mt-0.5 text-[11.5px]' },
  lg: { omr: 'text-[28px] font-extrabold leading-none tracking-tight sm:text-[34px]', inr: 'mt-2 text-[13px]' },
  sm: { omr: 'text-[15px] font-bold', inr: 'mt-0.5 text-[11px]' },
};

// OMR on top with its INR equivalent underneath — the same pairing as
// shared/components/Money.jsx, but sized and coloured for the Bookings
// ledger. Never wraps: amounts stay on one line and use tabular figures.
// `note` replaces the INR line (e.g. "Settled").
export function Amount({ value, size = 'md', align = 'left', muted = false, note, className = '', theme = 'ledger' }) {
  useSyncExternalStore(subscribeOmrToInrRate, getOmrToInrRate);
  const s = SIZES[size];
  const inr = formatInr(value);
  return (
    <span className={`block tabular-nums ${align === 'right' ? 'text-right' : ''} ${className}`}>
      <span className={`block whitespace-nowrap ${s.omr} ${muted ? (theme === 'agent' ? 'text-agent-muted' : 'text-bk-muted') : (theme === 'agent' ? 'text-agent-ink' : 'text-bk-ink')}`}>
        {formatOmr(value)}
      </span>
      {note ? (
        <span className={`block whitespace-nowrap ${s.inr}`}>{note}</span>
      ) : (
        inr && <span className={`block whitespace-nowrap ${theme === 'agent' ? 'text-agent-muted' : 'text-bk-muted'} ${s.inr}`}>{inr}</span>
      )}
    </span>
  );
}
