// One A4 page (794 x 1123 CSS px = 210 x 297 mm) laid out like the
// supplier's real hotel booking confirmation. The same component renders the
// live preview in the form and is rasterised for the PDF download, so what
// the admin sees is exactly what gets downloaded.
import { voucherDate } from "./voucherTemplate.js";

export const PAGE_W = 794;
export const PAGE_H = 1123;

const C = {
  text: "#333333",
  accent: "#28BCCF",
  frame: "#2B2B2B",
  boxBorder: "#D2D2D2",
  muted: "#9A9A9A",
  footer: "#888888",
  offersBg: "#F5F5F5",
};
const FONT = "Arial, Helvetica, 'Liberation Sans', sans-serif";

const box = {
  border: `1.5px solid ${C.boxBorder}`,
  borderRadius: 6,
  boxShadow: "1px 2px 3px rgba(0,0,0,0.22)",
  padding: "7px 11px 9px",
  background: "#fff",
};

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", fontSize: 14.5, lineHeight: "18.6px" }}>
      <div style={{ width: 308, flex: "0 0 308px", fontWeight: 700 }}>{label} :</div>
      <div style={{ flex: 1, minWidth: 0, maxWidth: 360, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {value === null || value === undefined ? "" : String(value)}
      </div>
    </div>
  );
}

const num = (v) => (v === null || v === undefined ? "" : String(v));
const px = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export default function VoucherDocument({ v }) {
  const notes = String(v.notes || "")
    .split("\n")
    .filter((line) => line.trim() !== "");
  return (
    <div
      style={{
        width: PAGE_W,
        height: PAGE_H,
        position: "relative",
        background: "#fff",
        fontFamily: FONT,
        color: C.text,
        boxSizing: "border-box",
        overflow: "hidden",
        textAlign: "left",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 35,
          top: 38,
          width: 735,
          minHeight: 1017,
          maxHeight: 1078,
          border: `2.5px solid ${C.frame}`,
          borderRadius: 12,
          boxSizing: "border-box",
          padding: "0 11.5px",
        }}
      >
        {/* Header: logo + title */}
        <div style={{ position: "relative", height: 102 }}>
          {v.logoUrl ? (
            <img
              src={v.logoUrl}
              alt=''
              crossOrigin='anonymous'
              style={{
                position: "absolute",
                left: 13,
                top: 30,
                width: px(v.logoWidth, 135),
                height: px(v.logoHeight, 28),
                objectFit: "contain",
                objectPosition: "left center",
              }}
            />
          ) : null}
          <div
            style={{
              position: "absolute",
              right: -8,
              top: 26,
              fontSize: 23,
              fontWeight: 700,
              lineHeight: "26px",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ color: "#111" }}>{v.headerTitle}</span>
            {v.headerTitle && v.headerTitleAccent ? " " : ""}
            <span style={{ color: C.accent }}>{v.headerTitleAccent}</span>
          </div>
          <div
            style={{
              position: "absolute",
              right: -8,
              top: 54,
              maxWidth: 560,
              fontSize: 9.5,
              lineHeight: "12px",
              textAlign: "right",
              color: "#222",
            }}
          >
            {v.headerSubtitle}
          </div>
        </div>

        {/* Booking details */}
        <div style={box}>
          <Row label='Booking ID' value={v.bookingId} />
          <Row label='Booking Reference No' value={v.bookingReference} />
          <Row label='Client' value={v.client} />
          <Row label='Member ID' value={v.memberId} />
          <Row label='Country of Residence' value={v.country} />
          <Row label='Property' value={v.property} />
          <Row label='Address' value={v.address} />
          <Row label='Property Contact Number' value={v.propertyContact} />
        </div>

        {/* Room details */}
        <div style={{ ...box, marginTop: 11, padding: "9px 11px 11px" }}>
          <Row label='Number of Rooms' value={num(v.rooms)} />
          <Row label='Number of Extra Beds' value={num(v.extraBeds)} />
          <Row label='Number of Adults' value={num(v.adults)} />
          <Row label='Number of Children' value={num(v.children)} />
          <Row label='Room Type' value={v.roomType} />
          <Row label='Promotion' value={v.promotion} />
        </div>

        {/* Special offers */}
        <div style={{ ...box, marginTop: 12, background: C.offersBg, padding: "9px 11px 10px" }}>
          <div style={{ fontSize: 14.5, lineHeight: "18.6px", fontWeight: 700 }}>{v.specialOffersTitle}</div>
          <div style={{ fontSize: 14.5, lineHeight: "18.6px", whiteSpace: "pre-wrap" }}>
            Inclusions: {String(v.inclusions || "").trim() || "-"}
          </div>
        </div>

        {/* Stay + remarks */}
        <div style={{ ...box, marginTop: 11, padding: "8px 11px 12px" }}>
          <Row label='Arrival' value={voucherDate(v.arrival)} />
          <Row label='Departure' value={voucherDate(v.departure)} />
          <Row label='Booked And Payable By' value={v.bookedAndPayableBy} />
          <div style={{ borderTop: "1.5px dashed #D9D9D9", margin: "20px 0 16px" }} />
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, lineHeight: "18.6px", fontWeight: 700 }}>Remarks :</div>
              {String(v.included || "").trim() ? (
                <div style={{ fontSize: 14.5, lineHeight: "18.6px", whiteSpace: "pre-wrap" }}>
                  Included : {v.included}
                </div>
              ) : null}
              {String(v.remarks || "").trim() ? (
                <div style={{ fontSize: 11.5, lineHeight: "15px", color: C.muted, whiteSpace: "pre-wrap" }}>
                  {v.remarks}
                </div>
              ) : null}
            </div>
            <div
              style={{
                flex: "0 0 auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                marginRight: 32,
                minWidth: 190,
              }}
            >
              {v.stampUrl ? (
                <img
                  src={v.stampUrl}
                  alt=''
                  crossOrigin='anonymous'
                  style={{
                    width: px(v.stampWidth, 60),
                    height: px(v.stampHeight, 43),
                    objectFit: "contain",
                    marginBottom: 4,
                  }}
                />
              ) : null}
              <div style={{ fontSize: 14.5, lineHeight: "18.6px", color: "#111", whiteSpace: "nowrap" }}>
                {v.signatureLabel}
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {notes.length ? (
          <div style={{ ...box, marginTop: 13, padding: "9px 11px 11px" }}>
            <div style={{ fontSize: 12, lineHeight: "15px", fontWeight: 700 }}>Notes:</div>
            {notes.map((line, i) => (
              <div key={i} style={{ fontSize: 12, lineHeight: "15px", textAlign: "justify" }}>
                {line}
              </div>
            ))}
          </div>
        ) : null}

        {/* Footer contact */}
        {String(v.footerContact || "").trim() ? (
          <div style={{ margin: "17px 14px 0", borderTop: "1px solid #CCCCCC", paddingTop: 12 }}>
            <div
              style={{
                fontSize: 12,
                lineHeight: "15px",
                color: C.footer,
                textAlign: "center",
                whiteSpace: "pre-wrap",
              }}
            >
              {v.footerContact}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
