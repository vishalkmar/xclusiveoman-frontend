import { useState } from 'react';

// One photo in the public Gallery grid (sections/GallerySection.jsx).
//
// Tiles are shaped by orientation, and the two shapes are the same height so
// rows line up: a Horizontal photo is a 3:2 tile spanning two grid columns,
// a Vertical photo is a 3:4 tile in one column. The image is always
// object-contain, so nothing is ever cropped — when a photo's own ratio
// differs a little from its tile (16:9, 4:5, …), a blurred copy of the same
// photo fills the edges instead of bare bars.
//
// Orientation comes from the admin's choice in Gallery Management
// (0106_gallery_item_orientation.sql), else the stored pixel size, else it's
// detected from the image once it loads (older uploads).

export function photoOrientation(photo) {
  if (photo.orientation === 'portrait' || photo.orientation === 'landscape') return photo.orientation;
  if (photo.width && photo.height) return photo.height > photo.width ? 'portrait' : 'landscape';
  return null;
}

export function GalleryPhotoTile({ photo, alt, onOpen, overlay }) {
  const [detected, setDetected] = useState(null);
  const orientation = photoOrientation(photo) || detected || 'landscape';
  const portrait = orientation === 'portrait';

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={alt}
      className={`group relative block w-full overflow-hidden rounded-[3px] bg-[#E9E3D6] text-left ${
        portrait ? 'col-span-1 aspect-[3/4]' : 'col-span-2 aspect-[3/2]'
      }`}
    >
      <img src={photo.url} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl" />
      <img
        src={photo.url}
        alt={alt}
        loading="lazy"
        onLoad={(event) => {
          const { naturalWidth: w, naturalHeight: h } = event.currentTarget;
          if (!photoOrientation(photo) && w && h) setDetected(h > w ? 'portrait' : 'landscape');
        }}
        className="absolute inset-0 h-full w-full object-contain transition duration-300 group-hover:brightness-105"
      />
      {overlay}
    </button>
  );
}
