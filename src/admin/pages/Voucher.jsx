import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  LuDownload,
  LuEye,
  LuImageOff,
  LuLoader,
  LuPencil,
  LuPlus,
  LuRefreshCw,
  LuRotateCcw,
  LuSearch,
  LuTicket,
  LuTrash2,
  LuUpload,
  LuX,
} from "react-icons/lu";
import VoucherDocument, { PAGE_H, PAGE_W } from "../voucher/VoucherDocument.jsx";
import { downloadVoucherPdf } from "../voucher/downloadVoucherPdf.js";
import {
  NEW_VOUCHER,
  TEMPLATE_DEFAULTS,
  withTemplateDefaults,
} from "../voucher/voucherTemplate.js";
import { api } from "../api/client.js";
import {
  Badge,
  Button,
  Card,
  Select,
  TextInput,
  Textarea,
} from "../components/ui.jsx";
import ConfirmDialog from "../../shared/components/ConfirmDialog.jsx";

const dateLabel = (v) => {
  if (!v) return "—";
  const raw = String(v);
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw
  );
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const REQUIRED = ["bookingId", "client", "property", "arrival", "departure", "status"];
const LABELS = {
  bookingId: "Booking ID",
  client: "Client",
  property: "Property",
  arrival: "Arrival",
  departure: "Departure",
  status: "Status",
};

// Scales the 794px A4 page down to whatever width its column has.
function ScaledPage({ v, maxWidth }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(0.6);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => setScale(Math.min(1, (maxWidth || el.clientWidth) / PAGE_W, el.clientWidth / PAGE_W));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxWidth]);
  return (
    <div ref={ref} className='w-full'>
      <div
        className='mx-auto overflow-hidden bg-white shadow-[0_6px_24px_rgba(15,23,42,0.18)]'
        style={{ width: PAGE_W * scale, height: PAGE_H * scale }}
      >
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: PAGE_W }}>
          <VoucherDocument v={v} />
        </div>
      </div>
    </div>
  );
}

