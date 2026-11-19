import { Link } from 'react-router-dom';
import { LuLock } from 'react-icons/lu';
import { FOCUS } from './visaFlowTokens.js';

// Shown on the traveller / photo / passport pages once the application is
// paid for (or its NEFT slip is being verified): the fee was charged per
// traveller, so nothing can be changed any more (the server refuses edits
// too — visa.controller.js#loadEditableApplicationOr404).
export default function VisaLockedNotice({ application }) {
  const reviewing = application.status === 'payment_review';
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-xl border border-[#F0DFC7] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-3 text-sm text-[#17243A]">
        <span className="mt-px flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#FFF1DF] text-[#E87535]">
          <LuLock size={13} strokeWidth={2.5} />
        </span>
        <span>
          <span className="font-semibold">{reviewing ? 'Payment is being verified.' : 'This application has been submitted.'}</span>{' '}
          <span className="text-[#737D8C]">The travellers, photos and passports can no longer be changed.</span>
        </span>
      </p>
      <Link
        to={`/agent/visa/applications/${application.id}`}
        className={`flex-none rounded-full text-sm font-semibold text-[#E87535] hover:underline ${FOCUS}`}
      >
        View application →
      </Link>
    </div>
  );
}
