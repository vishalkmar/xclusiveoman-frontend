import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LuHeadphones, LuPlus, LuX } from 'react-icons/lu';
import { FAQ_CATEGORIES, VISA_FAQS } from './visaFaqs.js';

// "Frequently asked questions" at the bottom of the agent Apply for Visa page
// (VisaApply.jsx). A centred list of questions split by dashed rules; "+"
// opens an answer and turns into "×". Category pills narrow the list (the
// content lives in visaFaqs.js). Several answers can be open at once.

const SERIF = "font-['Georgia','Cambria','Times_New_Roman',serif]";
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFBF47] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFF9EF]';

// "**bold** rest" → <b>bold</b> rest.
function RichText({ text }) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <b key={i} className="font-semibold text-[#17243A]">
        {part.slice(2, -2)}
      </b>
    ) : (
      part
    )
  );
}

function Answer({ blocks, id }) {
  return (
    <div id={id} className="space-y-4 pb-7 pr-10 text-[15px] leading-relaxed text-[#5E6878] sm:text-base">
      {blocks.map((block, i) =>
        typeof block === 'string' ? (
          // The first paragraph is the direct answer — set a touch stronger.
          <p key={i} className={i === 0 ? 'font-medium text-[#17243A]' : ''}>
            <RichText text={block} />
          </p>
        ) : (
          <ul key={i} className="space-y-2.5">
            {block.list.map((item) => (
              <li key={item} className="flex items-start gap-3.5">
                <span aria-hidden className="mt-[7px] h-0 w-0 flex-none border-y-[5px] border-l-[8px] border-y-transparent border-l-[#E87535]" />
                <span>
                  <RichText text={item} />
                </span>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

function FaqItem({ faq, open, onToggle, index }) {
  const id = `visa-faq-${index}`;
  return (
    <li className="border-b border-dashed border-[#E3CFA9]">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          className={`flex w-full items-center justify-between gap-6 py-7 text-left ${FOCUS}`}
        >
          <span className="text-[17px] font-semibold leading-snug text-[#17243A] sm:text-lg">{faq.q}</span>
          <span
            aria-hidden
            className={`flex h-9 w-9 flex-none items-center justify-center rounded-full transition ${
              open ? 'bg-[#FFF1DF] text-[#17243A]' : 'text-[#17243A] hover:bg-[#FFF1DF]'
            }`}
          >
            {open ? <LuX size={20} /> : <LuPlus size={22} />}
          </span>
        </button>
      </h3>
      {open && <Answer blocks={faq.a} id={id} />}
    </li>
  );
}

export default function VisaFaq() {
  const [category, setCategory] = useState(FAQ_CATEGORIES[0].key);
  // Open answers by question text; the first question starts open.
  const [open, setOpen] = useState(() => new Set([VISA_FAQS[0].q]));
  const faqs = VISA_FAQS.filter((f) => f.category === category);

  function toggle(q) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(q)) next.delete(q);
      else next.add(q);
      return next;
    });
  }

  return (
    <section aria-labelledby="visa-faq-heading" className="mt-16 border-t border-[#F0DFC7] pt-12">
      <div className="mx-auto max-w-[1080px]">
        <h2 id="visa-faq-heading" className={`${SERIF} text-[30px] font-bold leading-tight text-[#17243A] sm:text-[38px]`}>
          Frequently asked questions
        </h2>

        <div role="tablist" aria-label="FAQ topics" className="mt-6 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
          {FAQ_CATEGORIES.map((c) => {
            const active = c.key === category;
            const count = VISA_FAQS.filter((f) => f.category === c.key).length;
            return (
              <button
                key={c.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCategory(c.key)}
                className={`flex-none rounded-full border px-4 py-2 text-sm font-semibold transition ${FOCUS} ${
                  active
                    ? 'border-[#FFBF47] bg-[#FFBF47] text-[#17243A]'
                    : 'border-[#F0DFC7] bg-white text-[#5E6878] hover:border-[#FFBF47] hover:text-[#17243A]'
                }`}
              >
                {c.label} <span className={active ? 'text-[#17243A]/60' : 'text-[#A0A6B1]'}>{count}</span>
              </button>
            );
          })}
        </div>

        <ul role="tabpanel" aria-label={FAQ_CATEGORIES.find((c) => c.key === category)?.label} className="mt-4">
          {faqs.map((faq) => (
            <FaqItem key={faq.q} faq={faq} index={VISA_FAQS.indexOf(faq)} open={open.has(faq.q)} onToggle={() => toggle(faq.q)} />
          ))}
        </ul>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#F0DFC7] bg-white px-5 py-4">
          <div>
            <div className="text-[15px] font-semibold text-[#17243A]">Still have a question?</div>
            <div className="text-[13px] text-[#737D8C]">Our team can help with documents, payments and anything else.</div>
          </div>
          <Link
            to="/agent/support"
            className={`inline-flex items-center gap-1.5 rounded-full bg-[#FFBF47] px-5 py-2.5 text-sm font-bold text-[#17243A] transition hover:bg-[#F7AE2C] ${FOCUS}`}
          >
            <LuHeadphones size={15} /> Contact support
          </Link>
        </div>
      </div>
    </section>
  );
}
