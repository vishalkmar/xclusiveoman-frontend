import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  LuArrowLeft,
  LuBan,
  LuBuilding2,
  LuCalendarDays,
  LuCreditCard,
  LuHistory,
  LuMail,
  LuPhone,
  LuPlay,
  LuTriangleAlert,
  LuUser,
} from 'react-icons/lu';
import { api } from '../api/client.js';
import { formatCurrency } from '../../shared/currency.js';
import { Badge, Button, Card, ErrorText, TextInput } from '../components/ui.jsx';
import { AgencyAvatar } from '../components/visa/AgencyAvatar.jsx';
import { DocTile } from '../components/visa/TravellerThumb.jsx';
import { DocumentLightbox } from '../components/visa/DocumentLightbox.jsx';
import { RequestStatusBadge } from '../components/visa/RequestStatusBadge.jsx';
import { VisaProgress } from '../components/visa/VisaProgress.jsx';
import { VisaUploadPanel } from '../components/visa/VisaUploadPanel.jsx';
import { EVENT_META, TRAVELLER_VISA, ageLabel, fmtDate, fmtDateTime, plural } from '../components/visa/visaAdminMeta.js';
import { storedApplicationReference } from '../../agent/components/ledger/ledgerUtils.js';

// One visa request (opened from the Application Tracker). The admin checks
// each traveller's photo, passport pages and details, then uploads their
// visa (or refuses it); the request finishes itself once every traveller is
// decided. Right column: who applied, the payment and the tracking timeline.
// GET /admin/visa/applications/:id and its action endpoints — each action
// answers with the refreshed request, so the page just swaps it in.

const PASSPORT_FIELDS = [
  ['passportNumber', 'Passport no.', true],
  ['nationality', 'Nationality'],
  ['sex', 'Sex'],
  ['dateOfBirth', 'Date of birth', false, true],
  ['placeOfBirth', 'Place of birth'],
  ['dateOfIssue', 'Issued', false, true],
  ['dateOfExpiry', 'Expires', false, true],
  ['placeOfIssue', 'Place of issue'],
  ['issuingCountry', 'Issuing country'],
];

const TONE_DOT = {
  indigo: 'bg-[#6366F1]',
  amber: 'bg-[#F59E0B]',
  green: 'bg-[#10B981]',
  red: 'bg-[#EF4444]',
  grey: 'bg-[#94A3B8]',
};

// Passport expiring within 6 months of applying — most visas refuse those.
function expiryWarning(details, appliedAt) {
  if (!details?.dateOfExpiry) return '';
  const expiry = new Date(`${details.dateOfExpiry}T00:00:00`);
  const limit = new Date(appliedAt || Date.now());
  limit.setMonth(limit.getMonth() + 6);
  if (Number.isNaN(expiry.getTime())) return '';
  if (expiry < new Date()) return 'Passport has expired';
  return expiry < limit ? 'Passport expires within 6 months' : '';
}

