// Low-contrast Omani skyline (palms, mosque domes/minarets, dunes) drawn
// behind the visa pages. Inline SVG — no image files or network loads —
// purely decorative: aria-hidden and pointer-events-none, so it never
// affects reading order or clicks. Sits at the page's top-right and bottom.

function Palm({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 0 C2 -40 4 -80 2 -120 L7 -120 C9 -80 8 -40 6 0 Z" />
      <path d="M4 -120 C-20 -130 -42 -122 -58 -104 C-36 -114 -18 -114 4 -116 Z" />
      <path d="M4 -120 C-14 -142 -38 -146 -56 -138 C-34 -134 -16 -128 4 -117 Z" />
      <path d="M4 -120 C24 -132 46 -126 62 -108 C40 -116 22 -116 4 -116 Z" />
      <path d="M4 -120 C20 -144 44 -150 62 -142 C40 -138 22 -130 4 -117 Z" />
      <path d="M4 -121 C2 -146 -8 -162 -22 -170 C-12 -154 -6 -138 3 -118 Z" />
      <path d="M4 -121 C10 -146 22 -160 36 -166 C24 -150 16 -136 6 -118 Z" />
    </g>
  );
}

export default function VisaBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
      {/* Top-right skyline */}
      <svg
        viewBox="0 0 640 300"
        className="absolute -right-6 top-0 hidden h-[300px] w-[640px] text-[#F3C77A] opacity-[0.36] md:block"
        fill="currentColor"
        preserveAspectRatio="xMaxYMin meet"
      >
        {/* distant hills */}
        <path d="M0 270 C80 240 150 236 230 252 C300 266 360 232 440 226 C520 220 580 240 640 232 L640 300 L0 300 Z" opacity="0.5" />
        {/* mosque: main dome, side domes, minarets */}
        <g>
          <rect x="360" y="200" width="170" height="80" />
          <path d="M395 200 C395 150 495 150 495 200 Z" />
          <rect x="441" y="132" width="8" height="22" />
          <circle cx="445" cy="130" r="5" />
          <path d="M362 210 C362 188 392 188 392 210 Z" />
          <path d="M498 210 C498 188 528 188 528 210 Z" />
          <rect x="336" y="120" width="16" height="160" />
          <path d="M332 122 L344 92 L356 122 Z" />
          <rect x="331" y="150" width="26" height="6" />
          <rect x="540" y="96" width="18" height="184" />
          <path d="M536 98 L549 62 L562 98 Z" />
          <rect x="535" y="130" width="28" height="6" />
          <rect x="535" y="180" width="28" height="6" />
        </g>
        <Palm x={250} y={282} s={0.95} />
        <Palm x={300} y={290} s={0.7} />
        <Palm x={600} y={290} s={0.85} />
        <Palm x={190} y={292} s={0.6} />
        {/* birds */}
        <path d="M120 70 q8 -8 16 0 q8 -8 16 0" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M170 40 q6 -6 12 0 q6 -6 12 0" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>

      {/* Bottom dunes */}
      <svg
        viewBox="0 0 1200 160"
        className="absolute bottom-0 left-0 h-[140px] w-full text-[#F6D49A] opacity-[0.22]"
        fill="currentColor"
        preserveAspectRatio="none"
      >
        <path d="M0 120 C200 70 380 70 560 104 C740 138 900 80 1200 92 L1200 160 L0 160 Z" />
        <path d="M0 140 C260 110 520 120 760 136 C960 150 1080 128 1200 132 L1200 160 L0 160 Z" opacity="0.7" />
      </svg>
    </div>
  );
}
