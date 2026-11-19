// Example passport pages shown next to the upload slots, so agents know
// which page is the "front" (photo + data page with the two code lines)
// and which is the "back" (address page). Both show the same DUMMY passport
// (Arjun Sharma, Z1234567 — not a real person or document):
//   front — a photo of an open dummy passport (public/visa/passport-sample-front.png)
//   back  — the matching last page, drawn as SVG in the same look, with the
//           same passport number (the back page must match the front's).
// Both have the same 262 × 206 shape so the two upload slots line up.

const HI = "'Nirmala UI', 'Noto Sans Devanagari', 'Mangal', Arial, sans-serif";
const SANS = 'Arial, Helvetica, sans-serif';
const MONO = "'OCR B', 'Consolas', 'Courier New', monospace";
const INK = '#2E3442';
const LABEL = '#6E7482';

export function PassportFrontSample({ className = '' }) {
  return (
    <img
      src="/visa/passport-sample-front.png"
      width="262"
      height="206"
      alt="Example of a passport front page: photo on the left, details on the right, two code lines at the bottom"
      className={className}
      draggable="false"
    />
  );
}

// Bilingual caption (Hindi / English) + the printed value below it.
function Field({ x, y, hi, en, value, valueSize = 15 }) {
  return (
    <g>
      <text x={x} y={y} fontSize="8.5" fill={LABEL}>
        <tspan fontFamily={HI}>{hi}</tspan>
        <tspan fontFamily={SANS}> / {en}</tspan>
      </text>
      {value &&
        [].concat(value).map((line, i) => (
          <text key={line} x={x} y={y + 16 + i * 17} fontFamily={SANS} fontSize={valueSize} fill={INK} letterSpacing="0.4">
            {line}
          </text>
        ))}
    </g>
  );
}

export function PassportBackSample({ className = '' }) {
  // Barcode bars (fixed pattern so it renders the same every time).
  const bars = Array.from({ length: 58 }, (_, i) => ({ x: 44 + i * 4.1, w: [1.2, 2.4, 1.6, 3, 1.2, 2][(i * 7) % 6] }));
  return (
    <svg
      viewBox="0 0 524 412"
      width="262"
      height="206"
      className={className}
      role="img"
      aria-label="Example of a passport back page: passport number at the top, father's, mother's and spouse's names, address and file number"
    >
      <defs>
        <linearGradient id="ps-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F4F4F2" />
          <stop offset="0.75" stopColor="#ECECE8" />
          <stop offset="1" stopColor="#DADAD5" />
        </linearGradient>
        <linearGradient id="ps-page" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E9E8E2" />
          <stop offset="0.06" stopColor="#F3F2EC" />
          <stop offset="1" stopColor="#F0EFE9" />
        </linearGradient>
        <filter id="ps-shadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#1B2230" floodOpacity="0.18" />
        </filter>
      </defs>

      <rect width="524" height="412" fill="#FBFBFA" />

      <g filter="url(#ps-shadow)">
        {/* Facing page (top) */}
        <path d="M18 0 H506 V78 Q262 70 18 78 Z" fill="url(#ps-top)" />
        {/* Stacked page edges under the last page */}
        <path d="M22 392 H502 L500 398 H24 Z" fill="#E4E3DD" />
        <path d="M26 398 H498 L496 403 H28 Z" fill="#DAD9D2" />
        {/* Last page */}
        <path d="M18 80 Q262 72 506 80 V390 Q262 394 18 390 Z" fill="url(#ps-page)" />
      </g>
      {/* Spine fold */}
      <path d="M18 80 Q262 72 506 80" fill="none" stroke="#C9C8C1" strokeWidth="1.5" />

      {/* Passport number — the same as the front page */}
      <text x="488" y="104" textAnchor="end" fontSize="8.5" fill={LABEL}>
        <tspan fontFamily={HI}>पासपोर्ट सं.</tspan>
        <tspan fontFamily={SANS}> / Passport No.</tspan>
      </text>
      <text x="488" y="126" textAnchor="end" fontFamily={MONO} fontSize="21" fill={INK} letterSpacing="1.5">
        Z1234567
      </text>

      <Field x={44} y={110} hi="पिता / कानूनी अभिभावक का नाम" en="Name of Father / Legal Guardian" value="RAJESH SHARMA" />
      <Field x={44} y={150} hi="माता का नाम" en="Name of Mother" value="SUNITA SHARMA" />
      <Field x={44} y={190} hi="पति या पत्नी का नाम" en="Name of Spouse" />
      <Field x={44} y={222} hi="पता" en="Address" value={['H NO 12, SECTOR 4, ROHINI', 'NEW DELHI, DELHI 110085, INDIA']} valueSize={13.5} />
      <Field x={44} y={279} hi="पुराना पासपोर्ट सं., जारी करने की तिथि और स्थान" en="Old Passport No. with Date and Place of Issue" />
      <Field x={330} y={330} hi="फ़ाइल सं." en="File No." value="DL1069876543212" valueSize={13.5} />

      {/* Barcode */}
      <g fill={INK} opacity="0.85">
        {bars.map((b) => (
          <rect key={b.x} x={b.x} y="318" width={b.w} height="40" />
        ))}
      </g>
      <text x="44" y="374" fontFamily={MONO} fontSize="11" fill={INK} letterSpacing="2.6">
        DL1069876543212
      </text>
    </svg>
  );
}
