import { FiMail, FiMapPin, FiPhone } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { CONTACT, FOOTER_LINKS } from '../data.js';

const PARTNER_LINKS = [
  { label: 'Sign Up', to: '/agent/register' },
  { label: 'Login', to: '/agent' },
  { label: 'Privacy Policy', to: '/privacy-policy' },
  { label: 'Terms & Conditions', to: '/terms-and-conditions' },
];

export function Footer() {
  return (
    <footer className="bg-[#0d1b2a] px-6 pb-8 pt-16 text-white/80 sm:px-10">
      <div className="mx-auto grid max-w-6xl gap-10 border-b border-white/10 pb-12 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <div className="flex items-center gap-3">
            <img src="/Xclusive_Oman_Logo_New.png" alt="Xclusive Oman" className="h-9 w-auto" />
            <span className="relative top-1 inline-block whitespace-nowrap py-2 text-xs font-semibold uppercase tracking-wide text-white">A Unit of Traveon Ventures</span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
            The best B2B partner for MICE and travel services across the Sultanate of Oman for trade partners
            worldwide.
          </p>
          <form className="mt-5 flex max-w-xs overflow-hidden rounded-full border border-white/20" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder="Subscribe to Our Newsletter"
              className="min-w-0 flex-1 bg-transparent px-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none"
            />
            <button type="submit" className="whitespace-nowrap bg-[#C9A24A] px-4 py-2 text-sm font-semibold text-[#1B2333]">
              Subscribe
            </button>
          </form>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-white">Itineraries</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {FOOTER_LINKS.itineraries.map((item) => (
              <li key={item}>
                <a href="/#tours" className="transition-colors hover:text-[#C9A24A]">
                  {item}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-white">Partners</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {PARTNER_LINKS.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="block transition-colors hover:text-[#C9A24A]">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-white">Contact</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <FiMapPin className="mt-0.5 flex-shrink-0 text-[#C9A24A]" />
              {CONTACT.address}
            </li>
            <li className="flex items-center gap-2">
              <FiPhone className="flex-shrink-0 text-[#C9A24A]" />
              {CONTACT.phone}
            </li>
            <li className="flex items-center gap-2">
              <FiMail className="flex-shrink-0 text-[#C9A24A]" />
              {CONTACT.email}
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 pt-6 text-xs text-white/40 sm:flex-row">
        <p>© {new Date().getFullYear()} Xclusive Oman. All rights reserved.</p>
        <p>MCT ~ NIZ ~ WHR ~ ELL ~ KSB</p>
      </div>
    </footer>
  );
}
