import { useEffect, useState } from "react";
import { FiArrowLeft, FiArrowRight, FiCheck, FiX } from "react-icons/fi";
import { api } from "../../../../pages/publicApi.js";
import { GALLERY_CATEGORIES } from "../data.js";
import { GalleryPhotoTile, photoOrientation } from "../components/GalleryPhotoTile.jsx";

// Gallery rows -> { [category]: [{ url, orientation, width, height }] }.
function normalise(items) {
  return (items || []).reduce((groups, item) => {
    const category = item.category || item.type || "events";
    const url = item.imageUrl || item.image_url;
    if (url) {
      const photo = { url, orientation: item.orientation || null, width: item.width || null, height: item.height || null };
      groups[category] = [...(groups[category] || []), photo];
    }
    return groups;
  }, {});
}

// Resolves with a copy of `groups` where every photo lacking an orientation
// and pixel size has them measured from the image itself — or null when
// nothing needed measuring.
function detectMissingShapes(groups) {
  const pending = [];
  const next = Object.fromEntries(
    Object.entries(groups).map(([key, photos]) => [
      key,
      photos.map((photo) => {
        if (photoOrientation(photo)) return photo;
        const copy = { ...photo };
        pending.push(
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              copy.width = img.naturalWidth || null;
              copy.height = img.naturalHeight || null;
              resolve();
            };
            img.onerror = () => resolve();
            img.src = photo.url;
          })
        );
        return copy;
      }),
    ])
  );
  return pending.length ? Promise.all(pending).then(() => next) : Promise.resolve(null);
}

// Under the "All" filter each section previews two full desktop rows: 12
// grid columns' worth, where a Horizontal photo uses 2 and a Vertical one 1.
// Filling by width (not a fixed photo count) means the preview never ends on
// a half-empty row. 12 also divides evenly into the 2- and 4-column layouts.
const PREVIEW_UNITS = 12;
const unitsFor = (photo) => (photoOrientation(photo) === "portrait" ? 1 : 2);

function previewTiles(photos) {
  const picked = [];
  let used = 0;
  for (let index = 0; index < photos.length && used < PREVIEW_UNITS; index++) {
    const units = unitsFor(photos[index]);
    if (used + units > PREVIEW_UNITS) continue; // try a narrower photo for the last slot
    picked.push({ photo: photos[index], index });
    used += units;
  }
  return picked;
}

// Orientation-aware grid (components/GalleryPhotoTile.jsx): Horizontal photos
// take two columns, Vertical one, at equal heights; `grid-flow-row-dense`
// back-fills gaps so mixed uploads still pack into neat rows. Nothing is
// cropped — each photo is fitted inside its tile.
function GalleryGrid({ category, photos, compact = false, onOpenImage, onShowCategory }) {
  const tiles = compact ? previewTiles(photos) : photos.map((photo, index) => ({ photo, index }));
  const morePhotos = Math.max(photos.length - tiles.length, 0);
  const urls = photos.map((photo) => photo.url);
  return (
    <div className="grid grid-flow-row-dense grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-6">
      {tiles.map(({ photo, index: photoIndex }, index) => (
        <GalleryPhotoTile
          key={`${photo.url}-${photoIndex}`}
          photo={photo}
          alt={`Open ${category.label} photo ${photoIndex + 1}`}
          onOpen={() => onOpenImage(urls, photoIndex)}
          overlay={
            morePhotos > 0 && index === tiles.length - 1 ? (
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  onShowCategory?.(category.key);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    onShowCategory?.(category.key);
                  }
                }}
                className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/45 text-center text-white"
              >
                <span>
                  <strong className="block text-2xl sm:text-4xl">+{morePhotos}</strong>
                  <small className="text-[10px] sm:text-xs">More Photos</small>
                </span>
              </span>
            ) : null
          }
        />
      ))}
    </div>
  );
}

