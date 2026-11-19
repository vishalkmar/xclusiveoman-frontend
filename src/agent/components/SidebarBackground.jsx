import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

const SIDEBAR_CATEGORY = 'agent-sidebar';

export function useSidebarBackground() {
  const [background, setBackground] = useState(null);

  useEffect(() => {
    let active = true;
    api.get('/gallery')
      .then((data) => {
        const item = (data.gallery || data.items || []).find((entry) => (entry.category || entry.type) === SIDEBAR_CATEGORY);
        if (active) setBackground(item?.imageUrl || item?.image_url || null);
      })
      .catch(() => { if (active) setBackground(null); });
    return () => { active = false; };
  }, []);

  return { background, clearBackground: () => setBackground(null) };
}

export function SidebarBackdrop({ imageUrl, onImageError, collapsed = false }) {
  if (!imageUrl) return null;
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-cover bg-no-repeat opacity-90"
        style={{ backgroundImage: `url(${JSON.stringify(imageUrl)})`, backgroundPosition: collapsed ? '72% bottom' : 'center bottom' }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-[#633A16]/95 via-[#8A531D]/70 via-55% to-[#2A1609]/50" />
      <img src={imageUrl} alt="" aria-hidden="true" className="hidden" onError={onImageError} />
    </>
  );
}

export { SIDEBAR_CATEGORY };
