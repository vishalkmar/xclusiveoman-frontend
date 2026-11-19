import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";

// Full-bleed photo slider: the current image fills the container, with a
// thumbnail strip and a "‹ 1 / 3 ›" pill along the bottom. Prev/Next wrap
// around. Sizing is up to the parent — this fills whatever box it's put in.
//
//   images            ordered list of image URLs
//   initialIndex      which image to start on
//   keyboard          true -> ArrowLeft/ArrowRight on the document navigate
//   showThumbnails    false hides the thumbnail strip (pill still shows)
//   controlsClassName extra classes for the bottom controls block (e.g.
//                     right padding to keep clear of a decorative edge)
//   children          rendered on top of the image (badges, overlays)
export default function ImageSlider({
  images = [],
  initialIndex = 0,
  keyboard = false,
  showThumbnails = true,
  alt = "",
  className = "",
  controlsClassName = "",
  children,
}) {
  const [index, setIndex] = useState(() =>
    images.length ? Math.min(Math.max(initialIndex, 0), images.length - 1) : 0
  );
  const thumbRefs = useRef([]);
  const count = images.length;
  const hasMany = count > 1;

  function go(delta) {
    if (!hasMany) return;
    setIndex((i) => (i + delta + count) % count);
  }

  useEffect(() => {
    if (!keyboard || !hasMany) return undefined;
    function onKeyDown(e) {
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + count) % count);
      else if (e.key === "ArrowRight") setIndex((i) => (i + 1) % count);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [keyboard, hasMany, count]);

  useEffect(() => {
    thumbRefs.current[index]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [index]);

  return (
    <div className={`relative h-full w-full overflow-hidden bg-neutral-900 ${className}`}>
      <AnimatePresence initial={false}>
        {count > 0 && (
          <motion.img
            key={images[index] + index}
            src={images[index]}
            alt={alt}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className='absolute inset-0 h-full w-full object-cover object-center'
          />
        )}
      </AnimatePresence>

      {hasMany && (
        <>
          <div className='pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/25 to-transparent' />
          <div
            className={`absolute inset-x-0 bottom-0 flex flex-col gap-3 p-4 sm:p-5 ${controlsClassName}`}
          >
            {showThumbnails && (
              <div className='flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
                {images.map((url, i) => {
                  const active = i === index;
                  return (
                    <button
                      key={url + i}
                      ref={(el) => (thumbRefs.current[i] = el)}
                      type='button'
                      onClick={() => setIndex(i)}
                      aria-label={`Show photo ${i + 1}`}
                      aria-current={active}
                      className={`h-14 w-20 flex-none overflow-hidden rounded-xl transition duration-200 sm:h-24 sm:w-32 ${
                        active
                          ? "ring-[3px] ring-white"
                          : "opacity-75 ring-1 ring-white/40 hover:opacity-100"
                      }`}
                    >
                      <img src={url} alt='' className='h-full w-full object-cover' />
                    </button>
                  );
                })}
              </div>
            )}
            <div className='inline-flex items-center gap-3 self-start rounded-full bg-black/45 px-2 py-1.5 text-white backdrop-blur'>
              <button
                type='button'
                onClick={() => go(-1)}
                aria-label='Previous photo'
                className='flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/25'
              >
                <LuChevronLeft size={18} />
              </button>
              <span className='min-w-[2.75rem] text-center text-sm font-semibold tabular-nums'>
                {index + 1} / {count}
              </span>
              <button
                type='button'
                onClick={() => go(1)}
                aria-label='Next photo'
                className='flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/25'
              >
                <LuChevronRight size={18} />
              </button>
            </div>
          </div>
        </>
      )}

      {children}
    </div>
  );
}
