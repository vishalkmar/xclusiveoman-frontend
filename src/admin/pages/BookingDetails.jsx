import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  LuArrowLeft,
  LuArrowRight,
  LuBedDouble,
  LuBookmark,
  LuBuilding2,
  LuCalendar,
  LuCarFront,
  LuChevronDown,
  LuChevronRight,
  LuCircleCheck,
  LuClipboardList,
  LuCreditCard,
  LuDownload,
  LuExternalLink,
  LuFileText,
  LuFlag,
  LuHandCoins,
  LuImage,
  LuBanknote,
  LuMapPin,
  LuMonitor,
  LuPackage,
  LuPencil,
  LuRoute,
  LuSend,
  LuSun,
  LuTag,
  LuUser,
  LuUsers,
  LuWallet,
  LuZap,
} from "react-icons/lu";
import { api } from "../api/client.js";
import { ErrorText } from "../components/ui.jsx";
import { downloadDocument } from "../../shared/documents/downloadDocument.js";
import { RichTextDisplay } from "../../shared/components/RichTextEditor.jsx";
import { dayTitle } from "../../shared/itinerary/index.js";
import { formatCurrency } from "../../shared/currency.js";

const STATUS_PILL = {
  fully_paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  completed: "border-slate-200 bg-slate-100 text-slate-600",
  balance_due: "border-amber-200 bg-amber-50 text-amber-700",
  pending_payment: "border-amber-200 bg-amber-50 text-amber-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
};

// Per-type label + icon for the itinerary rows' right-hand column.
const ITEM_TYPE = {
  hotel: { label: "Hotel Check-in", icon: LuBedDouble },
  tour: { label: "Tour", icon: LuRoute },
  activity: { label: "Activity", icon: LuFlag },
  transfer: { label: "Transfer", icon: LuCarFront },
};

const money = (value) => formatCurrency(value || 0);
const date = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
const addDays = (value, days) => {
  if (!value) return null;
  const next = new Date(value);
  if (Number.isNaN(next.getTime())) return null;
  next.setDate(next.getDate() + days);
  return next;
};
const titleCase = (value) =>
  (value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
const initials = (name) =>
  (name || "AG")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

function StatusPill({ status, className = "" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        STATUS_PILL[status] || STATUS_PILL.completed
      } ${className}`}
    >
      {titleCase(status || "unknown")}
    </span>
  );
}

function Panel({ className = "", children }) {
  return (
    <section
      className={`rounded-2xl border border-[#EEF1F8] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)] ${className}`}
    >
      {children}
    </section>
  );
}

function PanelTitle({ icon: Icon, children, right }) {
  return (
    <div className='flex items-center justify-between gap-3'>
      <h2 className='flex items-center gap-3 text-base font-bold text-[#0F1B4C]'>
        <Icon size={19} className='text-[#4F46E5]' />
        {children}
      </h2>
      {right}
    </div>
  );
}

function SummaryRow({ label, children }) {
  return (
    <div className='grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] items-center gap-3 py-[5px] text-[13px]'>
      <span className='text-[#6B7394]'>{label}</span>
      <span className='font-medium text-[#0F1B4C]'>{children || "—"}</span>
    </div>
  );
}

function OverviewItem({ label, icon: Icon, children }) {
  return (
    <div className='min-w-0 px-4 first:pl-0 last:pr-0'>
      <div className='text-xs text-[#6B7394]'>{label}</div>
      <div className='mt-2 flex items-center gap-2 text-sm font-medium text-[#0F1B4C]'>
        <Icon size={17} className='shrink-0 text-[#4B5575]' />
        <span className='truncate'>{children || "—"}</span>
      </div>
    </div>
  );
}

function FinanceTile({ label, value, icon: Icon, tone }) {
  return (
    <div className='flex items-center gap-3 rounded-xl border border-[#EEF1F8] px-3 py-4'>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}
      >
        <Icon size={20} />
      </span>
      <div className='min-w-0'>
        <div className='text-[11px] text-[#4B5575]'>{label}</div>
        <div className='mt-0.5 truncate text-lg font-bold text-[#0F1B4C]'>
          {value}
        </div>
      </div>
    </div>
  );
}

