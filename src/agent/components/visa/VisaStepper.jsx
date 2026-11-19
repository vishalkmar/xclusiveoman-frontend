import { LuCheck } from 'react-icons/lu';

// Progress header shared by the visa application pages
// (VisaApply -> VisaTravellers -> VisaPhotos -> VisaPassports -> VisaPayment),
// shown in VisaFlowUi.jsx's top bar next to "Back". Current step: filled
// amber disc with a soft outer glow; completed: light amber disc with a
// check; upcoming: white disc with a beige border. Connectors are beige,
// amber once the step before them is done.
//
// It looks the same on every page: a compact, left-aligned bar with fixed
// connector lengths (it never stretches to the page width). Every step's
// label shows from lg up; below that only the current step's label does. On
// phones the connectors flex to the screen width.
const STEPS = ['Choose visa', 'Traveller names', 'Photos', 'Passports', 'Payment'];

export default function VisaStepper({ current, className = 'mb-8' }) {
  return (
    <ol aria-label="Application progress" className={`flex w-full max-w-full items-center sm:w-fit ${className}`}>
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        const last = index === STEPS.length - 1;
        return (
          <li
            key={label}
            // The current step keeps room for its label (no min-w-0) so on
            // narrow screens it can't run into the next step's disc. From sm
            // up the connector lines shrink (to 12px) when space is tight —
            // e.g. the sidebar opening — instead of the bar overflowing.
            className={`flex items-center ${last ? 'flex-none' : active ? 'flex-1 sm:flex-initial' : 'min-w-0 flex-1 sm:flex-initial'}`}
            aria-current={active ? 'step' : undefined}
          >
            <span
              title={active ? undefined : label}
              className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-bold transition sm:h-9 sm:w-9 ${
                active
                  ? 'bg-[#FFBF47] text-[#17243A] shadow-[0_0_0_5px_rgba(255,191,71,0.25)]'
                  : done
                    ? 'bg-[#FFF1DF] text-[#E87535] ring-1 ring-[#FFBF47]/60'
                    : 'border border-[#F0DFC7] bg-white text-[#737D8C]'
              }`}
            >
              {done ? <LuCheck size={15} strokeWidth={3} /> : index + 1}
            </span>
            <span
              className={`ml-2 flex-none whitespace-nowrap text-sm sm:ml-2.5 ${active ? 'font-bold text-[#17243A]' : 'font-medium text-[#737D8C]'} ${
                active ? '' : 'sr-only xl:not-sr-only xl:ml-2.5'
              }`}
            >
              {label}
            </span>
            {!last && (
              <span
                aria-hidden="true"
                className={`mx-2 h-px min-w-3 flex-1 sm:mx-3 sm:w-12 sm:flex-initial ${done ? 'bg-[#FFBF47]' : 'bg-[#F0DFC7]'}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