function Section({ title, hint, children }) {
  return (
    <section className='rounded-lg border border-line-light bg-white p-4'>
      <h3 className='text-sm font-bold text-ink'>{title}</h3>
      {hint && <p className='mb-3 text-xs text-muted'>{hint}</p>}
      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${hint ? "" : "mt-3"}`}>{children}</div>
    </section>
  );
}

function Field({ label, required, wide, children }) {
  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className='mb-1 block text-[11px] font-semibold uppercase text-muted'>
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

// Logo / stamp picker: upload (Cloudinary), reset to the default image,
// remove, and set the printed width/height (px on the A4 page) with an
// optional aspect-ratio lock.
function ImageField({ label, urlKey, wKey, hKey, data, set }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [lock, setLock] = useState(true);
  const fileRef = useRef(null);
  const url = data[urlKey];
  const w = data[wKey];
  const h = data[hKey];

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      setErr("Upload a PNG, JPG or WEBP image.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await api.postForm("/admin/vouchers/assets", fd);
      const ratio = res.width && res.height ? res.height / res.width : null;
      const width = Number(w) || TEMPLATE_DEFAULTS[wKey];
      set({
        [urlKey]: res.url,
        ...(ratio ? { [hKey]: Math.max(1, Math.round(width * ratio)) } : {}),
      });
    } catch (ex) {
      setErr(ex.message || "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  function setSize(key, value) {
    const n = Number(value);
    const patch = { [key]: value };
    if (lock && n > 0 && Number(w) > 0 && Number(h) > 0) {
      const ratio = Number(h) / Number(w);
      if (key === wKey) patch[hKey] = Math.max(1, Math.round(n * ratio));
      else patch[wKey] = Math.max(1, Math.round(n / ratio));
    }
    set(patch);
  }

  return (
    <div className='sm:col-span-2'>
      <span className='mb-1 block text-[11px] font-semibold uppercase text-muted'>{label}</span>
      <div className='flex flex-wrap items-center gap-3 rounded-md border border-[#D7DDF0] bg-[#FAFBFF] p-3'>
        <div className='flex h-14 w-36 items-center justify-center rounded border border-dashed border-line-light bg-white'>
          {url ? (
            <img src={url} alt='' className='max-h-12 max-w-[8.5rem] object-contain' />
          ) : (
            <span className='text-xs text-muted'>No image</span>
          )}
        </div>
        <div className='flex flex-wrap gap-2'>
          <input ref={fileRef} type='file' accept='image/png,image/jpeg,image/webp' hidden onChange={onFile} />
          <Button type='button' onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? <LuLoader className='mr-1.5 animate-spin' /> : <LuUpload className='mr-1.5' />}
            {url ? "Change" : "Upload"}
          </Button>
          <Button
            type='button'
            title='Use the default image'
            onClick={() =>
              set({ [urlKey]: TEMPLATE_DEFAULTS[urlKey], [wKey]: TEMPLATE_DEFAULTS[wKey], [hKey]: TEMPLATE_DEFAULTS[hKey] })
            }
          >
            <LuRotateCcw className='mr-1.5' />
            Default
          </Button>
          {url && (
            <Button type='button' onClick={() => set({ [urlKey]: "" })}>
              <LuImageOff className='mr-1.5' />
              Remove
            </Button>
          )}
        </div>
        <div className='flex w-full flex-wrap items-end gap-3'>
          <label className='w-28'>
            <span className='mb-1 block text-[10px] font-semibold uppercase text-muted'>Width (px)</span>
            <TextInput type='number' min='1' max='700' value={w ?? ""} onChange={(e) => setSize(wKey, e.target.value)} />
          </label>
          <label className='w-28'>
            <span className='mb-1 block text-[10px] font-semibold uppercase text-muted'>Height (px)</span>
            <TextInput type='number' min='1' max='300' value={h ?? ""} onChange={(e) => setSize(hKey, e.target.value)} />
          </label>
          <label className='flex items-center gap-2 pb-3 text-xs text-muted'>
            <input type='checkbox' checked={lock} onChange={(e) => setLock(e.target.checked)} />
            Keep proportions
          </label>
        </div>
        {err && <p className='w-full text-xs text-red-600'>{err}</p>}
      </div>
    </div>
  );
}

function VoucherForm({ item, onClose, onSave }) {
  const [data, setData] = useState(() => withTemplateDefaults(item));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch) => setData((d) => ({ ...d, ...patch }));
  const bind = (key) => ({ value: data[key] ?? "", onChange: (e) => set({ [key]: e.target.value }) });

  async function submit(e) {
    e.preventDefault();
    const missing = REQUIRED.filter((k) => !String(data[k] ?? "").trim());
    if (missing.length) {
      setError(`Please fill: ${missing.map((k) => LABELS[k]).join(", ")}`);
      return;
    }
    if (data.departure < data.arrival) {
      setError("Departure can't be before arrival.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ ...data, id: item.id });
    } catch (err) {
      setError(err.message || "Unable to save voucher.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3'>
      <form
        onSubmit={submit}
        className='flex h-[96vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-xl bg-[#F4F6FB] shadow-2xl'
      >
        <div className='flex items-center justify-between border-b border-line-light bg-white px-6 py-3'>
          <div>
            <h2 className='text-lg font-bold text-ink'>{item.id ? "Edit voucher" : "Create voucher"}</h2>
            <p className='text-xs text-muted'>
              Fields marked * are required. Everything else is pre-filled from the voucher template and can be edited.
            </p>
          </div>
          <button type='button' onClick={onClose} className='rounded p-2 text-muted hover:bg-slate-100' title='Close'>
            <LuX size={18} />
          </button>
        </div>

        <div className='grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'>
          <div className='min-h-0 space-y-4 overflow-y-auto p-4'>
            <Section title='Header' hint='Logo and title shown at the top of the voucher.'>
              <ImageField label='Logo' urlKey='logoUrl' wKey='logoWidth' hKey='logoHeight' data={data} set={set} />
              <Field label='Title (dark part)'>
                <TextInput {...bind("headerTitle")} />
              </Field>
              <Field label='Title (coloured part)'>
                <TextInput {...bind("headerTitleAccent")} />
              </Field>
              <Field label='Sub title' wide>
                <Textarea rows={2} {...bind("headerSubtitle")} />
              </Field>
            </Section>

            <Section title='Booking details'>
              <Field label='Booking ID' required>
                <TextInput {...bind("bookingId")} />
              </Field>
              <Field label='Booking Reference No'>
                <TextInput {...bind("bookingReference")} />
              </Field>
              <Field label='Client' required>
                <TextInput {...bind("client")} />
              </Field>
              <Field label='Member ID'>
                <TextInput {...bind("memberId")} />
              </Field>
              <Field label='Country of Residence'>
                <TextInput {...bind("country")} />
              </Field>
              <Field label='Property' required>
                <TextInput {...bind("property")} />
              </Field>
              <Field label='Address' wide>
                <Textarea rows={2} {...bind("address")} />
              </Field>
              <Field label='Property Contact Number' wide>
                <TextInput {...bind("propertyContact")} />
              </Field>
            </Section>

            <Section title='Room details'>
              <Field label='Number of Rooms'>
                <TextInput type='number' min='0' {...bind("rooms")} />
              </Field>
              <Field label='Number of Extra Beds'>
                <TextInput type='number' min='0' {...bind("extraBeds")} />
              </Field>
              <Field label='Number of Adults'>
                <TextInput type='number' min='0' {...bind("adults")} />
              </Field>
              <Field label='Number of Children'>
                <TextInput type='number' min='0' {...bind("children")} />
              </Field>
              <Field label='Room Type' wide>
                <TextInput {...bind("roomType")} />
              </Field>
              <Field label='Promotion' wide>
                <TextInput {...bind("promotion")} />
              </Field>
            </Section>

            <Section title='Special offers'>
              <Field label='Box title'>
                <TextInput {...bind("specialOffersTitle")} />
              </Field>
              <Field label='Inclusions'>
                <TextInput placeholder='-' {...bind("inclusions")} />
              </Field>
            </Section>

            <Section title='Stay'>
              <Field label='Arrival' required>
                <TextInput type='date' {...bind("arrival")} />
              </Field>
              <Field label='Departure' required>
                <TextInput type='date' min={data.arrival || undefined} {...bind("departure")} />
              </Field>
              <Field label='Booked And Payable By' wide>
                <Textarea rows={2} {...bind("bookedAndPayableBy")} />
              </Field>
            </Section>

            <Section
              title='Remarks'
              hint='Printed exactly as typed — line breaks are kept. "Included" shows in normal text, the remark note in small grey text.'
            >
              <Field label='Included' wide>
                <Textarea rows={2} {...bind("included")} />
              </Field>
              <Field label='Remark note' wide>
                <Textarea rows={3} {...bind("remarks")} />
              </Field>
              <ImageField label='Stamp / signature' urlKey='stampUrl' wKey='stampWidth' hKey='stampHeight' data={data} set={set} />
              <Field label='Stamp caption' wide>
                <TextInput {...bind("signatureLabel")} />
              </Field>
            </Section>

            <Section title='Notes' hint='Each line becomes its own paragraph on the voucher.'>
              <Field label='Notes' wide>
                <Textarea rows={10} {...bind("notes")} />
              </Field>
              <div className='sm:col-span-2'>
                <Button type='button' onClick={() => set({ notes: TEMPLATE_DEFAULTS.notes })}>
                  <LuRotateCcw className='mr-1.5' />
                  Reset notes to default
                </Button>
              </div>
            </Section>

            <Section title='Footer contact' hint='Line breaks are kept.'>
              <Field label='Contact text' wide>
                <Textarea rows={3} {...bind("footerContact")} />
              </Field>
            </Section>

            <Section title='Status'>
              <Field label='Status' required>
                <Select {...bind("status")}>
                  <option>Draft</option>
                  <option>Ready</option>
                  <option>Cancelled</option>
                </Select>
              </Field>
            </Section>
          </div>

          <div className='hidden min-h-0 overflow-y-auto border-l border-line-light bg-[#E9ECF3] p-4 lg:block'>
            <p className='mb-2 text-center text-[11px] font-semibold uppercase text-muted'>
              Live preview — the PDF downloads exactly like this
            </p>
            <ScaledPage v={data} />
          </div>
        </div>

        <div className='flex items-center justify-between gap-2 border-t border-line-light bg-white px-6 py-3'>
          <p className='text-sm text-red-600'>{error}</p>
          <div className='flex gap-2'>
            <Button type='button' onClick={() => downloadVoucherPdf(data)}>
              <LuDownload className='mr-1.5' />
              Download preview
            </Button>
            <Button type='button' onClick={onClose}>
              Cancel
            </Button>
            <Button variant='accent' type='submit' disabled={saving}>
              {saving ? "Saving…" : "Save voucher"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function PreviewModal({ v, onClose }) {
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4' onClick={onClose}>
      <div
        className='flex max-h-[96vh] w-full max-w-[860px] flex-col overflow-hidden rounded-xl bg-[#E9ECF3] shadow-2xl'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex items-center justify-between bg-white px-5 py-3'>
          <h2 className='font-bold text-ink'>Voucher {v.bookingId}</h2>
          <div className='flex gap-2'>
            <Button onClick={() => downloadVoucherPdf(v)}>
              <LuDownload className='mr-1.5' />
              Download PDF
            </Button>
            <button onClick={onClose} className='rounded p-2 text-muted hover:bg-slate-100' title='Close'>
              <LuX size={18} />
            </button>
          </div>
        </div>
        <div className='overflow-y-auto p-4'>
          <ScaledPage v={withTemplateDefaults(v)} />
        </div>
      </div>
    </div>
  );
}

export default function Voucher() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [createdFilter, setCreatedFilter] = useState("All");
  const [customCreatedDate, setCustomCreatedDate] = useState("");
  const [form, setForm] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [previewing, setPreviewing] = useState(null);
  async function load() {
    setLoading(true);
    try {
      const result = await api.get("/admin/vouchers");
      setRows(result.vouchers || []);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load vouchers.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  const filtered = useMemo(
    () =>
      rows.filter((v) => {
        const created = v.createdAt ? new Date(v.createdAt) : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sameDay = (a, b) => a && a.toDateString() === b.toDateString();
        let createdMatches = true;
        if (createdFilter !== "All" && created) {
          if (createdFilter === "Today")
            createdMatches = sameDay(created, today);
          else if (createdFilter === "Yesterday") {
            const d = new Date(today);
            d.setDate(d.getDate() - 1);
            createdMatches = sameDay(created, d);
          } else if (createdFilter === "Custom")
            createdMatches =
              customCreatedDate === created.toISOString().slice(0, 10);
          else {
            const from = new Date(today);
            if (createdFilter === "Last week") from.setDate(from.getDate() - 7);
            if (createdFilter === "Last month")
              from.setMonth(from.getMonth() - 1);
            if (createdFilter === "Last 6 months")
              from.setMonth(from.getMonth() - 6);
            createdMatches = created >= from && created <= new Date();
          }
        } else if (createdFilter !== "All") createdMatches = false;
        return (
          (status === "All" || v.status === status) &&
          createdMatches &&
          [v.bookingId, v.memberId, v.client, v.property].some((x) =>
            String(x || "")
              .toLowerCase()
              .includes(query.toLowerCase())
          )
        );
      }),
    [rows, status, query, createdFilter, customCreatedDate]
  );
  async function save(v) {
    const result = v.id
      ? await api.patch(`/admin/vouchers/${v.id}`, v)
      : await api.post("/admin/vouchers", v);
    setRows((items) =>
      v.id
        ? items.map((x) => (x.id === v.id ? result.voucher : x))
        : [result.voucher, ...items]
    );
    setForm(null);
  }
  async function remove() {
    await api.del(`/admin/vouchers/${deleting.id}`);
    setRows((items) => items.filter((x) => x.id !== deleting.id));
    setDeleting(null);
  }
  return (
    <div className='mx-auto max-w-[1500px] p-6 lg:p-10'>
      <div className='mb-6 flex items-end justify-between'>
        <div>
          <p className='mb-2 text-xs text-muted'>
            Home › Voucher Manager › <span className='text-ink'>Vouchers</span>
          </p>
          <div className='flex items-center gap-3'>
            <LuTicket className='text-accent' size={28} />
            <div>
              <h1 className='text-2xl font-bold text-[#172554]'>
                Voucher Manager
              </h1>
              <p className='text-sm text-muted'>
                Create, manage and download hotel booking vouchers.
              </p>
            </div>
          </div>
        </div>
        <Button variant='accent' onClick={() => setForm({ ...NEW_VOUCHER })}>
          <LuPlus className='mr-1.5' />
          Create Voucher
        </Button>
      </div>
      <div className='mb-6 grid gap-4 md:grid-cols-3'>
        <Card>
          <p className='text-xs text-muted'>Total Vouchers</p>
          <p className='text-2xl font-bold text-ink'>{rows.length}</p>
          <p className='text-xs text-muted'>All hotel booking vouchers</p>
        </Card>
        <Card>
          <p className='text-xs text-muted'>Ready to Download</p>
          <p className='text-2xl font-bold text-emerald-600'>
            {rows.filter((x) => x.status === "Ready").length}
          </p>
          <p className='text-xs text-muted'>Vouchers ready for download</p>
        </Card>
        <Card>
          <p className='text-xs text-muted'>Draft Vouchers</p>
          <p className='text-2xl font-bold text-amber-600'>
            {rows.filter((x) => x.status === "Draft").length}
          </p>
          <p className='text-xs text-muted'>Vouchers in draft stage</p>
        </Card>
      </div>
      <Card>
        <div className='mb-4 flex flex-wrap items-end gap-3 lg:flex-nowrap'>
          <div className='relative min-w-0 flex-1 pt-4'>
            <label className='absolute left-0 top-0 text-[11px] font-semibold uppercase text-muted'>Search</label>
            <LuSearch
              className='absolute left-3 top-10 -translate-y-1/2 text-muted'
              size={15}
            />
            <TextInput
              className='pl-9'
              placeholder='Search booking ID, member ID, client or property'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className='relative pt-4' style={{ width: "11rem", flex: "0 0 11rem" }}>
            <label className='absolute left-0 top-0 text-[11px] font-semibold uppercase text-muted'>Status</label>
          <Select
            className='!w-44 shrink-0'
            style={{ width: "11rem", flex: "0 0 11rem" }}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option>All</option>
            <option>Ready</option>
            <option>Draft</option>
            <option>Cancelled</option>
          </Select>
          </div>
          <div className='relative shrink-0 pt-4' style={{ width: "12rem", flex: "0 0 12rem" }}>
            <label className='absolute left-0 top-0 text-[11px] font-semibold uppercase text-muted'>Created date</label>
            <Select
              className='!w-full'
              value={createdFilter}
              onChange={(e) => setCreatedFilter(e.target.value)}
            >
              <option value='All'>Created: All dates</option>
              <option value='Today'>Today</option>
              <option value='Yesterday'>Yesterday</option>
              <option value='Last week'>Last week</option>
              <option value='Last month'>Last month</option>
              <option value='Last 6 months'>Last 6 months</option>
              <option value='Custom'>Custom date</option>
            </Select>
            {createdFilter === "Custom" && (
              <div className='absolute left-0 top-full z-20 mt-2 w-full rounded-lg border border-line-light bg-white p-2 shadow-lg'>
                <label className='mb-1 block text-[11px] font-semibold uppercase text-muted'>Select date</label>
                <TextInput
                  className='!w-full'
                  type='date'
                  max={new Date().toISOString().slice(0, 10)}
                  value={customCreatedDate}
                  onChange={(e) => setCustomCreatedDate(e.target.value)}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  onFocus={(e) => e.currentTarget.showPicker?.()}
                  aria-label='Select created date'
                  autoFocus
                />
              </div>
            )}
          </div>
          <Button
            className='h-12 shrink-0 border-accent text-accent hover:bg-indigo-50'
            onClick={() => {
              setQuery("");
              setStatus("All");
              setCreatedFilter("All");
              setCustomCreatedDate("");
            }}
          >
            <LuRefreshCw className='mr-1.5' />
            Clear Filters
          </Button>
        </div>
        {error && <p className='mb-3 text-sm text-red-600'>{error}</p>}
        <div className='overflow-x-auto'>
          <table className='w-full min-w-[950px] text-left text-sm'>
            <thead>
              <tr className='bg-indigo-50 text-xs uppercase text-[#172554]'>
                <th className='px-4 py-3'>Booking ID</th>
                <th className='px-4 py-3'>Member ID</th>
                <th className='px-4 py-3'>Client</th>
                <th className='px-4 py-3'>Country</th>
                <th className='px-4 py-3'>Property</th>
                <th className='px-4 py-3'>Created</th>
                <th className='px-4 py-3'>Status</th>
                <th className='px-4 py-3 text-right'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan='8' className='py-12 text-center text-muted'>
                    Loading vouchers…
                  </td>
                </tr>
              ) : (
                filtered.map((v) => (
                  <tr
                    key={v.id}
                    className='border-b border-line-light hover:bg-indigo-50/30'
                  >
                    <td className='px-4 py-4 font-semibold text-accent'>
                      {v.bookingId || "—"}
                    </td>
                    <td className='px-4 py-4'>{v.memberId || "—"}</td>
                    <td className='px-4 py-4'>{v.client || "—"}</td>
                    <td className='px-4 py-4'>{v.country || "—"}</td>
                    <td className='px-4 py-4'>
                      <b>{v.property || "—"}</b>
                      <span className='block text-xs text-muted'>
                        {v.address || "—"}
                      </span>
                    </td>
                    <td className='px-4 py-4'>{dateLabel(v.createdAt)}</td>
                    <td className='px-4 py-4'>
                      <Badge
                        tone={
                          v.status === "Ready"
                            ? "green"
                            : v.status === "Cancelled"
                            ? "red"
                            : "amber"
                        }
                      >
                        {v.status || "—"}
                      </Badge>
                    </td>
                    <td className='px-4 py-4'>
                      <div className='flex justify-end gap-1'>
                        <button
                          onClick={() => downloadVoucherPdf(v).catch((e) => setError(e.message || "Download failed."))}
                          title='Download voucher'
                          className='rounded border border-line-light p-2 text-accent'
                        >
                          <LuDownload size={15} />
                        </button>
                        <button
                          onClick={() => setPreviewing(v)}
                          title='Preview voucher'
                          className='rounded border border-line-light p-2 text-muted'
                        >
                          <LuEye size={15} />
                        </button>
                        <button
                          onClick={() => setForm(v)}
                          title='Edit voucher'
                          className='rounded border border-line-light p-2 text-muted'
                        >
                          <LuPencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeleting(v)}
                          title='Delete voucher'
                          className='rounded border border-line-light p-2 text-red-500'
                        >
                          <LuTrash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {!loading && !filtered.length && (
            <p className='py-12 text-center text-sm text-muted'>
              {createdFilter === "Custom" && !customCreatedDate
                ? "Select a date to view vouchers."
                : "No vouchers found."}
            </p>
          )}
        </div>
      </Card>
      {form && (
        <VoucherForm item={form} onClose={() => setForm(null)} onSave={save} />
      )}
      {previewing && (
        <PreviewModal v={previewing} onClose={() => setPreviewing(null)} />
      )}
      {deleting && (
        <ConfirmDialog
          title='Delete this voucher?'
          confirmLabel='Delete voucher'
          onCancel={() => setDeleting(null)}
          onConfirm={remove}
        >
          This voucher will be deleted from the database and cannot be restored.
        </ConfirmDialog>
      )}
    </div>
  );
}
