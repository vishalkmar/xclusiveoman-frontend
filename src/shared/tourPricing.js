// Tour vehicle pricing — the price entered for a vehicle is the TOTAL for that
// vehicle filled to capacity, so its per-person price is price / maxPax (a
// Sedan entered as 30 for 3 people is 10 a head). Which vehicle applies
// depends on how many people are travelling, and a group pays that per-person
// price for each traveller. Mirrors the backend's src/utils/tourPricing.js;
// keep the two in step.
//
// Groups above 50 aren't handled yet — they fall into the 50 Seater Bus tier.
export const TOUR_VEHICLE_TIERS = [
  {
    key: "sedan",
    field: "priceSedan",
    column: "price_sedan",
    label: "Sedan",
    minPax: 1,
    maxPax: 3,
  },
  {
    key: "landCruiser",
    field: "priceLandCruiser",
    column: "price_land_cruiser",
    label: "Land Cruiser",
    minPax: 4,
    maxPax: 6,
  },
  {
    key: "bus20",
    field: "priceBus20",
    column: "price_bus_20",
    label: "20 Seater Bus",
    minPax: 7,
    maxPax: 20,
  },
  {
    key: "bus35",
    field: "priceBus35",
    column: "price_bus_35",
    label: "35 Seater Bus",
    minPax: 21,
    maxPax: 35,
  },
  {
    key: "bus50",
    field: "priceBus50",
    column: "price_bus_50",
    label: "50 Seater Bus",
    minPax: 36,
    maxPax: 50,
  },
];

// Group size the advertised per-person package rate is quoted for before a
// headcount is picked (same as the backend's BASELINE_PAX).
export const BASELINE_PAX = 2;

export function paxRangeLabel(tier) {
  return `${tier.minPax}–${tier.maxPax} people`;
}

export function tierForPax(pax) {
  const n = Math.max(1, Number(pax) || 1);
  return (
    TOUR_VEHICLE_TIERS.find((t) => n >= t.minPax && n <= t.maxPax) ||
    TOUR_VEHICLE_TIERS[TOUR_VEHICLE_TIERS.length - 1]
  );
}

// Vehicle for `pax` people among the priced vehicles. Ranges can overlap (a
// 4-seat Sedan and a 7-seat van both cover 3 people), so among the vehicles
// that cover the group the snuggest fit - the smallest capacity - is used. A group that falls in a
// gap (an unpriced vehicle between two priced ones) takes the next vehicle
// up — the closest minimum above the group size. Mirrors the backend's
// tierForPax.
export function tierForVehiclePrices(pax, vehiclePrices) {
  const n = Math.max(1, Number(pax) || 1);
  const priced = (vehiclePrices || []).filter((tier) => Number(tier.price) > 0);
  const covering = priced.filter((tier) => n >= tier.minPax && n <= tier.maxPax);
  if (covering.length > 0) {
    return covering.reduce((best, tier) =>
      Number(tier.maxPax) < Number(best.maxPax) ? tier : best
    );
  }
  return (
    priced
      .filter((tier) => tier.minPax > n)
      .sort((a, b) => a.minPax - b.minPax)[0] || null
  );
}

// Vehicle price table from a raw catalog row (snake_case, straight off
// GET /tours) — the same [{ key, label, minPax, maxPax, price }] shape the
// API's own `vehiclePrices` fields use. null when the tour has none yet.
export function vehiclePricesFromRow(row) {
  if (Array.isArray(row?.vehicle_prices)) {
    return row.vehicle_prices.map((tier, index) => ({
      key: tier.key || `${tier.minPax}-${tier.maxPax}-${index}`,
      vehicleId: tier.vehicleId || null,
      label: tier.label,
      minPax: Number(tier.minPax),
      maxPax: Number(tier.maxPax),
      price: Number(tier.price),
    }));
  }
  if (!row || !TOUR_VEHICLE_TIERS.some((t) => row[t.column] != null))
    return null;
  return TOUR_VEHICLE_TIERS.map((t) => ({
    key: t.key,
    label: t.label,
    minPax: t.minPax,
    maxPax: t.maxPax,
    price: row[t.column] != null ? Number(row[t.column]) : null,
  }));
}

// What each traveller in a vehicle pays: its entered total shared across its
// capacity (maxPax).
export function vehiclePerPersonPrice(tier) {
  const maxPax = Number(tier?.maxPax) || 0;
  return maxPax > 0 ? Number(tier.price || 0) / maxPax : 0;
}

// Total for a group of `pax`. `vehiclePrices` is the table above (or null);
// `pricePerPax` is an older tour's single per-person price, used only when
// there's no table.
export function tourGroupPrice({ vehiclePrices, pricePerPax }, pax) {
  const n = Math.max(1, Number(pax) || 1);
  if (vehiclePrices) {
    const tier = tierForVehiclePrices(n, vehiclePrices);
    return tier ? vehiclePerPersonPrice(tier) * n : 0;
  }
  return Number(pricePerPax || 0) * n;
}

export function tourPerPaxPrice(tour, pax) {
  const n = Math.max(1, Number(pax) || 1);
  return tourGroupPrice(tour, n) / n;
}

// Per-person share from a raw catalog row, for admin screens that hold the
// full tour rows (FdPackageEditor's live net-rate preview).
export function rowPerPaxPrice(row, pax = BASELINE_PAX, vehicleKey = null) {
  // A vehicle chosen for an FD itinerary tour fixes its per-person price
  // (vehicle price / max passengers), whatever the group size.
  if (vehicleKey) {
    const chosen = vehiclePricesFromRow(row)?.find(
      (v) => String(v.key) === String(vehicleKey) && Number(v.price) > 0
    );
    if (chosen) return vehiclePerPersonPrice(chosen);
  }
  return tourPerPaxPrice(
    { vehiclePrices: vehiclePricesFromRow(row), pricePerPax: row?.price },
    pax
  );
}