function TravellerCard({ traveller, appliedAt, locked, busy, onAction, onOpenDoc }) {
  const name = traveller.fullName || `Traveller ${traveller.position}`;
  const visa = TRAVELLER_VISA[traveller.visaStatus] || TRAVELLER_VISA.pending;
  const pd = traveller.passportDetails || {};
  const warning = expiryWarning(traveller.passportDetails, appliedAt);
  const open = (doc) => onOpenDoc({ ...doc, title: `${name} — ${doc.title}` });
  const fullName = [pd.givenNames, pd.surname].filter(Boolean).join(' ');

  return (
    <Card className="overflow-hidden border-[#E5E7F2] !p-0 shadow-[0_8px_28px_rgba(35,45,95,0.06)]">
      <div className="flex items-center gap-3 border-b border-[#E8EBF5] bg-[#FBFCFF] px-5 py-4">
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-accent-soft text-[11px] font-bold text-accent-dark">
          {traveller.position}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-bold text-ink">{name}</div>
          {fullName && fullName.toUpperCase() !== name.toUpperCase() && <div className="truncate text-[11px] text-muted">Passport name: {fullName}</div>}
        </div>
        <Badge tone={visa.tone}>{visa.label}</Badge>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-[132px_minmax(0,1fr)]">
        <div className="flex flex-row gap-3 lg:flex-col">
          {traveller.photoUrl ? (
            <button
              type="button"
              onClick={() => open({ url: traveller.photoUrl, title: 'Photo' })}
              className="group relative h-[164px] w-[132px] flex-none overflow-hidden rounded-2xl border border-line-light bg-[#F1F5F9] lg:w-full"
              aria-label={`View ${name}'s photo`}
            >
              <img src={traveller.photoUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-1 pt-4 text-[10px] font-semibold text-white">
                Photo
              </span>
            </button>
          ) : (
            <span className="flex h-[164px] w-[132px] flex-none flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-[#CBD5E1] text-[11px] text-[#94A3B8] lg:w-full">
              <LuUser size={22} /> No photo
            </span>
          )}
          <div className="grid grid-cols-2 gap-2">
            <DocTile url={traveller.passportFrontUrl} label="Passport front" onOpen={open} className="h-16 w-full" />
            <DocTile url={traveller.passportBackUrl} label="Passport back" onOpen={open} className="h-16 w-full" />
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          {traveller.passportDetails ? (
            <div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
                {PASSPORT_FIELDS.filter(([key]) => pd[key]).map(([key, label, mono, date]) => (
                  <div key={key} className="min-w-0">
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
                    <dd className={`truncate text-sm text-ink ${mono ? 'font-mono font-semibold' : ''}`} title={pd[key]}>
                      {date ? fmtDate(`${pd[key]}T00:00:00`) : pd[key]}
                    </dd>
                  </div>
                ))}
              </dl>
              {warning && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#FFF7ED] px-2.5 py-1.5 text-[11px] font-semibold text-[#C2410C]">
                  <LuTriangleAlert size={13} /> {warning}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">No passport details were saved for this traveller.</p>
          )}

            <div className="border-t border-dashed border-line-light pt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Visa document</div>
              <span className="text-[10px] text-muted">Upload for agent delivery</span>
            </div>
            <VisaUploadPanel
              traveller={traveller}
              locked={locked}
              busy={busy}
              onOpenDoc={onOpenDoc}
              onUpload={(payload) => onAction('upload', traveller, payload)}
              onRemove={() => onAction('remove', traveller)}
              onRefuse={(reason) => onAction('refuse', traveller, { reason })}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

function Timeline({ events }) {
  if (!events.length) return <p className="text-xs text-muted">Nothing recorded yet.</p>;
  return (
    <ol className="relative space-y-4 pl-5">
      <span className="absolute bottom-1 left-[5px] top-1 w-px bg-line-light" aria-hidden />
      {events.map((e) => {
        const meta = EVENT_META[e.event] || { label: e.event.replace(/_/g, ' '), tone: 'grey' };
        return (
          <li key={e.id} className="relative">
            <span className={`absolute -left-5 top-1 h-[11px] w-[11px] rounded-full ring-4 ring-white ${TONE_DOT[meta.tone]}`} aria-hidden />
            <div className="text-xs font-semibold text-ink">{meta.label}</div>
            {e.message && <div className="mt-0.5 text-[11px] leading-snug text-muted">{e.message}</div>}
            <div className="mt-0.5 text-[10px] text-[#94A3B8]">
              {fmtDateTime(e.createdAt)}
              {e.actor?.name ? ` · ${e.actor.name}` : ''}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function RefuseRequestForm({ busy, pending, onSubmit, onCancel }) {
  const [reason, setReason] = useState('');
  return (
    <div className="mt-4 rounded-xl border border-[#FECACA] bg-[#FFF7F7] p-4">
      <p className="mb-2 text-xs text-[#991B1B]">
        Refuses the {plural(pending, 'traveller')} still waiting. Visas already issued stay with the agent.
      </p>
      <TextInput autoFocus value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="Reason (shown to the agent)" />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="danger" disabled={!reason.trim() || busy} onClick={() => onSubmit(reason.trim())}>
          {busy ? 'Saving…' : 'Refuse remaining'}
        </Button>
        <Button disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default function VisaRequestDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [doc, setDoc] = useState(null);
  const [refusing, setRefusing] = useState(false);

  useEffect(() => {
    api
      .get(`/admin/visa/applications/${id}`)
      .then(setData)
      .catch((err) => setLoadError(err.message || 'Unable to load this request'));
  }, [id]);

  const run = useCallback(
    async (key, request, success) => {
      setError('');
      setNotice('');
      setBusyKey(key);
      try {
        const next = await request();
        setData(next);
        setNotice(success);
        return true;
      } catch (err) {
        setError(err.message || 'Something went wrong');
        return false;
      } finally {
        setBusyKey('');
      }
    },
    []
  );

  function travellerAction(kind, traveller, payload = {}) {
    const base = `/admin/visa/applications/${id}/applicants/${traveller.id}`;
    const name = traveller.fullName || `Traveller ${traveller.position}`;
    if (kind === 'upload') {
      const form = new FormData();
      form.append('visa', payload.file);
      if (payload.visaNumber) form.append('visaNumber', payload.visaNumber);
      if (payload.validUntil) form.append('validUntil', payload.validUntil);
      return run(traveller.id, () => api.post(`${base}/visa`, form), `Visa uploaded for ${name} — the agent can download it now.`);
    }
    if (kind === 'remove') return run(traveller.id, () => api.del(`${base}/visa`), `Updated ${name}.`);
    return run(traveller.id, () => api.post(`${base}/reject`, { reason: payload.reason }), `Visa refused for ${name}.`);
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#F4F7FF] p-6 lg:p-10">
        <Link to="/admin/visa-status" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-accent">
          <LuArrowLeft size={14} /> Application Tracker
        </Link>
        <p className="text-sm text-[#a5162d]">{loadError}</p>
      </div>
    );
  }
  if (!data) return <div className="min-h-screen bg-[#F4F7FF] p-6 text-sm text-muted lg:p-10">Loading…</div>;

  const { application: a, events, payments } = data;
  const locked = a.status === 'payment_review';
  const paid = payments.find((p) => p.status === 'confirmed');

  return (
    <div className="min-h-screen bg-[#F4F7FF]">
      <div className="mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-8">
        <Link
          to={`/admin/visa-status?agency=${a.agency.id}`}
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-accent"
        >
          <LuArrowLeft size={14} /> {a.agency.name}&apos;s requests
        </Link>

        <Card className="mb-6 border-[#E5E7F2] shadow-[0_8px_28px_rgba(35,45,95,0.06)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-bold text-accent">Visa request #{a.reference}</span>
                <RequestStatusBadge status={a.status} />
              </div>
              <div className="mt-1 truncate font-mono text-[11px] text-muted" title={a.id}>Application ID: {storedApplicationReference(a)}</div>
              <h2 className="mt-1.5 text-2xl font-bold text-ink">
                {a.visaType.name} <span className="font-medium text-muted">· {a.visaCategory.name}</span>
              </h2>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
                <span className="inline-flex items-center gap-1">
                  <LuCalendarDays size={13} /> Applied {fmtDateTime(a.appliedAt)} · {ageLabel(a.appliedAt)}
                </span>
                <span>{plural(a.travellers, 'traveller')}</span>
                {a.visaPackage && (
                  <span>
                    Valid for {plural(a.visaPackage.validForDays, 'day')} · maximum stay {plural(a.visaPackage.maxStayDays, 'day')}
                  </span>
                )}
                {a.visaCategory.processingTime && <span>Processing time: {a.visaCategory.processingTime}</span>}
                {a.completedAt && <span>Completed {fmtDate(a.completedAt)}</span>}
              </div>
              {a.status === 'rejected' && a.rejectionReason && (
                <p className="mt-3 rounded-lg bg-[#FEF2F2] px-3 py-2 text-xs text-[#991B1B]">Refused: {a.rejectionReason}</p>
              )}
            </div>
            <div className="w-full lg:w-72">
              <VisaProgress issued={a.visasIssued} rejected={a.visasRejected} total={a.travellers} size="lg" />
              <div className="mt-4 flex flex-wrap gap-2 lg:justify-end">
                {a.status === 'submitted' && (
                  <Button
                    variant="accent"
                    disabled={!!busyKey}
                    onClick={() => run('start', () => api.post(`/admin/visa/applications/${id}/start`), 'Processing started — the agent has been told.')}
                  >
                    <LuPlay size={14} className="mr-1.5" /> {busyKey === 'start' ? 'Starting…' : 'Start processing'}
                  </Button>
                )}
                {!locked && a.visasPending > 0 && !refusing && (
                  <Button variant="danger" disabled={!!busyKey} onClick={() => setRefusing(true)}>
                    <LuBan size={14} className="mr-1.5" /> Refuse remaining
                  </Button>
                )}
              </div>
            </div>
          </div>
          {refusing && (
            <RefuseRequestForm
              busy={busyKey === 'reject'}
              pending={a.visasPending}
              onCancel={() => setRefusing(false)}
              onSubmit={async (reason) => {
                if (await run('reject', () => api.post(`/admin/visa/applications/${id}/reject`, { reason }), 'Remaining travellers refused.')) setRefusing(false);
              }}
            />
          )}
          {locked && (
            <p className="mt-4 rounded-lg bg-[#F8FAFC] px-3 py-2 text-xs text-[#475569] ring-1 ring-[#E2E8F0]">
              The visa fee for this request was paid by NEFT and is still being verified.{' '}
              <Link to="/admin/neft-verification" className="font-semibold text-accent hover:underline">
                Open NEFT Verification
              </Link>
            </p>
          )}
        </Card>

        <div aria-live="polite">
          {notice && <p className="mb-4 rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-2.5 text-sm text-[#047857]">{notice}</p>}
          {error && (
            <div className="mb-4">
              <ErrorText>{error}</ErrorText>
            </div>
          )}
        </div>

        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-ink">Traveller documents &amp; visa delivery</h3>
            <p className="mt-0.5 text-xs text-muted">Review each traveller separately, then upload or refuse the visa.</p>
          </div>
          <span className="hidden rounded-full bg-[#EEF0FF] px-3 py-1 text-[10px] font-semibold text-accent-dark sm:inline-flex">{a.visasPending} pending</span>
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-5">
            {a.applicants.map((t) => (
              <TravellerCard
                key={t.id}
                traveller={t}
                appliedAt={a.appliedAt}
                locked={locked}
                busy={busyKey === t.id}
                onAction={travellerAction}
                onOpenDoc={setDoc}
              />
            ))}
          </div>

          <div className="space-y-4 lg:sticky lg:top-5 lg:self-start">
            <Card className="border-[#E5E7F2] shadow-[0_8px_24px_rgba(35,45,95,0.05)]">
              <div className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted">Applied by</div>
              <div className="flex items-center gap-3">
                <AgencyAvatar name={a.agency.name} logoUrl={a.agency.logoUrl} />
                <div className="min-w-0">
                  <div className="truncate font-bold text-ink">{a.agency.name}</div>
                  {a.agency.country && <div className="text-[11px] text-muted">{a.agency.country}</div>}
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-xs text-ink">
                <li className="flex items-center gap-2">
                  <LuUser size={14} className="flex-none text-muted" /> {a.createdBy.name || '—'}
                </li>
                {a.createdBy.email && (
                  <li className="flex min-w-0 items-center gap-2">
                    <LuMail size={14} className="flex-none text-muted" />
                    <a href={`mailto:${a.createdBy.email}`} className="truncate text-accent hover:underline">
                      {a.createdBy.email}
                    </a>
                  </li>
                )}
                {a.createdBy.phone && (
                  <li className="flex items-center gap-2">
                    <LuPhone size={14} className="flex-none text-muted" /> {a.createdBy.phone}
                  </li>
                )}
              </ul>
              <Link
                to={`/admin/visa-status?agency=${a.agency.id}`}
                className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold text-accent hover:underline"
              >
                <LuBuilding2 size={13} /> All requests from this agent
              </Link>
            </Card>

            <Card className="border-[#E5E7F2] shadow-[0_8px_24px_rgba(35,45,95,0.05)]">
              <div className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted">Visa fee</div>
              {paid ? (
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <LuCreditCard size={17} />
                  </span>
                  <div className="text-xs">
                    <div className="text-base font-bold text-ink">{formatCurrency(paid.amount)}</div>
                    <div className="text-muted">
                      {paid.travellers} × {formatCurrency(paid.pricePerPerson)} · {paid.method === 'neft' ? 'NEFT' : 'Card'}
                    </div>
                    <div className="text-muted">Paid {fmtDateTime(paid.paidAt)}</div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted">{locked ? 'NEFT slip in verification.' : 'No confirmed payment found.'}</p>
              )}
            </Card>

            <Card className="border-[#E5E7F2] shadow-[0_8px_24px_rgba(35,45,95,0.05)]">
              <div className="mb-4 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                <LuHistory size={13} /> Tracking
              </div>
              <Timeline events={events} />
            </Card>
          </div>
        </div>
      </div>
      <DocumentLightbox doc={doc} onClose={() => setDoc(null)} />
    </div>
  );
}
