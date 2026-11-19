import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LuGift,
  LuFootprints,
  LuBriefcase,
  LuCar,
  LuPlaneTakeoff,
  LuPlaneLanding,
  LuChevronDown,
  LuWallet,
  LuFileText,
  LuCalendarDays,
  LuMapPin,
  LuMap,
  LuPlane,
  LuTag,
  LuShieldCheck,
  LuUtensils,
  LuShield,
  LuBanknote,
  LuCircleCheck,
  LuTrash2,
  LuSearch,
  LuX,
  LuCirclePlus,
  LuArrowLeft,
  LuArrowRight,
  LuBox,
  LuCalendarCheck,
  LuCalendarRange,
  LuCheck,
  LuCrown,
  LuImage,
  LuListChecks,
  LuLoaderCircle,
  LuMapPinned,
  LuPencil,
  LuPlus,
  LuStar,
  LuTreePalm,
  LuUsers,
  LuAlarmClock,
  LuBinoculars,
  LuChevronLeft,
  LuChevronRight,
  LuClock,
  LuHotel,
  LuLayoutGrid,
  LuNotebookPen,
  LuSearchX,
  LuSparkles,
} from "react-icons/lu";
import { api, getAccessToken } from "../api/client.js";
import ConfirmDialog from "../../shared/components/ConfirmDialog.jsx";
import { useToast } from "../../shared/components/ToastProvider.jsx";
import { getApiBaseUrl } from "../../shared/api/backendUrl.js";
import { readablePath } from "../../shared/api/createApiClient.js";
import {
  Button,
  Card,
  Checkbox,
  Select,
  Textarea,
  TextInput,
} from "../components/ui.jsx";
import { ImageUpload } from "../../shared/components/ImageUpload.jsx";
import {
  RichTextDisplay,
  RichTextEditor,
} from "../../shared/components/RichTextEditor.jsx";
import {
  InclusionExclusionList,
  itineraryHasItemType,
  linesFromText,
  textFromLines,
} from "../components/InclusionExclusionList.jsx";
import {
  formatCurrency,
  formatTime,
  parseDurationDays,
} from "../../shared/fdPackage/index.js";
import {
  BASELINE_PAX,
  rowPerPaxPrice,
  vehiclePerPersonPrice,
  vehiclePricesFromRow,
} from "../../shared/tourPricing.js";
import { tourPriceSummary } from "../../shared/components/TourVehiclePriceTable.jsx";
import { Money } from "../../shared/components/Money.jsx";
import { formatOmr } from "../../shared/currency.js";
import {
  ITINERARY_ITEM_TYPE_META,
  deserializeItinerary,
  itemsForDay,
  itineraryItemKey,
  updateItineraryItemNote,
} from "../../shared/itinerary/index.js";

// The backend's validateBody() middleware already returns a human-readable
// `message` (e.g. "Rate gold must be a valid number"). This is a fallback for
// endpoints/errors that only carry the raw zod { fieldErrors } shape, so the
// admin never just sees "Request failed (400)".
function describeApiError(err) {
  if (err.message) return err.message;
  const fieldErrors = err.data?.details?.fieldErrors;
  if (fieldErrors && Object.keys(fieldErrors).length) {
    return Object.entries(fieldErrors)
      .map(([field, messages]) => `${field}: ${messages[0]}`)
      .join("; ");
  }
  return "Something went wrong. Please try again.";
}

function HeroImageUpload({ packageId, value, onUploaded }) {
  async function upload(file) {
    const formData = new FormData();
    formData.append("image", file);
    const { fdPackage } = await api.postForm(
      `/admin/fd-packages/${packageId}/hero-image`,
      formData
    );
    return fdPackage.heroImageUrl;
  }

  return (
    <ImageUpload
      label='Hero Image'
      description='This will be the main image for the package'
      layout='stacked'
      wrapperClassName=''
      required
      value={value}
      onChange={onUploaded}
      onUpload={upload}
      disabled={!packageId}
      disabledHint='Setting up…'
    />
  );
}

// Mandatory gallery size for an FD package's own carousel — enforced here
// (the hint below) and again in handlePublish's findCarouselImagesError, the
// same "frontend-only gate checked again right before Publish" pattern
// findItineraryPublishError already uses for the day-by-day itinerary.
const MIN_CAROUSEL_IMAGES = 4;

function CarouselImagesUpload({ packageId, images, onChange }) {
  async function upload(files) {
    const formData = new FormData();
    files.forEach((file) => formData.append("images", file));
    const { fdPackage } = await api.postForm(
      `/admin/fd-packages/${packageId}/images`,
      formData
    );
    return fdPackage.images;
  }

  async function remove(url) {
    const { fdPackage } = await api.post(`/admin/fd-packages/${packageId}/images/remove`, { url });
    onChange(fdPackage.images);
  }

  return (
    <ImageUpload
      label='Carousel Images'
      description={`Add multiple images to showcase the package (at least ${MIN_CAROUSEL_IMAGES} images)`}
      layout='stacked'
      wrapperClassName=''
      required
      multiple
      value={images}
      onChange={onChange}
      onUpload={upload}
      onRemove={remove}
      disabled={!packageId}
      disabledHint='Setting up…'
      hint={
        images.length < MIN_CAROUSEL_IMAGES
          ? `Upload at least ${MIN_CAROUSEL_IMAGES} images (${images.length}/${MIN_CAROUSEL_IMAGES} so far). The first image is used as the primary listing photo.`
          : undefined
      }
    />
  );
}

// Task 2 (spacing) — short text fields (Title/Duration/Suitable age/Theme/
// Short description) are grouped into their own compact grid first, and the
// two image dropzones (naturally tall) are grouped into a second grid below
// them — previously Theme sat next to Hero Image in the same grid row,
// which forced Theme's cell to stretch to the dropzone's full height and
// left a big empty gap under the theme tags. No field was removed, only
// reordered/regrouped.
function BasicsForm({ form, update, packageId, categories, onAddCategory, onDeleteCategory }) {
  const [open, setOpen] = useState(true);
  const [mediaOpen, setMediaOpen] = useState(true);
  const [categoryOpen, setCategoryOpen] = useState(false);
  return (
    <>
      <CollapsibleSection
        icon={LuFileText}
        title='Basics'
        description='Enter the basic information about this package'
        open={open}
        onToggle={() => setOpen((o) => !o)}
      >
        <div className='grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2'>
          <div className='md:col-span-2'>
            <FieldLabel required>Title</FieldLabel>
            <TextInput
              placeholder='Enter package title (e.g. Majestic Muscat City Tour)'
              value={form.title || ""}
              onChange={(e) => update("title", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel required>Duration (days)</FieldLabel>
            <IconField icon={LuCalendarDays}>
              <TextInput
                type='number'
                min='1'
                className='pl-10'
                placeholder='Enter number of days'
                value={form.duration || ""}
                onChange={(e) => update("duration", e.target.value)}
              />
            </IconField>
          </div>
          <div>
            <FieldLabel>Suitable age (min)</FieldLabel>
            <IconField icon={LuUsers}>
              <TextInput
                type='number'
                className='pl-10'
                placeholder='Enter minimum age'
                value={form.suitableAgeMin || ""}
                onChange={(e) => update("suitableAgeMin", Number(e.target.value))}
              />
            </IconField>
          </div>
          <div>
            <FieldLabel required>Category</FieldLabel>
            <div className='relative'>
              <button
                type='button'
                className='flex w-full items-center justify-between rounded-md border border-[#D7DDF0] bg-[#FAFBFF] px-3.5 py-3 text-left text-sm text-ink shadow-sm transition hover:border-[#A5B4FC] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/15'
                onClick={() => setCategoryOpen((value) => !value)}
              >
                <span className={form.category ? 'text-ink' : 'text-[#94A3B8]'}>{form.category || 'Select category'}</span>
                <LuChevronDown size={16} className={`flex-none text-muted transition-transform ${categoryOpen ? 'rotate-180' : ''}`} />
              </button>
              {categoryOpen && <div className='absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-[#E4E9FB] bg-white shadow-lg'>
                <button type='button' className='flex w-full items-center gap-1.5 border-b border-[#E4E9FB] px-3 py-2.5 text-left text-sm font-semibold text-accent hover:bg-panel' onClick={() => { setCategoryOpen(false); onAddCategory(); }}><LuPlus size={14} />Create new category</button>
                {categories.map((category) => <div key={category} className={`flex items-center border-b border-[#EEF1FA] last:border-0 hover:bg-panel ${form.category === category ? 'bg-[#F5F7FF]' : ''}`}>
                  <button type='button' className='flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left text-sm text-ink' onClick={() => { update('category', category); setCategoryOpen(false); }}>
                    {category}
                    {form.category === category && <LuCheck size={14} className='flex-none text-accent' />}
                  </button>
                  <button type='button' aria-label={`Delete ${category}`} className='mr-2 flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-rose-50 hover:text-rose-600' onClick={() => onDeleteCategory(category)}><LuTrash2 size={14} /></button>
                </div>)}
                {!categories.length && <p className='px-3 py-2 text-xs text-muted'>No categories yet.</p>}
              </div>}
            </div>
          </div>
          <div className='md:col-span-2'>
            <FieldLabel>Short description</FieldLabel>
            <RichTextEditor
              size='sm'
              value={form.shortDescription || ""}
              onChange={(html) => update("shortDescription", html)}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Hero + carousel side by side on desktop (stacked below lg) — the
          upload mechanics themselves (ImageUpload) are unchanged. */}
      <CollapsibleSection
        icon={LuImage}
        title='Media'
        description='Add hero image and carousel images for this package'
        open={mediaOpen}
        onToggle={() => setMediaOpen((o) => !o)}
      >
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8'>
          <HeroImageUpload
            packageId={packageId}
            value={form.heroImageUrl}
            onUploaded={(url) => update("heroImageUrl", url)}
          />
          {/* images (carousel) now lives in `form` like every other field —
              previously it had its own parallel `images` state that never
              synced back into `form`, so clicking Save/Publish afterward sent
              a stale `form.images` in the PATCH body and silently overwrote
              the images the upload endpoint had already saved to the DB. */}
          <CarouselImagesUpload
            packageId={packageId}
            images={form.images || []}
            onChange={(imgs) => update("images", imgs)}
          />
        </div>
      </CollapsibleSection>
    </>
  );
}

// Net rate per pax is auto-calculated live from what's placed in the
// day-by-day itinerary above (hotel nights + tours + transfers + extras —
// see computeItineraryNetRate/computeNetRatePerPax) plus any meals selected
// just below it, as soon as either changes — no need to click "Save
// Itinerary" first. Admin can still set a specific sell price via Edit; that
// override is saved with the rest of the form (Save as Draft / Publish) and
// takes over from the computed value until "Reset to automatic" clears it.
// Deposit amount and balance-due lead time are no longer package-level
// settings either — every booking now uses a fixed lead time server-side.
function PricingForm({ form, update, computedRatePerPax }) {
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(true);
  // Readymade packages have no manual pricing: the rate is always computed
  // from the itinerary, and the vehicle (hence price) follows the group size.
  const isReadymade = form.type === "readymade";
  const isOverridden = !isReadymade && form.ratePerPax != null;
  const effective = isOverridden ? form.ratePerPax : computedRatePerPax;

  return (
    <CollapsibleSection
      icon={LuBanknote}
      title='Pricing'
      description='Set the pricing details for this package'
      open={open}
      onToggle={() => setOpen((o) => !o)}
    >
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-[#E4E9FB]'>
        <div className='lg:pr-8'>
          <FieldLabel>Net rate (per pax)</FieldLabel>
          {editing && !isReadymade ? (
            <div className='flex items-center gap-2'>
              <TextInput
                type='number'
                step='0.001'
                className='max-w-xs'
                autoFocus
                placeholder='From itinerary'
                value={form.ratePerPax ?? ""}
                onChange={(e) =>
                  update(
                    "ratePerPax",
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
              />
              <Button className='h-11 gap-1.5' onClick={() => setEditing(false)}>
                <LuCheck size={14} />
                Done
              </Button>
            </div>
          ) : (
            <div className='flex flex-wrap items-center gap-3'>
              <div className='flex min-h-[58px] w-full max-w-xs items-center rounded-lg border border-[#D7DDF0] bg-[#FAFBFF] px-4 py-2 text-base font-bold text-ink'>
                {effective != null ? <Money amount={effective} /> : "—"}
              </div>
              {!isReadymade && (
                <Button
                  className='h-10 gap-1.5 border-[#C7D2FE] text-[#4F46E5]'
                  onClick={() => setEditing(true)}
                >
                  <LuPencil size={14} />
                  Edit
                </Button>
              )}
              {isOverridden && (
                <button
                  type='button'
                  className='text-[11px] text-muted underline hover:text-ink'
                  onClick={() => update("ratePerPax", null)}
                >
                  Reset to automatic
                </button>
              )}
            </div>
          )}
          <p className='mt-2 text-[11px] text-muted'>
            {isOverridden
              ? "Manually set — saved with the rest of this form."
              : isReadymade
              ? "Calculated automatically from the itinerary. The vehicle, and so the price, is chosen from the number of people the agent books for."
              : "Calculated automatically from the itinerary and meals above."}
          </p>
        </div>

        <div className='lg:pl-8'>
          {effective != null && (
            <>
              <FieldLabel>Price with platform fee (per pax)</FieldLabel>
              <div className='flex min-h-[58px] w-full max-w-xs items-center rounded-lg border border-[#C7D2FE] bg-[#F5F7FF] px-4 py-2 text-base font-bold text-[#3730A3]'>
                <Money
                  amount={
                    Math.round(
                      Number(effective) * (1 + Number(form.platformFeeApplied || 0) / 100) * 100
                    ) / 100
                  }
                />
              </div>
              <p className='mt-2 text-xs font-medium text-[#334155]'>
                {Number(form.platformFeeApplied) > 0
                  ? `Includes the ${Number(form.platformFeeApplied)}% platform fee. This is the rate agents see.`
                  : "No platform fee applies to this package, so this matches the net rate."}
              </p>
            </>
          )}
          {!isOverridden && (
            <p className='mt-2 text-[11px] leading-relaxed text-muted'>
              Tours are priced per person by vehicle (vehicle price ÷ capacity), so they're included here at the{" "}
              {BASELINE_PAX}-traveller rate. Agents see the rate for their actual
              group size when booking.
            </p>
          )}
        </div>
      </div>
    </CollapsibleSection>
  );
}

// Brought back — the master "Add-ons" toggle used to live here (pre-Task-5),
// then was removed on the theory that Add-ons & Inclusions being opt-in per
// item made a master switch redundant. Restored as the same frontend-only,
// non-persisted gate it always was (addonsEnabled/onToggleAddons — see
// FdPackageEditor's own state), seeded from whether this package already has
// any addons on load: it only hides/shows the priced Activities/Tours/
// Transfers/Onward/Return Flights cards inside AddonsManager (and the total
// summary bar under them) — never deletes anything, and never touches Visa/
// Meals, which stay visible either way since those are plain package
// inclusions, not "priced add-ons" the way this toggle was ever scoped to.
function MerchandisingForm({ form, update, addonsEnabled, onToggleAddons }) {
  const [open, setOpen] = useState(true);
  return (
    <CollapsibleSection
      icon={LuTag}
      title='Merchandising & discovery attributes'
      description='Set attributes to highlight this package'
      className='h-full'
      open={open}
      onToggle={() => setOpen((o) => !o)}
    >
      <div className='space-y-1.5'>
        <OptionCheckbox
          checked={!!form.isFeatured}
          onChange={(v) => update("isFeatured", v)}
          icon={LuCrown}
          iconClassName='text-amber-500'
          label='Mark as Featured / Highly Recommended'
          hint='Show this package as a featured recommendation'
        />
        <OptionCheckbox
          checked={!!form.isBestseller}
          onChange={(v) => update("isBestseller", v)}
          icon={LuStar}
          iconClassName='text-amber-500'
          label='Mark as Bestseller'
          hint='Highlight this package as a bestseller'
        />
        <OptionCheckbox
          checked={addonsEnabled}
          onChange={onToggleAddons}
          icon={LuBox}
          iconClassName='text-[#2563EB]'
          label='Add-ons'
          hint='This package has optional add-ons'
        />
      </div>
    </CollapsibleSection>
  );
}

// Sentinel option value that switches the Location field from the picklist
// select into a free-text input — never collides with a real location name
// since it can't come back out of GET /departure-locations.
const NEW_LOCATION_OPTION = "__new_location__";

function DepartureDatesManager({ fdPackageId, dates, onChange }) {
  const toast = useToast();
  const [date, setDate] = useState("");
  const [seatsTotal, setSeatsTotal] = useState(20);
  const [location, setLocation] = useState("");
  const [locations, setLocations] = useState([]);
  // true once "+ Enter a new location…" has been picked — swaps the Select
  // below for a plain text field instead.
  const [customLocation, setCustomLocation] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    api
      .get("/departure-locations")
      .then((d) => setLocations(d.locations || []));
  }, []);

  function handleLocationSelect(e) {
    if (e.target.value === NEW_LOCATION_OPTION) {
      setCustomLocation(true);
      setLocation("");
    } else {
      setLocation(e.target.value);
    }
  }

  function backToLocationList() {
    setCustomLocation(false);
    setLocation("");
  }

  async function add() {
    if (!date) return;
    const trimmedLocation = location.trim();
    if (!trimmedLocation) {
      toast.error("Select a location for this departure date.");
      return;
    }
    if (!seatsTotal || seatsTotal <= 0) {
      toast.error("Seats must be at least 1.");
      return;
    }
    let finalLocation = trimmedLocation;
    // A freshly-typed location isn't just used for this one departure date —
    // it's saved into the master list too (POST /departure-locations,
    // upsert-by-name — see locations.model.js), so it shows up in the
    // dropdown for every future departure date from here on, not only this
    // package. Skipped when the admin picked an existing option, since
    // that's already in the list.
    if (customLocation) {
      try {
        const { location: saved } = await api.post("/departure-locations", {
          name: trimmedLocation,
        });
        finalLocation = saved.name;
        setLocations((list) =>
          list.some((l) => l.id === saved.id)
            ? list
            : [...list, saved].sort((a, b) => a.name.localeCompare(b.name))
        );
      } catch (err) {
        toast.error(err.message || "Unable to save new location");
        return;
      }
    }
    try {
      const { departureDate } = await api.post(
        `/admin/fd-packages/${fdPackageId}/departure-dates`,
        {
          date,
          seatsTotal,
          location: finalLocation,
        }
      );
      onChange([...dates, departureDate]);
      setDate("");
      setLocation("");
      setCustomLocation(false);
    } catch (err) {
      toast.error(err.message || "Unable to add departure date");
    }
  }

  async function remove(id) {
    await api.del(`/admin/fd-packages/${fdPackageId}/departure-dates/${id}`);
    onChange(dates.filter((d) => d.id !== id));
  }

  return (
    <CollapsibleSection
      icon={LuCalendarDays}
      title='Departure dates & inventory'
      description='Add departure dates, location and available seats'
      open={open}
      onToggle={() => setOpen((o) => !o)}
    >
      <div className='rounded-lg border border-[#E4E9FB]'>
        <div className={`hidden gap-3 rounded-t-lg bg-[#F8FAFF] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#4F46E5] md:grid ${DEPARTURE_GRID}`}>
          <div>Date</div>
          <div>Location *</div>
          <div>Seats *</div>
          <div />
        </div>

        {dates.map((d) => (
          <div
            key={d.id}
            className={`grid grid-cols-1 items-center gap-1.5 border-t border-[#EEF1FA] px-4 py-3 text-sm first:border-t-0 md:gap-3 ${DEPARTURE_GRID}`}
          >
            <div className='flex items-center gap-2 font-semibold text-ink'>
              <LuCalendarCheck size={15} className='flex-none text-[#4F46E5]' />
              {new Date(d.date).toLocaleDateString()}
            </div>
            <div className='flex items-center gap-1.5 text-[#334155]'>
              <LuMapPin size={14} className='flex-none text-muted' />
              {d.location || "—"}
            </div>
            <div className='text-[#334155]'>
              {d.seats_booked ?? d.seatsBooked ?? 0} /{" "}
              {d.seats_total ?? d.seatsTotal}
              <span className='ml-1 text-xs text-muted'>booked</span>
            </div>
            <div className='md:text-right'>
              <button
                type='button'
                onClick={() => remove(d.id)}
                className='inline-flex items-center gap-1.5 rounded-md border border-[#FECACA] px-2.5 py-1.5 text-xs font-semibold text-[#B91C1C] transition hover:border-[#F87171] hover:bg-[#FEF2F2]'
              >
                <LuTrash2 size={13} />
                Remove
              </button>
            </div>
          </div>
        ))}

        <div className={`grid grid-cols-1 items-start gap-3 border-t border-[#E4E9FB] px-4 py-3 ${dates.length ? 'bg-[#FCFDFF]' : ''} ${DEPARTURE_GRID}`}>
          <div>
            <span className='mb-1 block text-[11px] font-semibold uppercase text-muted md:hidden'>Date</span>
            <TextInput
              type='date'
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <span className='mb-1 block text-[11px] font-semibold uppercase text-muted md:hidden'>Location *</span>
            {customLocation ? (
              <div>
                <TextInput
                  autoFocus
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder='Enter new location'
                />
                <button
                  type='button'
                  onClick={backToLocationList}
                  className='mt-1 whitespace-nowrap text-[11px] text-muted underline hover:text-ink'
                >
                  Choose from list
                </button>
              </div>
            ) : (
              <Select value={location} onChange={handleLocationSelect}>
                <option value=''>Select location…</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.name}>
                    {loc.name}
                  </option>
                ))}
                <option value={NEW_LOCATION_OPTION}>
                  + Enter a new location…
                </option>
              </Select>
            )}
          </div>
          <div>
            <span className='mb-1 block text-[11px] font-semibold uppercase text-muted md:hidden'>Seats *</span>
            <TextInput
              type='number'
              min='1'
              value={seatsTotal}
              onChange={(e) => setSeatsTotal(Number(e.target.value))}
            />
          </div>
          <Button
            onClick={add}
            disabled={!date || !location || !seatsTotal}
            className='h-[46px] w-full gap-1.5 border-[#C7D2FE] text-sm text-[#4F46E5]'
          >
            <LuPlus size={16} />
            Add departure date
          </Button>
        </div>
      </div>
    </CollapsibleSection>
  );
}

