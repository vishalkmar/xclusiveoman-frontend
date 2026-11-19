import { useCallback, useEffect, useRef, useState } from 'react';
import { LuArrowRight, LuChevronLeft, LuChevronRight } from 'react-icons/lu';

// "One visa, every city." — a fanned 3D carousel of Oman's popular places on
// the agent Apply for Visa page (VisaApply.jsx). The centre card is upright
// and bright; the cards either side tilt back, shrink and dim. It advances
// on its own (paused on hover/focus, and off for reduced motion); arrows,
// the dots or clicking a side card move it. "Apply now" calls onApply.
//
// Photos are the ones the portal already ships in public/ (also used by the
// landing page), each labelled with the place it actually shows.
const CITIES = [
  { name: 'Grand Mosque', region: 'Muscat', image: '/We_Operate_Section.png' },
  { name: 'Mutrah Corniche', region: 'Muscat', image: '/oman_pic.jpg' },
  { name: 'Al Alam Palace', region: 'Muscat', image: '/cta-section.png' },
  { name: 'Old Muscat', region: 'Muscat', image: '/HeroImage.png' },
  { name: 'Wadi Shab', region: 'Ash Sharqiyah', image: '/activity_5.png' },
  { name: 'Jebel Shams', region: 'Al Hajar Mountains', image: '/travel_2.png' },
  { name: 'Jebel Akhdar', region: 'Ad Dakhiliyah', image: '/activity_4.png' },
  { name: 'Wahiba Sands', region: 'Desert', image: '/travel_1.png' },
  { name: 'Musandam', region: 'The fjords', image: '/travel_3.png' },
  { name: 'Salalah', region: 'Dhofar', image: '/salalah_image.jpg' },
];

const VISIBLE_SIDE = 3; // cards shown either side of the centre
const AUTOPLAY_MS = 3500;
const SERIF = "font-['Georgia','Cambria','Times_New_Roman',serif]";
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFBF47] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFF9EF]';

// Shortest signed distance from the active card around the loop.
function offsetFrom(index, active, n) {
  let d = index - active;
  if (d > n / 2) d -= n;
  if (d < -n / 2) d += n;
  return d;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false
  );
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

export default function OmanCitiesCarousel({ onApply }) {
  const n = CITIES.length;
  const [active, setActive] = useState(Math.floor(n / 2) - 1);
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const touchX = useRef(null);

  const go = useCallback((delta) => setActive((a) => (a + delta + n) % n), [n]);

  useEffect(() => {
    if (paused || reducedMotion) return undefined;
    const t = setInterval(() => go(1), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [paused, reducedMotion, go]);

  return (
    <section aria-labelledby="oman-cities-heading" className="mt-16 overflow-hidden border-t border-[#F0DFC7] pt-12">
      <div className="text-center">
        <h2 id="oman-cities-heading" className={`${SERIF} text-[30px] font-bold leading-tight text-[#17243A] sm:text-[36px]`}>
          One visa, every city.
        </h2>
        <p className="mt-2 text-[15px] text-[#737D8C] sm:text-base">You can travel across all of Oman on the same visa.</p>
      </div>

      <div
        role="region"
        aria-roledescription="carousel"
        aria-label="Popular places in Oman"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') go(-1);
          if (e.key === 'ArrowRight') go(1);
        }}
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
        className="relative mx-auto mt-8 h-[360px] max-w-[1200px] [perspective:1600px] sm:h-[430px]"
      >
        {CITIES.map((city, i) => {
          const offset = offsetFrom(i, active, n);
          const abs = Math.abs(offset);
          const shown = abs <= VISIBLE_SIDE;
          const centre = offset === 0;
          return (
            <button
              key={city.name}
              type="button"
              tabIndex={shown ? 0 : -1}
              aria-hidden={!shown}
              aria-label={centre ? `${city.name}, ${city.region}` : `Show ${city.name}`}
              aria-current={centre ? 'true' : undefined}
              onClick={() => !centre && setActive(i)}
              style={{
                transform: `translateX(-50%) translateX(calc(${offset} * min(170px, 24vw))) translateZ(${-abs * 70}px) rotateY(${offset * -14}deg) scale(${1 - abs * 0.07})`,
                zIndex: 20 - abs,
                opacity: shown ? 1 : 0,
              }}
              className={`absolute left-1/2 top-1/2 -mt-[160px] h-[320px] w-[min(240px,58vw)] overflow-hidden rounded-[26px] text-left shadow-[0_24px_50px_-26px_rgba(22,27,39,0.75)] transition-[transform,opacity,filter] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] sm:-mt-[190px] sm:h-[380px] sm:w-[270px] ${FOCUS} ${
                shown ? '' : 'pointer-events-none'
              } ${centre ? '' : 'cursor-pointer brightness-[0.62] hover:brightness-75'}`}
            >
              <img src={city.image} alt="" loading="lazy" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
              <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#17243A]/85 via-[#17243A]/10 to-transparent" />
              <span className="absolute inset-x-0 bottom-0 px-4 pb-6 text-center">
                <span className={`${SERIF} block text-[24px] font-bold leading-tight text-white drop-shadow sm:text-[28px]`}>{city.name}</span>
                <span
                  className={`mt-1 block text-[11px] font-bold uppercase tracking-[0.16em] text-[#FFC15A] transition-opacity duration-500 ${
                    centre ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  {city.region}
                </span>
              </span>
            </button>
          );
        })}

        <button
          type="button"
          aria-label="Previous place"
          onClick={() => go(-1)}
          className={`absolute left-1 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#F0DFC7] bg-white/90 text-[#17243A] shadow-md backdrop-blur transition hover:bg-[#FFF1DF] sm:left-4 ${FOCUS}`}
        >
          <LuChevronLeft size={20} />
        </button>
        <button
          type="button"
          aria-label="Next place"
          onClick={() => go(1)}
          className={`absolute right-1 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#F0DFC7] bg-white/90 text-[#17243A] shadow-md backdrop-blur transition hover:bg-[#FFF1DF] sm:right-4 ${FOCUS}`}
        >
          <LuChevronRight size={20} />
        </button>
      </div>

      <div className="mt-6 flex justify-center gap-1.5" aria-label="Choose a place">
        {CITIES.map((city, i) => (
          <button
            key={city.name}
            type="button"
            aria-label={`Show ${city.name}`}
            aria-current={i === active ? 'true' : undefined}
            onClick={() => setActive(i)}
            className={`h-2 rounded-full transition-all ${FOCUS} ${i === active ? 'w-6 bg-[#FFBF47]' : 'w-2 bg-[#E9D5B0] hover:bg-[#FFD68A]'}`}
          />
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={onApply}
          className={`inline-flex items-center gap-2 rounded-full bg-[#FFBF47] px-10 py-4 text-base font-bold text-[#17243A] shadow-[0_14px_28px_-14px_rgba(245,166,35,0.95)] transition hover:bg-[#F7AE2C] ${FOCUS}`}
        >
          Apply now <LuArrowRight size={18} />
        </button>
      </div>
    </section>
  );
}
