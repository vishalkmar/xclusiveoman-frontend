import { TRANSFER_SLOT_KEYS, TRANSFERS, resolveLandingCard } from '../data.js';
import { SectionHeading, Accent } from '../components/SectionHeading.jsx';
import { TourCard } from '../components/TourCard.jsx';
import { useLandingMedia } from '../useLandingMedia.js';

export function TransfersSection() {
  const media = useLandingMedia();
  return (
    <section id="transfers" className="bg-white px-6 py-20 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <SectionHeading>
          Transfers
          <br />
          <Accent>Hassle</Accent> Free Transfers
        </SectionHeading>

        <p className="mx-auto mt-4 max-w-xl text-center text-sm text-[#5B6472]">
          Modular experiences your clients can add to any base tour — priced and confirmed alongside your
          itinerary, no separate supplier to chase.
        </p>

        <div className="mx-auto mt-12 grid max-w-2xl gap-6 sm:grid-cols-2">
          {/* Each card's content comes from Gallery Management -> Transfers,
              field by field, falling back to TRANSFERS. */}
          {TRANSFERS.map((transfer, i) => (
            <TourCard
              key={TRANSFER_SLOT_KEYS[i]}
              {...resolveLandingCard(transfer, media[TRANSFER_SLOT_KEYS[i]]?.[0], media['landing-transfers']?.[i])}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
