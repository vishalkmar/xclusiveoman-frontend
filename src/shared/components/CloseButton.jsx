import { LuX } from "react-icons/lu";

// Round "×" close button shared by popups/overlays.
//   variant="soft"  -> cream circle with an orange cross (light panels)
//   variant="glass" -> translucent white circle (dark photo backdrops)
const VARIANTS = {
  soft: "bg-[#FDE9CC] text-[#E07B12] hover:bg-[#FBD9A8] focus-visible:ring-[#EE8A1F]/50",
  glass:
    "bg-white/15 text-white backdrop-blur hover:bg-white/25 focus-visible:ring-white/60",
};

const SIZES = {
  sm: { box: "h-8 w-8", icon: 16 },
  md: { box: "h-10 w-10", icon: 20 },
  lg: { box: "h-12 w-12", icon: 22 },
};

export default function CloseButton({
  onClick,
  label = "Close",
  variant = "soft",
  size = "md",
  className = "",
}) {
  const { box, icon } = SIZES[size] || SIZES.md;
  return (
    <button
      type='button'
      onClick={onClick}
      aria-label={label}
      className={`flex flex-none items-center justify-center rounded-full shadow-sm transition duration-200 hover:rotate-90 focus:outline-none focus-visible:ring-4 ${box} ${
        VARIANTS[variant] || VARIANTS.soft
      } ${className}`}
    >
      <LuX size={icon} strokeWidth={2.5} />
    </button>
  );
}
