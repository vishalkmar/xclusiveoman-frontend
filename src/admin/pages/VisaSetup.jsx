import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LuChevronRight, LuImage, LuPackage, LuPlus } from 'react-icons/lu';
import { VisaHeroCard } from '../components/visa/VisaHeroCard.jsx';
import { VisaPackagesPanel } from '../components/visa/VisaPackagesPanel.jsx';
import { VisaHeaderArt } from '../components/visa/setupUi.jsx';

// Admin "Create Visa" (sidebar; route /admin/visa-setup) — the Visa Packages agents apply for on the agent
// "Apply for Visa" page (agent/pages/VisaApply.jsx), and that page's single
// Hero Image (components/visa/VisaPackagesPanel.jsx, VisaHeroCard.jsx).
// Visa types/categories were replaced by packages (0130 migration); older
// applications keep their type/category labels.
// No prices here: one per-person price for every visa is set only in
// Payments → Package Controller → Visa (PackageController.jsx).
// Styled with the warm Visa Setup look in components/visa/setupUi.jsx.

const TABS = [
  { key: 'packages', label: 'Visa Creation', icon: LuPackage },
  { key: 'hero', label: 'Hero Image', icon: LuImage },
];

export default function VisaSetup() {
  const [tab, setTab] = useState('packages');
  // Bumped by "Create Visa" — VisaPackagesPanel opens its pop-up form.
  const [createRequest, setCreateRequest] = useState(0);
  const current = TABS.find((t) => t.key === tab);

  return (
    <div className="relative min-h-full overflow-hidden bg-[#F4F7FF]">
      <VisaHeaderArt className="pointer-events-none absolute right-0 top-0 hidden h-[260px] w-[520px] lg:block" />
      <div className="relative w-full space-y-6 p-5 lg:p-8">
        <div className="lg:pr-[340px]">
          <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-sm text-[#64748B]">
            <Link to="/admin" className="hover:text-[#4F46E5]">
              Home
            </Link>
            <LuChevronRight size={14} />
            <span>Create Visa</span>
            <LuChevronRight size={14} />
            <span className="font-semibold text-[#172554]">{current.label}</span>
          </nav>
          <h2 className="mb-2 text-3xl font-bold text-[#172554]">{current.label}</h2>
          <p className="text-sm leading-relaxed text-[#64748B]">
            The visa packages agents choose from when applying, and the agent Visa page&apos;s hero image. Inactive packages are
            hidden from agents. The price per person is the same for every visa — set it in{' '}
            <Link to="/admin/package-controller?tab=visa" className="font-semibold text-[#4F46E5] hover:underline">
              Payments → Package Controller → Visa
            </Link>
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                tab === key
                  ? 'border-[#4F46E5] bg-[#4F46E5] text-white shadow-[0_6px_16px_rgba(79,70,229,0.28)]'
                  : 'border-[#DCE2F5] bg-white text-[#172554] hover:border-[#4F46E5] hover:text-[#4F46E5]'
              }`}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
          {tab === 'packages' && (
            <button
              type="button"
              onClick={() => setCreateRequest((n) => n + 1)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(79,70,229,0.28)] transition hover:bg-[#4338CA] sm:ml-5"
            >
              <LuPlus size={17} /> Create Visa
            </button>
          )}
        </div>

        {tab === 'packages' ? <VisaPackagesPanel createRequest={createRequest} /> : <VisaHeroCard />}
      </div>
    </div>
  );
}
