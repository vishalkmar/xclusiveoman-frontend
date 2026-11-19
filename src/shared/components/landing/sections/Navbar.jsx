import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiMenu, FiX } from 'react-icons/fi';
import { NAV_LINKS } from '../data.js';
import { PillButton } from '../components/PillButton.jsx';
import { AccountMenu } from '../components/AccountMenu.jsx';
import { dashboardPathFor, useLandingSession } from '../useLandingSession.js';

export function Navbar({ session: sessionProp }) {
  // Below md, NAV_LINKS has nowhere to render (nav below is md:flex only) —
  // this dropdown is that mobile/sm equivalent, off by default so it never
  // affects the md/lg layout it's hidden alongside.
  const [menuOpen, setMenuOpen] = useState(false);
  // Signed in (any portal) -> account menu instead of "Sign Up/ Login".
  // LandingPage passes its own session in; Gallery/Legal pages don't, so
  // Navbar checks for itself there.
  const ownSession = useLandingSession({ skip: Boolean(sessionProp) });
  const session = sessionProp || ownSession;

  return (
    <header className="sticky top-0 z-40 border-t-[3px] border-[#1B1B1B] bg-[#F7F3EA] backdrop-blur">
      <div className="flex items-center justify-between px-6 py-4 sm:px-10">
        <Link to="/" className="flex items-center gap-2">
          <img src="/Xclusive_Oman_Logo_New.png" alt="Xclusive Oman" className="h-10 w-auto" />
        </Link>

        <nav className="hidden items-center gap-10 text-base text-[#1B1B1B] md:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.label} href={link.href} className="transition-colors hover:text-[#E8B84B]">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {session.isAuthenticated ? (
            <AccountMenu user={session.user} dashboardPath={dashboardPathFor(session.user)} onLogout={session.logout} />
          ) : (
            // Kept in place (invisible) while the session check runs, so the
            // header doesn't shift or flash the login pill for a signed-in user.
            <PillButton
              to="/agent"
              variant="solid"
              withArrow={false}
              className={`bg-[#E8B84B] px-4 py-2 text-xs font-semibold text-[#1B1B1B] hover:bg-[#d9a93a] md:px-6 md:py-2.5 md:text-sm ${session.status === 'loading' ? 'invisible' : ''}`}
            >
              Sign Up/ Login
            </PillButton>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[#1B1B1B]/15 text-[#1B1B1B] md:hidden"
          >
            {menuOpen ? <FiX className="text-xl" /> : <FiMenu className="text-xl" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="flex flex-col gap-1 border-t border-[#1B1B1B]/10 px-6 pb-4 pt-2 text-base text-[#1B1B1B] md:hidden">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-2 py-2.5 transition-colors hover:bg-[#1B1B1B]/5 hover:text-[#E8B84B]"
            >
              {link.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