// Shared column template for the departure-dates header, rows and add row.
const DEPARTURE_GRID =
  "md:grid-cols-[minmax(150px,1fr)_minmax(200px,2fr)_minmax(110px,1fr)_200px]";

// Package type tabs — the two kinds of package this editor builds:
//   - "FD Package" (the default): dated Fixed Departures with seat inventory,
//     exactly the editor as it has always been;
//   - "Readymade Package": no departure dates or seats; it departs from all
//     cities or a chosen list (ReadymadeCitiesSection below).
// The type is saved as soon as a tab is picked (not through the ~1s autosave,
// so a stale pending autosave can't flip it back), and only a draft can
// change type — once published, the tabs are locked.
const PACKAGE_TYPES = [
  { value: "fd_package", label: "FD Package", icon: LuGift },
  { value: "readymade", label: "Readymade Package", icon: LuCalendarRange },
];

function PackageTypeTabs({ type, locked, onChange }) {
  return (
    <div className='flex flex-col items-start lg:items-end'>
      <div
        role='tablist'
        aria-label='Package type'
        className='inline-flex gap-1 rounded-xl border border-[#E4E9FB] bg-white p-1.5 shadow-sm'
      >
        {PACKAGE_TYPES.map((t) => {
          const active = type === t.value;
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              type='button'
              role='tab'
              aria-selected={active}
              disabled={locked && !active}
              onClick={() => onChange(t.value)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]/40 sm:px-5 ${
                active
                  ? "bg-[#4F46E5] text-white shadow-md shadow-[#4F46E5]/25"
                  : "text-[#334155] hover:bg-[#F3F4FF] hover:text-[#4F46E5] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-[#334155]"
              }`}
            >
              <Icon size={16} className='flex-none' />
              {t.label}
            </button>
          );
        })}
      </div>
      {locked && (
        <p className='mt-1.5 text-[11px] text-muted'>
          The package type is locked once a package is published.
        </p>
      )}
    </div>
  );
}

// Readymade packages replace the dated "Departure dates & inventory" section
// with where the package departs from: tick "All cities", or leave it off and
// tick one or more cities from the master list (GET /departure-locations —
// the same cities FD departure dates pick from; a missing one can be added
// here and joins that list). Publishing needs All cities or at least one
// city (checked by handlePublish, and again by the backend).
function ReadymadeCitiesSection({ form, update }) {
  const toast = useToast();
  const [locations, setLocations] = useState([]);
  const [open, setOpen] = useState(true);
  const [newCity, setNewCity] = useState("");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [pendingCityDelete, setPendingCityDelete] = useState(null);
  const [deletingCity, setDeletingCity] = useState(false);
  const selected = Array.isArray(form.departureCities) ? form.departureCities : [];

  useEffect(() => {
    api
      .get("/departure-locations")
      .then((d) => setLocations(d.locations || []))
      .catch(() => {});
  }, []);

  // A saved city that's no longer in the master list still shows (and can be
  // unticked) rather than silently disappearing.
  const names = [...new Set([...locations.map((l) => l.name), ...selected])].sort((a, b) =>
    a.localeCompare(b)
  );

  function toggleCity(name, checked) {
    update(
      "departureCities",
      checked ? [...selected, name] : selected.filter((c) => c !== name)
    );
  }

  function deleteCity(name) {
    const location = locations.find((item) => item.name === name);
    if (location) setPendingCityDelete(location);
  }

  async function confirmDeleteCity() {
    if (!pendingCityDelete) return;
    const { id, name } = pendingCityDelete;
    setDeletingCity(true);
    try {
      await api.del(`/departure-locations/${id}`);
      setLocations((list) => list.filter((item) => item.id !== id));
      if (selected.includes(name)) update("departureCities", selected.filter((city) => city !== name));
    } catch (err) {
      toast.error(err.message || "Unable to delete this city");
    } finally {
      setDeletingCity(false);
      setPendingCityDelete(null);
    }
  }

  async function addCity() {
    const name = newCity.trim();
    if (!name) return;
    setAdding(true);
    try {
      const { location: saved } = await api.post("/departure-locations", { name });
      setLocations((list) =>
        list.some((l) => l.id === saved.id) ? list : [...list, saved]
      );
      if (!selected.includes(saved.name)) update("departureCities", [...selected, saved.name]);
      setNewCity("");
    } catch (err) {
      toast.error(err.message || "Unable to add this city");
    } finally {
      setAdding(false);
    }
  }

  const needsSelection = !form.allCities && selected.length === 0;
  const q = search.trim().toLowerCase();
  const visible = q ? names.filter((n) => n.toLowerCase().includes(q)) : names;

  return (
    <>
      <CollapsibleSection
        icon={LuMapPin}
        title='Departure cities'
        description='Choose the cities this package departs from'
        open={open}
        onToggle={() => setOpen((o) => !o)}
      >
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <Checkbox
          checked={!!form.allCities}
          onChange={(v) => {
            update("allCities", v);
            if (v) update("departureCities", []);
          }}
          label='All cities'
          hint='Offer this package from every departure city.'
        />
        {!form.allCities && (
          <div className='relative w-full sm:w-72'>
            <LuSearch
              size={15}
              className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted'
            />
            <TextInput
              className='pl-9'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search cities...'
            />
          </div>
        )}
      </div>

      {!form.allCities && (
        <div className='mt-3'>
          {names.length === 0 ? (
            <p className='text-xs text-muted'>
              No cities yet — add the first one below.
            </p>
          ) : (
            <div className='max-h-64 overflow-y-auto rounded-lg border border-line-light bg-panel/40 p-2'>
              {visible.length === 0 ? (
                <p className='p-2 text-xs text-muted'>No city matches that search.</p>
              ) : (
                <div className='grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4'>
                  {visible.map((name) => {
                    const on = selected.includes(name);
                    return (
                      <label
                        key={name}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                          on
                            ? "border-accent/40 bg-accent-soft font-medium text-ink"
                            : "border-line-light bg-white text-ink hover:border-accent/30"
                        }`}
                      >
                        <input
                          type='checkbox'
                          className='h-4 w-4 flex-shrink-0 accent-[var(--color-accent,#6d28d9)]'
                          checked={on}
                          onChange={(e) => toggleCity(name, e.target.checked)}
                        />
                        <span className='truncate'>{name}</span>
                        <button
                          type='button'
                          aria-label={`Delete ${name}`}
                          className='ml-auto flex h-6 w-6 flex-none items-center justify-center rounded text-rose-500 transition hover:bg-rose-50 hover:text-rose-700'
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            deleteCity(name);
                          }}
                        >
                          <LuTrash2 size={14} />
                        </button>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className='mt-4 flex items-center justify-between'>
            <FieldLabel>Selected cities ({selected.length})</FieldLabel>
            {selected.length > 0 && (
              <button
                type='button'
                className='text-xs font-semibold text-accent hover:underline'
                onClick={() => update("departureCities", [])}
              >
                Clear all
              </button>
            )}
          </div>
          {selected.length === 0 ? (
            <p
              className={`text-xs ${
                needsSelection ? "font-semibold text-[#9a5a16]" : "text-muted"
              }`}
            >
              Select "All cities" or at least one city to publish this package.
            </p>
          ) : (
            <div className='flex flex-wrap gap-2'>
              {selected.map((name) => (
                <span
                  key={name}
                  className='inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent-soft px-2.5 py-1 text-xs font-medium text-ink'
                >
                  {name}
                  <button
                    type='button'
                    aria-label={`Remove ${name}`}
                    className='text-accent hover:opacity-70'
                    onClick={() => toggleCity(name, false)}
                  >
                    <LuX size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className='mt-4 border-t border-line-light pt-3'>
            <FieldLabel>Add a city</FieldLabel>
            <div className='flex items-center gap-2'>
              <div className='relative flex-1'>
                <LuCirclePlus
                  size={16}
                  className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted'
                />
                <TextInput
                  className='pl-9'
                  value={newCity}
                  disabled={adding}
                  onChange={(e) => setNewCity(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCity();
                    }
                  }}
                  placeholder='Type city name and press enter...'
                />
              </div>
            </div>
          </div>
        </div>
      )}
      </CollapsibleSection>

      {pendingCityDelete && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
          <button
            type='button'
            aria-label='Close delete dialog'
            className='fixed inset-0 bg-black/30'
            disabled={deletingCity}
            onClick={() => setPendingCityDelete(null)}
          />
          <div className='relative z-10 w-full max-w-md rounded-xl border border-line-light bg-white p-6 shadow-xl'>
            <h3 className='text-lg font-bold text-ink'>Delete departure city?</h3>
            <p className='mt-2 text-sm text-muted'>
              Are you sure you want to delete{' '}
              <span className='font-semibold text-ink'>“{pendingCityDelete.name}”</span>?
            </p>
            <div className='mt-5 flex justify-end gap-2'>
              <Button
                type='button'
                disabled={deletingCity}
                onClick={() => setPendingCityDelete(null)}
              >
                Cancel
              </Button>
              <Button
                type='button'
                variant='danger'
                disabled={deletingCity}
                onClick={confirmDeleteCity}
              >
                {deletingCity ? 'Deleting…' : 'Yes, delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Day-by-day itinerary builder — mirrors the agent Custom FIT Builder's
// Itinerary step (agent/pages/PackageBuilder.jsx's DayPlanCard): a numbered
// day-timeline where each day picks its own hotel (single-select) plus
// tours/transfers/extras (multi-select) straight from the catalog, instead of
// one free-text line per day. Unlike the agent builder there's no City & Days
// planner step first — an FD package doesn't carry per-package trip dates or
// a multi-city plan the way a Custom FIT quote does, so every day just picks
// from the full catalog.
//
// NOTE: the wire shape this now saves — { dayNumber, notes, items: [{type,
// id, note}] } — matches the Custom FIT itinerary shape already used by
// admin/pages/QuoteInboxDetail.jsx and agent/pages/PackageBuilder.jsx (see
// shared/itinerary/index.js). PUT /admin/fd-packages/:id/itinerary currently
// only accepts/returns the older { dayNumber, description } shape — the
// backend needs updating to accept/persist this richer shape before Save
// Itinerary here round-trips end to end.
// ---------------------------------------------------------------------------

// How long to wait after the admin stops changing Duration before checking
// whether shrinking it just orphaned any day content. Debounced (rather than
// reacting to every keystroke) so typing "10 Days" doesn't briefly check
// against "1 Day" and pop a confirmation.
const DURATION_SYNC_DELAY_MS = 600;

function addItineraryItem(items, { type, id, dayNumber, vehicleKey }) {
  const dayItems = itemsForDay(items, dayNumber);
  const newItem = {
    key: `${itineraryItemKey(
      type,
      id
    )}:${dayNumber}:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    id,
    dayNumber,
    position: dayItems.length,
    note: "",
    ...(vehicleKey ? { vehicleKey } : {}),
  };
  return [...items, newItem];
}

function setItineraryItemVehicle(items, key, vehicleKey) {
  return items.map((it) => (it.key === key ? { ...it, vehicleKey } : it));
}

function removeItineraryItemByKey(items, key) {
  const removing = items.find((it) => it.key === key);
  if (!removing) return items;
  const rest = items.filter((it) => it.key !== key);
  const remainingInDay = itemsForDay(rest, removing.dayNumber).map(
    (it, idx) => ({ ...it, position: idx })
  );
  const others = rest.filter((it) => it.dayNumber !== removing.dayNumber);
  return [...others, ...remainingInDay];
}

// Hotel is single-select per day — choosing a new hotel for a day replaces
// whatever hotel was already there instead of stacking up multiple. No
// occupancy/headcount is captured here anymore (0061_hotel_occupancy_pricing.sql,
// Task 6) — real pax is only known once an agent actually books
// (agent/pages/DepartureDetail.jsx's Traveler Details step), so admin just
// picks the hotel and its per-pax rate is resolved automatically below.
function setHotelForDay(items, dayNumber, hotelId) {
  const withoutOldHotel = items.filter(
    (it) => !(it.dayNumber === dayNumber && it.type === "hotel")
  );
  return addItineraryItem(withoutOldHotel, {
    type: "hotel",
    id: hotelId,
    dayNumber,
  });
}

// Mirrors the backend's resolveHotelPerPaxRate (fdPackages.model.js): a
// hotel's displayed per-pax nightly rate uses its single-occupancy price
// first. It falls back to double (÷2) and then triple (÷3) when a single
// price is not configured. Returns null when none of the three are priced.
const HOTEL_OCCUPANCY_PRIORITY = [
  { field: "single_price", capacity: 1 },
  { field: "double_price", capacity: 2 },
  { field: "triple_price", capacity: 3 },
];

function resolveHotelPerPaxRate(hotel) {
  if (!hotel) return null;
  for (const { field, capacity } of HOTEL_OCCUPANCY_PRIORITY) {
    if (hotel[field] != null) return Number(hotel[field]) / capacity;
  }
  return null;
}

// Mirrors the backend's computeNetRatePerPax (fdPackages.model.js) so the
// "auto" net rate updates live as items are added/removed, without waiting
// on the itinerary autosave or a round trip. `catalogs` is the plural
// {hotels, tours, transfers, activities} shape ItineraryManager already
// fetches; catalog rows come straight off the DB (snake_case), same as the
// backend reads them.
const ITINERARY_CATALOG_KEY = {
  hotel: "hotels",
  tour: "tours",
  transfer: "transfers",
  activity: "activities",
};
// Tours aren't here — they're priced per vehicle by group size, so their
// per-person share is taken at BASELINE_PAX (shared/tourPricing.js), same as
// the backend's computeNetRatePerPax default.
const ITINERARY_PRICE_FIELD = { transfer: "price", activity: "price_per_pax" };

function computeItineraryNetRate(items, catalogs) {
  return items.reduce((total, it) => {
    const list = catalogs[ITINERARY_CATALOG_KEY[it.type]] || [];
    const ref = list.find((c) => c.id === it.id);
    if (!ref) return total;
    if (it.type === "tour")
      return total + rowPerPaxPrice(ref, BASELINE_PAX, it.vehicleKey);
    if (it.type === "hotel") {
      const perPax = resolveHotelPerPaxRate(ref);
      return perPax != null ? total + perPax : total;
    }
    const field = ITINERARY_PRICE_FIELD[it.type];
    return total + (Number(ref[field]) || 0);
  }, 0);
}
const HOTEL_STAR_CATEGORIES = [3, 4, 5];

function HotelStars({ category }) {
  const stars = Number(category) || 0;
  if (!stars) return null;
  return (
    <span className='inline-flex items-center gap-0.5' aria-label={`${stars} star`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <LuStar
          key={i}
          size={12}
          className={i <= stars ? "fill-amber-400 text-amber-400" : "text-[#E2E8F0]"}
        />
      ))}
    </span>
  );
}

// Catalogue descriptions are rich text — strip tags for one-line previews.
function plainText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function Thumb({ url, className = "", icon: Icon = LuImage }) {
  return url ? (
    <img src={url} alt='' className={`object-cover ${className}`} />
  ) : (
    <div
      className={`flex items-center justify-center bg-[#EEF2FF] text-[#A5B4D9] ${className}`}
    >
      <Icon size={20} />
    </div>
  );
}

function tourVehicles(tour) {
  return (vehiclePricesFromRow(tour) || []).filter((v) => Number(v.price) > 0);
}

function transferTypeLabel(type) {
  return type
    ? String(type)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : "";
}

// Display price for a catalogue row — { value, unit } or null. Same sources
// as the net-rate maths above (resolveHotelPerPaxRate, ITINERARY_PRICE_FIELD,
// per-person vehicle prices for tours).
function catalogPrice(type, item) {
  if (!item) return null;
  if (type === "hotel") {
    const rate = resolveHotelPerPaxRate(item);
    return rate != null ? { value: formatOmr(rate), unit: "/ pax / night" } : null;
  }
  if (type === "tour") {
    const vehicles = tourVehicles(item);
    if (vehicles.length) {
      // Readymade tours do not choose a vehicle at booking time. Quote the
      // vehicle price for the smallest supported group.
      const vehicle = vehicles.reduce(
        (lowest, candidate) =>
          !lowest || Number(candidate.minPax) < Number(lowest.minPax)
            ? candidate
            : lowest,
        null
      );
      return {
        value: formatOmr(vehiclePerPersonPrice(vehicle)),
        unit: "/ person",
      };
    }
    return item.price != null ? { value: formatOmr(item.price), unit: "/ pax" } : null;
  }
  const value = item[ITINERARY_PRICE_FIELD[type]];
  return value != null ? { value: formatOmr(value), unit: "/ pax" } : null;
}

function PriceTag({ price, className = "" }) {
  if (!price) return null;
  return (
    <div className={`text-right leading-tight ${className}`}>
      <div className='whitespace-nowrap text-sm font-bold text-ink'>{price.value}</div>
      <div className='text-[11px] text-muted'>{price.unit}</div>
    </div>
  );
}

// Small label above a catalogue item's name (tour category, transfer type).
function categoryOf(type, item) {
  if (!item) return "";
  if (type === "tour") return item.category || "";
  if (type === "transfer") return transferTypeLabel(item.type);
  return "";
}

const CATEGORY_BADGE_TONE = {
  tour: "bg-orange-50 text-orange-600",
  transfer: "bg-violet-50 text-violet-600",
  activity: "bg-sky-50 text-sky-600",
};

function CategoryBadge({ type, children }) {
  if (!children) return null;
  return (
    <span
      className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
        CATEGORY_BADGE_TONE[type] || "bg-slate-100 text-slate-600"
      }`}
    >
      {children}
    </span>
  );
}

function itemFacts(type, item) {
  if (!item) return [];
  const facts = [];
  if (item.city) facts.push({ icon: LuMapPin, text: item.city });
  if ((type === "tour" || type === "activity") && item.duration)
    facts.push({ icon: LuClock, text: item.duration });
  if (type === "transfer" && (item.vehicle_class || item.vehicleClass))
    facts.push({ icon: LuCar, text: item.vehicle_class || item.vehicleClass });
  return facts;
}

function FactRow({ facts, className = "" }) {
  if (!facts.length) return null;
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted ${className}`}>
      {facts.map(({ icon: Icon, text }) => (
        <span key={text} className='inline-flex min-w-0 items-center gap-1'>
          <Icon size={12} className='flex-none' />
          <span className='truncate'>{text}</span>
        </span>
      ))}
    </div>
  );
}

// City + thumbnail for a day — from its hotel first, else the first placed
// item that has one. Used by the day strip and the day overview.
function dayPreview(dayItems, catalogs) {
  const resolve = (it) =>
    (catalogs[ITINERARY_CATALOG_KEY[it.type]] || []).find((c) => c.id === it.id);
  const hotelItem = dayItems.find((it) => it.type === "hotel");
  const rows = [
    hotelItem && resolve(hotelItem),
    ...dayItems.filter((it) => it.type !== "hotel").map(resolve),
  ].filter(Boolean);
  return {
    city: rows.find((r) => r.city)?.city || "",
    image: rows.find((r) => r.images?.[0])?.images[0] || null,
  };
}

// Pop-up shown when a tour is added to a day (or its vehicle is changed): pick
// which of the tour's priced vehicles this tour uses. The package is priced
// with that vehicle's per-person price (vehicle price ÷ max passengers).
function TourVehicleModal({ tour, current, adding, onClose, onConfirm }) {
  const vehicles = (vehiclePricesFromRow(tour) || []).filter((v) => Number(v.price) > 0);
  const [selected, setSelected] = useState(
    vehicles.some((v) => String(v.key) === String(current)) ? String(current) : ""
  );
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      <div className='fixed inset-0 bg-black/30' onClick={onClose} />
      <div className='relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-line-light bg-white p-5 shadow-lg sm:p-6'>
        <div className='mb-1 flex items-start justify-between gap-3'>
          <h3 className='text-lg font-bold text-ink'>Select vehicle</h3>
          <button
            type='button'
            onClick={onClose}
            aria-label='Close'
            className='text-lg leading-none text-muted hover:text-ink'
          >
            ×
          </button>
        </div>
        <p className='mb-3 text-xs text-muted'>
          Which vehicle does <b className='text-ink'>{tour?.name}</b> use in
          this package? The package is priced with this vehicle's per-person
          price.
        </p>
        <div className='space-y-2 overflow-y-auto'>
          {vehicles.map((v) => {
            const active = String(v.key) === selected;
            return (
              <label
                key={v.key}
                className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition ${
                  active
                    ? "border-accent bg-accent-soft/50 ring-1 ring-accent/25"
                    : "border-line-light hover:border-accent/40"
                }`}
              >
                <input
                  type='radio'
                  name='tour-vehicle'
                  className='h-4 w-4 flex-none accent-[#4F46E5]'
                  checked={active}
                  onChange={() => setSelected(String(v.key))}
                />
                <span className='min-w-0 flex-1'>
                  <span className='block font-semibold text-ink'>{v.label}</span>
                  <span className='block text-[11px] text-muted'>
                    {v.minPax}–{v.maxPax} people · vehicle price{" "}
                    {formatCurrency(v.price)}
                  </span>
                </span>
                <span className='flex-none text-right'>
                  <span className='block text-sm font-bold text-ink'>
                    {formatCurrency(vehiclePerPersonPrice(v))}
                  </span>
                  <span className='block text-[10px] text-muted'>per person</span>
                </span>
              </label>
            );
          })}
        </div>
        <div className='mt-5 flex flex-wrap justify-end gap-2 border-t border-line-light pt-4'>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant='accent' disabled={!selected} onClick={() => onConfirm(selected)}>
            {adding ? "Add tour" : "Save vehicle"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// A placed tour/transfer/activity on a specific day — image, name, facts,
// price, remove, per-item note, and (tours) the chosen vehicle.
function PlacedItemCard({ type, item, meta, onNoteChange, onRemove, onChangeVehicle, showVehicle = true }) {
  // Readymade packages place tours as plain catalogue tours: no vehicle choice.
  const vehicles = type === "tour" && meta ? tourVehicles(meta) : [];
  const hasVehicles = showVehicle && vehicles.length > 0;
  const chosenVehicle =
    hasVehicles && item.vehicleKey
      ? vehicles.find((v) => String(v.key) === String(item.vehicleKey)) || null
      : null;
  const price = chosenVehicle
    ? { value: formatOmr(vehiclePerPersonPrice(chosenVehicle)), unit: "/ person" }
    : catalogPrice(type, meta);
  const description = plainText(meta?.description);

  return (
    <div className='rounded-xl border border-[#E4E9FB] bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'>
      <div className='flex gap-3'>
        <Thumb url={meta?.images?.[0]} className='h-20 w-24 flex-none rounded-lg sm:w-28' />
        <div className='min-w-0 flex-1'>
          <CategoryBadge type={type}>{categoryOf(type, meta)}</CategoryBadge>
          <div className='mt-0.5 truncate text-sm font-bold text-ink'>
            {meta?.name || "Unknown item"}
          </div>
          <FactRow facts={itemFacts(type, meta)} className='mt-1' />
          {description && (
            <p className='mt-1 line-clamp-1 text-[11px] text-muted'>{description}</p>
          )}
        </div>
        <div className='flex flex-none flex-col items-end justify-between gap-2'>
          <PriceTag price={price} />
          <button
            type='button'
            onClick={onRemove}
            title='Remove'
            aria-label={`Remove ${meta?.name || "item"}`}
            className='flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 transition hover:bg-rose-100'
          >
            <LuTrash2 size={14} />
          </button>
        </div>
      </div>
      {type === "tour" && hasVehicles && (
        <div className='mt-2 flex items-center justify-between gap-2 rounded-lg bg-[#F8FAFF] px-2.5 py-1.5 text-[11px]'>
          {chosenVehicle ? (
            <span className='inline-flex items-center gap-1.5 text-ink'>
              <LuCar size={12} className='flex-none text-[#4F46E5]' />
              <b>{chosenVehicle.label}</b> ({chosenVehicle.minPax}–{chosenVehicle.maxPax} people)
            </span>
          ) : (
            <span className='font-medium text-[#B45309]'>
              No vehicle chosen — the price follows group size.
            </span>
          )}
          {onChangeVehicle && (
            <button
              type='button'
              onClick={onChangeVehicle}
              className='flex-none font-semibold text-accent hover:underline'
            >
              {chosenVehicle ? "Change" : "Choose vehicle"}
            </button>
          )}
        </div>
      )}
      <TextInput
        className='mt-2 px-2.5 py-1.5 text-xs'
        placeholder='Add a note (optional)…'
        value={item.note || ""}
        onChange={(e) => onNoteChange(e.target.value)}
      />
    </div>
  );
}

// White card with an icon-tile header used by every block inside a day.
function DaySection({ icon: Icon, title, subtitle, actions, className = "", children }) {
  return (
    <section className={`rounded-xl border border-[#E4E9FB] bg-white p-4 sm:p-5 ${className}`}>
      <div className='mb-4 flex flex-wrap items-start justify-between gap-3'>
        <div className='flex min-w-0 items-start gap-3'>
          <div className='flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-[#EEF0FF]'>
            <Icon size={18} className='text-[#4F46E5]' />
          </div>
          <div className='min-w-0 pt-0.5'>
            <div className='text-sm font-bold uppercase tracking-wide text-[#4F46E5]'>
              {title}
            </div>
            {subtitle && <p className='mt-0.5 text-xs text-muted'>{subtitle}</p>}
          </div>
        </div>
        {actions && (
          <div className='flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-1 sm:justify-end'>
            {actions}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

// Looks like a search box; opens the catalogue picker, where the real search
// lives.
function SearchLauncher({ placeholder, onClick }) {
  return (
    <button
      type='button'
      onClick={onClick}
      className='flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#D7DDF0] bg-[#FAFBFF] px-3 text-left text-sm text-[#94A3B8] transition hover:border-[#A5B4FC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]/30 sm:max-w-sm'
    >
      <LuSearch size={15} className='flex-none' />
      <span className='truncate'>{placeholder}</span>
    </button>
  );
}

function AddTile({ title, subtitle, onClick, className = "" }) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={`flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[#C7D2FE] bg-[#FAFBFF] px-4 py-5 text-left transition hover:border-[#818CF8] hover:bg-[#F5F7FF] ${className}`}
    >
      <span className='flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#EEF0FF] text-[#4F46E5]'>
        <LuPlus size={20} />
      </span>
      <span>
        <span className='block text-sm font-semibold text-[#4F46E5]'>{title}</span>
        {subtitle && <span className='block text-xs text-muted'>{subtitle}</span>}
      </span>
    </button>
  );
}

// One hotel option card — click to select; clicking the selected one clears
// it (same as the old "Selected ✓" button).
function HotelOptionCard({ hotel, selected, onClick }) {
  const description = plainText(hotel.description);
  return (
    <button
      type='button'
      onClick={onClick}
      aria-pressed={selected}
      className={`relative flex w-full gap-3 rounded-xl border p-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]/30 ${
        selected
          ? "border-[#4F46E5] bg-[#F5F7FF] ring-2 ring-[#4F46E5]/15"
          : "border-[#E4E9FB] bg-white hover:border-[#A5B4FC] hover:shadow-sm"
      }`}
    >
      <Thumb url={hotel.images?.[0]} icon={LuHotel} className='h-24 w-28 flex-none rounded-lg' />
      <span className='min-w-0 flex-1 pr-6'>
        <span className='block truncate text-sm font-bold text-ink'>{hotel.name}</span>
        <span className='mt-0.5 flex items-center gap-1.5'>
          <HotelStars category={hotel.category} />
          {hotel.category ? (
            <span className='text-[11px] text-muted'>{hotel.category}-star</span>
          ) : null}
        </span>
        <FactRow facts={itemFacts("hotel", hotel)} className='mt-1' />
        {description && (
          <span className='mt-1 line-clamp-2 block text-[11px] text-muted'>{description}</span>
        )}
      </span>
      <span
        className={`absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] ${
          selected ? "border-[#4F46E5] bg-[#4F46E5] text-white" : "border-[#CBD5E1] bg-white"
        }`}
      >
        {selected && <LuCheck size={12} strokeWidth={3} />}
      </span>
      <PriceTag price={catalogPrice("hotel", hotel)} className='self-end' />
    </button>
  );
}

// A day's hotel — single-select. Choosing a hotel replaces whatever was
// already selected for this day; its per-pax rate is resolved from whichever
// occupancy price it has (resolveHotelPerPaxRate). Only a few cards show at
// once — the search box narrows them and "View more" opens the full picker
// (with the star-category filter).
const HOTEL_PREVIEW_COUNT = 3;

function DayHotelSection({ hotels, currentHotelId, onSelect, label = "Hotel" }) {
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const currentHotel = hotels.find((h) => h.id === currentHotelId) || null;
  const q = query.trim().toLowerCase();
  const matches = q
    ? hotels.filter((h) => matchesQuery(h, q, PICKER_SEARCH_FIELDS.hotel))
    : hotels;
  const ordered =
    currentHotel && matches.includes(currentHotel)
      ? [currentHotel, ...matches.filter((h) => h.id !== currentHotel.id)]
      : matches;
  const visible = ordered.slice(0, HOTEL_PREVIEW_COUNT);

  return (
    <DaySection
      icon={LuHotel}
      title={label}
      subtitle='Select one hotel for this day.'
      actions={
        <>
          <div className='relative min-w-0 flex-1 sm:max-w-sm'>
            <LuSearch
              size={15}
              className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]'
            />
            <input
              type='text'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Search hotels (e.g. Muscat, Best Western…)'
              aria-label='Search hotels'
              className='h-10 w-full rounded-lg border border-[#D7DDF0] bg-[#FAFBFF] pl-9 pr-3 text-sm text-ink placeholder:text-[#94A3B8] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/15'
            />
          </div>
          {hotels.length > 0 && (
            <button
              type='button'
              onClick={() => setPickerOpen(true)}
              className='inline-flex flex-none items-center gap-1 px-1 text-sm font-semibold text-[#4F46E5] hover:underline'
            >
              View more
              <LuArrowRight size={14} />
            </button>
          )}
        </>
      }
    >
      {hotels.length === 0 ? (
        <p className='text-xs text-muted'>No published hotels in the catalogue yet.</p>
      ) : visible.length === 0 ? (
        <p className='rounded-lg bg-[#F8FAFF] px-3 py-4 text-center text-xs text-muted'>
          No hotels match “{query}”.{" "}
          <button type='button' onClick={() => setQuery("")} className='font-semibold text-[#4F46E5] hover:underline'>
            Clear search
          </button>
        </p>
      ) : (
        <div className='grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3'>
          {visible.map((h) => {
            const selected = h.id === currentHotelId;
            return (
              <HotelOptionCard
                key={h.id}
                hotel={h}
                selected={selected}
                onClick={() => onSelect(selected ? "" : h.id)}
              />
            );
          })}
        </div>
      )}
      {pickerOpen && (
        <CataloguePickerModal
          mode='hotel'
          catalog={hotels}
          placedIds={currentHotelId ? [currentHotelId] : []}
          initialQuery={query}
          onClose={() => setPickerOpen(false)}
          onConfirm={(ids) => {
            if (ids[0]) onSelect(ids[0]);
            setPickerOpen(false);
          }}
        />
      )}
    </DaySection>
  );
}

// Tours/Transfers/Activities are all optional per day — only "the day has
// *some* content" (a note or any item) is enforced, by findItineraryPublishError.
const DAY_SECTION_META = {
  tour: {
    label: "Tours & Sightseeing",
    subtitle: "Add tours or sightseeing for this day.",
    addLabel: "Add tour / sightseeing",
    searchPlaceholder: "Search tours (e.g. Muscat City Tour, Jebel Akhdar…)",
    icon: LuBinoculars,
    noun: "tours",
  },
  transfer: {
    label: "Transfers",
    subtitle: "Add transfers for this day.",
    addLabel: "Add transfer",
    searchPlaceholder: "Search transfers (e.g. airport, intercity…)",
    icon: LuCar,
    noun: "transfers",
  },
  activity: {
    label: "Activities",
    subtitle: "Add activities for this day.",
    addLabel: "Add activity",
    searchPlaceholder: "Search activities (e.g. snorkeling, desert…)",
    icon: LuFootprints,
    noun: "activities",
  },
};

// A day's tours/transfers/activities — placed cards plus an Add button that
// opens CataloguePickerModal in this section's mode.
function DayCatalogSection({
  type,
  catalog,
  placedItems,
  onAdd,
  onVehicleChange,
  vehicleChoice = true,
  onRemove,
  onNoteChange,
  className = "",
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  // Changing the vehicle of a tour already on the day: { tour, itemKey, current }.
  const [vehiclePicker, setVehiclePicker] = useState(null);
  const meta = DAY_SECTION_META[type];
  const wide = type === "tour";
  const openPicker = () => setPickerOpen(true);

  return (
    <DaySection
      icon={meta.icon}
      title={meta.label}
      subtitle={meta.subtitle}
      className={className}
      actions={
        <>
          <SearchLauncher placeholder={meta.searchPlaceholder} onClick={openPicker} />
          <Button
            className='h-10 flex-none gap-1.5 border-[#C7D2FE] text-sm text-[#4F46E5]'
            onClick={openPicker}
          >
            <LuPlus size={15} />
            {meta.addLabel}
          </Button>
        </>
      }
    >
      <div className={`grid grid-cols-1 gap-3 ${wide ? "xl:grid-cols-2" : ""}`}>
        {placedItems.map((it) => (
          <PlacedItemCard
            key={it.key}
            type={type}
            item={it}
            meta={catalog.find((c) => c.id === it.id)}
            onRemove={() => onRemove(it.key)}
            onNoteChange={(note) => onNoteChange(it.key, note)}
            showVehicle={vehicleChoice}
            onChangeVehicle={
              type === "tour" && vehicleChoice
                ? () =>
                    setVehiclePicker({
                      tour: catalog.find((c) => c.id === it.id),
                      itemKey: it.key,
                      current: it.vehicleKey || null,
                    })
                : undefined
            }
          />
        ))}
        {(wide || placedItems.length === 0) && (
          <AddTile
            title={
              placedItems.length
                ? `Add another ${wide ? "tour or sightseeing" : meta.addLabel.replace("Add ", "")}`
                : `No ${meta.noun} yet — ${meta.addLabel.toLowerCase()}`
            }
            subtitle='Search and add from the catalogue'
            onClick={openPicker}
            className={placedItems.length ? "" : "py-4"}
          />
        )}
      </div>
      {pickerOpen && (
        <CataloguePickerModal
          mode={type}
          catalog={catalog}
          placedIds={placedItems.map((it) => it.id)}
          vehicleChoice={vehicleChoice}
          onClose={() => setPickerOpen(false)}
          onConfirm={(ids, vehicleKey) => {
            ids.forEach((id) => onAdd(id, vehicleKey));
            setPickerOpen(false);
          }}
        />
      )}
      {vehiclePicker && (
        <TourVehicleModal
          tour={vehiclePicker.tour}
          current={vehiclePicker.current}
          adding={false}
          onClose={() => setVehiclePicker(null)}
          onConfirm={(vehicleKey) => {
            onVehicleChange?.(vehiclePicker.itemKey, vehicleKey);
            setVehiclePicker(null);
          }}
        />
      )}
    </DaySection>
  );
}

// ---------------------------------------------------------------------------
// Catalogue picker popup — one shared modal for every "Add …" in a day:
//   mode "activity" / "transfer" — card grid, multi-select, "Add to Day (n)"
//   mode "hotel"                  — card grid, single-select (replaces the day's hotel)
//   mode "tour"                   — list + detail preview, one tour at a time,
//                                   vehicle chosen inline when the tour has priced vehicles
// Search and the filter chips both filter `catalog` (the same published rows
// ItineraryManager already loaded) — no extra requests. Items already on the
// day show as "Added" and can't be picked again; removing stays on the day's
// own cards. onConfirm(ids, vehicleKey?) hands back what to add.
const PICKER_SEARCH_FIELDS = {
  activity: ["name", "city", "duration", "description"],
  transfer: ["name", "city", "type", "vehicle_class", "description"],
  hotel: ["name", "city", "state", "address"],
  tour: ["name", "city", "category", "duration", "description"],
};

function matchesQuery(item, q, fields) {
  return fields.some((f) => plainText(item[f]).toLowerCase().includes(q));
}

const PICKER_META = {
  activity: {
    title: "Add Activity",
    description: "Browse and add activities from the catalogue.",
    icon: LuFootprints,
    searchPlaceholder: "Search activities (e.g. snorkeling, desert safari, dhow cruise…)",
    // Activities carry no category, so they filter by location.
    filterOf: (item) => item.city || "",
    multi: true,
    noun: "activities",
  },
  transfer: {
    title: "Add Transfer",
    description: "Browse and add transfers from the catalogue.",
    icon: LuCar,
    searchPlaceholder: "Search transfers (e.g. airport, intercity…)",
    filterOf: (item) => transferTypeLabel(item.type),
    multi: true,
    noun: "transfers",
  },
  hotel: {
    title: "Choose Hotel",
    description: "Browse every published hotel and pick one for this day.",
    icon: LuHotel,
    searchPlaceholder: "Search hotels (e.g. Muscat, Best Western…)",
    filterOf: (item) => (item.category ? `${item.category}★` : ""),
    filters: HOTEL_STAR_CATEGORIES.map((c) => `${c}★`),
    multi: false,
    noun: "hotels",
  },
  tour: {
    title: "Add Tour / Sightseeing",
    description: "Browse and add tours or sightseeing from the catalogue.",
    icon: LuBinoculars,
    searchPlaceholder: "Search tours (e.g. Muscat City Tour, Jebel Akhdar…)",
    filterOf: (item) => item.category || "",
    multi: false,
    noun: "tours",
  },
};

function PickerPagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  let first = Math.max(1, page - 2);
  const last = Math.min(totalPages, first + 4);
  first = Math.max(1, last - 4);
  const pages = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const base =
    "flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg px-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <nav className='flex items-center gap-1' aria-label='Catalogue pages'>
      <button
        type='button'
        className={`${base} border border-[#E4E9FB] text-[#334155] hover:bg-[#F3F4FF]`}
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        aria-label='Previous page'
      >
        <LuChevronLeft size={16} />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type='button'
          onClick={() => onChange(p)}
          aria-current={p === page ? "page" : undefined}
          className={`${base} ${
            p === page ? "bg-[#4F46E5] text-white shadow-sm" : "text-[#334155] hover:bg-[#F3F4FF]"
          }`}
        >
          {p}
        </button>
      ))}
      <button
        type='button'
        className={`${base} border border-[#E4E9FB] text-[#334155] hover:bg-[#F3F4FF]`}
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        aria-label='Next page'
      >
        <LuChevronRight size={16} />
      </button>
    </nav>
  );
}

function AddedBadge({ className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200 ${className}`}
    >
      <LuCheck size={11} strokeWidth={3} />
      Added
    </span>
  );
}

// Grid card for activity / transfer / hotel modes.
function PickerGridCard({ mode, item, selected, added, onToggle }) {
  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border bg-white transition ${
        selected
          ? "border-[#4F46E5] ring-2 ring-[#4F46E5]/20"
          : "border-[#E4E9FB] hover:shadow-md"
      }`}
    >
      <div className='relative'>
        <Thumb
          url={item.images?.[0]}
          icon={PICKER_META[mode].icon}
          className={`h-32 w-full ${added ? "opacity-70" : ""}`}
        />
        {added && <AddedBadge className='absolute left-2 top-2 bg-white' />}
      </div>
      <div className='flex flex-1 flex-col p-3'>
        <CategoryBadge type={mode}>{categoryOf(mode, item)}</CategoryBadge>
        <div className='mt-0.5 line-clamp-1 text-sm font-bold text-ink'>{item.name}</div>
        {mode === "hotel" && <HotelStars category={item.category} />}
        <FactRow facts={itemFacts(mode, item)} className='mt-1' />
        <div className='mt-auto flex items-end justify-between gap-2 pt-3'>
          <PriceTag price={catalogPrice(mode, item)} className='!text-left' />
          <button
            type='button'
            disabled={added}
            onClick={onToggle}
            aria-pressed={selected}
            className={`inline-flex h-9 flex-none items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]/30 disabled:cursor-not-allowed ${
              added
                ? "bg-emerald-50 text-emerald-700"
                : selected
                ? "bg-[#4F46E5] text-white shadow-sm"
                : "border border-[#C7D2FE] text-[#4F46E5] hover:bg-[#F5F7FF]"
            }`}
          >
            {added || selected ? <LuCheck size={14} strokeWidth={3} /> : <LuPlus size={14} />}
            {added ? "Added" : selected ? "Selected" : mode === "hotel" ? "Select" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Right-hand preview of the highlighted tour (tour mode).
function TourDetailPanel({ tour, added, vehicles, vehicleKey, onVehicleChange }) {
  const images = tour.images || [];
  const [imageIndex, setImageIndex] = useState(0);
  const pickupTime = tour.pickup_time || tour.pickupTime;
  const facts = [
    ...itemFacts("tour", tour),
    ...(pickupTime ? [{ icon: LuAlarmClock, text: `Pickup ${formatTime(pickupTime)}` }] : []),
  ];

  return (
    <div>
      <Thumb url={images[imageIndex]} icon={LuBinoculars} className='h-52 w-full rounded-xl' />
      <h4 className='mt-4 text-lg font-bold text-ink'>{tour.name}</h4>
      <div className='mt-1.5 flex flex-wrap items-center gap-1.5'>
        <CategoryBadge type='tour'>{tour.category}</CategoryBadge>
        {(tour.is_bestseller || tour.isBestseller) && (
          <span className='inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700'>
            <LuSparkles size={11} />
            Bestseller
          </span>
        )}
        {added && <AddedBadge />}
      </div>
      <FactRow facts={facts} className='mt-2' />
      {tour.description && (
        <RichTextDisplay
          html={tour.description}
          className='mt-3 text-sm leading-relaxed text-[#475569]'
        />
      )}

      {vehicles.length > 0 ? (
        <div className='mt-4'>
          <div className='mb-2 text-xs font-semibold text-[#334155]'>
            Vehicle <span className='font-normal text-muted'>— the package is priced with its per-person price</span>
          </div>
          <div className='space-y-2'>
            {vehicles.map((v) => {
              const active = String(v.key) === vehicleKey;
              return (
                <label
                  key={v.key}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
                    active
                      ? "border-[#4F46E5] bg-[#F5F7FF] ring-1 ring-[#4F46E5]/25"
                      : "border-[#E4E9FB] hover:border-[#A5B4FC]"
                  } ${added ? "pointer-events-none opacity-60" : ""}`}
                >
                  <input
                    type='radio'
                    name={`picker-vehicle-${tour.id}`}
                    className='h-4 w-4 flex-none accent-[#4F46E5]'
                    checked={active}
                    disabled={added}
                    onChange={() => onVehicleChange(String(v.key))}
                  />
                  <span className='min-w-0 flex-1'>
                    <span className='block font-semibold text-ink'>{v.label}</span>
                    <span className='block text-[11px] text-muted'>
                      {v.minPax}–{v.maxPax} people · vehicle price {formatOmr(v.price)}
                    </span>
                  </span>
                  <span className='flex-none text-right'>
                    <span className='block text-sm font-bold text-ink'>
                      {formatOmr(vehiclePerPersonPrice(v))}
                    </span>
                    <span className='block text-[10px] text-muted'>per person</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ) : catalogPrice("tour", tour) ? (
        <div className='mt-4'>
          <div className='mb-1.5 text-xs font-semibold text-[#334155]'>Price (per pax)</div>
          <div className='rounded-lg bg-[#F5F7FF] px-4 py-3 text-base font-bold text-[#3730A3]'>
            {/* Plain catalogue price, or the vehicle range when this
                package places tours without a vehicle (Readymade). */}
            {tourVehicles(tour).length ? (
              <span>{catalogPrice("tour", tour).value} <span className='text-xs font-medium text-muted'>/ person</span></span>
            ) : (
              <Money amount={tour.price} />
            )}
          </div>
        </div>
      ) : null}

      {images.length > 1 && (
        <div className='mt-4'>
          <div className='mb-2 text-xs font-semibold text-[#334155]'>Gallery</div>
          <div className='grid grid-cols-4 gap-2'>
            {images.slice(0, 4).map((url, i) => {
              const more = i === 3 && images.length > 4 ? images.length - 4 : 0;
              return (
                <button
                  key={url + i}
                  type='button'
                  onClick={() => setImageIndex(i)}
                  aria-label={`Show photo ${i + 1}`}
                  className={`relative h-16 overflow-hidden rounded-lg ${
                    i === imageIndex ? "ring-2 ring-[#4F46E5]" : "opacity-80 hover:opacity-100"
                  }`}
                >
                  <img src={url} alt='' className='h-full w-full object-cover' />
                  {more > 0 && (
                    <span className='absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-bold text-white'>
                      +{more}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CataloguePickerModal({
  mode,
  catalog,
  placedIds = [],
  vehicleChoice = true,
  initialQuery = "",
  onClose,
  onConfirm,
}) {
  const meta = PICKER_META[mode];
  const isTour = mode === "tour";
  const pageSize = isTour ? 6 : 9;
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [vehicleKey, setVehicleKey] = useState("");
  const placed = new Set(placedIds);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const filters =
    meta.filters ||
    [...new Set(catalog.map(meta.filterOf).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const q = query.trim().toLowerCase();
  const results = catalog.filter(
    (item) =>
      (!filter || meta.filterOf(item) === filter) &&
      (!q || matchesQuery(item, q, PICKER_SEARCH_FIELDS[mode]))
  );
  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = results.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Tour mode: the highlighted tour (defaults to the first visible result).
  const activeTour = isTour
    ? results.find((t) => t.id === activeId) || pageItems[0] || null
    : null;
  const activeVehicles = activeTour && vehicleChoice ? tourVehicles(activeTour) : [];
  const activeAdded = activeTour ? placed.has(activeTour.id) : false;

  function updateQuery(value) {
    setQuery(value);
    setPage(1);
  }
  function updateFilter(value) {
    setFilter(value);
    setPage(1);
  }
  function highlightTour(id) {
    setActiveId(id);
    setVehicleKey("");
  }
  function toggle(id) {
    if (placed.has(id)) return;
    setSelectedIds((ids) =>
      meta.multi
        ? ids.includes(id)
          ? ids.filter((x) => x !== id)
          : [...ids, id]
        : ids[0] === id
        ? []
        : [id]
    );
  }

  const canConfirm = isTour
    ? !!activeTour && !activeAdded && (activeVehicles.length === 0 || !!vehicleKey)
    : selectedIds.length > 0;

  function confirm() {
    if (!canConfirm) return;
    if (isTour) onConfirm([activeTour.id], activeVehicles.length ? vehicleKey : undefined);
    else onConfirm(selectedIds);
  }

  const confirmLabel = isTour
    ? activeAdded
      ? "Already added"
      : activeVehicles.length && !vehicleKey
      ? "Choose a vehicle"
      : "Add to Day"
    : mode === "hotel"
    ? "Select Hotel"
    : `Add to Day (${selectedIds.length})`;

  const Icon = meta.icon;

  const emptyState = (
    <div className='flex flex-col items-center justify-center px-6 py-14 text-center'>
      <span className='flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF0FF] text-[#4F46E5]'>
        <LuSearchX size={22} />
      </span>
      <p className='mt-3 text-sm font-semibold text-ink'>
        {catalog.length === 0
          ? `No published ${meta.noun} in the catalogue yet.`
          : `No ${meta.noun} match your search.`}
      </p>
      {catalog.length > 0 && (q || filter) && (
        <button
          type='button'
          onClick={() => {
            updateQuery("");
            updateFilter("");
          }}
          className='mt-2 text-xs font-semibold text-[#4F46E5] hover:underline'
        >
          Clear search and filters
        </button>
      )}
    </div>
  );

  const searchAndFilters = (
    <div>
      <div className='relative'>
        <LuSearch
          size={17}
          className='pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]'
        />
        <input
          autoFocus
          type='text'
          value={query}
          onChange={(e) => updateQuery(e.target.value)}
          placeholder={meta.searchPlaceholder}
          aria-label={`Search ${meta.noun}`}
          className='h-11 w-full rounded-xl border border-[#D7DDF0] bg-[#FAFBFF] pl-10 pr-10 text-sm text-ink placeholder:text-[#94A3B8] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/15'
        />
        {query && (
          <button
            type='button'
            onClick={() => updateQuery("")}
            aria-label='Clear search'
            className='absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-[#F3F4FF] hover:text-ink'
          >
            <LuX size={15} />
          </button>
        )}
      </div>
      {filters.length > 0 && (
        <div className='mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]' role='group' aria-label='Filter'>
          {["", ...filters].map((f) => {
            const active = filter === f;
            return (
              <button
                key={f || "all"}
                type='button'
                onClick={() => updateFilter(f)}
                aria-pressed={active}
                className={`inline-flex flex-none items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-[#4F46E5] bg-[#4F46E5] text-white shadow-sm"
                    : "border-[#E4E9FB] bg-white text-[#334155] hover:border-[#A5B4FC] hover:text-[#4F46E5]"
                }`}
              >
                {!f && <LuLayoutGrid size={13} />}
                {f || "All"}
              </button>
            );
          })}
        </div>
      )}
      <p className='mt-2 text-[11px] text-muted'>
        {results.length} {results.length === 1 ? meta.noun.replace(/(ies|s)$/, (m) => (m === "ies" ? "y" : "")) : meta.noun}
        {filter ? ` · ${filter}` : ""}
      </p>
    </div>
  );

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/50 p-3 backdrop-blur-sm sm:p-6'
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby='catalogue-picker-title'
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${
          isTour ? "max-w-6xl" : "max-w-5xl"
        }`}
      >
        {/* Header */}
        <div className='flex items-start gap-4 border-b border-[#EEF1FA] px-5 py-4 sm:px-6'>
          <span className='flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-[#EEF0FF] text-[#4F46E5]'>
            <Icon size={22} />
          </span>
          <div className='min-w-0 flex-1'>
            <h3 id='catalogue-picker-title' className='text-xl font-bold text-ink'>
              {meta.title}
            </h3>
            <p className='mt-0.5 text-sm text-muted'>{meta.description}</p>
          </div>
          <button
            type='button'
            onClick={onClose}
            aria-label='Close'
            className='flex h-9 w-9 flex-none items-center justify-center rounded-full text-muted transition hover:bg-[#F3F4FF] hover:text-ink'
          >
            <LuX size={20} />
          </button>
        </div>

        {/* Body */}
        {isTour ? (
          <div className='grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:overflow-hidden'>
            <div className='flex min-h-0 flex-col p-5 lg:overflow-y-auto'>
              {searchAndFilters}
              {results.length === 0 ? (
                emptyState
              ) : (
                <>
                  <div className='mt-3 space-y-2.5'>
                    {pageItems.map((t) => {
                      const active = activeTour?.id === t.id;
                      return (
                        <button
                          key={t.id}
                          type='button'
                          onClick={() => highlightTour(t.id)}
                          aria-pressed={active}
                          className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]/30 ${
                            active
                              ? "border-[#4F46E5] bg-[#F5F7FF] ring-2 ring-[#4F46E5]/15"
                              : "border-[#E4E9FB] bg-white hover:border-[#A5B4FC]"
                          }`}
                        >
                          <Thumb url={t.images?.[0]} icon={LuBinoculars} className='h-20 w-24 flex-none rounded-lg' />
                          <span className='min-w-0 flex-1'>
                            <span className='block truncate text-sm font-bold text-ink'>{t.name}</span>
                            <FactRow facts={itemFacts("tour", t)} className='mt-1' />
                            {placed.has(t.id) && <AddedBadge className='mt-1.5' />}
                          </span>
                          <PriceTag price={catalogPrice("tour", t)} />
                          <LuChevronRight size={18} className='flex-none text-muted' />
                        </button>
                      );
                    })}
                  </div>
                  <div className='mt-4'>
                    <PickerPagination page={currentPage} totalPages={totalPages} onChange={setPage} />
                  </div>
                </>
              )}
            </div>
            <div className='min-h-0 border-t border-[#EEF1FA] bg-[#FCFDFF] p-5 lg:overflow-y-auto lg:border-l lg:border-t-0'>
              {activeTour ? (
                <TourDetailPanel
                  key={activeTour.id}
                  tour={activeTour}
                  added={activeAdded}
                  vehicles={activeVehicles}
                  vehicleKey={vehicleKey}
                  onVehicleChange={setVehicleKey}
                />
              ) : (
                <p className='py-14 text-center text-sm text-muted'>
                  Select a tour to see its details.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className='min-h-0 flex-1 overflow-y-auto p-5 sm:px-6'>
            {searchAndFilters}
            {results.length === 0 ? (
              emptyState
            ) : (
              <div className='mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                {pageItems.map((item) => (
                  <PickerGridCard
                    key={item.id}
                    mode={mode}
                    item={item}
                    added={placed.has(item.id)}
                    selected={selectedIds.includes(item.id)}
                    onToggle={() => toggle(item.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className='flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF1FA] px-5 py-4 sm:px-6'>
          <div>
            {!isTour && (
              <PickerPagination page={currentPage} totalPages={totalPages} onChange={setPage} />
            )}
          </div>
          <div className='flex items-center gap-2'>
            <Button className='h-11 px-5 text-sm' onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant='accent'
              className='h-11 gap-2 px-5 text-sm'
              disabled={!canConfirm}
              onClick={confirm}
            >
              {!activeAdded && <LuPlus size={16} />}
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Leisure day (0105_fd_itinerary_leisure.sql) — a free day with no
// tours/transfers/activities. Only the hotel stays selectable (optional,
// except on Day 1 — see findItineraryPublishError), and an optional remark
// replaces the day's regular notes. Shown to agents as "Leisure day".
function LeisureToggle({ dayNumber, leisure, onChange }) {
  return (
    <div
      className={`rounded-xl border p-4 transition ${
        leisure ? "border-[#99F6E4] bg-[#F0FDFA]" : "border-[#E4E9FB] bg-[#F8FAFF]"
      }`}
    >
      <div className='flex items-center justify-between gap-3'>
        <span className='flex items-center gap-2 text-sm font-semibold text-ink'>
          <LuTreePalm size={18} className='flex-none text-[#0D9488]' />
          Leisure day
        </span>
        <button
          type='button'
          role='switch'
          aria-checked={leisure}
          aria-label={`Day ${dayNumber} is a leisure day`}
          onClick={() => onChange(!leisure)}
          className={`relative h-6 w-11 flex-none rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]/40 ${
            leisure ? "bg-[#4F46E5]" : "bg-[#CBD5E1]"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
              leisure ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>
      <p className='mt-1.5 text-xs text-muted'>
        {leisure
          ? `Day ${dayNumber} is free time — only the hotel can be set. Add an optional remark for agents below.`
          : "Turn on for a free day: no tours, transfers or activities — just the hotel and an optional remark."}
      </p>
    </div>
  );
}

// Compact header for the selected day: hero image, "Day N – City", what's
// placed so far, and the leisure toggle.
function DayOverview({ dayNumber, preview, leisure, counts, onLeisureChange }) {
  const chips = [
    { icon: LuHotel, text: counts.hotel ? "Hotel set" : "No hotel yet", muted: !counts.hotel },
    ...(leisure
      ? []
      : [
          { icon: LuBinoculars, text: `${counts.tours} tour${counts.tours === 1 ? "" : "s"}`, muted: !counts.tours },
          { icon: LuCar, text: `${counts.transfers} transfer${counts.transfers === 1 ? "" : "s"}`, muted: !counts.transfers },
          { icon: LuFootprints, text: `${counts.activities} activit${counts.activities === 1 ? "y" : "ies"}`, muted: !counts.activities },
        ]),
  ];
  return (
    <div className='grid grid-cols-1 items-center gap-4 rounded-xl border border-[#E4E9FB] bg-white p-4 md:grid-cols-[220px_1fr] xl:grid-cols-[280px_1fr_minmax(280px,360px)]'>
      <Thumb url={preview.image} icon={LuMapPinned} className='h-32 w-full rounded-xl' />
      <div className='min-w-0'>
        <h3 className='text-2xl font-bold text-ink'>
          Day {dayNumber}
          {preview.city ? ` – ${preview.city}` : ""}
        </h3>
        <p className='mt-1 text-xs text-muted'>
          {leisure
            ? "Free time — the hotel and an optional remark only."
            : "Pick the hotel, then add tours, transfers and activities for this day."}
        </p>
        <div className='mt-3 flex flex-wrap gap-2'>
          {chips.map(({ icon: ChipIcon, text, muted }) => (
            <span
              key={text}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                muted ? "bg-[#F1F5F9] text-[#64748B]" : "bg-[#EEF0FF] text-[#4F46E5]"
              }`}
            >
              <ChipIcon size={13} />
              {text}
            </span>
          ))}
        </div>
      </div>
      <div className='md:col-span-2 xl:col-span-1'>
        <LeisureToggle dayNumber={dayNumber} leisure={leisure} onChange={onLeisureChange} />
      </div>
    </div>
  );
}

function DayPlanCard({
  dayNumber,
  items,
  catalogs,
  notes,
  onNotesChange,
  addItem,
  setVehicle,
  vehicleChoice = true,
  removeItem,
  updateNote,
  setHotel,
  leisure,
  onLeisureChange,
  remark,
  onRemarkChange,
}) {
  const hotelItem = items.find((it) => it.type === "hotel") || null;
  const tourItems = items.filter((it) => it.type === "tour");
  const transferItems = items.filter((it) => it.type === "transfer");
  const activityItems = items.filter((it) => it.type === "activity");

  const overview = (
    <DayOverview
      dayNumber={dayNumber}
      preview={dayPreview(items, catalogs)}
      leisure={leisure}
      counts={{
        hotel: !!hotelItem,
        tours: tourItems.length,
        transfers: transferItems.length,
        activities: activityItems.length,
      }}
      onLeisureChange={onLeisureChange}
    />
  );
  const hotelSection = (label) => (
    <DayHotelSection
      label={label}
      hotels={catalogs.hotels}
      currentHotelId={hotelItem?.id || ""}
      onSelect={(hotelId) => setHotel(dayNumber, hotelId)}
    />
  );

  if (leisure) {
    return (
      <div className='space-y-4'>
        {overview}
        {hotelSection(dayNumber === 1 ? "Hotel *" : "Hotel (optional)")}
        {dayNumber === 1 && !hotelItem && (
          <p className='rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-[#B45309]'>
            Day 1 needs a hotel even on a leisure day — required before
            publishing.
          </p>
        )}
        <DayCatalogSection type='transfer' catalog={catalogs.transfers} placedItems={transferItems} onAdd={(id) => addItem("transfer", id)} onRemove={removeItem} onNoteChange={updateNote} />
        <DaySection
          icon={LuNotebookPen}
          title='Remark (optional)'
          subtitle='Shown to agents for this leisure day.'
        >
          <Textarea
            rows={2}
            maxLength={1000}
            placeholder='e.g. Spend the day at leisure on the beach or explore the souq at your own pace.'
            value={remark}
            onChange={(e) => onRemarkChange(e.target.value)}
          />
        </DaySection>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {overview}
      {hotelSection("Hotel")}
      <DayCatalogSection
        type='tour'
        catalog={catalogs.tours}
        placedItems={tourItems}
        onAdd={(id, vehicleKey) => addItem("tour", id, vehicleKey)}
        onVehicleChange={setVehicle}
        vehicleChoice={vehicleChoice}
        onRemove={removeItem}
        onNoteChange={updateNote}
      />
      <div className='grid grid-cols-1 items-start gap-4 2xl:grid-cols-2'>
        <DayCatalogSection
          type='transfer'
          catalog={catalogs.transfers}
          placedItems={transferItems}
          onAdd={(id) => addItem("transfer", id)}
          onRemove={removeItem}
          onNoteChange={updateNote}
        />
        <DayCatalogSection
          type='activity'
          catalog={catalogs.activities}
          placedItems={activityItems}
          onAdd={(id) => addItem("activity", id)}
          onRemove={removeItem}
          onNoteChange={updateNote}
        />
      </div>
      <DaySection icon={LuNotebookPen} title='Notes for this day (optional)'>
        <TextInput
          placeholder='Add any special instructions, remarks or notes for this day…'
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
        />
      </DaySection>
    </div>
  );
}

// A day is "complete" once it has *any* content — a note or at least one
// item — matching findItineraryPublishError's hasContent check below (tours
// and transfers are no longer required); used here purely to decorate each
// tab with a ✓ so admin can see progress across days without having to click
// through all of them.
function isDayComplete(items, notes, leisure) {
  return leisure || items.length > 0 || !!(notes || "").trim();
}

// FD-only wire shape: unlike the shared serializeItinerary (which skips empty
// days), every day 1..dayCount is sent, so fd_itinerary_days stores the
// leisure flag for all days (0105_fd_itinerary_leisure.sql). A leisure day
// sends only its hotel and remark; its regular notes don't apply.
function serializeFdItinerary(items, dayNotes, dayLeisure, dayRemarks, dayCount, withVehicles = true) {
  const days = [];
  for (let n = 1; n <= dayCount; n++) {
    const leisure = Boolean(dayLeisure[n]);
    days.push({
      dayNumber: n,
      notes: leisure ? "" : (dayNotes[n] || "").trim(),
      leisure,
      leisureRemark: leisure ? (dayRemarks[n] || "").trim() : "",
      items: itemsForDay(items, n)
        .filter((it) => !leisure || ["hotel", "transfer"].includes(it.type))
        .map((it) => ({
          type: it.type,
          id: it.id,
          note: it.note || "",
          ...(withVehicles && it.type === "tour" && it.vehicleKey ? { vehicleKey: it.vehicleKey } : {}),
          ...(it.type === "hotel" && it.adults ? { adults: it.adults } : {}),
        })),
    });
  }
  return days;
}

// Saved itinerary -> { dayLeisure, dayRemarks } editor state (the shared
// deserializeItinerary only knows about items and notes).
function readLeisure(itinerary) {
  const dayLeisure = {};
  const dayRemarks = {};
  for (const day of itinerary || []) {
    if (day.leisure) {
      dayLeisure[day.dayNumber] = true;
      dayRemarks[day.dayNumber] = day.leisureRemark || "";
    }
  }
  return { dayLeisure, dayRemarks };
}

const keepDays = (map, dayCount) =>
  Object.fromEntries(
    Object.entries(map).filter(([day]) => Number(day) <= dayCount)
  );

function ItineraryManager({
  fdPackageId,
  itinerary,
  duration,
  onChange,
  onComputedRateChange,
  readymade = false,
  ref,
}) {
  const [itineraryItems, setItineraryItems] = useState(
    () => deserializeItinerary(itinerary).items
  );
  const [dayNotes, setDayNotes] = useState(
    () => deserializeItinerary(itinerary).dayNotes
  );
  const [dayLeisure, setDayLeisure] = useState(
    () => readLeisure(itinerary).dayLeisure
  );
  const [dayRemarks, setDayRemarks] = useState(
    () => readLeisure(itinerary).dayRemarks
  );
  // In-app confirmation (shared ConfirmDialog) for removing itinerary
  // content: { title, message, confirmLabel, cancelLabel?, tone?, onConfirm }.
  const [askConfirm, setAskConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(true);

  const toast = useToast();
  // Debounced autosave for the day-by-day itinerary — same shape as the
  // parent editor's Task-2 form autosave, replacing the old explicit "Save
  // Itinerary" button. `hasUserEditedRef` is flipped only by the day/item/
  // note mutators below (never the initial load, nor the parent handing back
  // a just-saved itinerary), so opening a package never re-PUTs what it just
  // loaded.
  const hasUserEditedRef = useRef(false);
  const autosaveTimerRef = useRef(null);
  // Consumed once by the reload effect below: our own autosave calls
  // onChange(saved), which flows straight back in as a new `itinerary` prop —
  // this stops that round trip from resetting local state (and regenerating
  // item keys) out from under an edit still in progress.
  const skipNextReloadRef = useRef(false);
  // Latest serialized payload, read synchronously by the unmount flush.
  const latestPayloadRef = useRef(null);

  const [hotels, setHotels] = useState([]);
  const [tours, setTours] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const dayCount = parseDurationDays(duration) || 0;
  // Tracks the day count content was last checked against, so shrinking
  // Duration only prompts once per change rather than on every render.
  const lastSyncedDays = useRef(dayCount);

  // Task 6 — tabs to switch between days instead of one long stacked list.
  // Clamped down whenever Duration shrinks past the currently active tab
  // (e.g. was on Day 8, Duration drops to 5 days) so the tab bar never sits
  // on a day that no longer exists.
  const [activeDay, setActiveDay] = useState(1);
  useEffect(() => {
    if (dayCount > 0 && activeDay > dayCount) setActiveDay(dayCount);
  }, [dayCount, activeDay]);

  // Horizontal day strip — arrow buttons scroll it, and the active day is
  // kept in view when it changes.
  const dayStripRef = useRef(null);
  function scrollDays(direction) {
    dayStripRef.current?.scrollBy({ left: direction * 420, behavior: "smooth" });
  }
  useEffect(() => {
    // Scrolls only the strip itself (never the page): the strip is
    // `relative`, so each card's offsetLeft is measured from it.
    const strip = dayStripRef.current;
    const card = strip?.querySelector(`[data-day="${activeDay}"]`);
    if (!strip || !card) return;
    const left = card.offsetLeft;
    if (left < strip.scrollLeft || left + card.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({ left: Math.max(0, left - 8), behavior: "smooth" });
    }
  }, [activeDay, dayCount]);

  useEffect(() => {
    // 0070_hotels_status.sql / 0072_tours_activities_transfers_status.sql —
    // only published catalog rows are offered for the day-by-day itinerary;
    // drafts stay editable in ProductCatalog.jsx but can't be placed into a
    // package yet.
    Promise.all([
      api.get("/hotels?status=published"),
      api.get("/tours?status=published"),
      api.get("/transfers?status=published"),
      api.get("/activities?status=published"),
    ])
      .then(([h, t, tr, a]) => {
        setHotels(h.hotels || []);
        setTours(t.tours || []);
        setTransfers(tr.transfers || []);
        setActivities(a.activities || []);
      })
      .finally(() => setCatalogLoading(false));
  }, []);

  // Recomputed live on every itinerary edit — no need to click "Save
  // Itinerary" first. Skipped until catalogs finish loading so the price
  // doesn't flash to 0 while hotels/tours/transfers/activities are still
  // in flight.
  useEffect(() => {
    if (catalogLoading) return;
    onComputedRateChange?.(
      computeItineraryNetRate(
        readymade
          ? itineraryItems.map(({ vehicleKey: _vehicleKey, ...rest }) => rest)
          : itineraryItems,
        {
        hotels,
        tours,
        transfers,
        activities,
      }
      )
    );
  }, [
    readymade,
    itineraryItems,
    hotels,
    tours,
    transfers,
    activities,
    catalogLoading,
    onComputedRateChange,
  ]);

  // Reload from the DB whenever the parent hands us a freshly fetched
  // itinerary — e.g. opening the editor for an existing package. Skipped for
  // the prop change our own autosave triggers (see skipNextReloadRef), so an
  // in-progress edit isn't reset from under the admin ~1s after they type.
  useEffect(() => {
    if (skipNextReloadRef.current) {
      skipNextReloadRef.current = false;
      return;
    }
    const { items, dayNotes: loaded } = deserializeItinerary(itinerary);
    setItineraryItems(items);
    setDayNotes(loaded);
    const leisureState = readLeisure(itinerary);
    setDayLeisure(leisureState.dayLeisure);
    setDayRemarks(leisureState.dayRemarks);
  }, [itinerary]);

  // Days are just 1..dayCount, rendered straight off itineraryItems/dayNotes
  // — there's no separate "days" list to grow/trim the way the old free-text
  // builder had. Shrinking Duration past days that already have content still
  // needs a confirmation before that content is dropped, though.
  useEffect(() => {
    if (!dayCount || dayCount >= lastSyncedDays.current) {
      lastSyncedDays.current = dayCount;
      return;
    }
    const timer = setTimeout(() => {
      const hasOrphanedContent =
        itineraryItems.some((it) => it.dayNumber > dayCount) ||
        Object.entries(dayNotes).some(
          ([day, note]) => Number(day) > dayCount && (note || "").trim()
        ) ||
        Object.entries(dayLeisure).some(
          ([day, leisure]) => Number(day) > dayCount && leisure
        );
      const trim = () => {
        setItineraryItems((items) =>
          items.filter((it) => it.dayNumber <= dayCount)
        );
        setDayNotes((notes) => keepDays(notes, dayCount));
        setDayLeisure((map) => keepDays(map, dayCount));
        setDayRemarks((map) => keepDays(map, dayCount));
        hasUserEditedRef.current = true; // persist the trim on the next autosave tick
        lastSyncedDays.current = dayCount;
      };
      if (!hasOrphanedContent) return trim();
      // Asked first; "Keep" leaves it as-is (asked again once Duration
      // settles on a smaller value).
      setAskConfirm({
        title: `Remove Day ${dayCount + 1} onward?`,
        message: `Reducing the duration to ${dayCount} day${
          dayCount === 1 ? "" : "s"
        } removes the itinerary content on Day ${dayCount + 1} onward.`,
        confirmLabel: "Remove those days",
        cancelLabel: "Keep",
        onConfirm: trim,
      });
    }, DURATION_SYNC_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayCount]);

  function addItemToDay(dayNumber, type, id, vehicleKey) {
    hasUserEditedRef.current = true;
    setItineraryItems((items) =>
      addItineraryItem(items, { type, id, dayNumber, vehicleKey })
    );
  }

  function setVehicleForItem(key, vehicleKey) {
    hasUserEditedRef.current = true;
    setItineraryItems((items) => setItineraryItemVehicle(items, key, vehicleKey));
  }

  function removeItemFromDay(key) {
    hasUserEditedRef.current = true;
    setItineraryItems((items) => removeItineraryItemByKey(items, key));
  }

  function updateItemNoteByKey(key, note) {
    hasUserEditedRef.current = true;
    setItineraryItems((items) => updateItineraryItemNote(items, key, note));
  }

  function setHotelForDayNumber(dayNumber, hotelId) {
    hasUserEditedRef.current = true;
    setItineraryItems((items) =>
      hotelId
        ? setHotelForDay(items, dayNumber, hotelId)
        : items.filter(
            (it) => !(it.dayNumber === dayNumber && it.type === "hotel")
          )
    );
  }

  function updateDayNote(dayNumber, value) {
    hasUserEditedRef.current = true;
    setDayNotes((n) => ({ ...n, [dayNumber]: value }));
  }

  // Turning a day into a leisure day removes its tours/transfers/activities
  // (asked first, since that's content the admin built) and carries any day
  // notes over into the remark so nothing typed is silently lost.
  function setLeisureForDay(dayNumber, leisure, confirmed = false) {
    if (leisure) {
      const extras = itemsForDay(itineraryItems, dayNumber).filter(
        (it) => !["hotel", "transfer"].includes(it.type)
      );
      if (extras.length > 0 && !confirmed) {
        setAskConfirm({
          title: `Make Day ${dayNumber} a leisure day?`,
          message: `This removes its ${extras.length} tour/transfer/activit${
            extras.length === 1 ? "y" : "ies"
          } — only the hotel is kept.`,
          tone: "warning",
          confirmLabel: "Make it a leisure day",
          onConfirm: () => setLeisureForDay(dayNumber, true, true),
        });
        return;
      }
      setItineraryItems((items) =>
        items.filter(
          (it) => !(it.dayNumber === dayNumber && !["hotel", "transfer"].includes(it.type))
        )
      );
      const existingNote = (dayNotes[dayNumber] || "").trim();
      if (existingNote && !(dayRemarks[dayNumber] || "").trim()) {
        setDayRemarks((r) => ({ ...r, [dayNumber]: existingNote }));
      }
    }
    hasUserEditedRef.current = true;
    setDayLeisure((map) => ({ ...map, [dayNumber]: leisure }));
  }

  function updateDayRemark(dayNumber, value) {
    hasUserEditedRef.current = true;
    setDayRemarks((r) => ({ ...r, [dayNumber]: value }));
  }

  // PUT the current itinerary. Shared by the debounce, the imperative flush
  // (parent calls it before publish / leaving), and the unload handlers.
  async function persistItinerary() {
    const days = serializeFdItinerary(itineraryItems, dayNotes, dayLeisure, dayRemarks, dayCount, !readymade);
    const { itinerary: saved } = await api.put(
      `/admin/fd-packages/${fdPackageId}/itinerary`,
      { days }
    );
    skipNextReloadRef.current = true;
    onChange(saved);
    return saved;
  }

  latestPayloadRef.current = {
    days: serializeFdItinerary(itineraryItems, dayNotes, dayLeisure, dayRemarks, dayCount, !readymade),
    dayCount,
  };

  // Debounced ~1s after the admin stops editing days — replaces the old
  // explicit "Save Itinerary" button. Never fires on load (hasUserEditedRef)
  // or before Duration yields a day count.
  useEffect(() => {
    if (!hasUserEditedRef.current || dayCount === 0) return undefined;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await persistItinerary();
      } catch (err) {
        toast.error(describeApiError(err));
      } finally {
        setSaving(false);
      }
    }, 1000);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itineraryItems, dayNotes, dayLeisure, dayRemarks]);

  // A Readymade package places tours without a vehicle, so drop any choice left
  // over from when it was an FD package (persisted on the next autosave).
  useEffect(() => {
    if (!readymade) return;
    setItineraryItems((items) => {
      if (!items.some((it) => it.vehicleKey)) return items;
      hasUserEditedRef.current = true;
      return items.map(({ vehicleKey: _vehicleKey, ...rest }) => rest);
    });
  }, [readymade]);

  // Parent (handlePublish / handleBackToCatalog) awaits this so the publish
  // gate and the next catalog list read never run against a ~1s-stale
  // itinerary.
  useImperativeHandle(ref, () => ({
    // Resolves to the freshly-saved itinerary when a flush happened, else
    // null — the parent uses it to run the publish gate against current data
    // (React state from onChange() above hasn't re-rendered yet at that
    // point).
    async flush() {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      if (hasUserEditedRef.current && dayCount > 0) return persistItinerary();
      return null;
    },
  }));

  // Best-effort catch for the two moments a pending debounce would be lost:
  // an actual page refresh/tab close (keepalive PUT), and this editor
  // unmounting via an in-app navigation (the []-deps cleanup below, reading
  // the latest payload from a ref).
  useEffect(() => {
    function saveOnUnload() {
      if (!hasUserEditedRef.current) return;
      const { days, dayCount: dc } = latestPayloadRef.current || {};
      if (!dc) return;
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      const token = getAccessToken();
      fetch(`${getApiBaseUrl()}/admin/fd-packages/${fdPackageId}/itinerary`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        keepalive: true,
        body: JSON.stringify({ days }),
      }).catch(() => {});
    }
    window.addEventListener("pagehide", saveOnUnload);
    window.addEventListener("beforeunload", saveOnUnload);
    return () => {
      window.removeEventListener("pagehide", saveOnUnload);
      window.removeEventListener("beforeunload", saveOnUnload);
      saveOnUnload();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fdPackageId]);

  return (
    <CollapsibleSection
      icon={LuMap}
      title='Day-by-day itinerary builder'
      description={
        dayCount
          ? `${dayCount} day${
              dayCount === 1 ? "" : "s"
            }, generated from Duration above. Each day picks its own hotel plus tours/transfers/activities straight from the catalogue.`
          : 'Set a Duration above (e.g. "7N") to generate day sections.'
      }
      open={open}
      onToggle={() => setOpen((o) => !o)}
    >
      {dayCount === 0 ? (
        <div className='flex flex-col items-center justify-center rounded-lg border border-dashed border-[#C7D2FE] bg-[#FAFBFF] px-6 py-10 text-center'>
          <LuMapPinned size={30} className='text-[#4F46E5]' />
          <p className='mt-3 text-sm font-semibold text-ink'>
            Set a Duration above to start building the itinerary.
          </p>
          <p className='mt-1 text-xs text-muted'>
            Once you set the duration, day sections will be generated here to
            add hotels, tours, transfers and activities.
          </p>
        </div>
      ) : catalogLoading ? (
        <div className='flex items-center gap-2 text-sm text-muted'>
          <LuLoaderCircle size={16} className='animate-spin' />
          Loading catalogue…
        </div>
      ) : (
        <div>
          {/* One card per day in a single scrollable row — city and
              thumbnail come from that day's hotel (or first item). The
              check marks a day that already has content (what publishing
              requires — see isDayComplete). */}
          <div className='mb-5 flex items-center gap-2'>
            <button
              type='button'
              onClick={() => scrollDays(-1)}
              aria-label='Scroll days left'
              className='hidden h-9 w-9 flex-none items-center justify-center rounded-full border border-[#E4E9FB] bg-white text-[#334155] shadow-sm transition hover:text-[#4F46E5] sm:flex'
            >
              <LuChevronLeft size={18} />
            </button>
            <div
              ref={dayStripRef}
              className='relative flex min-w-0 flex-1 snap-x gap-3 overflow-x-auto scroll-smooth py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            >
              {Array.from({ length: dayCount }, (_, i) => i + 1).map(
                (dayNumber) => {
                  const leisure = Boolean(dayLeisure[dayNumber]);
                  const dayItems = itemsForDay(itineraryItems, dayNumber);
                  const complete = isDayComplete(
                    dayItems,
                    dayNotes[dayNumber],
                    leisure
                  );
                  const preview = dayPreview(dayItems, {
                    hotels,
                    tours,
                    transfers,
                    activities,
                  });
                  const active = activeDay === dayNumber;
                  return (
                    <button
                      key={dayNumber}
                      data-day={dayNumber}
                      type='button'
                      onClick={() => setActiveDay(dayNumber)}
                      title={leisure ? "Leisure day" : undefined}
                      aria-pressed={active}
                      className={`flex w-[196px] flex-none snap-start items-center gap-2.5 rounded-xl border p-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]/40 ${
                        active
                          ? "border-[#4F46E5] bg-[#4F46E5] text-white shadow-md shadow-[#4F46E5]/25"
                          : "border-[#E4E9FB] bg-white text-ink hover:border-[#A5B4FC]"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-bold ${
                          active ? "bg-white text-[#4F46E5]" : "bg-[#EEF0FF] text-[#4F46E5]"
                        }`}
                      >
                        {dayNumber}
                      </span>
                      <span className='min-w-0 flex-1'>
                        <span className='flex items-center gap-1 text-sm font-bold'>
                          Day {dayNumber}
                          {leisure && (
                            <LuTreePalm
                              size={13}
                              aria-label='Leisure day'
                              className={active ? "text-white" : "text-[#0D9488]"}
                            />
                          )}
                          {complete && (
                            <LuCircleCheck
                              size={13}
                              aria-label='Day complete'
                              className={active ? "text-white" : "text-emerald-500"}
                            />
                          )}
                        </span>
                        <span
                          className={`block truncate text-xs ${
                            active ? "text-white/80" : "text-muted"
                          }`}
                        >
                          {preview.city || (leisure ? "Leisure" : "Not planned yet")}
                        </span>
                      </span>
                      <Thumb
                        url={preview.image}
                        icon={LuMapPinned}
                        className='h-12 w-12 flex-none rounded-lg'
                      />
                    </button>
                  );
                }
              )}
            </div>
            <button
              type='button'
              onClick={() => scrollDays(1)}
              aria-label='Scroll days right'
              className='hidden h-9 w-9 flex-none items-center justify-center rounded-full border border-[#E4E9FB] bg-white text-[#334155] shadow-sm transition hover:text-[#4F46E5] sm:flex'
            >
              <LuChevronRight size={18} />
            </button>
          </div>
          <DayPlanCard
            dayNumber={activeDay}
            items={itemsForDay(itineraryItems, activeDay)}
            catalogs={{ hotels, tours, transfers, activities }}
            notes={dayNotes[activeDay] || ""}
            onNotesChange={(value) => updateDayNote(activeDay, value)}
            addItem={(type, id, vehicleKey) => addItemToDay(activeDay, type, id, vehicleKey)}
            setVehicle={setVehicleForItem}
            vehicleChoice={!readymade}
            removeItem={removeItemFromDay}
            updateNote={updateItemNoteByKey}
            setHotel={setHotelForDayNumber}
            leisure={Boolean(dayLeisure[activeDay])}
            onLeisureChange={(value) => setLeisureForDay(activeDay, value)}
            remark={dayRemarks[activeDay] || ""}
            onRemarkChange={(value) => updateDayRemark(activeDay, value)}
          />
        </div>
      )}
      {saving && (
        <p className='mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-muted'>
          <LuLoaderCircle size={12} className='animate-spin' />
          Saving itinerary…
        </p>
      )}
      <AnimatePresence>
        {askConfirm && (
          <ConfirmDialog
            title={askConfirm.title}
            tone={askConfirm.tone || "danger"}
            confirmLabel={askConfirm.confirmLabel}
            cancelLabel={askConfirm.cancelLabel || "Cancel"}
            busyLabel='Working…'
            onCancel={() => setAskConfirm(null)}
            onConfirm={() => {
              const run = askConfirm.onConfirm;
              setAskConfirm(null);
              run();
            }}
          >
            {askConfirm.message}
          </ConfirmDialog>
        )}
      </AnimatePresence>
    </CollapsibleSection>
  );
}

function flightOptionLabel(flight) {
  const route = [flight.source, flight.destination].filter(Boolean).join(" → ");
  // Date + time (0066_flights_departure_time.sql) shown together as one
  // "date, time" token rather than two separate dashed segments.
  const date = flight.departure_date
    ? new Date(flight.departure_date).toLocaleDateString()
    : null;
  const time = formatTime(flight.departure_time) || null;
  const dateTime = [date, time].filter(Boolean).join(", ");
  // Price (0065_flights_price.sql) — shown here for both callers of this
  // label: FlightsSection's own dropdown (where it *does* fold into the net
  // rate, see its onComputedRateChange effect below) and AddonsManager's
  // checkbox list (where it's a separate opt-in a-la-carte charge instead,
  // same as every other add-on — never both at once, since the two are
  // mutually exclusive per flight direction).
  const price = flight.price != null ? formatCurrency(flight.price) : null;
  return [flight.name, route, dateTime, price].filter(Boolean).join(" — ");
}

// Flights section, rendered directly below the day-by-day itinerary builder
// — flightsEnabled true locks in exactly one Onward + one Return flight
// directly on the package (onwardFlightId/returnFlightId); false leaves both
// unset, and AddonsManager further down offers the same Onward/Return
// catalogs as ordinary checkbox add-ons instead (hidden whenever this is
// on) — same "included directly, or offered as an opt-in add-on, never
// both" split Visa/Meals already established just below this section.
// Unchecking clears both picks, same "off wipes the value" behavior those
// use too, so a stale onward/return id can never linger once the section is
// switched off. Priced into the net rate exactly the same way Visa/Meals are
// (onComputedRateChange, mirroring AddonsManager's own live-preview effect)
// — but only while flightsEnabled: a flight offered as an add-on instead is
// deliberately never folded in here (mirrors resolveRatePerPax/
// resolveFlightsPerPax on the backend, the actual source of truth this is a
// client-side preview of).
function FlightsSection({ form, update, onComputedRateChange }) {
  const [onwardFlights, setOnwardFlights] = useState([]);
  const [returnFlights, setReturnFlights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/flights?isFlightOnward=true"),
      api.get("/flights?isFlightOnward=false"),
    ])
      .then(([onward, ret]) => {
        setOnwardFlights(onward.flights || []);
        setReturnFlights(ret.flights || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const flightsPerPax = form.flightsEnabled
    ? Number(
        onwardFlights.find((f) => f.id === form.onwardFlightId)?.price || 0
      ) +
      Number(
        returnFlights.find((f) => f.id === form.returnFlightId)?.price || 0
      )
    : 0;

  useEffect(() => {
    if (loading) return;
    onComputedRateChange?.(flightsPerPax);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightsPerPax, loading]);

  function toggle(enabled) {
    update("flightsEnabled", enabled);
    if (!enabled) {
      update("onwardFlightId", null);
      update("returnFlightId", null);
    }
  }

  return (
    <Card className={`${SECTION_CARD} h-full`}>
      <SectionHeader
        icon={LuPlaneTakeoff}
        title='Flights'
        description='Include flight details in this package'
      />
      {/* Checked = the Onward/Return flights are included directly on the
          package; unchecked = the same two catalogs show up as an add-on in
          Add-ons & Inclusions instead. */}
      <div className='mt-5'>
        <OptionCheckbox
          checked={!!form.flightsEnabled}
          onChange={toggle}
          label='Include directly'
          hint='Enable this if you want to include flight details as part of this package.'
        />
      </div>

      {form.flightsEnabled &&
        (loading ? (
          <p className='mt-3 flex items-center gap-2 text-xs text-muted'>
            <LuLoaderCircle size={14} className='animate-spin' />
            Loading flights…
          </p>
        ) : (
          <div className='mt-4 grid grid-cols-1 gap-4 2xl:grid-cols-2'>
            <div>
              <FieldLabel>Onward flight</FieldLabel>
              <Select
                value={form.onwardFlightId || ""}
                onChange={(e) =>
                  update("onwardFlightId", e.target.value || null)
                }
              >
                <option value=''>Select an onward flight…</option>
                {onwardFlights.map((f) => (
                  <option key={f.id} value={f.id}>
                    {flightOptionLabel(f)}
                  </option>
                ))}
              </Select>
              {onwardFlights.length === 0 && (
                <p className='mt-1 text-[11px] text-muted'>
                  No onward flights in the catalogue yet.
                </p>
              )}
            </div>
            <div>
              <FieldLabel>Return flight</FieldLabel>
              <Select
                value={form.returnFlightId || ""}
                onChange={(e) =>
                  update("returnFlightId", e.target.value || null)
                }
              >
                <option value=''>Select a return flight…</option>
                {returnFlights.map((f) => (
                  <option key={f.id} value={f.id}>
                    {flightOptionLabel(f)}
                  </option>
                ))}
              </Select>
              {returnFlights.length === 0 && (
                <p className='mt-1 text-[11px] text-muted'>
                  No return flights in the catalogue yet.
                </p>
              )}
            </div>
          </div>
        ))}
    </Card>
  );
}

// Task 5 — one catalog-item checkbox per row, straight from the Product
// Catalog; checking it creates a real fd_addons row (price read
// automatically off the item, never typed by hand), unchecking removes it.
// Reused for Activities/Tours/Transfers below (AddonsManager) — only the
// catalog list, id field, and display price field differ per type.
const ADDON_ID_FIELD = {
  activity: "activityId",
  tour: "tourId",
  transfer: "transferId",
  flight: "flightId",
  meal: "mealId",
};
const ADDON_PRICE_FIELD = {
  activity: "price_per_pax",
  tour: "price",
  transfer: "price",
  flight: "price",
};

// Per-card color identity (icon avatar, "N selected" badge, selected-item
// pills, footer total figure) — purely cosmetic, keyed the same as
// ADDON_ID_FIELD/ADDON_PRICE_FIELD above so each AddonMultiSelectCard below
// just looks up its own type's theme rather than repeating className strings
// per card. onwardFlight/returnFlight get their own theme keys distinct from
// the generic 'flight' addon type (both post the same `flightId` either way
// — see ADDON_ID_FIELD — this split only decides which color each card uses).
const ADDON_CARD_THEME = {
  activity: {
    border: "border-[#E4DEFB]",
    iconBg: "bg-[#EDE9FE]",
    iconText: "text-[#7C3AED]",
    badge: "bg-[#EDE9FE] text-[#6D28D9]",
    pill: "bg-[#EDE9FE] text-[#6D28D9]",
    total: "text-[#6D28D9]",
  },
  tour: {
    border: "border-[#BFDBFE]",
    iconBg: "bg-[#DBEAFE]",
    iconText: "text-[#2563EB]",
    badge: "bg-[#DBEAFE] text-[#1D4ED8]",
    pill: "bg-[#DBEAFE] text-[#1D4ED8]",
    total: "text-[#1D4ED8]",
  },
  transfer: {
    border: "border-[#FED7AA]",
    iconBg: "bg-[#FFEDD5]",
    iconText: "text-[#EA580C]",
    badge: "bg-[#FFEDD5] text-[#C2410C]",
    pill: "bg-[#FFEDD5] text-[#C2410C]",
    total: "text-[#C2410C]",
  },
  onwardFlight: {
    border: "border-[#DDD6FE]",
    iconBg: "bg-[#EDE9FE]",
    iconText: "text-[#6D28D9]",
    badge: "bg-[#EDE9FE] text-[#6D28D9]",
    pill: "border border-[#DDD6FE] bg-white text-[#6D28D9]",
    total: "text-[#6D28D9]",
  },
  returnFlight: {
    border: "border-[#BBF7D0]",
    iconBg: "bg-[#DCFCE7]",
    iconText: "text-[#16A34A]",
    badge: "bg-[#DCFCE7] text-[#15803D]",
    pill: "border border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]",
    total: "text-[#15803D]",
  },
};

// Replaces the old checkbox-list-in-a-scroll-box UI (previously
// AddonCheckboxGroup) with a searchable multi-select combobox: selected
// items show as removable pills on the closed trigger, opening it reveals a
// search box + the same checkbox-per-catalog-item list as before. Toggling
// an item (via the dropdown checkbox or a pill's ×) is still exactly
// onToggle(type, item, existing) — the same fd_addons POST/DELETE per click
// AddonsManager already had; only the presentation around it changed.
function AddonMultiSelectCard({
  type,
  themeKey,
  icon: Icon,
  title,
  subtitle,
  itemNounPlural,
  catalog,
  addons,
  onToggle,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const boxRef = useRef(null);
  const idField = ADDON_ID_FIELD[type];
  const priceField = ADDON_PRICE_FIELD[type];
  const theme = ADDON_CARD_THEME[themeKey];

  useEffect(() => {
    function handleClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = catalog.filter((item) =>
    addons.some((a) => a[idField] === item.id)
  );
  // Tours: per-person share at BASELINE_PAX — their real price depends on
  // the group size picked at booking (vehicle pricing).
  const perPaxOf = (item) =>
    type === "tour"
      ? rowPerPaxPrice(item, BASELINE_PAX)
      : Number(item[priceField] || 0);
  const totalPrice = selected.reduce((sum, item) => sum + perPaxOf(item), 0);
  const filtered = search.trim()
    ? catalog.filter((item) =>
        item.name.toLowerCase().includes(search.trim().toLowerCase())
      )
    : catalog;

  function toggleItem(item) {
    const existing = addons.find((a) => a[idField] === item.id);
    onToggle(type, item, existing);
  }

  return (
    // A vertical card (icon+title+subtitle on top, selector below, total at
    // the bottom) rather than a horizontal row — this is what lets these
    // sit side by side in a grid at any column width without a fixed-width
    // label/total block fighting for space the way a row layout would
    // (Tailwind's sm:/lg: breakpoints key off the *viewport*, not this grid
    // cell's actual rendered width, so a row layout that looked fine
    // full-width breaks the moment the same component sits in a narrower
    // grid column at the very same viewport size).
    <div
      ref={boxRef}
      className={`relative flex flex-col gap-3 rounded-xl border bg-white p-4 ${theme.border}`}
    >
      <div className='flex items-start justify-between gap-2'>
        <div className='flex items-center gap-2.5'>
          <div
            className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ${theme.iconBg}`}
          >
            <Icon size={16} className={theme.iconText} />
          </div>
          <div>
            <div className='text-sm font-bold text-ink'>{title}</div>
            <p className='mt-0.5 text-[11px] text-muted'>{subtitle}</p>
          </div>
        </div>
        {selected.length > 0 && (
          <span
            className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-semibold ${theme.badge}`}
          >
            {selected.length} selected
          </span>
        )}
      </div>

      <div className='relative'>
        <button
          type='button'
          onClick={() => setOpen((o) => !o)}
          className='flex min-h-[2.75rem] w-full flex-wrap items-center gap-1.5 rounded-lg border border-line-light bg-white px-2.5 py-2 text-left'
        >
          {selected.length === 0 ? (
            <span className='text-xs text-muted'>Select…</span>
          ) : (
            selected.map((item) => (
              <span
                key={item.id}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${theme.pill}`}
              >
                {item.name}
                <span
                  role='button'
                  aria-label={`Remove ${item.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleItem(item);
                  }}
                  className='cursor-pointer opacity-70 hover:opacity-100'
                >
                  ×
                </span>
              </span>
            ))
          )}
          <LuChevronDown
            size={14}
            className={`ml-auto flex-none text-muted transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        {open && (
          <div className='absolute inset-x-0 z-20 mt-1.5 rounded-lg border border-line-light bg-white p-2 shadow-lg'>
            <TextInput
              autoFocus
              placeholder={`Search ${title.toLowerCase()}`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className='mb-2 py-2 text-xs'
            />
            <div className='max-h-44 space-y-0.5 overflow-y-auto'>
              {catalog.length === 0 ? (
                <p className='px-1 py-2 text-[11px] text-muted'>
                  No {title.toLowerCase()} in the catalogue yet.
                </p>
              ) : filtered.length === 0 ? (
                <p className='px-1 py-2 text-[11px] text-muted'>No matches.</p>
              ) : (
                filtered.map((item) => {
                  const checked = addons.some((a) => a[idField] === item.id);
                  return (
                    <Checkbox
                      key={item.id}
                      checked={checked}
                      onChange={() => toggleItem(item)}
                      label={item.name}
                      hint={
                        type === "tour"
                          ? tourPriceSummary(
                              vehiclePricesFromRow(item),
                              item.price
                            )
                          : item[priceField] != null
                          ? `${formatCurrency(item[priceField])} / pax`
                          : undefined
                      }
                    />
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      <div className='flex items-center justify-between border-t border-dashed border-line-light pt-2.5'>
        <span className='text-[11px] text-muted'>
          Total for {selected.length}{" "}
          {selected.length === 1
            ? itemNounPlural.singular
            : itemNounPlural.plural}
          {type === "tour" && ` (per person, for ${BASELINE_PAX} travellers)`}
        </span>
        <span className={`text-sm font-bold ${theme.total}`}>
          {selected.length > 0 ? formatCurrency(totalPrice) : "—"}
        </span>
      </div>
    </div>
  );
}

// Visa/Meals — each its own collapsible card (a clickable header row, a
// chevron that flips, content shown only while open) rather than plain
// static boxes: click the heading to expand and choose, click again to
// collapse. `open` is owned by the caller (AddonsManager) so it can seed it
// true once this package already has a value set, without fighting a
// manual collapse afterward.
// Every section Card in this editor is one of these now — click the header
// row to expand/collapse, smooth height/opacity animation via framer-motion
// (AnimatePresence handles the exit animation too, not just enter) rather
// than an abrupt show/hide. `iconBg`/`iconColor` default to the same indigo
// square every other section already uses so most
// callers don't need to think about it; Visa/Meals below still override
// them for their own blue/amber identity. `open`/`onToggle` are owned by
// each caller's own local state — some default open (most sections, so
// nothing looks hidden on first load), Visa/Meals seed theirs from whether
// this package already has a value set (see AddonsManager's own effect).
function CollapsibleSection({
  icon: Icon,
  iconBg = "bg-[#EEF0FF]",
  iconColor = "text-[#4F46E5]",
  title,
  description,
  open,
  onToggle,
  className = "",
  children,
}) {
  // overflow-hidden is only needed *during* the height:0<->auto animation
  // (so the grow/shrink itself clips cleanly) — left on permanently (a
  // static class, as this used to be) it also clips anything inside that's
  // meant to visually escape the card once fully open, e.g.
  // InclusionExclusionList's absolutely-positioned catalog dropdown getting
  // cut off mid-row instead of floating over the page. `expanded` flips
  // true only once the open animation actually finishes, and back to false
  // the instant `open` goes false (before the close animation starts), so
  // overflow is only ever hidden while a transition is actually in flight.
  //
  // Initialized to `open` itself, not always `false` — AnimatePresence's
  // `initial={false}` below means a section that starts already expanded
  // (InclusionsExclusionsForm's `useState(true)`) never actually plays an
  // enter animation on first mount, so onAnimationComplete below would
  // never fire and `expanded` would stay stuck at `false` (overflow-hidden
  // stuck on) forever for exactly that section — which is what was still
  // clipping the dropdown after the first pass at this fix.
  const [expanded, setExpanded] = useState(open);
  useEffect(() => {
    if (!open) setExpanded(false);
  }, [open]);

  return (
    <Card className={`${SECTION_CARD} ${className}`}>
      <button
        type='button'
        onClick={onToggle}
        aria-expanded={open}
        className='group flex w-full items-start justify-between gap-3 text-left'
      >
        <SectionHeader
          icon={Icon}
          iconBg={iconBg}
          iconColor={iconColor}
          title={title}
          description={description}
        />
        <span className='flex h-8 w-8 flex-none items-center justify-center rounded-full text-muted transition group-hover:bg-[#F3F4FF] group-hover:text-[#4F46E5]'>
          <LuChevronDown
            size={18}
            className={`transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key='content'
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            onAnimationComplete={() => {
              if (open) setExpanded(true);
            }}
            className={expanded ? "" : "overflow-hidden"}
          >
            <div className='mt-5'>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// Card overrides shared by every section on this page (Card's own default
// radius is rounded-lg; `!` because both classes would otherwise compete).
const SECTION_CARD = "!rounded-xl";

// Icon tile + uppercase accent title + one-line description — the header of
// every section card (CollapsibleSection above, and FlightsSection, which
// isn't collapsible).
function SectionHeader({
  icon: Icon,
  iconBg = "bg-[#EEF0FF]",
  iconColor = "text-[#4F46E5]",
  title,
  description,
}) {
  return (
    <div className='flex min-w-0 items-start gap-3'>
      <div
        className={`flex h-10 w-10 flex-none items-center justify-center rounded-lg ${iconBg}`}
      >
        <Icon size={18} className={iconColor} />
      </div>
      <div className='min-w-0 pt-0.5'>
        <div className='text-sm font-bold uppercase tracking-wide text-[#4F46E5]'>
          {title}
        </div>
        {description && (
          <p className='mt-0.5 text-xs text-muted'>{description}</p>
        )}
      </div>
    </div>
  );
}

// Page-local field label (sentence case, optional red asterisk) — replaces
// the admin-wide uppercase FieldLabel throughout this editor only.
function FieldLabel({ children, required = false }) {
  return (
    <div className='mb-1.5 text-xs font-semibold text-[#334155]'>
      {children}
      {required && <span className='ml-0.5 text-rose-500'>*</span>}
    </div>
  );
}

// Leading icon inside a text input — pair with `pl-10` on the input.
function IconField({ icon: Icon, children }) {
  return (
    <div className='relative'>
      <Icon
        size={16}
        className='pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]'
      />
      {children}
    </div>
  );
}

// Checkbox row with an optional icon and hint line, highlighted when
// checked. Same contract as ui.jsx's Checkbox: onChange(!checked).
function OptionCheckbox({ checked, onChange, icon: Icon, iconClassName = "", label, hint }) {
  return (
    <button
      type='button'
      role='checkbox'
      aria-checked={!!checked}
      onClick={() => onChange?.(!checked)}
      className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]/30 ${
        checked
          ? "border-[#C7D2FE] bg-[#F5F7FF]"
          : "border-transparent hover:bg-[#F8FAFF]"
      }`}
    >
      <span
        className={`mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded border-[1.5px] transition ${
          checked
            ? "border-[#4F46E5] bg-[#4F46E5] text-white"
            : "border-[#CBD5E1] bg-white"
        }`}
      >
        {checked && <LuCheck size={12} strokeWidth={3} />}
      </span>
      {Icon && <Icon size={20} className={`mt-px flex-none ${iconClassName}`} />}
      <span className='min-w-0'>
        <span className='block text-sm font-semibold text-ink'>{label}</span>
        {hint && <span className='mt-0.5 block text-xs text-muted'>{hint}</span>}
      </span>
    </button>
  );
}

// Activities/Tours/Transfers/Flights/Meals are all real fd_addons rows now,
// picked by checkbox and priced straight from the catalog (meals: catalog
// price_per_day × the package's Duration — see 0075). They're opt-in extras
// the agent applies at booking, so none of them touch the advertised Net
// rate. Visa is still a simple "included or not" flag on the package itself
// (form.visaEnabled), the one AddonsManager inclusion that IS folded into
// the live Net rate preview (mirrors the backend's resolveRatePerPax —
// visaRatePerPax in the parent).
function AddonsManager({
  fdPackageId,
  addons,
  onChange,
  form,
  update,
  duration,
  onComputedRateChange,
  addonsEnabled,
  // Rendered beside the Visa card on desktop (the parent passes the
  // Inclusions & Exclusions card) — layout only.
  aside,
}) {
  const [activities, setActivities] = useState([]);
  const [tours, setTours] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [onwardFlights, setOnwardFlights] = useState([]);
  const [returnFlights, setReturnFlights] = useState([]);
  const [meals, setMeals] = useState([]);
  const [visa, setVisa] = useState(null);
  const [loading, setLoading] = useState(true);
  // Visa's collapsible card defaults closed, then forces itself open once
  // the moment loading finishes if this package already has visa enabled —
  // so opening an already-configured package doesn't look like that setting
  // vanished. Only ever forces open, so a manual collapse afterward sticks.
  const [visaOpen, setVisaOpen] = useState(false);
  // Independent of addonsEnabled — that's what shows/hides this whole card
  // in the first place; this just lets the admin collapse it locally once
  // it's on, same "click the heading" behavior as every other section.
  const [addonsSectionOpen, setAddonsSectionOpen] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/activities"),
      api.get("/tours"),
      api.get("/transfers"),
      api.get("/flights?isFlightOnward=true"),
      api.get("/flights?isFlightOnward=false"),
      api.get("/meals"),
      api.get("/visas"),
    ])
      .then(([a, t, tr, fOnward, fReturn, m, v]) => {
        setActivities(a.activities || []);
        setTours(t.tours || []);
        setTransfers(tr.transfers || []);
        setOnwardFlights(fOnward.flights || []);
        setReturnFlights(fReturn.flights || []);
        setMeals(m.meals || []);
        setVisa((v.visas || [])[0] || null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function toggleAddon(type, item, existing) {
    if (existing) {
      await api.del(`/admin/fd-packages/${fdPackageId}/addons/${existing.id}`);
      onChange(addons.filter((a) => a.id !== existing.id));
    } else {
      const { addon } = await api.post(
        `/admin/fd-packages/${fdPackageId}/addons`,
        { [ADDON_ID_FIELD[type]]: item.id }
      );
      onChange([...addons, addon]);
    }
  }

  // "The" lunch/dinner/visa entry — one catalog row per meal_type (and Visa
  // has only ever the one row), so there's nothing else for the admin to
  // choose between. Meals are opt-in fd_addons rows now (0075): toggling a
  // meal checkbox adds/removes an fd_addons row priced price_per_day ×
  // Duration, exactly like the activity/tour/transfer add-on cards.
  // Breakfast is a fixed package inclusion. The Meals catalogue contains
  // optional lunch/dinner rows, and every catalogue row remains selectable.
  const mealAddons = meals.map((meal) => ({ meal, addon: addons.find((a) => a.mealId === meal.id) }));
  const dayCount = parseDurationDays(duration);

  function mealPreviewPerPax(meal) {
    return meal && dayCount ? Number(meal.price_per_day || 0) * dayCount : 0;
  }

  // Only Visa is folded into the package's advertised Net rate now — meals
  // sit in the Add-ons total instead.
  const visaPerPax = form.visaEnabled ? Number(visa?.price_per_person || 0) : 0;

  useEffect(() => {
    if (loading) return;
    onComputedRateChange?.(visaPerPax);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visaPerPax, loading]);

  useEffect(() => {
    if (loading) return;
    if (form.visaEnabled) setVisaOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Bottom summary bar — purely a sum over whatever fd_addons rows already
  // exist (activities + tours + transfers + flights combined, regardless of
  // which cards are currently visible), not a separately-tracked figure —
  // so it can never drift from what the 5 cards above already show.
  const totalAddonsCost = addons.reduce(
    (sum, a) => sum + Number(a.pricePerPax || 0),
    0
  );

  return (
    <div className='space-y-5'>
      {/* The entire Add-ons & Inclusions card — heading included — only
          shows up while the master "Add-ons" checkbox (Merchandising &
          Discovery Attributes, above) is on. Off means it doesn't render at
          all rather than showing a placeholder; nothing already selected is
          deleted, it just isn't on screen until re-enabled. Visa/Meals below
          are separate cards and always render regardless. */}
      {addonsEnabled && (
        <CollapsibleSection
          icon={LuGift}
          title='Add-ons & Inclusions'
          description='Select the add-on activities, tours, transfers, flights and meals the agent can pick at booking.'
          open={addonsSectionOpen}
          onToggle={() => setAddonsSectionOpen((o) => !o)}
        >

          {loading ? (
            <p className='text-sm text-muted'>Loading catalogue…</p>
          ) : (
            <div className='space-y-4'>
              {/* Side by side, 2 per row — each AddonMultiSelectCard is a
                  vertical card (icon/title on top, selector, total at the
                  bottom), which is what lets it sit in a grid column
                  cleanly at any width, unlike a horizontal row layout. */}
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                <AddonMultiSelectCard
                  type='activity'
                  themeKey='activity'
                  icon={LuFootprints}
                  title='Activities'
                  subtitle='Choose one or more activities'
                  itemNounPlural={{
                    singular: "activity",
                    plural: "activities",
                  }}
                  catalog={activities}
                  addons={addons}
                  onToggle={toggleAddon}
                />
                <AddonMultiSelectCard
                  type='tour'
                  themeKey='tour'
                  icon={LuBriefcase}
                  title='Tours'
                  subtitle='Choose one or more tours'
                  itemNounPlural={{ singular: "tour", plural: "tours" }}
                  catalog={tours}
                  addons={addons}
                  onToggle={toggleAddon}
                />
                <AddonMultiSelectCard
                  type='transfer'
                  themeKey='transfer'
                  icon={LuCar}
                  title='Transfers'
                  subtitle='Choose one or more transfer options'
                  itemNounPlural={{ singular: "transfer", plural: "transfers" }}
                  catalog={transfers}
                  addons={addons}
                  onToggle={toggleAddon}
                />
                {/* Only shown when the Flights section above is off —
                    flightsEnabled already locks in one Onward + one Return
                    flight directly on the package, so offering the same two
                    catalogs again here as add-ons would be a duplicate, not
                    an alternative. */}
                {!form.flightsEnabled && (
                  <>
                    <AddonMultiSelectCard
                      type='flight'
                      themeKey='onwardFlight'
                      icon={LuPlaneTakeoff}
                      title='Onward Flights'
                      subtitle='Choose onward flight'
                      itemNounPlural={{
                        singular: "onward flight",
                        plural: "onward flights",
                      }}
                      catalog={onwardFlights.map((f) => ({
                        ...f,
                        name: flightOptionLabel(f),
                      }))}
                      addons={addons}
                      onToggle={toggleAddon}
                    />
                    <AddonMultiSelectCard
                      type='flight'
                      themeKey='returnFlight'
                      icon={LuPlaneLanding}
                      title='Return Flights'
                      subtitle='Choose return flight'
                      itemNounPlural={{
                        singular: "return flight",
                        plural: "return flights",
                      }}
                      catalog={returnFlights.map((f) => ({
                        ...f,
                        name: flightOptionLabel(f),
                      }))}
                      addons={addons}
                      onToggle={toggleAddon}
                    />
                  </>
                )}

                {/* Meals come directly from the Meals catalogue. Show every
                    configured row by its catalogue name, not hard-coded
                    breakfast/dinner labels. */}
                <div className='flex flex-col gap-3 rounded-xl border border-line-light bg-white p-4'>
                  <div className='flex items-center gap-2.5'>
                    <div className='flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#FEF3C7]'>
                      <LuUtensils size={16} className='text-[#D97706]' />
                    </div>
                    <div>
                      <div className='text-sm font-bold text-ink'>Meals</div>
                      <p className='text-[11px] text-muted'>
                        Breakfast is included; dinner can be added at booking
                      </p>
                    </div>
                  </div>
                  <div className='space-y-1'>
                    {mealAddons.length === 0 ? (
                      <p className='text-xs text-muted'>No optional meals have been added in the Meals table yet.</p>
                    ) : mealAddons.map(({ meal, addon }) => {
                      return (
                        <Checkbox
                          key={meal.id}
                          checked={!!addon}
                          onChange={(v) => toggleAddon('meal', meal, v ? undefined : addon)}
                          label={meal.name}
                          hint={meal.price_per_day != null
                            ? `${formatCurrency(meal.price_per_day)}/pax/day${dayCount ? ` · ${formatCurrency(mealPreviewPerPax(meal))}/pax for ${dayCount} day${dayCount === 1 ? '' : 's'}` : ' · set a Duration to price it'}`
                            : 'No price configured yet'}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className='flex items-center justify-between rounded-xl border border-[#E4E9FB] bg-[#F7F8FF] px-4 py-3.5'>
                <div className='flex items-center gap-3'>
                  <div className='flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#EDE9FE]'>
                    <LuWallet size={16} className='text-[#7C3AED]' />
                  </div>
                  <div>
                    <div className='text-sm font-bold text-ink'>
                      Total Add-ons & Inclusions
                    </div>
                    <p className='text-[11px] text-muted'>
                      {addons.length} item{addons.length === 1 ? "" : "s"}{" "}
                      selected
                    </p>
                  </div>
                </div>
                <div className='text-right'>
                  <div className='text-lg font-bold text-[#4F46E5]'>
                    {formatCurrency(totalAddonsCost)}
                  </div>
                  <p className='text-[11px] text-muted'>
                    Total additional cost
                  </p>
                </div>
              </div>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Visa — its own heading, outside Add-ons & Inclusions, always shown
          regardless of addonsEnabled (it's a plain package inclusion folded
          into the Net rate, not an opt-in add-on like Meals). Sits beside
          `aside` (Inclusions & Exclusions) on desktop. */}
      <div
        className={`grid grid-cols-1 items-stretch gap-5 ${
          aside ? "lg:grid-cols-2" : ""
        }`}
      >
        <div className='flex flex-col gap-2'>
          <CollapsibleSection
            icon={LuShieldCheck}
            iconBg='bg-[#DBEAFE]'
            iconColor='text-[#2563EB]'
            title='Visa'
            description='Add visa requirements for this package'
            className='flex-1'
            open={visaOpen}
            onToggle={() => setVisaOpen((o) => !o)}
          >
            <OptionCheckbox
              checked={!!form.visaEnabled}
              onChange={(v) => update("visaEnabled", v)}
              label='Visa assistance included'
              hint={
                visa?.price_per_person != null
                  ? `${formatCurrency(visa.price_per_person)} / pax`
                  : "No visa price configured in the catalogue yet"
              }
            />
          </CollapsibleSection>

          {visaPerPax > 0 && (
            <p className='px-1 text-xs text-muted'>
              Visa adds {formatCurrency(visaPerPax)}/pax to the Net rate below.
            </p>
          )}
        </div>
        {aside}
      </div>
    </div>
  );
}

// Inclusions/Exclusions — client-facing, shown read-only to the agent once
// this package is published (agent/pages/DepartureDetail.jsx), same
// dropdown-from-catalog + editable-list behavior as the Custom FIT Quote
// Inbox (admin/pages/QuoteInboxDetail.jsx) via the shared
// InclusionExclusionList. Persisted as plain fields on `form` — one
// newline-delimited string each — so they ride along with the rest of Save
// as Draft/Publish Package, no separate save step.
function InclusionsExclusionsForm({ form, update, className = "" }) {
  const [open, setOpen] = useState(true);
  return (
    <CollapsibleSection
      icon={LuListChecks}
      title='Inclusions & Exclusions'
      description="Add what's included and excluded in this package"
      className={className}
      open={open}
      onToggle={() => setOpen((o) => !o)}
    >
      <div className='grid grid-cols-1 gap-5 md:grid-cols-2'>
        <InclusionExclusionList
          catalogEntityPath='inclusions'
          label='Inclusions'
          items={linesFromText(form.inclusions)}
          onItemsChange={(items) => update("inclusions", textFromLines(items))}
        />
        <InclusionExclusionList
          catalogEntityPath='exclusions'
          label='Exclusions'
          items={linesFromText(form.exclusions)}
          onItemsChange={(items) => update("exclusions", textFromLines(items))}
        />
      </div>
    </CollapsibleSection>
  );
}

// The backend's `ratePerPax` is the resolved/effective price (override, or
// the itinerary total when there isn't one) — useful for display elsewhere,
// but the editor needs to know whether an override actually exists so it can
// decide "auto" vs "edit" mode. Reshape it into `ratePerPax: rateOverride`
// (raw, nullable) so `form.ratePerPax` always means exactly what a PATCH
// will persist to rate_per_pax, matching PricingForm's expectations.
function toFormState(fdPackage) {
  return { ...fdPackage, ratePerPax: fdPackage.rateOverride ?? null };
}

// A handful of `form` fields are meaningfully `null` — the admin explicitly
// cleared them (Flights' "Turn off" / meal checkboxes unticking / Pricing's
// "Reset to automatic") and that null needs to reach the backend. Every other
// still-`null`/`undefined` field just hasn't been filled in yet (e.g.
// heroImageUrl before any image is uploaded) — sending an explicit null for
// those made the backend's required-field validation reject the *entire*
// autosave PATCH while the admin was still mid-edit, well before Publish, so
// they're left out of the payload entirely instead (standard partial-update:
// the backend keeps whatever it already has for an omitted field).
const NULLABLE_FORM_FIELDS = new Set([
  "ratePerPax",
  "onwardFlightId",
  "returnFlightId",
]);

function buildAutosavePayload(form) {
  const payload = {};
  for (const [key, value] of Object.entries(form)) {
    if (key === 'theme') continue;
    // The package type is saved on its own the moment a tab is picked
    // (changeType) — a stale pending autosave must never flip it back.
    if (key === 'type') continue;
    if (
      (value === null || value === undefined) &&
      !NULLABLE_FORM_FIELDS.has(key)
    )
      continue;
    payload[key] = value;
  }
  return payload;
}

export default function FdPackageEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isNew = id === "new";

  const [form, setForm] = useState({});
  const [categories, setCategories] = useState([]);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryError, setCategoryError] = useState('');
  const [pendingCategoryDelete, setPendingCategoryDelete] = useState('');
  const [packageId, setPackageId] = useState(isNew ? null : id);
  const [dates, setDates] = useState([]);
  const [itinerary, setItinerary] = useState([]);
  const [addons, setAddons] = useState([]);
  // Master "Add-ons" switch (MerchandisingForm) — frontend-only, never
  // persisted (mirrors its old pre-Task-5 self exactly): seeded true only
  // when this package already has addons saved, so an existing package with
  // add-ons doesn't look like they vanished on open. Gates only the priced
  // Activities/Tours/Transfers/Onward/Return Flights cards inside
  // AddonsManager — Visa/Meals there stay visible regardless.
  const [addonsEnabled, setAddonsEnabled] = useState(false);
  const [submitting, setSubmitting] = useState("");
  useEffect(() => {
    api.get('/admin/categories?name=fd_package').then(({ categories: rows }) => setCategories((rows || []).map((row) => row.category))).catch(() => {});
  }, []);

  async function addCategory() {
    setNewCategory('');
    setCategoryError('');
    setCategoryModalOpen(true);
  }

  async function saveCategory() {
    const name = newCategory.trim();
    if (!name) { setCategoryError('Category name is required.'); return; }
    setCategorySaving(true);
    setCategoryError('');
    try {
      const { category: saved } = await api.post('/admin/categories', { name: 'fd_package', category: name });
      const category = saved.category;
      setCategories((current) => current.includes(category) ? current : [...current, category]);
      update('category', category);
      setCategoryModalOpen(false);
    } catch (err) {
      setCategoryError(err.message || 'Unable to create category.');
    } finally { setCategorySaving(false); }
  }

  async function deleteCategory(category) {
    setPendingCategoryDelete(category);
  }

  async function confirmDeleteCategory() {
    const category = pendingCategoryDelete;
    if (!category) return;
    await api.del(`/admin/categories?name=fd_package&category=${encodeURIComponent(category)}`);
    setCategories((current) => current.filter((item) => item !== category));
    if (form.category === category) update('category', '');
    setPendingCategoryDelete('');
  }
  // Live "auto" net rate — the itinerary total (ItineraryManager) plus any
  // included meals/visa (AddonsManager) plus any directly-included flights
  // (FlightsSection, only while flightsEnabled — see its own comment), each
  // reported independently as they're edited so none has to wait on the
  // others or on a save round trip. All three start at null ("still
  // calculating") rather than 0, so the Net rate field shows "—" instead of
  // flashing 0 before all have finished their first pass. Kept separate
  // from `form` so this never gets sent back to the server as if it were
  // the override.
  const [itineraryRatePerPax, setItineraryRatePerPax] = useState(null);
  // Visa is the only AddonsManager inclusion still folded into the Net rate —
  // meals became opt-in add-ons (0075) and show in the Add-ons total instead.
  const [visaRatePerPax, setVisaRatePerPax] = useState(null);
  const [flightsRatePerPax, setFlightsRatePerPax] = useState(null);
  const computedRatePerPax =
    itineraryRatePerPax == null ||
    visaRatePerPax == null ||
    flightsRatePerPax == null
      ? null
      : itineraryRatePerPax + visaRatePerPax + flightsRatePerPax;

  // Task 2 — auto-save to draft. `hasUserEditedRef` is set only by update()
  // below (a real, user-driven field change) — never by the initial load's
  // own setForm(toFormState(...)), so opening an existing package doesn't
  // immediately re-PATCH back the exact data it just loaded.
  const hasUserEditedRef = useRef(false);
  const autosaveTimerRef = useRef(null);
  const [autosaving, setAutosaving] = useState(false);
  // Lets handlePublish / handleBackToCatalog flush the itinerary builder's
  // own debounced autosave before they read `itinerary` or navigate away.
  const itineraryRef = useRef(null);

  useEffect(() => {
    if (isNew) {
      // Create the draft immediately on open rather than waiting for an
      // explicit "Save as Draft" click, so hero image / carousel images /
      // departure dates / itinerary / add-ons are usable right away instead
      // of being gated behind a manual save first.
      api
        .post("/admin/fd-packages", {
          title: "",
          status: "draft",
        })
        .then(({ fdPackage }) => {
          setForm(toFormState(fdPackage));
          setPackageId(fdPackage.id);
          navigate(`/admin/catalog/fd-packages/${fdPackage.id}`, {
            replace: true,
          });
        })
        .catch((err) =>
          toast.error(err.message || "Unable to start a new FD package")
        );
      return;
    }
    api.get(`/admin/fd-packages/${id}`).then(({ fdPackage }) => {
      setForm(toFormState(fdPackage));
      setPackageId(fdPackage.id);
      setDates(fdPackage.departureDates || []);
      setItinerary(fdPackage.itinerary || []);
      setAddons(fdPackage.addons || []);
      setAddonsEnabled((fdPackage.addons || []).length > 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  function update(key, value) {
    hasUserEditedRef.current = true;
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Debounced ~1s after the admin stops changing anything on `form`
  // (Basics/Merchandising/Pricing/Inclusions, all wired through update()
  // above) — reuses the same PATCH endpoint "Save as Draft" used to call
  // directly, just fired automatically instead of on a button click. Never
  // touches `status` itself (unlike handleSave('draft')/('published') below)
  // so autosaving a field on an already-published package can't silently
  // knock it back to draft.
  useEffect(() => {
    if (!packageId || !hasUserEditedRef.current) return undefined;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      setAutosaving(true);
      try {
        await api.patch(
          `/admin/fd-packages/${packageId}`,
          buildAutosavePayload(form)
        );
      } catch (err) {
        toast.error(describeApiError(err));
      } finally {
        setAutosaving(false);
      }
    }, 1000);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, packageId]);

  // Belt-and-braces on top of the debounce above, for the two moments a
  // pending 1s-out autosave could otherwise be lost entirely: leaving via
  // "Back to catalog" (flushed + awaited before navigating, so the next
  // catalog list read is never stale) and an actual page refresh/tab close
  // (best-effort — `keepalive: true` lets the PATCH survive the page
  // unloading, but browsers don't guarantee it completes either way).
  async function flushAutosave() {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    if (!packageId || !hasUserEditedRef.current) return;
    try {
      await api.patch(
        `/admin/fd-packages/${packageId}`,
        buildAutosavePayload(form)
      );
    } catch (err) {
      toast.error(describeApiError(err));
    }
  }

  useEffect(() => {
    function saveOnUnload() {
      if (!packageId || !hasUserEditedRef.current) return;
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      const token = getAccessToken();
      fetch(`${getApiBaseUrl()}${readablePath(`/admin/fd-packages/${packageId}`)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        keepalive: true,
        body: JSON.stringify(buildAutosavePayload(form)),
      }).catch(() => {});
    }
    window.addEventListener("pagehide", saveOnUnload);
    window.addEventListener("beforeunload", saveOnUnload);
    return () => {
      window.removeEventListener("pagehide", saveOnUnload);
      window.removeEventListener("beforeunload", saveOnUnload);
    };
  }, [packageId, form]);

  async function handleBackToCatalog() {
    await flushAutosave();
    await itineraryRef.current?.flush().catch(() => {});
    navigate("/admin/catalog");
  }

  // Inclusions default-seed — same idea as the Custom FIT Quote Inbox
  // (QuoteInboxDetail.jsx's CostingAndPublishing): while Inclusions is
  // completely empty, keep it filled in from what's actually in the
  // package — a hotel on any day adds "Accommodation", a tour adds "Tour as
  // per itinerary", a transfer adds "Travel as per itinerary", an activity
  // adds "Activity as per itinerary", an included lunch/dinner adds
  // "Meals", and (Task 5) a checked Visa adds "Visa assistance" — FD
  // packages get their own visa_enabled flag now, same idea as Custom FIT's
  // agent-facing one. Re-evaluated whenever the itinerary/meals/visa change
  // (unlike the Quote Inbox's one-shot seed on mount) since this editor
  // builds up the itinerary progressively in the same session rather than
  // loading it fully formed already — stops the moment Inclusions has any
  // point of its own, admin-added or previously seeded.
  useEffect(() => {
    if (linesFromText(form.inclusions).length > 0) return;
    const seeded = [];
    if (itineraryHasItemType(itinerary, "hotel")) seeded.push("Accommodation");
    if (itineraryHasItemType(itinerary, "tour"))
      seeded.push("Tour as per itinerary");
    if (itineraryHasItemType(itinerary, "transfer"))
      seeded.push("Travel as per itinerary");
    if (itineraryHasItemType(itinerary, "activity"))
      seeded.push("Activity as per itinerary");
    // Meals are opt-in add-ons now (0075) — not a default inclusion, so no
    // longer auto-seeded here.
    if (form.visaEnabled) seeded.push("Visa assistance");
    if (seeded.length > 0) update("inclusions", textFromLines(seeded));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itinerary, form.visaEnabled, form.inclusions]);

  // Blind pricing aside, the itinerary is the one thing PRD explicitly
  // requires before a package goes live (FGD-2 / ADM-6 catalog screens both
  // show the full day-by-day plan). Checked against `itinerary` — the last
  // autosaved state; handlePublish awaits itineraryRef.current.flush() first
  // and passes the freshly-saved shape in, so a mid-edit publish still sees
  // current data rather than a ~1s-stale copy.
  // `itinerary` is now the { dayNumber, notes, items } shape (see
  // ItineraryManager above) — days with neither notes nor items are omitted
  // entirely rather than kept as an empty row, so "every day has content" is
  // checked by looking each day 1..targetDays up rather than by length.
  function findItineraryPublishError(itineraryOverride) {
    const it = itineraryOverride || itinerary;
    if (!it.length) return "Add the day-by-day itinerary before publishing.";
    const targetDays = parseDurationDays(form.duration);
    if (!targetDays) return null;
    const byDay = new Map(it.map((d) => [d.dayNumber, d]));
    for (let n = 1; n <= targetDays; n++) {
      const day = byDay.get(n);
      const items = day?.items || [];
      // Leisure days (0105) are complete as they are — their hotel is
      // optional, except on Day 1, where the stay has to start somewhere.
      if (day?.leisure) {
        if (n === 1 && !items.some((item) => item.type === "hotel"))
          return "Day 1 is a leisure day — select a hotel for Day 1 before publishing.";
        continue;
      }
      const hasContent = (day?.notes || "").trim() || items.length > 0;
      if (!hasContent)
        return `Day ${n} is missing itinerary details. Fill in every day before publishing.`;
    }
    return null;
  }

  // Mirrors findItineraryPublishError just above — checked once more, right
  // before Publish, since CarouselImagesUpload's own inline hint only warns
  // rather than blocking anything on its own.
  function findCarouselImagesError() {
    if ((form.images || []).length < MIN_CAROUSEL_IMAGES) {
      return `Add at least ${MIN_CAROUSEL_IMAGES} carousel images before publishing.`;
    }
    return null;
  }

  // Mirrors findCarouselImagesError just above — heroImageUrl is nullable in
  // the backend schema on purpose (a package can sit in draft with no hero
  // image yet), so this only blocks the moment of Publish, same gate the
  // backend's own heroImageError re-checks server-side.
  function findHeroImageError() {
    if (!form.heroImageUrl) {
      return "Add a hero image before publishing.";
    }
    return null;
  }

  function findPackageDetailsError() {
    if (!String(form.title || '').trim()) return 'Enter a package name before publishing.';
    if (!String(form.category || '').trim()) return 'Select a category before publishing.';
    return null;
  }

  // Mirrors findCarouselImagesError just above — only fires once the
  // Flights section is actually switched on; leaving it off is always fine
  // (the flights just show up as add-ons in AddonsManager instead).
  function findFlightsSelectionError() {
    if (form.flightsEnabled && (!form.onwardFlightId || !form.returnFlightId)) {
      return "Select both an Onward and a Return flight, or turn off the Flights section, before publishing.";
    }
    return null;
  }

  // The package-type tabs. Saved immediately (not via autosave) and only
  // reflected in the form once the server accepts it — the backend refuses a
  // type change on a published package, or turning a package that still has
  // departure dates into a Readymade one.
  async function changeType(next) {
    if (!packageId || next === (form.type || "fd_package")) return;
    try {
      const { fdPackage } = await api.patch(`/admin/fd-packages/${packageId}`, { type: next });
      setForm((f) => ({
        ...f,
        type: fdPackage.type,
        allCities: fdPackage.allCities,
        departureCities: fdPackage.departureCities,
      }));
    } catch (err) {
      toast.error(describeApiError(err));
    }
  }

  // Readymade packages have no dates or seats to validate; what they need to
  // publish is somewhere to depart from. FD packages are unchanged.
  function findReadymadeCitiesError() {
    if (
      form.type === "readymade" &&
      !form.allCities &&
      !(form.departureCities || []).length
    ) {
      return 'Select "All cities" or at least one departure city before publishing.';
    }
    return null;
  }

  // Task 2 — "Save as Draft" is gone (autosave above covers it); this is now
  // just the one remaining explicit action, publishing.
  async function handlePublish() {
    // Flush any pending itinerary autosave so the publish gate checks the
    // current day-by-day plan, not a ~1s-stale copy. flush() returns the
    // just-saved itinerary (state from onChange hasn't re-rendered yet).
    let flushedItinerary = null;
    try {
      flushedItinerary = await itineraryRef.current?.flush();
    } catch (err) {
      toast.error(describeApiError(err));
      return;
    }
    const itineraryError = findItineraryPublishError(flushedItinerary);
    if (itineraryError) {
      toast.error(itineraryError);
      return;
    }
    const packageDetailsError = findPackageDetailsError();
    if (packageDetailsError) {
      toast.error(packageDetailsError);
      return;
    }
    const carouselImagesError = findCarouselImagesError();
    if (carouselImagesError) {
      toast.error(carouselImagesError);
      return;
    }
    const heroImageError = findHeroImageError();
    if (heroImageError) {
      toast.error(heroImageError);
      return;
    }
    const flightsSelectionError = findFlightsSelectionError();
    if (flightsSelectionError) {
      toast.error(flightsSelectionError);
      return;
    }
    const readymadeCitiesError = findReadymadeCitiesError();
    if (readymadeCitiesError) {
      toast.error(readymadeCitiesError);
      return;
    }
    setSubmitting("published");
    try {
      const { theme: _legacyTheme, type: _type, ...packageForm } = form;
      const payload = { ...packageForm, status: "published" };
      if (!packageId) {
        const { fdPackage } = await api.post("/admin/fd-packages", payload);
        setPackageId(fdPackage.id);
        navigate(`/admin/catalog/fd-packages/${fdPackage.id}`, {
          replace: true,
        });
      } else {
        const { fdPackage } = await api.patch(
          `/admin/fd-packages/${packageId}`,
          payload
        );
        setForm(toFormState(fdPackage));
      }
      toast.success(form.type === "readymade" ? "Readymade package published" : "FD package published");
    } catch (err) {
      toast.error(describeApiError(err));
    } finally {
      setSubmitting("");
    }
  }

  return (
    <div className='min-h-screen bg-[#F4F7FF]'>
      {/* Full width of the workspace beside the sidebar (no max-w/mx-auto
          cap) — AdminLayout's content column is already `min-w-0 flex-1`,
          so this follows the sidebar's collapsed/expanded width by itself. */}
      <div className='w-full px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8 2xl:px-10'>
        <header className='mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
          <div>
            <button
              type='button'
              onClick={handleBackToCatalog}
              className='mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-[#4F46E5]'
            >
              <LuArrowLeft size={14} />
              Back to catalogue
            </button>
            <h2 className='text-3xl font-bold tracking-tight text-ink'>
              {form.status === "published" ? "Edit Package" : "Create Package"}
            </h2>
            <p className='mt-1 text-sm text-muted'>
              {form.status === "published"
                ? "Update this travel package and its details"
                : "Add a new travel package with all the required details"}
            </p>
          </div>
          <PackageTypeTabs
            type={form.type || "fd_package"}
            locked={!!form.status && form.status !== "draft"}
            onChange={changeType}
          />
        </header>

        <div className='space-y-5'>
          <BasicsForm form={form} update={update} packageId={packageId} categories={categories} onAddCategory={addCategory} onDeleteCategory={deleteCategory} />

          {packageId && (
            <>
              {form.type === "readymade" ? (
                <ReadymadeCitiesSection form={form} update={update} />
              ) : (
                <DepartureDatesManager
                  fdPackageId={packageId}
                  dates={dates}
                  onChange={setDates}
                />
              )}
              <ItineraryManager
                ref={itineraryRef}
                fdPackageId={packageId}
                itinerary={itinerary}
                duration={form.duration}
                onChange={setItinerary}
                onComputedRateChange={setItineraryRatePerPax}
                readymade={form.type === "readymade"}
              />
              {/* Flights + Merchandising side by side on desktop. Flights
                  either locks in one Onward + one Return flight directly
                  here, or is left off and AddonsManager offers the same two
                  catalogs as add-ons instead. */}
              <div className='grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2'>
                <FlightsSection
                  form={form}
                  update={update}
                  onComputedRateChange={setFlightsRatePerPax}
                />
                <MerchandisingForm
                  form={form}
                  update={update}
                  addonsEnabled={addonsEnabled}
                  onToggleAddons={setAddonsEnabled}
                />
              </div>
              {/* Task 4/5 replaced the old gated-behind-a-toggle AddonsManager
                  with one that always renders, each item opt-in by its own
                  checkbox — the master toggle itself is back (Merchandising's
                  "Add-ons" checkbox above), but only hides/shows the priced
                  catalog cards inside; Visa/Meals here still always render.
                  Inclusions & Exclusions summarizes what's already been built
                  above (itinerary + add-ons) and sits beside Visa. */}
              <AddonsManager
                fdPackageId={packageId}
                addons={addons}
                onChange={setAddons}
                form={form}
                update={update}
                duration={form.duration}
                onComputedRateChange={setVisaRatePerPax}
                addonsEnabled={addonsEnabled}
                aside={
                  <InclusionsExclusionsForm
                    form={form}
                    update={update}
                    className='h-full'
                  />
                }
              />
            </>
          )}
          {!packageId && (
            <>
              <p className='flex items-center gap-2 text-xs text-muted'>
                <LuLoaderCircle size={14} className='animate-spin' />
                Setting up…
              </p>
              <InclusionsExclusionsForm form={form} update={update} />
            </>
          )}

          {/* Rendered last — the net rate is computed from the itinerary and
              meals above, so it reads naturally as a summary once everything
              else is set. */}
          <PricingForm
            form={form}
            update={update}
            computedRatePerPax={computedRatePerPax}
          />
        </div>

        {/* Sticky action bar. Every field above autosaves a moment after you
            stop typing — this shows that status next to the Publish action,
            nothing new added. Sticky (not fixed) so it never covers the last
            section once you've scrolled to the bottom. */}
        <div className='sticky bottom-0 z-20 -mx-4 mt-6 border-t border-[#E4E9FB] bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 2xl:-mx-10 2xl:px-10'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <span
              className={`flex items-center gap-2 text-sm font-semibold ${
                autosaving ? "text-muted" : "text-[#16A34A]"
              }`}
            >
              {autosaving ? (
                <LuLoaderCircle size={16} className='flex-none animate-spin' />
              ) : (
                <LuCircleCheck size={16} className='flex-none' />
              )}
              {autosaving ? "Saving…" : "All changes saved"}
            </span>
            <Button
              variant='accent'
              className='h-11 gap-2 px-6 text-sm'
              disabled={!!submitting}
              onClick={handlePublish}
            >
              {submitting === "published" ? (
                <>
                  <LuLoaderCircle size={16} className='animate-spin' />
                  Publishing…
                </>
              ) : (
                <>
                  Publish Package
                  <LuArrowRight size={16} />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      {categoryModalOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
          <button type='button' aria-label='Close category dialog' className='fixed inset-0 bg-black/30' onClick={() => !categorySaving && setCategoryModalOpen(false)} />
          <div className='relative z-10 w-full max-w-md rounded-xl border border-line-light bg-white p-6 shadow-xl'>
            <h3 className='text-lg font-bold text-ink'>Create FD package category</h3>
            <p className='mt-1 text-sm text-muted'>Add a category to the dropdown and assign it to this package.</p>
            <TextInput autoFocus className='mt-4 w-full' placeholder='e.g. Adventure' value={newCategory} onChange={(event) => setNewCategory(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && saveCategory()} />
            {categoryError && <p className='mt-2 text-xs text-rose-600'>{categoryError}</p>}
            <div className='mt-5 flex justify-end gap-2'>
              <Button type='button' disabled={categorySaving} onClick={() => setCategoryModalOpen(false)}>Cancel</Button>
              <Button type='button' variant='accent' disabled={categorySaving} onClick={saveCategory}>{categorySaving ? 'Creating…' : 'Create category'}</Button>
            </div>
          </div>
        </div>
      )}
      {pendingCategoryDelete && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
          <button type='button' aria-label='Close delete dialog' className='fixed inset-0 bg-black/30' onClick={() => setPendingCategoryDelete('')} />
          <div className='relative z-10 w-full max-w-md rounded-xl border border-line-light bg-white p-6 shadow-xl'>
            <h3 className='text-lg font-bold text-ink'>Delete category?</h3>
            <p className='mt-2 text-sm text-muted'>Are you sure you want to delete <span className='font-semibold text-ink'>“{pendingCategoryDelete}”</span>?</p>
            <div className='mt-5 flex justify-end gap-2'>
              <Button type='button' onClick={() => setPendingCategoryDelete('')}>No</Button>
              <Button type='button' variant='danger' onClick={confirmDeleteCategory}>Yes, delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