function ItineraryDay({ day, index, dayDate, hotel, isLast }) {
  const [open, setOpen] = useState(false);
  const items = day.items || [];
  const primary = items.find((item) => ITEM_TYPE[item.type]) || items[0];
  // FD leisure days (0105) carry only a hotel plus the admin's optional remark.
  const type = day.leisure
    ? { label: "Leisure", icon: LuFlag }
    : ITEM_TYPE[primary?.type] || { label: "Itinerary", icon: LuFlag };
  const TypeIcon = type.icon;
  const city = items.map((item) => item.city).find(Boolean);
  const description = day.leisure
    ? [
        "Free time — no tours or transfers planned",
        primary?.name && `stay at ${primary.name}`,
      ]
        .filter(Boolean)
        .join(", ") + (day.leisureRemark ? `. ${day.leisureRemark}` : ".")
    : items
        .map((item) => [item.name, item.note].filter(Boolean).join(" — "))
        .filter(Boolean)
        .join(". ") || "Details for this day will be shared soon.";
  const dayNumber = day.dayNumber || index + 1;

  return (
    <div className='relative grid grid-cols-[28px_minmax(0,1fr)] gap-2'>
      <div className='relative flex justify-center'>
        <span className='relative z-10 mt-[18px] h-2.5 w-2.5 rounded-full bg-[#4F46E5] ring-4 ring-[#EEF0FF]' />
        {!isLast && (
          <span className='absolute bottom-0 top-[22px] w-px bg-[#DADFF0]' />
        )}
      </div>
      <div className={`py-2.5 ${isLast ? "" : "border-b border-[#EEF1F8]"}`}>
        <div className='grid items-center gap-4 md:grid-cols-[80px_96px_minmax(0,1fr)_150px_20px]'>
          <div>
            <div className='text-sm font-semibold text-[#0F1B4C]'>
              Day {dayNumber}
            </div>
            <div className='mt-0.5 text-xs text-[#6B7394]'>
              {dayDate ? date(dayDate) : "—"}
            </div>
          </div>
          <div
            className='h-12 w-24 overflow-hidden rounded-md bg-[#F1F4FB]'
            title={hotel?.name || "No hotel for this day"}
          >
            {hotel?.image ? (
              <img
                src={hotel.image}
                alt={hotel.name || "Hotel"}
                className='h-full w-full object-cover'
              />
            ) : (
              <div className='flex h-full items-center justify-center text-[#A3AAC4]'>
                <LuBedDouble size={18} />
              </div>
            )}
          </div>
          <div className='min-w-0'>
            <div className='text-[13px] font-semibold text-[#0F1B4C]'>
              {dayTitle(day)}
            </div>
            <p
              className={`mt-0.5 text-xs leading-relaxed text-[#6B7394] ${
                open ? "" : "line-clamp-2"
              }`}
            >
              {description}
            </p>
          </div>
          <div className='space-y-1.5 text-xs text-[#6B7394]'>
            <div className='flex items-center gap-2'>
              <TypeIcon size={14} className='shrink-0' />
              <span className='truncate'>{type.label}</span>
            </div>
            <div className='flex items-center gap-2'>
              <LuMapPin size={14} className='shrink-0' />
              <span className='truncate'>{city || "—"}</span>
            </div>
          </div>
          <button
            type='button'
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Collapse day" : "Expand day"}
            className='text-[#6B7394] hover:text-[#4F46E5]'
          >
            <LuChevronDown
              size={18}
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </div>
        {open && items.length > 0 && (
          <ul className='mt-3 space-y-1.5 rounded-lg bg-[#F8F9FD] p-3 text-xs text-[#4B5575] md:ml-[200px]'>
            {items.map((item, itemIndex) => {
              const Icon = ITEM_TYPE[item.type]?.icon || LuFlag;
              return (
                <li
                  key={item.id || itemIndex}
                  className='flex items-center gap-2'
                >
                  <Icon size={13} className='shrink-0 text-[#4F46E5]' />
                  <span className='font-medium text-[#0F1B4C]'>
                    {item.name || ITEM_TYPE[item.type]?.label || "Item"}
                  </span>
                  {item.city && <span>· {item.city}</span>}
                  {item.note && <span>({item.note})</span>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function MoreActions({ bookingId }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className='relative'>
      <button
        type='button'
        onClick={() => setOpen((value) => !value)}
        className='inline-flex h-10 items-center gap-6 rounded-lg border border-[#D9DEEF] bg-white px-4 text-xs font-semibold text-[#0F1B4C] hover:border-[#4F46E5]'
      >
        More Actions <LuChevronDown size={15} />
      </button>
      {open && (
        <div className='absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-lg border border-[#E4E9FB] bg-white py-1 shadow-lg'>
          <Link
            to={`/admin/bookings/${bookingId}/documents`}
            className='flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#0F1B4C] hover:bg-[#F4F6FF]'
          >
            <LuFileText size={14} /> Manage Documents
          </Link>
        </div>
      )}
    </div>
  );
}

export default function BookingDetails() {
  const { bookingId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get(`/admin/bookings/${bookingId}/documents`),
      api.get("/admin/bookings?page=1&pageSize=100"),
    ])
      .then(async ([result, bookingList]) => {
        const listedBooking = (bookingList.bookings || []).find(
          (item) => item.id === bookingId
        );
        const enrichedBooking = { ...listedBooking, ...result.booking };
        const [packageData, agencyData] = await Promise.all([
          enrichedBooking.fdPackageId
            ? api
                .get(`/admin/fd-packages/${enrichedBooking.fdPackageId}`)
                .then((res) => res.fdPackage)
                // Package details are optional for legacy bookings.
                .catch(() => null)
            : null,
          enrichedBooking.agencyId
            ? api
                .get("/admin/agencies?page=1&pageSize=100")
                .then((res) =>
                  (res.agencies || []).find(
                    (item) => item.id === enrichedBooking.agencyId
                  )
                )
                .catch(() => null)
            : null,
        ]);
        if (active)
          setData({
            ...result,
            booking: enrichedBooking,
            package: packageData,
            agency: agencyData,
          });
      })
      .catch(
        (err) =>
          active && setError(err.message || "Unable to load booking details")
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [bookingId]);

  const paymentProgress = useMemo(() => {
    if (!data?.booking) return 0;
    const total = Number(data.booking.totalPrice || 0);
    return total
      ? Math.min(
          100,
          Math.round((Number(data.booking.depositPaid || 0) / total) * 100)
        )
      : 0;
  }, [data]);

  async function downloadAll() {
    setDownloading(true);
    try {
      await downloadDocument(
        api,
        `/admin/bookings/${bookingId}/documents/download-all`
      );
    } catch (err) {
      setError(err.message || "Unable to download documents");
    } finally {
      setDownloading(false);
    }
  }

  if (loading)
    return (
      <div className='min-h-screen bg-[#F6F8FC] p-8 text-sm text-muted'>
        Loading booking details…
      </div>
    );
  if (!data?.booking)
    return (
      <div className='min-h-screen bg-[#F6F8FC] p-8'>
        <ErrorText>{error || "Booking not found."}</ErrorText>
        <Link
          to='/admin/bookings-documents'
          className='mt-4 inline-flex text-sm font-semibold text-accent'
        >
          Back to Bookings
        </Link>
      </div>
    );

  const {
    booking,
    travelers = [],
    voucher = {},
    package: packageDetails,
    agency,
  } = data;
  const bookingCode = booking.id.slice(0, 8).toUpperCase();
  const packageTitle =
    packageDetails?.title || booking.packageTitle || "Fixed Departure Booking";
  const destination = booking.departureLocation || "—";
  const itinerary = packageDetails?.itinerary || [];
  const totalDays = itinerary.length;
  const totalNights = Math.max(totalDays - 1, 0);
  const durationLabel = totalDays
    ? `${totalNights} Nights / ${totalDays} Days`
    : packageDetails?.duration || "Fixed departure";
  const returnDate = totalDays
    ? addDays(booking.departureDate, totalDays - 1)
    : null;
  const travellersLabel = `${booking.pax || 0} ${
    Number(booking.pax) === 1 ? "Adult" : "Adults"
  }`;
  const createdVia = titleCase(booking.createdVia) || "—";
  const agencyName = booking.agencyName || agency?.name || "Agency unavailable";
  const agencyEmail = agency?.email || agency?.ownerEmail;
  const contactPerson = booking.createdByName || agency?.ownerName;
  const gallery = [
    packageDetails?.heroImageUrl,
    ...(packageDetails?.images || []),
  ].filter(Boolean);
  const [heroImage, ...thumbs] = gallery;
  // Each day's photo is the hotel the travellers stay at that day. A day
  // with no hotel item of its own (e.g. a checkout/departure day) keeps the
  // previous day's hotel, falling back to the package's own hotel.
  const packageHotel = packageDetails?.hotel;
  const dayHotels = itinerary.reduce((acc, day) => {
    const hotelItem = (day.items || []).find((item) => item.type === "hotel");
    const hotel = hotelItem
      ? { name: hotelItem.name, image: hotelItem.images?.[0] }
      : acc[acc.length - 1] ||
        (packageHotel && {
          name: packageHotel.name || packageDetails?.hotelName,
          image: packageHotel.images?.[0],
        }) ||
        null;
    return [...acc, hotel];
  }, []);

  return (
    <div className='min-h-screen bg-[#F6F8FC]'>
      <div className='mx-auto max-w-[1440px] px-5 py-5 lg:px-8'>
        {/* Header */}
        <div className='mb-6 flex flex-wrap items-end justify-between gap-4'>
          <div>
            <Link
              to='/admin/bookings-documents'
              className='mb-3 inline-flex items-center gap-2 text-sm text-[#4B5575] hover:text-[#4F46E5]'
            >
              <LuArrowLeft size={16} /> Back to Bookings
            </Link>
            <div className='flex flex-wrap items-center gap-3'>
              <h1 className='text-[28px] font-bold leading-tight text-[#0F1B4C]'>
                Booking Details
              </h1>
              <span className='rounded-md bg-[#EEF1F8] px-2.5 py-1 text-xs font-medium text-[#0F1B4C]'>
                {bookingCode}
              </span>
              <StatusPill status={booking.status} />
            </div>
          </div>
          <div className='flex flex-wrap items-center gap-2.5'>
            <button
              type='button'
              onClick={downloadAll}
              disabled={downloading || (!travelers.length && !voucher.uploaded)}
              className='inline-flex h-10 items-center gap-2 rounded-lg border border-[#D9DEEF] bg-white px-4 text-xs font-semibold text-[#4F46E5] hover:border-[#4F46E5] disabled:cursor-not-allowed disabled:opacity-50'
            >
              <LuDownload size={15} />
              {downloading ? "Preparing…" : "Download Voucher"}
            </button>
            <Link
              to={`/admin/bookings/${bookingId}/documents`}
              className='inline-flex h-10 items-center gap-2 rounded-lg border border-[#D9DEEF] bg-white px-4 text-xs font-semibold text-[#4F46E5] hover:border-[#4F46E5]'
            >
              <LuSend size={15} /> Send Voucher
            </Link>
            <button
              type='button'
              className='inline-flex h-10 items-center gap-2 rounded-lg bg-[#5B4FF5] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#4F46E5]'
            >
              <LuPencil size={15} /> Edit Booking
            </button>
            <MoreActions bookingId={bookingId} />
          </div>
        </div>
        {error && <ErrorText>{error}</ErrorText>}

        <div className='grid gap-5 xl:grid-cols-[minmax(0,1fr)_336px]'>
          <main className='min-w-0 space-y-4'>
            {/* Package hero */}
            <Panel className='p-4'>
              <div className='grid gap-6 lg:grid-cols-[minmax(0,1.75fr)_minmax(300px,1fr)]'>
                <div className='grid grid-cols-[1.45fr_1fr_1fr_1fr] grid-rows-2 gap-2'>
                  <div className='row-span-2 overflow-hidden rounded-lg bg-[#F1F4FB]'>
                    {heroImage ? (
                      <img
                        src={heroImage}
                        alt={packageTitle}
                        className='h-full min-h-48 w-full object-cover'
                      />
                    ) : (
                      <div className='flex h-full min-h-48 items-center justify-center text-[#A3AAC4]'>
                        <LuPackage size={34} />
                      </div>
                    )}
                  </div>
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className='h-[92px] overflow-hidden rounded-md bg-[#F1F4FB]'
                    >
                      {thumbs[index] ? (
                        <img
                          src={thumbs[index]}
                          alt=''
                          className='h-full w-full object-cover'
                        />
                      ) : (
                        <div className='flex h-full items-center justify-center text-[#C4CADD]'>
                          <LuImage size={18} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className='py-1 pr-2'>
                  <div className='text-[10px] font-semibold uppercase tracking-wider text-[#B7791F]'>
                    Fixed Departure
                  </div>
                  <h2 className='mt-2 text-[22px] font-bold leading-tight text-[#0F1B4C]'>
                    {packageTitle}
                  </h2>
                  <p className='mt-2 flex items-center gap-2 text-xs text-[#6B7394]'>
                    <LuMapPin size={14} /> {destination}
                  </p>
                  <RichTextDisplay
                    html={
                      packageDetails?.shortDescription ||
                      packageDetails?.description ||
                      "<p>Package details are available from the linked fixed-departure package.</p>"
                    }
                    className='mt-4 line-clamp-5 text-[13px] leading-relaxed text-[#6B7394]'
                  />
                  <div className='mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#0F1B4C]'>
                    <span className='flex items-center gap-2'>
                      <LuSun size={16} className='text-[#4B5575]' />
                      {durationLabel}
                    </span>
                    <span className='flex items-center gap-2'>
                      <LuUsers size={16} className='text-[#4B5575]' />
                      {booking.pax || 0} Travellers
                    </span>
                    {packageDetails?.theme && (
                      <span className='flex items-center gap-2'>
                        <LuTag size={16} className='text-[#4B5575]' />
                        {packageDetails.theme}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Panel>

            {/* Booking overview */}
            <Panel className='px-5 py-4'>
              <PanelTitle
                icon={LuCalendar}
                right={
                  <span className='flex items-center gap-2 text-xs text-[#6B7394]'>
                    <LuCalendar size={14} /> Created on{" "}
                    {date(booking.createdAt)}
                  </span>
                }
              >
                Booking Overview
              </PanelTitle>
              <div className='mt-4 grid grid-cols-2 gap-y-4 border-t border-[#EEF1F8] pt-4 sm:grid-cols-4 xl:grid-cols-7 xl:divide-x xl:divide-[#EEF1F8]'>
                <OverviewItem label='Departure Date' icon={LuCalendar}>
                  {date(booking.departureDate)}
                </OverviewItem>
                <OverviewItem label='Return Date' icon={LuCalendar}>
                  {returnDate ? date(returnDate) : "—"}
                </OverviewItem>
                <OverviewItem label='Destination' icon={LuMapPin}>
                  {destination}
                </OverviewItem>
                <OverviewItem label='Travellers' icon={LuUser}>
                  {travellersLabel}
                </OverviewItem>
                <OverviewItem label='Created Via' icon={LuMonitor}>
                  {createdVia}
                </OverviewItem>
                <OverviewItem label='Agency' icon={LuBuilding2}>
                  {agencyName}
                </OverviewItem>
                <OverviewItem label='Agent / Contact Person' icon={LuUser}>
                  {contactPerson}
                </OverviewItem>
              </div>
            </Panel>

            {/* Financial summary */}
            <Panel className='px-5 py-4'>
              <PanelTitle icon={LuCreditCard}>Financial Summary</PanelTitle>
              <div className='mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.1fr_2fr]'>
                <FinanceTile
                  label='Total Amount'
                  value={money(booking.totalPrice)}
                  icon={LuBanknote}
                  tone='bg-[#EEF0FF] text-[#4F46E5]'
                />
                <FinanceTile
                  label='Deposit Paid'
                  value={money(booking.depositPaid)}
                  icon={LuWallet}
                  tone='bg-emerald-50 text-emerald-600'
                />
                <FinanceTile
                  label='Balance Due'
                  value={money(booking.balanceDue)}
                  icon={LuHandCoins}
                  tone='bg-orange-50 text-orange-500'
                />
                <FinanceTile
                  label='Payment Status'
                  value={titleCase(booking.status)}
                  icon={LuCircleCheck}
                  tone='bg-emerald-50 text-emerald-600'
                />
                <div className='flex flex-col justify-center px-3 py-2 sm:col-span-2 xl:col-span-1'>
                  <div className='flex items-center justify-between text-xs'>
                    <span className='font-medium text-[#0F1B4C]'>
                      Payment Progress
                    </span>
                    <span className='font-medium text-[#0F1B4C]'>
                      {paymentProgress}%
                    </span>
                  </div>
                  <div className='mt-3 h-2 overflow-hidden rounded-full bg-[#EEF1F8]'>
                    <div
                      className='h-full rounded-full bg-emerald-500'
                      style={{ width: `${paymentProgress}%` }}
                    />
                  </div>
                  <p className='mt-3 text-[11px] text-[#6B7394]'>
                    {money(booking.depositPaid)} of {money(booking.totalPrice)}{" "}
                    paid
                  </p>
                </div>
              </div>
            </Panel>

            {/* Travel itinerary */}
            <Panel className='px-5 py-4'>
              <PanelTitle
                icon={LuClipboardList}
                right={
                  booking.fdPackageId && (
                    <Link
                      to={`/admin/catalog/fd-packages/${booking.fdPackageId}`}
                      className='inline-flex items-center gap-2 rounded-lg border border-[#D9DEEF] px-3 py-2 text-xs font-medium text-[#4F46E5] hover:border-[#4F46E5]'
                    >
                      View Full Itinerary <LuExternalLink size={14} />
                    </Link>
                  )
                }
              >
                Travel Itinerary
              </PanelTitle>
              <div className='mt-3'>
                {itinerary.length ? (
                  itinerary.map((day, index) => (
                    <ItineraryDay
                      key={day.dayNumber || index}
                      day={day}
                      index={index}
                      dayDate={addDays(booking.departureDate, index)}
                      hotel={dayHotels[index]}
                      isLast={index === itinerary.length - 1}
                    />
                  ))
                ) : (
                  <p className='py-6 text-center text-sm text-[#6B7394]'>
                    No itinerary available for this booking.
                  </p>
                )}
              </div>
            </Panel>
          </main>

          <aside className='space-y-4'>
            {/* Booking summary */}
            <Panel className='px-5 py-4'>
              <PanelTitle icon={LuBookmark}>Booking Summary</PanelTitle>
              <div className='mt-3 border-t border-[#EEF1F8] pt-3'>
                <SummaryRow label='Booking ID'>{bookingCode}</SummaryRow>
                <SummaryRow label='Status'>
                  <StatusPill status={booking.status} />
                </SummaryRow>
                <SummaryRow label='Package'>{packageTitle}</SummaryRow>
                <SummaryRow label='Destination'>{destination}</SummaryRow>
                <SummaryRow label='Departure Date'>
                  {date(booking.departureDate)}
                </SummaryRow>
                <SummaryRow label='Travellers'>{travellersLabel}</SummaryRow>
                <SummaryRow label='Total Nights'>
                  {totalDays ? `${totalNights} Nights` : "—"}
                </SummaryRow>
                <SummaryRow label='Created On'>
                  {date(booking.createdAt)}
                </SummaryRow>
                <SummaryRow label='Created Via'>{createdVia}</SummaryRow>
              </div>
            </Panel>

            {/* Payment summary */}
            <Panel className='px-5 py-4'>
              <PanelTitle icon={LuCreditCard}>Payment Summary</PanelTitle>
              <div className='mt-3 border-t border-[#EEF1F8] pt-3 [&>div]:py-[7px]'>
                <SummaryRow label='Total Amount'>
                  <span className='text-[15px] font-bold'>
                    {money(booking.totalPrice)}
                  </span>
                </SummaryRow>
                <SummaryRow label='Deposit Paid'>
                  <span className='text-[15px] font-bold text-emerald-600'>
                    {money(booking.depositPaid)}
                  </span>
                </SummaryRow>
                <SummaryRow label='Balance Due'>
                  <span className='text-[15px] font-bold'>
                    {money(booking.balanceDue)}
                  </span>
                </SummaryRow>
                <SummaryRow label='Balance Due Date'>
                  {booking.balanceDueDate ? date(booking.balanceDueDate) : "-"}
                </SummaryRow>
                <SummaryRow label='Payment Status'>
                  <StatusPill status={booking.status} />
                </SummaryRow>
              </div>
            </Panel>

            {/* Agency / agent */}
            <Panel className='px-5 py-4'>
              <PanelTitle icon={LuUsers}>Agency / Agent</PanelTitle>
              <div className='mt-3 flex items-center gap-3 border-t border-[#EEF1F8] pt-3'>
                <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EEF0FF] text-base font-bold text-[#4F46E5]'>
                  {initials(agencyName)}
                </div>
                <strong className='min-w-0 flex-1 truncate text-base text-[#0F1B4C]'>
                  {agencyName}
                </strong>
                {agency?.status && (
                  <span className='rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700'>
                    {titleCase(
                      agency.status === "approved" ? "active" : agency.status
                    )}
                  </span>
                )}
              </div>
              <div className='mt-3'>
                <SummaryRow label='Contact Person'>{contactPerson}</SummaryRow>
                <SummaryRow label='Email'>
                  {agencyEmail && (
                    <a
                      href={`mailto:${agencyEmail}`}
                      className='break-all text-[#4F46E5] hover:underline'
                    >
                      {agencyEmail}
                    </a>
                  )}
                </SummaryRow>
                <SummaryRow label='Phone'>
                  {agency?.phone && (
                    <a
                      href={`tel:${agency.phone}`}
                      className='text-[#4F46E5] hover:underline'
                    >
                      {agency.phone}
                    </a>
                  )}
                </SummaryRow>
              </div>
              {booking.agencyId && (
                <Link
                  to={`/admin/manage-agents/${booking.agencyId}`}
                  className='mt-2 inline-flex items-center gap-2 text-[13px] font-medium text-[#4F46E5] hover:underline'
                >
                  View Agency Profile <LuArrowRight size={14} />
                </Link>
              )}
            </Panel>

            {/* Quick actions */}
            <Panel className='px-5 py-4'>
              <PanelTitle icon={LuZap}>Quick Actions</PanelTitle>
              <div className='mt-3 space-y-2'>
                {[
                  booking.agencyId && {
                    label: "View Agency",
                    icon: LuBuilding2,
                    to: `/admin/manage-agents/${booking.agencyId}`,
                  },
                  booking.fdPackageId && {
                    label: "View Package",
                    icon: LuPackage,
                    to: `/admin/catalog/fd-packages/${booking.fdPackageId}`,
                  },
                  { label: "Send Payment Reminder", icon: LuSend },
                ]
                  .filter(Boolean)
                  .map(({ label, icon: Icon, to }) => {
                    const className =
                      "flex w-full items-center justify-between rounded-lg border border-[#E4E8F4] px-4 py-2.5 text-left text-xs font-medium text-[#0F1B4C] hover:border-[#4F46E5]";
                    const content = (
                      <>
                        <span className='flex items-center gap-3'>
                          <Icon size={16} className='text-[#4F46E5]' />
                          {label}
                        </span>
                        <LuChevronRight size={15} className='text-[#4F46E5]' />
                      </>
                    );
                    return to ? (
                      <Link key={label} to={to} className={className}>
                        {content}
                      </Link>
                    ) : (
                      <button key={label} type='button' className={className}>
                        {content}
                      </button>
                    );
                  })}
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    </div>
  );
}
