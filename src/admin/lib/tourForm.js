// Shared Product Catalog `tours` field rules — backend truth is tourSchema
// (validation/schemas.js on the API); this mirrors it client-side so both
// the Product Catalog Tour form (TourEditor.jsx) and the Admin MICE Catalog
// Tour form (MiceCatalog.jsx) validate identically instead of each keeping
// a divergent copy.
import { isEmptyHtml } from "../../shared/components/RichTextEditor.jsx";
import { TOUR_VEHICLE_TIERS } from "../../shared/tourPricing.js";

// Pricing isn't in this list — at least one vehicle price is checked below.
export const TOUR_REQUIRED_FIELDS = [
  "name",
  "city",
  "description",
  "duration",
  "category",
  "pickupTime",
];

// description is rich text now — its empty state is `<p></p>`, not `''`.
const HTML_FIELDS = new Set(["description"]);

export function validateTourForm(form, images) {
  for (const key of TOUR_REQUIRED_FIELDS) {
    const empty = HTML_FIELDS.has(key)
      ? isEmptyHtml(form[key])
      : form[key] === undefined || form[key] === null || form[key] === "";
    if (empty) {
      return "Please fill in all required fields.";
    }
  }
  if (images.length === 0) return "Upload at least one image.";
  const enteredPrices = Array.isArray(form.vehiclePrices)
    ? form.vehiclePrices
    : TOUR_VEHICLE_TIERS.map((tier) => ({ price: form[tier.field] })).filter(
        (vehicle) =>
          vehicle.price !== "" &&
          vehicle.price !== undefined &&
          vehicle.price !== null
      );
  if (
    enteredPrices.some(
      (vehicle) =>
        !Number.isFinite(Number(vehicle.price)) || Number(vehicle.price) <= 0
    )
  ) {
    return "Vehicle prices must be positive numbers.";
  }
  if (enteredPrices.length === 0) {
    return "Enter a positive price for at least one vehicle.";
  }
  if (
    Array.isArray(form.vehiclePrices) &&
    enteredPrices.some(
      (vehicle) =>
        !vehicle.label?.trim() ||
        !Number.isInteger(Number(vehicle.minPax)) ||
        Number(vehicle.minPax) < 1 ||
        !Number.isInteger(Number(vehicle.maxPax)) ||
        Number(vehicle.maxPax) < Number(vehicle.minPax)
    )
  ) {
    return "Each vehicle needs a name and a valid passenger range.";
  }
  return "";
}
