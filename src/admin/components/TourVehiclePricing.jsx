import { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import { Button, TextInput } from "./ui.jsx";
import { TOUR_VEHICLE_TIERS, paxRangeLabel, vehiclePerPersonPrice } from "../../shared/tourPricing.js";
import { formatCurrency } from "../../shared/fdPackage/index.js";
import { LuCheck, LuChevronDown, LuPencil, LuTrash2 } from "react-icons/lu";

// Tour pricing table for the admin tour forms (TourEditor.jsx and
// MiceCatalog.jsx's MiceTourForm): one TOTAL price per vehicle, by group
// size, instead of a single per-person price. The price entered is the total
// for a full vehicle; the per-person price is that divided by the vehicle's
// capacity (max group size). `form` holds the prices under
// each tier's camelCase `field` (priceSedan, priceLandCruiser, …) — the same
// keys the API's tourSchema accepts.
export function TourVehiclePricingFields({ form, onChange, legacyPrice }) {
  return (
    <div className='sm:col-span-2'>
      <div className='mb-1 flex flex-wrap items-baseline justify-between gap-2'>
        <span className='text-[10px] font-semibold uppercase tracking-wide text-muted'>
          Tour pricing by vehicle
        </span>
      </div>
      <div className='overflow-hidden rounded-lg border border-[#E4E9FB]'>
        <table className='w-full text-left text-xs'>
          <thead>
            <tr className='bg-[#F3F4FF]'>
              <th className='border-b border-[#E4E9FB] px-3 py-2 font-semibold uppercase text-[#4F46E5]'>
                Vehicle
              </th>
              <th className='border-b border-[#E4E9FB] px-3 py-2 font-semibold uppercase text-[#4F46E5]'>
                Group size
              </th>
              <th className='border-b border-[#E4E9FB] px-3 py-2 font-semibold uppercase text-[#4F46E5]'>
                Total vehicle price (OMR)
              </th>
              <th className='hidden border-b border-[#E4E9FB] px-3 py-2 text-right font-semibold uppercase text-[#4F46E5] sm:table-cell'>
                Per person
              </th>
            </tr>
          </thead>
          <tbody>
            {TOUR_VEHICLE_TIERS.map((tier) => {
              const value = form[tier.field];
              const price = Number(value);
              return (
                <tr
                  key={tier.key}
                  className='border-b border-line-light last:border-0'
                >
                  <td className='px-3 py-2 font-semibold text-ink'>
                    {tier.label}
                  </td>
                  <td className='px-3 py-2 text-muted'>
                    {paxRangeLabel(tier)}
                  </td>
                  <td className='px-3 py-1.5'>
                    <TextInput
                      type='number'
                      min='0.01'
                      step='0.001'
                      aria-label={`${tier.label} price`}
                      placeholder='0.00'
                      value={value ?? ""}
                      onChange={(e) => onChange(tier.field, e.target.value)}
                    />
                  </td>
                  <td className='hidden px-3 py-2 text-right text-muted sm:table-cell'>
                    {price > 0
                      ? formatCurrency(
                          vehiclePerPersonPrice({ price, maxPax: tier.maxPax })
                        )
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {legacyPrice != null && vehiclePrices.length === 0 && (
        <p className='mt-1.5 text-[11px] text-muted'>
          This tour used a single per-person price of{" "}
          {formatCurrency(legacyPrice)}. It keeps being charged that way until
          you fill in the vehicle prices above.
        </p>
      )}
    </div>
  );
}

// Wide vehicle dropdown for the tour pricing row: a wider panel than the field
// itself, listing each vehicle with its group size, price and per-person price
// in aligned columns. Positioned with fixed coordinates so the table's
// horizontal scroll container can't clip it.
function VehicleSelect({ vehicles, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const selected = vehicles.find((v) => v.id === value) || null;

  function toggle() {
    if (!open && buttonRef.current) setRect(buttonRef.current.getBoundingClientRect());
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (panelRef.current?.contains(event.target) || buttonRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKey = (event) => event.key === "Escape" && setOpen(false);
    const onMove = () => setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  const panelWidth = rect ? Math.min(Math.max(rect.width, 680), window.innerWidth - 24) : 680;
  const left = rect ? Math.max(12, Math.min(rect.left, window.innerWidth - panelWidth - 12)) : 0;
  const spaceBelow = rect ? window.innerHeight - rect.bottom : 0;
  const openUp = rect && spaceBelow < 260 && rect.top > spaceBelow;

  return (
    <>
      <button
        ref={buttonRef}
        type='button'
        aria-label='Vehicle'
        aria-haspopup='listbox'
        aria-expanded={open}
        onClick={toggle}
        className={`flex w-full min-w-[220px] items-center justify-between gap-3 rounded-md border bg-white px-3 py-2 text-left text-sm transition ${
          open ? "border-accent ring-2 ring-accent/20" : "border-line-light hover:border-accent/50"
        }`}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? "font-semibold text-ink" : "text-muted"}`}>
          {selected ? selected.name : "Select a vehicle"}
        </span>
        <LuChevronDown size={16} className={`flex-none text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && rect && (
        <div
          ref={panelRef}
          role='listbox'
          style={{
            position: "fixed",
            left,
            width: panelWidth,
            ...(openUp ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
            maxHeight: 320,
          }}
          className='z-[60] overflow-y-auto rounded-lg border border-line-light bg-white shadow-xl'
        >
          <div className='sticky top-0 grid grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b border-[#E4E9FB] bg-[#F3F4FF] px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#4F46E5]'>
            <span>Vehicle</span>
            <span>Group size</span>
            <span className='text-right'>Vehicle price</span>
            <span className='text-right'>Per person</span>
          </div>
          {vehicles.length === 0 ? (
            <p className='px-4 py-4 text-xs text-muted'>No vehicles available to add.</p>
          ) : (
            vehicles.map((v) => {
              const active = v.id === value;
              const hasPrice = v.price != null && Number(v.price) > 0;
              return (
                <button
                  key={v.id}
                  type='button'
                  role='option'
                  aria-selected={active}
                  onClick={() => {
                    onChange(v.id);
                    setOpen(false);
                  }}
                  className={`grid w-full grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-4 border-b border-line-light px-4 py-2.5 text-left text-sm last:border-0 transition ${
                    active ? "bg-accent-soft/50" : "hover:bg-panel/70"
                  }`}
                >
                  <span className='flex min-w-0 items-center gap-2 font-semibold text-ink'>
                    <span className='flex h-4 w-4 flex-none items-center justify-center'>
                      {active && <LuCheck size={14} className='text-accent' />}
                    </span>
                    <span className='break-words'>{v.name}</span>
                  </span>
                  <span className='text-xs text-muted'>
                    {v.min_pax}–{v.max_pax} people
                  </span>
                  <span className='text-right text-xs text-ink'>
                    {hasPrice ? formatCurrency(v.price) : "—"}
                  </span>
                  <span className='text-right text-xs font-semibold text-ink'>
                    {hasPrice ? formatCurrency(vehiclePerPersonPrice({ price: v.price, maxPax: v.max_pax })) : "—"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </>
  );
}

// Tour "pricing by vehicle" (TourEditor): each row is a vehicle picked from the
// Product Catalog's Vehicles tab plus the TOTAL price for that vehicle filled
// to capacity. Group size comes from the vehicle; the per-person price is the
// total divided by its maximum passengers. Any number of vehicles can be
// added, each once.
export function EditableTourVehiclePricingFields({
  vehiclePrices,
  onChange,
  legacyPrice,
}) {
  const [vehicles, setVehicles] = useState([]);
  const [vehiclesError, setVehiclesError] = useState("");
  const [editingKey, setEditingKey] = useState(null);
  const [draft, setDraft] = useState(null);
  const [draftError, setDraftError] = useState("");

  useEffect(() => {
    api
      .get("/vehicles")
      .then(({ vehicles: list }) =>
        setVehicles(
          [...(list || [])].sort(
            (a, b) => a.min_pax - b.min_pax || a.name.localeCompare(b.name)
          )
        )
      )
      .catch((err) => setVehiclesError(err.message || "Unable to load vehicles"));
  }, []);

  const vehicleById = (id) => vehicles.find((v) => v.id === id) || null;

  // A vehicle can be priced once per tour; the row being edited keeps its own.
  const takenIds = new Set(
    vehiclePrices
      .filter((row) => row.key !== editingKey)
      .map((row) => row.vehicleId)
      .filter(Boolean)
  );
  const available = vehicles.filter((v) => !takenIds.has(v.id));

  function startAdd() {
    const key = `vehicle-${Date.now()}`;
    setEditingKey(key);
    setDraft({ key, vehicleId: "", price: "" });
    setDraftError("");
  }

  function startEdit(row) {
    setEditingKey(row.key);
    setDraft({ key: row.key, vehicleId: row.vehicleId || "", price: String(row.price ?? "") });
    setDraftError("");
  }

  function saveDraft() {
    const vehicle = vehicleById(draft.vehicleId);
    const price = Number(draft.price);
    if (!vehicle) {
      setDraftError("Choose a vehicle.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setDraftError("Enter a positive price for this vehicle.");
      return;
    }
    const nextRow = {
      key: draft.key,
      vehicleId: vehicle.id,
      label: vehicle.name,
      minPax: vehicle.min_pax,
      maxPax: vehicle.max_pax,
      price,
    };
    const exists = vehiclePrices.some((row) => row.key === editingKey);
    onChange(
      exists
        ? vehiclePrices.map((row) => (row.key === editingKey ? nextRow : row))
        : [...vehiclePrices, nextRow]
    );
    setEditingKey(null);
    setDraft(null);
    setDraftError("");
  }

  function cancelEdit() {
    setEditingKey(null);
    setDraft(null);
    setDraftError("");
  }

  function renderEditor() {
    const chosen = vehicleById(draft.vehicleId);
    const price = Number(draft.price);
    return (
      <tr key={editingKey} className='border-t border-line-light bg-panel/40'>
        <td className='min-w-[240px] px-2 py-2'>
          <VehicleSelect
            vehicles={available}
            value={draft.vehicleId}
            onChange={(vehicleId) => {
              const picked = vehicleById(vehicleId);
              setDraft((current) => ({
                ...current,
                vehicleId,
                // Start from the vehicle's own price; still editable per tour.
                price:
                  current.price === "" && picked?.price != null
                    ? String(Number(picked.price))
                    : current.price,
              }));
              setDraftError("");
            }}
          />
        </td>
        <td className='px-3 py-2 text-muted'>
          {chosen ? `${chosen.min_pax}–${chosen.max_pax} people` : "—"}
        </td>
        <td className='px-2 py-2'>
          <TextInput
            type='number'
            min='0.01'
            step='0.01'
            aria-label='Total vehicle price'
            placeholder='Total price (OMR)'
            value={draft.price}
            onChange={(event) => {
              setDraft((current) => ({ ...current, price: event.target.value }));
              setDraftError("");
            }}
          />
        </td>
        <td className='px-3 py-2 text-right text-muted'>
          {chosen && price > 0
            ? formatCurrency(
                vehiclePerPersonPrice({ price, maxPax: chosen.max_pax })
              )
            : "—"}
        </td>
        <td className='px-2 py-2 text-right'>
          <div className='flex justify-end gap-2'>
            <Button size='sm' variant='accent' onClick={saveDraft}>
              Save
            </Button>
            <Button size='sm' onClick={cancelEdit}>
              Cancel
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className='sm:col-span-2'>
      <div className='mb-1 flex items-baseline justify-between gap-2'>
        <span className='text-[10px] font-semibold uppercase tracking-wide text-muted'>
          Tour pricing by vehicle
        </span>
      </div>
      <div className='overflow-x-auto rounded-lg border border-[#E4E9FB]'>
        <table className='w-full min-w-[640px] text-left text-xs'>
          <thead>
            <tr className='bg-[#F3F4FF]'>
              <th className='px-3 py-2 font-semibold uppercase text-[#4F46E5]'>
                Vehicle
              </th>
              <th className='px-3 py-2 font-semibold uppercase text-[#4F46E5]'>
                Group size
              </th>
              <th className='px-3 py-2 font-semibold uppercase text-[#4F46E5]'>
                Total vehicle price (OMR)
              </th>
              <th className='px-3 py-2 text-right font-semibold uppercase text-[#4F46E5]'>
                Per person
              </th>
              <th className='px-3 py-2 text-right font-semibold uppercase text-[#4F46E5]'>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {vehiclePrices.map((row) =>
              editingKey === row.key ? (
                renderEditor()
              ) : (
                <tr key={row.key} className='border-t border-line-light'>
                  <td className='px-3 py-2 font-semibold text-ink'>
                    {row.label}
                  </td>
                  <td className='px-3 py-2 text-muted'>
                    {row.minPax}–{row.maxPax} people
                  </td>
                  <td className='px-3 py-2'>{formatCurrency(row.price)}</td>
                  <td className='px-3 py-2 text-right text-muted'>
                    {formatCurrency(vehiclePerPersonPrice(row))}
                  </td>
                  <td className='px-3 py-2 text-right'>
                    <div className='flex justify-end gap-1.5'>
                      <button type='button' title={`Edit ${row.label}`} aria-label={`Edit ${row.label}`} onClick={() => startEdit(row)} className='flex h-8 w-8 items-center justify-center rounded-md border border-line-light text-muted transition hover:border-accent hover:text-accent'>
                        <LuPencil size={14} />
                      </button>
                      <button type='button' title={`Delete ${row.label}`} aria-label={`Delete ${row.label}`} onClick={() => onChange(vehiclePrices.filter((item) => item.key !== row.key))} className='flex h-8 w-8 items-center justify-center rounded-md border border-[#FECACA] text-[#B91C1C] transition hover:bg-[#FEF2F2]'>
                        <LuTrash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
            {editingKey &&
              !vehiclePrices.some((row) => row.key === editingKey) &&
              renderEditor()}
            {vehiclePrices.length === 0 && !editingKey && (
              <tr>
                <td colSpan='5' className='px-3 py-4 text-center text-muted'>
                  No vehicles added yet.
                </td>
              </tr>
            )}
            <tr className='border-t border-line-light'>
              <td colSpan='5' className='px-3 py-2 text-right'>
                <Button
                  size='sm'
                  variant='accent'
                  disabled={!!editingKey || (vehicles.length > 0 && available.length === 0)}
                  onClick={startAdd}
                >
                  Add
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {vehicles.length === 0 && !vehiclesError && (
        <p className='mt-1.5 text-[11px] text-muted'>
          No vehicles available yet. Add them in Product Catalogue &rsaquo; Vehicles.
        </p>
      )}
      {vehicles.length > 0 && available.length === 0 && !editingKey && (
        <p className='mt-1.5 text-[11px] text-muted'>
          Every vehicle in the Vehicles list is already priced on this tour.
        </p>
      )}
      {vehiclesError && (
        <p role='alert' className='mt-1 text-xs text-[#B91C1C]'>
          {vehiclesError}
        </p>
      )}
      {draftError && (
        <p role='alert' className='mt-1 text-xs text-[#B91C1C]'>
          {draftError}
        </p>
      )}
      {legacyPrice != null && (
        <p className='mt-1.5 text-[11px] text-muted'>
          This tour still has its previous per-person price of{" "}
          {formatCurrency(legacyPrice)} until you add a vehicle price.
        </p>
      )}
    </div>
  );
}

// Form values for each tier from a raw tour row (snake_case columns).
export function vehiclePriceFormValues(tour) {
  const out = {};
  for (const tier of TOUR_VEHICLE_TIERS)
    out[tier.field] = tour?.[tier.column] ?? "";
  return out;
}

// Numeric payload for the API — only tiers that have a value.
export function vehiclePricePayload(form) {
  if (Array.isArray(form.vehiclePrices)) {
    return {
      vehiclePrices: form.vehiclePrices.map((vehicle) => ({
        key: vehicle.key,
        ...(vehicle.vehicleId ? { vehicleId: vehicle.vehicleId } : {}),
        label: vehicle.label,
        minPax: Number(vehicle.minPax),
        maxPax: Number(vehicle.maxPax),
        price: Number(vehicle.price),
      })),
    };
  }
  const out = {};
  for (const tier of TOUR_VEHICLE_TIERS) {
    if (
      form[tier.field] !== "" &&
      form[tier.field] !== undefined &&
      form[tier.field] !== null
    )
      out[tier.field] = Number(form[tier.field]);
  }
  return out;
}
