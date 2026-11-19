import { LuFileText, LuUser } from 'react-icons/lu';
import { Badge } from '../ui.jsx';
import { TRAVELLER_VISA } from './visaAdminMeta.js';

// Small image tile that opens the lightbox; a dashed placeholder when the
// document is missing.
export function DocTile({ url, label, onOpen, className = 'h-14 w-20' }) {
  if (!url) {
    return (
      <span className={`${className} flex flex-none flex-col items-center justify-center rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-[9px] font-medium text-[#94A3B8]`}>
        <LuFileText size={14} />
        No {label.toLowerCase()}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpen({ url, title: label })}
      className={`${className} group relative flex-none overflow-hidden rounded-lg border border-line-light bg-[#F1F5F9]`}
      aria-label={`View ${label}`}
      title={label}
    >
      <img src={url} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1 pb-0.5 pt-2 text-[8.5px] font-semibold text-white">
        {label}
      </span>
    </button>
  );
}

// One traveller in the agency page's request card: photo, name, passport
// number/nationality, both passport pages and the visa status.
export function TravellerThumb({ traveller, onOpen }) {
  const name = traveller.fullName || `Traveller ${traveller.position}`;
  const visa = TRAVELLER_VISA[traveller.visaStatus] || TRAVELLER_VISA.pending;
  const pd = traveller.passportDetails || {};
  const open = (doc) => onOpen({ ...doc, title: `${name} — ${doc.title}` });
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-line-light bg-[#FBFCFF] p-3">
      <div className="flex items-center gap-3">
        {traveller.photoUrl ? (
          <button
            type="button"
            onClick={() => open({ url: traveller.photoUrl, title: 'Photo' })}
            className="h-12 w-12 flex-none overflow-hidden rounded-full border-2 border-white shadow ring-1 ring-line-light"
            aria-label={`View ${name}'s photo`}
          >
            <img src={traveller.photoUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          </button>
        ) : (
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[#E2E8F0] text-[#94A3B8]">
            <LuUser size={20} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink" title={name}>
            {name}
          </div>
          <div className="truncate text-[11px] text-muted">
            {pd.passportNumber ? <span className="font-mono">{pd.passportNumber}</span> : 'No passport details'}
            {pd.nationality ? ` · ${pd.nationality}` : ''}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <DocTile url={traveller.passportFrontUrl} label="Passport front" onOpen={open} />
        <DocTile url={traveller.passportBackUrl} label="Passport back" onOpen={open} />
        <Badge tone={visa.tone} className="ml-auto !px-2 !text-[9px]">
          {visa.label}
        </Badge>
      </div>
    </div>
  );
}