function CategoryBlock({
  category,
  images,
  compact = false,
  onOpenImage,
  onShowCategory,
}) {
  return (
    <article
      className={`relative border-t border-[#D9D1C3] py-7 first:border-t-0 sm:py-9 ${
        category.key === "tours"
          ? "border-b border-[#D9D1C3] pb-10 sm:pb-12"
          : ""
      } ${category.key === "tours" ? "overflow-hidden" : ""}`}
    >
      {category.key === "tours" && (
        <>
          <img
            src={images.heroImage || "/oman_pic.jpg"}
            alt='Oman coast'
            className='absolute inset-x-0 top-0 h-32 w-full object-cover'
          />
          <div className='absolute inset-x-0 top-0 h-32 bg-gradient-to-r from-[#F8F5EF]/95 via-[#F8F5EF]/70 to-[#F8F5EF]/20' />
        </>
      )}
      <div
        className={`relative mb-3 flex items-center justify-between gap-3 ${
          category.key === "tours" ? "pt-3" : ""
        }`}
      >
        <div className='min-w-0 border-l-[3px] border-[#E8B84B] pl-3'>
          <h2 className='font-serif text-xl font-semibold text-[#1B2333] sm:text-2xl'>
            {category.label}
          </h2>
          <p className='mt-1 truncate text-[10px] text-[#59616D] sm:text-xs'>
            {category.description}
          </p>
        </div>
        {/* Under "All", opens this section on its own (every photo); inside a
            single section it goes back to the "All" overview. */}
        <button
          type='button'
          onClick={() => onShowCategory?.(compact ? category.key : "all")}
          className='inline-flex flex-none items-center gap-1 rounded-full border border-[#D7B65E] bg-white/85 px-3 py-1.5 text-[9px] font-semibold text-[#80601B] shadow-sm transition hover:bg-white sm:px-4 sm:py-2 sm:text-[10px]'
        >
          {compact ? (
            <>
              View All ({images.cards.length}) <FiArrowRight size={11} />
            </>
          ) : (
            <>
              <FiArrowLeft size={11} /> All sections
            </>
          )}
        </button>
      </div>
      <div className={category.key === "tours" ? "mt-5 sm:mt-6" : ""}>
        <GalleryGrid
          category={category}
          compact={compact}
          photos={images.cards}
          onOpenImage={onOpenImage}
          onShowCategory={onShowCategory}
        />
      </div>
    </article>
  );
}

