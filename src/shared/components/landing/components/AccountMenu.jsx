// Signed-in replacement for the Navbar's "Sign Up/ Login" pill: a user-face
// icon that opens a small menu with Dashboard and Log out.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LuChevronDown, LuCircleUserRound, LuLayoutDashboard, LuLogOut } from 'react-icons/lu';

export function AccountMenu({ user, dashboardPath, onLogout }) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function logout() {
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
      setOpen(false);
    }
  }

  const name = user?.fullName || 'My account';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-1 rounded-full border border-[#1B1B1B]/15 bg-white/70 py-1 pl-1 pr-2 text-[#1B1B1B] transition-colors hover:border-[#E8B84B] hover:bg-white"
      >
        <LuCircleUserRound className="text-[32px] text-[#1B1B1B]" />
        <LuChevronDown className={`text-base transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-[#1B1B1B]/10 bg-white shadow-[0_12px_32px_rgba(27,35,51,0.14)]">
          <div className="flex items-center gap-3 border-b border-[#1B1B1B]/10 bg-[#F7F3EA] px-4 py-3">
            <LuCircleUserRound className="flex-none text-3xl text-[#C9A24A]" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#1B1B1B]">{name}</p>
              {user?.email && <p className="truncate text-xs text-[#5B6472]">{user.email}</p>}
            </div>
          </div>
          <div className="p-1.5">
            <Link
              to={dashboardPath}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#1B1B1B] transition-colors hover:bg-[#F7F3EA]"
            >
              <LuLayoutDashboard className="text-lg text-[#C9A24A]" /> Dashboard
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={logout}
              disabled={loggingOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#A5162D] transition-colors hover:bg-rose-50 disabled:opacity-60"
            >
              <LuLogOut className="text-lg" /> {loggingOut ? 'Logging out…' : 'Log out'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
