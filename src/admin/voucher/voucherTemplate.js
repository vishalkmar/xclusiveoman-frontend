// Default voucher template — mirrors the supplier's real hotel booking
// confirmation (Traveon layout). Every value here is pre-filled into the
// Create Voucher form and stays editable per voucher. Older vouchers saved
// before these fields existed (NULL in the DB) fall back to these values.

export const DEFAULT_NOTES = [
  "*IMPORTANT: At check-in, you must present a valid photo ID with your address confirming the same name as the lead guest on the booking. For bookings paid with a credit card, you may also need to present the card used to make the payment. Failure to do so may result in the hotel requesting additional payment or your reservation not being honored.",
  "* All rooms are guaranteed on the day of arrival. In the case of a no-show, your room(s) will be released and you will be subject to the terms and conditions of the Cancellation/No-Show Policy specified at the time you made the booking as well as noted in the Confirmation Email.",
  "* The total price for this booking does not include mini-bar items, telephone usage, laundry service, etc. The property will bill you directly.",
  "*In cases where Breakfast is included with the room rate, please note that certain properties may charge extra for children traveling with their parents. If applicable, the property will bill you directly. Upon arrival, if you have any questions, please verify with the property.",
].join("\n");

export const TEMPLATE_DEFAULTS = {
  logoUrl: "/voucher/traveon-logo.png",
  logoWidth: 135,
  logoHeight: 28,
  headerTitle: "Booking",
  headerTitleAccent: "Confirmation",
  headerSubtitle:
    "Please present either an electronic or paper copy of your booking confirmation upon check-in.",
  specialOffersTitle: "Traveon Special Offers",
  stampUrl: "/voucher/traveon-stamp.png",
  stampWidth: 60,
  stampHeight: 43,
  signatureLabel: "Authorized Stamp & Signature",
  notes: DEFAULT_NOTES,
  footerContact:
    "Call our Customer Service Center 24/7 : Customer Support : +91\n9540111202, +91 9540111307 (Long distance charge may apply)",
};

export const TEMPLATE_KEYS = Object.keys(TEMPLATE_DEFAULTS);

// Booking-data defaults for a brand-new voucher (editable).
export const NEW_VOUCHER = {
  bookingId: "",
  bookingReference: "",
  client: "",
  memberId: "",
  country: "",
  property: "",
  address: "",
  propertyContact: "",
  rooms: "1",
  extraBeds: "0",
  adults: "1",
  children: "",
  roomType: "",
  promotion: "",
  inclusions: "",
  included: "Taxes and fees",
  arrival: "",
  departure: "",
  bookedAndPayableBy: "Traveon Venture LLP, 128A D-MAll, New Delhi, India 110034",
  remarks: "All special requests are subject to availability upon arrival",
  status: "Draft",
  ...TEMPLATE_DEFAULTS,
};

// "2026-10-18" or a DATE serialized as an ISO timestamp -> "2026-10-18".
export function toDateInput(value) {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "2026-10-18" -> "18 October, 2026" (the real voucher's date format).
export function voucherDate(value) {
  const iso = toDateInput(value);
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const month = new Date(y, m - 1, 1).toLocaleString("en-GB", { month: "long" });
  return `${d} ${month}, ${y}`;
}

// A saved voucher -> the object the form/preview/PDF work with: NULL
// template fields take the defaults, numbers/dates become input strings.
export function withTemplateDefaults(v = {}) {
  const out = { ...NEW_VOUCHER, ...v };
  for (const key of TEMPLATE_KEYS) {
    if (v[key] === null || v[key] === undefined) out[key] = TEMPLATE_DEFAULTS[key];
  }
  for (const key of ["rooms", "extraBeds", "adults", "children"]) {
    out[key] = v[key] === null || v[key] === undefined ? (v.id ? "" : NEW_VOUCHER[key]) : String(v[key]);
  }
  out.arrival = toDateInput(v.arrival);
  out.departure = toDateInput(v.departure);
  out.property = v.property ?? v.propertyName ?? "";
  return out;
}