export function GallerySection() {
  const [remoteImages, setRemoteImages] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    let active = true;
    api
      .get("/gallery")
      .then((result) => {
        if (!active) return;
        const groups = normalise(result?.gallery || result?.items);
        setRemoteImages(groups);
        // Older uploads carry no orientation/size: measure them so the grid
        // and the "All" preview plan with their real shape, then refresh.
        detectMissingShapes(groups).then((measured) => active && measured && setRemoteImages(measured));
      })
      .catch(() => {})
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!lightbox) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setLightbox(null);
      if (event.key === "ArrowLeft")
        setLightbox((current) => ({
          ...current,
          index:
            (current.index - 1 + current.images.length) % current.images.length,
        }));
      if (event.key === "ArrowRight")
        setLightbox((current) => ({
          ...current,
          index: (current.index + 1) % current.images.length,
        }));
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [lightbox]);

  function openImage(images, index) {
    setLightbox({ images, index });
  }

  // Only photos uploaded from admin Gallery Management are shown — no
  // built-in fallback images. A section with no uploads is hidden, along
  // with its filter chip.
  const populatedCategories = GALLERY_CATEGORIES.filter(
    (category) => remoteImages[category.key]?.length
  );
  const filters = [
    { key: "all", label: "All" },
    ...populatedCategories.map(({ key, label }) => ({ key, label })),
  ];
  const visibleCategories =
    activeFilter === "all"
      ? populatedCategories
      : populatedCategories.filter((category) => category.key === activeFilter);

  return (
    <section id='gallery' className='bg-[#F8F5EF] text-[#1B2333]'>
      <div className='relative min-h-[270px] overflow-hidden bg-[#173B4A] sm:min-h-[390px]'>
        <img
          src={remoteImages["gallery-hero"]?.[0]?.url || "/HeroImage.png"}
          alt='Muscat coastline and mountains'
          className='absolute inset-0 h-full w-full object-cover'
        />
        <div className='absolute inset-0 bg-gradient-to-r from-[#092B3C]/85 via-[#092B3C]/40 to-transparent' />
        <div className='relative mx-auto flex min-h-[270px] max-w-7xl flex-col justify-end px-6 pb-8 sm:min-h-[390px] sm:px-10 sm:pb-12'>
          <p className='mb-8 text-[10px] text-white/80 sm:mb-14 sm:text-xs'>
            Home <span className='mx-2'>›</span> Gallery
          </p>
          <h1 className='font-serif text-5xl leading-none text-white sm:text-7xl'>
            Gallery
          </h1>
          <p className='mt-3 max-w-xs text-xs leading-relaxed text-white/85 sm:text-sm'>
            Moments, Memories &amp; Experiences
            <br />
            from Across Oman
          </p>
        </div>
      </div>
      <div className='mx-auto max-w-7xl px-5 py-3 sm:px-10 sm:py-5'>
        <div className='flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]'>
          {filters.map((filter) => (
            <button
              key={filter.key}
              type='button'
              onClick={() => setActiveFilter(filter.key)}
              className={`inline-flex flex-none items-center gap-1.5 rounded-full border px-4 py-2 text-[9px] font-semibold transition sm:px-5 sm:text-[10px] ${
                activeFilter === filter.key
                  ? "border-[#E8B84B] bg-[#E8B84B] text-[#1B2333]"
                  : "border-[#DCD7CE] bg-white text-[#4E5660] hover:border-[#C9A24A]"
              }`}
            >
              {activeFilter === filter.key && <FiCheck size={10} />}
              {filter.label}
            </button>
          ))}
        </div>
      </div>
      <div className='mx-auto max-w-7xl px-5 pb-8 sm:px-10 sm:pb-14'>
        {visibleCategories.map((category) => (
          <CategoryBlock
            key={category.key}
            category={category}
            compact={activeFilter === "all"}
            onOpenImage={openImage}
            onShowCategory={setActiveFilter}
            images={{
              heroImage:
                remoteImages[`${category.key}-hero`]?.[0]?.url || category.heroImage,
              cards: remoteImages[category.key],
            }}
          />
        ))}
        {loaded && visibleCategories.length === 0 && (
          <p className='py-16 text-center text-sm text-[#59616D]'>
            New photos are coming soon.
          </p>
        )}
      </div>
      {lightbox && (
        <div
          className='fixed inset-0 z-[70] flex items-center justify-center bg-[#07131c]/90 p-5'
          role='dialog'
          aria-modal='true'
          aria-label='Gallery photo viewer'
          onClick={() => setLightbox(null)}
        >
          <button
            type='button'
            onClick={() => setLightbox(null)}
            aria-label='Close photo viewer'
            className='absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20'
          >
            <FiX size={22} />
          </button>
          <button
            type='button'
            onClick={(event) => {
              event.stopPropagation();
              setLightbox((current) => ({
                ...current,
                index:
                  (current.index - 1 + current.images.length) %
                  current.images.length,
              }));
            }}
            aria-label='Previous photo'
            className='absolute left-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-8'
          >
            <FiArrowLeft size={22} />
          </button>
          <img
            src={lightbox.images[lightbox.index]}
            alt='Gallery enlarged view'
            onClick={(event) => event.stopPropagation()}
            className='max-h-[86vh] max-w-[86vw] rounded-md object-contain shadow-2xl'
          />
          <button
            type='button'
            onClick={(event) => {
              event.stopPropagation();
              setLightbox((current) => ({
                ...current,
                index: (current.index + 1) % current.images.length,
              }));
            }}
            aria-label='Next photo'
            className='absolute right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-8'
          >
            <FiArrowRight size={22} />
          </button>
        </div>
      )}
      <div className='relative overflow-hidden bg-[#D9C49E] px-6 py-12 sm:px-10 sm:py-16'>
        <img
          src='/cta-section.png'
          alt='Oman coastline and fort'
          className='absolute inset-0 h-full w-full object-cover opacity-65'
        />
        <div className='absolute inset-0 bg-[#F1E5CA]/55' />
        <div className='relative mx-auto max-w-5xl text-center'>
          <p className='text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8A641F]'>
            Your next story starts here
          </p>
          <h2 className='mt-2 font-serif text-3xl leading-tight text-[#1B2333] sm:text-5xl'>
            Let&apos;s Create More
            <br />
            Memories in Oman
          </h2>
          <p className='mx-auto mt-3 max-w-md text-xs text-[#59616D] sm:text-sm'>
            From group tours to corporate events, explore what&apos;s possible
            with Xclusive Oman.
          </p>
        </div>
      </div>
    </section>
  );
}
