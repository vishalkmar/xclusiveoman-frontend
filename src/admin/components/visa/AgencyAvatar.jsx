import { useState } from 'react';
import { initials } from './visaAdminMeta.js';

// Agency logo, or its initials on an indigo tile when there's no logo (or it
// fails to load).
export function AgencyAvatar({ name, logoUrl, size = 'md' }) {
  const [broken, setBroken] = useState(false);
  const box = size === 'lg' ? 'h-14 w-14 text-lg' : 'h-11 w-11 text-sm';
  if (logoUrl && !broken) {
    return (
      <img
        src={logoUrl}
        alt=""
        onError={() => setBroken(true)}
        className={`${box} flex-none rounded-xl border border-line-light bg-white object-contain p-1`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`${box} flex flex-none items-center justify-center rounded-xl bg-gradient-to-br from-[#6366F1] to-[#4338CA] font-bold text-white`}
    >
      {initials(name)}
    </span>
  );
}
