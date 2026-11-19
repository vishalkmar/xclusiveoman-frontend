import { motion } from 'framer-motion';
import { LuChevronRight } from 'react-icons/lu';
import { AgencyAvatar } from './AgencyAvatar.jsx';
import { VisaProgress } from './VisaProgress.jsx';
import { ageLabel, plural } from './visaAdminMeta.js';

// One agency on the Application Tracker's "By agency" view: visas delivered
// vs. still to do, and its request mix. Clicking it filters the tracker's
// request list to that agency. Row shape: GET /admin/visa/agencies.
export function AgencyCard({ agency, index = 0, onSelect }) {
  const hasLeft = agency.pending > 0;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.03 }}>
      <button
        type="button"
        onClick={() => onSelect(agency)}
        className="group flex h-full w-full flex-col rounded-2xl border border-[#E4E9FB] bg-white p-5 text-left shadow-[0_4px_16px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-[#C7D2FE] hover:shadow-[0_10px_28px_rgba(79,70,229,0.12)]"
      >
        <div className="flex w-full items-start gap-3">
          <AgencyAvatar name={agency.name} logoUrl={agency.logoUrl} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-bold text-ink" title={agency.name}>
              {agency.name}
            </div>
            <div className="mt-0.5 text-[11px] text-muted">
              {[agency.country, `Last applied ${ageLabel(agency.lastAppliedAt).toLowerCase()}`].filter(Boolean).join(' · ')}
            </div>
          </div>
          <LuChevronRight size={18} className="mt-1 flex-none text-[#94A3B8] transition group-hover:translate-x-0.5 group-hover:text-accent" />
        </div>

        <div className="mt-4 grid w-full grid-cols-2 gap-2">
          <div className="rounded-xl bg-[#ECFDF5] px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[#047857]">Delivered</div>
            <div className="mt-0.5 text-2xl font-bold tabular-nums text-[#065F46]">{agency.issued}</div>
          </div>
          <div className={`rounded-xl px-3 py-2.5 ${hasLeft ? 'bg-[#FFF7ED]' : 'bg-[#F1F5F9]'}`}>
            <div className={`text-[10px] font-semibold uppercase tracking-wide ${hasLeft ? 'text-[#C2410C]' : 'text-muted'}`}>Left to deliver</div>
            <div className={`mt-0.5 text-2xl font-bold tabular-nums ${hasLeft ? 'text-[#9A3412]' : 'text-[#475569]'}`}>{agency.pending}</div>
          </div>
        </div>

        <div className="mt-4 w-full">
          <VisaProgress issued={agency.issued} rejected={agency.rejected} total={agency.travellers} />
        </div>

        <div className="mt-4 flex w-full flex-wrap gap-1.5 border-t border-dashed border-line-light pt-3 text-[11px]">
          <span className="rounded-full bg-[#F1F5F9] px-2.5 py-1 font-medium text-[#334155]">{plural(agency.applications, 'request')}</span>
          <span className="rounded-full bg-[#F1F5F9] px-2.5 py-1 font-medium text-[#334155]">{plural(agency.travellers, 'traveller')}</span>
          {agency.openApplications > 0 && (
            <span className="rounded-full bg-[#EEF0FF] px-2.5 py-1 font-semibold text-[#4338CA]">{agency.openApplications} open</span>
          )}
          {agency.awaitingPayment > 0 && (
            <span className="rounded-full bg-[#F8FAFC] px-2.5 py-1 font-medium text-[#475569] ring-1 ring-[#E2E8F0]">
              {agency.awaitingPayment} payment in review
            </span>
          )}
          {agency.rejected > 0 && (
            <span className="rounded-full bg-[#FEF2F2] px-2.5 py-1 font-medium text-[#B91C1C]">{agency.rejected} refused</span>
          )}
        </div>
      </button>
    </motion.div>
  );
}

// The selected agency's header above the filtered request list.
export function AgencySummary({ agency, onClear }) {
  return (
    <div className="mb-4 flex flex-col gap-4 rounded-2xl border border-white bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.05)] md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <AgencyAvatar name={agency.name} logoUrl={agency.logoUrl} />
        <div className="min-w-0">
          <div className="truncate text-lg font-bold text-ink">{agency.name}</div>
          <div className="text-[11px] text-muted">
            {[agency.country, plural(agency.applications, 'visa request'), plural(agency.travellers, 'traveller')].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 md:w-[330px]">
        <div className="rounded-xl bg-[#ECFDF5] px-3 py-2 text-center">
          <div className="text-xl font-bold tabular-nums text-[#065F46]">{agency.issued}</div>
          <div className="text-[10px] font-semibold uppercase text-[#047857]">Delivered</div>
        </div>
        <div className="rounded-xl bg-[#FFF7ED] px-3 py-2 text-center">
          <div className="text-xl font-bold tabular-nums text-[#9A3412]">{agency.pending}</div>
          <div className="text-[10px] font-semibold uppercase text-[#C2410C]">Left</div>
        </div>
        <div className="rounded-xl bg-[#FEF2F2] px-3 py-2 text-center">
          <div className="text-xl font-bold tabular-nums text-[#991B1B]">{agency.rejected}</div>
          <div className="text-[10px] font-semibold uppercase text-[#B91C1C]">Refused</div>
        </div>
      </div>
      <button type="button" onClick={onClear} className="self-start text-[11px] font-semibold text-accent hover:underline md:self-center">
        All agencies
      </button>
    </div>
  );
}
