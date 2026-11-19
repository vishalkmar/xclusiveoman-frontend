import { formatCurrency } from "../fdPackage/index.js";
import { tierForVehiclePrices, vehiclePerPersonPrice } from "../tourPricing.js";

// Read-only tour vehicle price table — Admin Product Catalog preview and the
// agent's FD departure page. `vehiclePrices` is the API's
// [{ key, label, minPax, maxPax, price }] shape (or shared/tourPricing.js's
// vehiclePricesFromRow for a raw catalog row). Pass `pax` to highlight the
// vehicle that group would travel in. Each vehicle's price is its total at
// full capacity, so the per-person price (price / max group size) is always
// shown alongside it.
export function TourVehiclePriceTable({ vehiclePrices, pax, compact = false }) {
  if (!vehiclePrices) return null;
  const active = pax ? tierForVehiclePrices(pax, vehiclePrices)?.key : null;
  const cell = compact ? "px-2.5 py-1.5" : "px-3 py-2";
  return (
    <div className='overflow-hidden rounded-lg border border-[#E4E9FB]'>
      <table className='w-full text-left text-xs'>
        <thead>
          <tr className='bg-[#F3F4FF] text-[#4F46E5]'>
            <th className={`${cell} font-semibold`}>Vehicle</th>
            <th className={`${cell} font-semibold`}>Group size</th>
            <th className={`${cell} text-right font-semibold`}>Vehicle price</th>
            <th className={`${cell} text-right font-semibold`}>Per person</th>
          </tr>
        </thead>
        <tbody>
          {vehiclePrices.map((v) => {
            const isActive = v.key === active;
            return (
              <tr
                key={v.key}
                className={`border-t border-[#EEF1FB] ${
                  isActive
                    ? "bg-[#EEF2FF] font-semibold text-[#312E81]"
                    : "text-[#334155]"
                }`}
              >
                <td className={cell}>
                  {v.label}
                  {isActive && (
                    <span className='ml-1.5 rounded-full bg-[#4F46E5] px-1.5 py-0.5 text-[9px] font-bold uppercase text-white'>
                      Your group
                    </span>
                  )}
                </td>
                <td className={cell}>
                  {v.minPax}–{v.maxPax} people
                </td>
                <td className={`${cell} text-right`}>
                  {v.price != null ? formatCurrency(v.price) : "—"}
                </td>
                <td className={`${cell} text-right`}>
                  {v.price != null
                    ? formatCurrency(vehiclePerPersonPrice(v))
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// One-line price summary for list rows: the per-person range across vehicles
// ("OMR 6.667 – OMR 10 per person"), or the old "OMR 7 / person" for a tour
// that has no vehicle prices yet.
export function tourPriceSummary(vehiclePrices, legacyPricePerPax) {
  if (vehiclePrices) {
    const prices = vehiclePrices
      .filter((v) => v.price != null)
      .map((v) => vehiclePerPersonPrice(v));
    if (prices.length === 0) return "—";
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return `${formatCurrency(min)}${
      max !== min ? ` – ${formatCurrency(max)}` : ""
    } per person`;
  }
  return legacyPricePerPax != null
    ? `${formatCurrency(legacyPricePerPax)} / person`
    : "—";
}
