import { motion } from 'framer-motion';
import { LuCheck } from 'react-icons/lu';

// "Travel desk" look for Admin → Visa Packages (VisaSetup.jsx): lavender
// surfaces, indigo accent, navy text and illustrated artwork — the admin
// palette from tailwind.config.js, same sans font as every admin page.
// Shared by VisaSetup.jsx, VisaPackagesPanel.jsx and VisaHeroCard.jsx so the
// tabs read as one page.

export function SetupCard({ title, className = '', children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`relative rounded-2xl border border-[#E4E9FB] bg-white p-5 shadow-[0_6px_24px_rgba(30,41,99,0.06)] sm:p-8 ${className}`}
    >
      {title && (
        <h3 className={`mb-5 border-l-[3px] border-[#4F46E5] pl-3 text-xl font-bold leading-none text-[#172554]`}>
          {title}
        </h3>
      )}
      {children}
    </motion.div>
  );
}

const BUTTON = {
  primary:
    'bg-[#4F46E5] text-white shadow-[0_6px_16px_rgba(79,70,229,0.28)] hover:bg-[#4338CA] disabled:bg-[#A5B4FC] disabled:shadow-none',
  ghost: 'border border-[#DCE2F5] bg-white text-[#334155] hover:border-[#4F46E5] hover:text-[#4F46E5]',
  danger: 'border border-[#F5D0C9] bg-white text-[#B42318] hover:bg-[#FEF3F2]',
};

export function SetupButton({ tone = 'primary', className = '', children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed ${BUTTON[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

export function SetupCheckbox({ checked, onChange, label, hint }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2.5 text-sm font-medium text-[#172554]">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className={`flex h-5 w-5 items-center justify-center rounded-md border-[1.5px] transition peer-focus-visible:ring-2 peer-focus-visible:ring-[#4F46E5]/40 ${
          checked ? 'border-[#4F46E5] bg-[#4F46E5] text-white' : 'border-[#C7D2FE] bg-white'
        }`}
      >
        {checked && <LuCheck size={13} strokeWidth={3} />}
      </span>
      {label}
      {hint && <span className="text-xs font-normal text-[#64748B]">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded-lg border border-[#DCE2F5] bg-white px-3 py-2.5 text-sm text-[#172554] outline-none transition placeholder:text-[#94A3B8] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/15';

export function StatusPill({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        active ? 'bg-[#ECFDF3] text-[#067647]' : 'bg-[#F1F5F9] text-[#64748B]'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-[#17B26A]' : 'bg-[#94A3B8]'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

// ---- Decorative artwork (pure SVG, aria-hidden) ---------------------------------

// Page header art: visa stamp, gold plane and a passport over faint map
// lines and leaves. Sits top-right behind the header and fades to the left.
export function VisaHeaderArt({ className = '' }) {
  return (
    <svg viewBox="0 0 520 260" aria-hidden className={className} preserveAspectRatio="xMaxYMin slice">
      <defs>
        <linearGradient id="vs-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#C7D2FE" />
          <stop offset="0.5" stopColor="#818CF8" />
          <stop offset="1" stopColor="#4F46E5" />
        </linearGradient>
        <linearGradient id="vs-pass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3730A3" />
          <stop offset="1" stopColor="#1E1B4B" />
        </linearGradient>
        <linearGradient id="vs-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id="vs-mask">
          <rect width="520" height="260" fill="url(#vs-fade)" />
        </mask>
      </defs>
      <g mask="url(#vs-mask)">
        {/* map contours + leaves */}
        <g fill="none" stroke="#C7CCF0" strokeWidth="1" opacity="0.7">
          <path d="M120 40c40-20 90-10 120 10s70 30 110 10 80-20 120 0" />
          <path d="M100 80c50-25 100-5 140 15s80 25 120 5 70-15 140 5" />
          <path d="M140 200c30 10 60 30 100 20s70-40 110-30" />
        </g>
        <g fill="#D4D8F5" opacity="0.55">
          <path d="M210 30c18 6 26 22 22 40-16-6-26-22-22-40z" />
          <path d="M236 60c16 2 28 14 28 30-16-2-28-14-28-30z" />
          <path d="M190 70c14 8 18 22 12 36-14-8-18-22-12-36z" />
          <path d="M200 190c20-4 36 4 44 20-20 4-36-4-44-20z" />
        </g>
        {/* VISA stamp */}
        <g transform="translate(-44 14) rotate(-14 300 150)">
          <rect x="248" y="112" width="124" height="74" rx="6" fill="#F5F6FF" stroke="#8B93C9" strokeWidth="2" />
          <rect x="256" y="120" width="108" height="58" rx="3" fill="none" stroke="#8B93C9" strokeWidth="1" strokeDasharray="3 3" />
          <text x="310" y="161" textAnchor="middle" fontFamily="Georgia, serif" fontSize="30" fontWeight="700" fill="#6F78B5" letterSpacing="2">
            VISA
          </text>
        </g>
        {/* passport */}
        <g transform="rotate(16 440 170)">
          <rect x="378" y="78" width="138" height="186" rx="10" fill="url(#vs-pass)" />
          <rect x="378" y="78" width="10" height="186" rx="4" fill="#13113A" opacity="0.6" />
          <text x="450" y="118" textAnchor="middle" fontFamily="Georgia, serif" fontSize="15" fill="#C7D2FE" letterSpacing="2">
            PASSPORT
          </text>
          <g fill="none" stroke="#C7D2FE" strokeWidth="2">
            <circle cx="450" cy="180" r="30" />
            <ellipse cx="450" cy="180" rx="13" ry="30" />
            <path d="M420 180h60M425 165h50M425 195h50" />
          </g>
        </g>
        {/* gold plane */}
        <g transform="translate(338 4) rotate(32) scale(0.92)">
          <path d="M60 0c6 0 10 6 10 14v40l52 30v14l-52-14v34l16 12v10l-26-8-26 8v-10l16-12v-34L-2 98V84l52-30V14c0-8 4-14 10-14z" fill="url(#vs-gold)" />
          <path d="M60 4c3 0 5 4 5 10v120" stroke="#EEF2FF" strokeWidth="2" opacity="0.6" fill="none" />
        </g>
      </g>
    </svg>
  );
}

// Faint globe + postmark waves (left) and a dotted flight path to a pin
// (right) for empty states.
export function EmptyStateArt() {
  return (
    <svg viewBox="0 0 1000 160" aria-hidden className="pointer-events-none absolute inset-0 hidden h-full w-full sm:block" preserveAspectRatio="none">
      <g fill="none" stroke="#D4D8F5" strokeWidth="1.5">
        <circle cx="70" cy="70" r="46" />
        <ellipse cx="70" cy="70" rx="20" ry="46" />
        <path d="M24 70h92M30 48h80M30 92h80" />
        <path d="M130 30c12-8 24 8 36 0s24 8 36 0M130 44c12-8 24 8 36 0s24 8 36 0M130 58c12-8 24 8 36 0s24 8 36 0" />
        <path d="M820 150c40-30 80-60 130-70" strokeDasharray="5 6" />
        <path d="M948 74c-10 0-16 8-16 16 0 12 16 26 16 26s16-14 16-26c0-8-6-16-16-16z" />
        <circle cx="948" cy="90" r="5" />
      </g>
      <path d="M860 40l16 6 14-10 4 3-9 12 12 6-2 3-14-3-8 9-3-1 3-11-15-6z" fill="#D4D8F5" />
    </svg>
  );
}
