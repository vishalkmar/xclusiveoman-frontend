import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LuArrowLeft, LuArrowRight, LuBadgeCheck, LuBookOpen, LuCamera, LuCheck, LuClock, LuCopy, LuDownload, LuEye, LuStamp, LuUser, LuUsers } from 'react-icons/lu';
import { api } from '../api/client.js';
import { ErrorText } from '../components/ui.jsx';
import { Amount } from '../components/ledger/Amount.jsx';
import { StatusBadge } from '../components/ledger/StatusBadge.jsx';
import { formatLedgerDate, formatLedgerTime, plural, storedApplicationReference } from '../components/ledger/ledgerUtils.js';
import { VISA_STATUS, applicationProgress, applicationStage, continuePath, stageMeta, visaDownloadUrl } from '../components/visa/visaMeta.js';
import { formatOmr } from '../../shared/currency.js';

// One visa application in full (Apply for Visa → Visa Applications → a row):
// status, who applied (visa_applications.created_by_user_id), fees, progress
// per step, and every traveller with their photo and passport details.
// GET /visa/applications/:id — scoped to the agent's agency server-side.

const ICON = { strokeWidth: 1.75, 'aria-hidden': true };

const PHOTO_STATUS = {
  pending: { tone: 'neutral', label: 'No photo' },
  approved: { tone: 'success', label: 'Photo verified' },
  needs_review: { tone: 'pending', label: 'Photo in review' },
};
const PASSPORT_STATUS = {
  pending: { tone: 'neutral', label: 'No passport' },
  scanned: { tone: 'pending', label: 'Passport to review' },
  needs_review: { tone: 'danger', label: 'Passport needs attention' },
  confirmed: { tone: 'success', label: 'Passport confirmed' },
};

const PAYMENT_STATUS = {
  confirmed: { tone: 'success', label: 'Paid' },
  pending_verification: { tone: 'pending', label: 'Slip in verification' },
  rejected: { tone: 'danger', label: 'Slip rejected' },
  pending: { tone: 'pending', label: 'Checkout open' },
  awaiting_payment: { tone: 'pending', label: 'Checkout open' },
  failed: { tone: 'danger', label: 'Failed' },
  cancelled: { tone: 'neutral', label: 'Cancelled' },
};

const monthsUntil =(iso) => (iso ? (new Date(`${iso}T00:00:00Z`) - Date.now()) / (30.44 * 86400000) : null);

function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-bk-muted">{label}</dt>
      <dd className="mt-1 text-[14px] font-semibold text-bk-ink">{children}</dd>
    </div>
  );
}

function StepCard({ icon: Icon, label, done, total, to }) {
  const complete = total > 0 && done === total;
  const body = (
    <>
      <span
        className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${
          complete ? 'bg-agent-panel text-agent-ink-dark' : 'bg-agent-accent-soft text-agent-accent-dark'
        }`}
      >
        {complete ? <LuCheck {...ICON} strokeWidth={2.5} className="h-5 w-5" /> : <Icon {...ICON} className="h-5 w-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-agent-ink">{label}</span>
        <span className="mt-0.5 block text-[12px] text-bk-muted">
          <span className="font-semibold tabular-nums text-bk-ink">
            {done}/{total}
          </span>{' '}
          {complete ? 'complete' : 'done'}
        </span>
      </span>
      {to && !complete && <LuArrowRight {...ICON} className="h-4 w-4 text-bk-muted" />}
    </>
  );
  const cls = 'flex items-center gap-3 rounded-xl border border-agent-line-light bg-white p-4';
  return to && !complete ? (
    <Link to={to} className={`${cls} transition-colors hover:border-agent-accent-dark/40 hover:bg-agent-panel`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function VisaDownloadPanel({ application, progress }) {
  const applicants = Array.isArray(application.applicants) ? application.applicants : [];
  const issued = applicants.filter((traveller) => traveller.visaStatus === 'issued' && traveller.visaDocumentUrl);
  const pending = applicants.filter((traveller) => traveller.visaStatus !== 'issued');
  return (
    <section aria-label="Visa downloads" className="mt-6 overflow-hidden rounded-2xl border border-agent-line-light bg-white shadow-[0_8px_28px_rgba(150,96,35,0.08)]">
      <div className="border-b border-agent-line-light bg-agent-panel/60 px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-agent-ink-dark text-agent-accent">
            {issued.length > 0 ? <LuBadgeCheck {...ICON} className="h-6 w-6" /> : <LuClock {...ICON} className="h-5 w-5" />}
          </span>
          <div>
            <h3 className="text-[19px] font-bold text-agent-ink-dark">{issued.length > 0 ? 'Visa ready to download' : 'Visa processing'}</h3>
            <p className="mt-1 text-[12.5px] text-agent-muted">
              {issued.length > 0 ? `${issued.length} of ${progress.total} traveller ${progress.total === 1 ? 'visa is' : 'visas are'} issued and available below.` : 'The visa team is still processing this application.'}
            </p>
          </div>
        </div>
      </div>
      <div className="divide-y divide-agent-line-light">
        {issued.map((traveller) => {
          const details = traveller.passportDetails || {};
          const isPdf = traveller.visaDocumentType === 'pdf';
          const downloadUrl = isPdf ? traveller.visaDocumentUrl : visaDownloadUrl(traveller.visaDocumentUrl);
          return (
            <div key={traveller.id} className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center sm:px-7">
              <div className="flex min-w-0 gap-4">
                <div className="h-20 w-16 flex-none overflow-hidden rounded-xl border border-agent-line-light bg-agent-panel">
                  {traveller.photoUrl ? <img src={traveller.photoUrl} alt="" className="h-full w-full object-cover" /> : <LuUser className="m-auto mt-6 h-6 w-6 text-agent-muted" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="truncate text-[15px] font-bold text-agent-ink">{traveller.fullName || `Traveller ${traveller.position}`}</h4>
                    <StatusBadge tone="success" label="Visa issued" />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[11px] sm:grid-cols-4">
                    <div><dt className="text-agent-muted">Passport no.</dt><dd className="font-semibold text-agent-ink">{details.passportNumber || '—'}</dd></div>
                    <div><dt className="text-agent-muted">Nationality</dt><dd className="font-semibold text-agent-ink">{details.nationality || '—'}</dd></div>
                    <div><dt className="text-agent-muted">Date of birth</dt><dd className="font-semibold text-agent-ink">{details.dateOfBirth ? formatLedgerDate(details.dateOfBirth) : '—'}</dd></div>
                    <div><dt className="text-agent-muted">Valid until</dt><dd className="font-semibold text-agent-ink">{traveller.visaValidUntil ? formatLedgerDate(traveller.visaValidUntil) : '—'}</dd></div>
                  </dl>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <a href={downloadUrl} download={isPdf ? undefined : true} target={isPdf ? '_blank' : undefined} rel="noopener noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#B45309] px-4 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-[#92400E]">
                  <LuDownload {...ICON} className="h-4 w-4" /> Download visa
                </a>
                <a href={traveller.visaDocumentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-agent-line-light bg-white text-[12px] font-semibold text-agent-ink transition-colors hover:border-agent-accent-dark hover:bg-agent-panel">
                  <LuEye {...ICON} className="h-3.5 w-3.5" /> View visa
                </a>
                <p className="text-center text-[10.5px] text-agent-muted">{isPdf ? 'PDF document' : 'Visa document'} · {traveller.fullName || 'Traveller'}</p>
              </div>
            </div>
          );
        })}
        {pending.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-5 py-3.5 text-[12px] text-agent-muted sm:px-7">
            <LuClock {...ICON} className="h-4 w-4 text-agent-accent-dark" /> {pending.length} traveller {pending.length === 1 ? 'visa remains' : 'visas remain'} in processing. Downloads will appear here when issued.
          </div>
        )}
      </div>
    </section>
  );
}

function ApplicationTimeline({ application, progress, stage, payments, visasIssued }) {
  const paid = application.paidAmount != null || payments.some((p) => p.status === 'confirmed');
  const documentsComplete = progress.names === progress.total && progress.photos === progress.total && progress.passports === progress.total;
  const processing = ['processing', 'approved', 'rejected'].includes(application.status);
  const issued = stage === 'approved' || visasIssued > 0;
  const steps = [
    { label: 'Application started', detail: 'Visa application created', done: true, date: application.createdAt },
    { label: 'Travellers and documents', detail: documentsComplete ? 'Names, photos and passports completed' : `${progress.names}/${progress.total} names · ${progress.photos}/${progress.total} photos · ${progress.passports}/${progress.total} passports`, done: documentsComplete, current: !documentsComplete && application.status === 'draft' },
    { label: 'Payment confirmed', detail: paid ? 'Visa fee received' : stage === 'ready' ? 'Waiting for visa fee payment' : 'Payment is required after documents are complete', done: paid, current: !paid && (stage === 'ready' || application.status === 'payment_review'), date: application.paidAt },
    { label: 'Visa team processing', detail: processing ? 'Application is with the visa team' : application.status === 'payment_review' ? 'Payment is being verified' : 'Starts after payment is confirmed', done: processing || issued, current: application.status === 'payment_review' || application.status === 'submitted' || application.status === 'processing', date: application.processingStartedAt },
    { label: 'Visa decision and delivery', detail: issued ? `${visasIssued} of ${progress.total} visa${progress.total === 1 ? '' : 's'} issued` : application.status === 'rejected' ? 'Application refused' : 'Waiting for the visa team to complete the request', done: issued || application.status === 'rejected', current: stage === 'approved' || application.status === 'rejected', date: application.completedAt },
  ];
  return (
    <section aria-label="Application tracking" className="mt-6 rounded-2xl border border-agent-line-light bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-bold text-agent-ink">Application tracking</h3>
          <p className="mt-0.5 text-[12px] text-agent-muted">Follow each stage and see where your visa application currently stands.</p>
        </div>
        <span className="font-mono text-[11px] text-agent-muted">{storedApplicationReference(application)}</span>
      </div>
      <ol className="mt-5 grid gap-4 md:grid-cols-5 md:gap-2">
        {steps.map((step, index) => (
          <li key={step.label} className="relative flex gap-3 md:block md:pr-3">
            {index < steps.length - 1 && <span aria-hidden className={`absolute left-[11px] top-6 hidden h-px w-[calc(100%-10px)] md:block ${step.done ? 'bg-agent-accent-dark' : 'bg-agent-line-light'}`} />}
            <span className={`relative z-10 flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-bold md:mb-2 ${step.done ? 'bg-agent-ink-dark text-agent-accent' : step.current ? 'bg-agent-accent text-agent-ink-dark' : 'border border-agent-line-light bg-agent-panel text-agent-muted'}`}>
              {step.done ? <LuCheck {...ICON} className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <div className="min-w-0">
              <p className={`text-[12px] font-semibold ${step.current ? 'text-agent-ink-dark' : 'text-agent-ink'}`}>{step.label}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-agent-muted">{step.detail}</p>
              {step.date && <p className="mt-1 text-[10px] text-agent-muted">{formatLedgerDate(step.date)}</p>}
              {step.current && <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-agent-accent-dark">Current stage</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function VisaApplicationDetail() {
  const { id } = useParams();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [payments, setPayments] = useState([]);
  const [copiedReference, setCopiedReference] = useState(false);

  useEffect(() => {
    Promise.all([api.get(`/visa/applications/${id}`), api.get(`/visa/applications/${id}/payment`).catch(() => ({ payments: [] }))])
      .then(([{ application: a }, p]) => {
        setApplication(a);
        setPayments(p.payments || []);
      })
      .catch((err) => setError(err.status === 404 ? 'This visa application was not found.' : err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const back = (
    <Link to="/agent/visa/applications" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-agent-muted hover:text-agent-ink">
      <LuArrowLeft size={14} /> Visa applications
    </Link>
  );

  if (loading) {
    return (
      <div className="w-full p-5 lg:p-8">
        {back}
        <div className="h-10 w-72 animate-pulse rounded-lg bg-bk-line-soft" />
        <div className="mt-6 h-40 animate-pulse rounded-2xl bg-bk-line-soft" />
      </div>
    );
  }
  if (!application) {
    return (
      <div className="w-full p-5 lg:p-8">
        {back}
        <ErrorText>{error}</ErrorText>
      </div>
    );
  }

  const stage = applicationStage(application);
  const meta = stageMeta(stage);
  const progress = applicationProgress(application);
  const applicants = Array.isArray(application.applicants) ? application.applicants : [];
  const next = application.status === 'draft' ? continuePath(application) : null;
  const price = application.visaCategory?.price;
  const total = price != null ? price * progress.total : null;
  const base = `/agent/visa/${application.id}`;
  // Paid requests are worked by the admin, who uploads each traveller's visa.
  const inProcessing = ['submitted', 'processing', 'approved', 'rejected'].includes(application.status);
  const visasIssued = applicants.filter((p) => p.visaStatus === 'issued').length;
  const applicationReference = storedApplicationReference(application);

  async function copyApplicationReference() {
    try {
      await navigator.clipboard.writeText(applicationReference);
      setCopiedReference(true);
      window.setTimeout(() => setCopiedReference(false), 1800);
    } catch {
      setCopiedReference(false);
    }
  }

  return (
    <div className="w-full p-5 lg:p-8">
      {back}

      {/* Heading */}
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-serif text-[30px] font-bold leading-tight tracking-tight text-agent-ink-dark sm:text-[36px]">
              {application.visaType?.name}
            </h2>
            <StatusBadge tone={meta.tone} label={meta.label} />
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-agent-muted">
            <span aria-hidden className="h-[2px] w-5 rounded-full bg-agent-accent-dark" />
            {application.visaCategory?.name}
            <span aria-hidden>·</span>
            <span className="font-mono text-[12.5px]" title={application.id}>
              Application ID: {storedApplicationReference(application)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button type="button" onClick={copyApplicationReference} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-agent-line-light bg-white px-3 text-[12px] font-semibold text-agent-ink transition-colors hover:border-agent-accent-dark hover:bg-agent-panel">
            <LuCopy {...ICON} className="h-3.5 w-3.5" /> {copiedReference ? 'Copied' : 'Copy ID'}
          </button>
          <Link to="/agent/support" className="inline-flex h-9 items-center justify-center rounded-lg border border-[#9A6A3A] bg-white px-3 text-[12px] font-semibold text-[#7F552E] transition-colors hover:bg-agent-panel">
            Contact support
          </Link>
          {next && (
            <Link to={next} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#9A6A3A] px-3 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-[#7F552E]">
              {stage === 'ready' ? 'Pay visa fee' : 'Continue'} <LuArrowRight {...ICON} className="h-3.5 w-3.5 text-[#FFCA75]" />
            </Link>
          )}
        </div>
      </header>

      <VisaDownloadPanel application={application} progress={progress} />
      <ApplicationTimeline application={application} progress={progress} stage={stage} payments={payments} visasIssued={visasIssued} />

      {/* Summary */}
      <section aria-label="Application summary" className="mt-6 grid overflow-hidden rounded-2xl border border-agent-line-light bg-white lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:grid-cols-3 sm:p-7">
          <Fact label="Applied by">{application.createdBy?.isMe ? 'You' : application.createdBy?.name || '—'}</Fact>
          <Fact label="Applied on">
            {formatLedgerDate(application.createdAt)}{' '}
            <span className="text-[12px] font-normal text-bk-muted">{formatLedgerTime(application.createdAt)}</span>
          </Fact>
          <Fact label="Last updated">{formatLedgerDate(application.updatedAt)}</Fact>
          <Fact label="Travellers">
            {progress.total} {plural(progress.total, 'traveller')}
          </Fact>
          {application.visaPackage ? (
            <>
              <Fact label="Valid for">{application.visaPackage.validForDays} {plural(application.visaPackage.validForDays, 'day')}</Fact>
              <Fact label="Maximum stay">{application.visaPackage.maxStayDays} {plural(application.visaPackage.maxStayDays, 'day')}</Fact>
            </>
          ) : (
            <Fact label="Processing time">
              {application.visaCategory?.processingTime ? (
                <span className="inline-flex items-center gap-1.5">
                  <LuClock {...ICON} className="h-3.5 w-3.5 text-bk-muted" /> {application.visaCategory.processingTime}
                </span>
              ) : (
                '—'
              )}
            </Fact>
          )}
          <Fact label="Status">{meta.label}</Fact>
        </dl>
        <div className="relative border-t border-agent-line-light p-5 sm:p-7 lg:border-l lg:border-t-0">
          <span aria-hidden className="absolute left-0 top-7 hidden h-10 w-[3px] rounded-r bg-agent-accent-dark lg:block" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-agent-muted">
            Visa fees · {application.paidAmount != null ? 'paid' : 'due'}
          </p>
          {application.paidAmount != null ? (
            <>
              <Amount value={application.paidAmount} size="lg" className="mt-3" />
              <p className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-bk-success-ink">
                <LuCheck {...ICON} strokeWidth={2.5} className="h-3.5 w-3.5" /> Paid
                {application.paidAt ? ` on ${formatLedgerDate(application.paidAt)}` : ''}
              </p>
            </>
          ) : total != null ? (
            <>
              <Amount value={total} size="lg" className="mt-3" />
              <p className="mt-3 text-[12.5px] text-bk-muted">
                <span className="font-semibold text-bk-ink">{formatOmr(price)}</span> per person × {progress.total}{' '}
                {plural(progress.total, 'traveller')}
              </p>
            </>
          ) : (
            <p className="mt-3 text-[14px] text-bk-muted">The visa fee hasn't been set yet.</p>
          )}
        </div>
      </section>

      {/* Progress */}
      <section aria-label="Progress" className="mt-6 grid gap-3 sm:grid-cols-3">
        <StepCard icon={LuUsers} label="Traveller names" done={progress.names} total={progress.total} to={`${base}/travellers`} />
        <StepCard icon={LuCamera} label="Photos" done={progress.photos} total={progress.total} to={`${base}/photos`} />
        <StepCard icon={LuBookOpen} label="Passports confirmed" done={progress.passports} total={progress.total} to={`${base}/passports`} />
      </section>

      <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)] lg:items-start">
      {/* Payments (newest first) */}
      {payments.length > 0 && (
        <section aria-label="Payments" className="overflow-hidden rounded-2xl border border-agent-line-light bg-white">
          <div className="border-b border-bk-line-soft px-5 py-3.5">
            <p className="text-[12.5px] text-bk-muted">
              <span className="font-semibold text-bk-ink">Payments</span> · {payments.length}
            </p>
          </div>
          <ul className="divide-y divide-bk-line-soft">
            {payments.map((p) => {
              const s = PAYMENT_STATUS[p.status] || { tone: 'neutral', label: p.status };
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3.5">
                  <span className="min-w-[150px] text-[13px] text-bk-ink">
                    {formatLedgerDate(p.createdAt)} <span className="text-bk-muted">{formatLedgerTime(p.createdAt)}</span>
                  </span>
                  <span className="min-w-[90px] text-[13px] font-semibold text-bk-ink">{p.method === 'neft' ? 'NEFT' : 'Card'}</span>
                  <span className="min-w-[120px]">
                    <Amount value={p.amount} />
                  </span>
                  <StatusBadge tone={s.tone} label={s.label} />
                  {p.rejectionReason && <span className="text-[12px] text-bk-danger-ink">{p.rejectionReason}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Travellers */}
      <section aria-label="Travellers" className="overflow-hidden rounded-2xl border border-agent-line-light bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-bk-line-soft px-5 py-3.5">
          <p className="text-[12.5px] text-bk-muted">
            <span className="font-semibold text-bk-ink">Travellers</span> · {progress.total}
          </p>
        </div>
        <ul className="divide-y divide-bk-line-soft">
          {applicants.map((p, index) => {
            const photo = PHOTO_STATUS[p.photoStatus] || PHOTO_STATUS.pending;
            const passport = PASSPORT_STATUS[p.passportStatus] || PASSPORT_STATUS.pending;
            const d = p.passportDetails || {};
            const months = monthsUntil(d.dateOfExpiry);
            const uploaded = p.passportStatus && p.passportStatus !== 'pending';
            const visa = VISA_STATUS[p.visaStatus] || VISA_STATUS.pending;
            return (
              <li key={p.id} className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)_160px] md:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-14 w-11 flex-none items-center justify-center overflow-hidden rounded-md bg-bk-line-soft ring-1 ring-bk-line">
                    {p.photoUrl ? (
                      <img src={p.photoUrl} alt={p.fullName || ''} className="h-full w-full object-cover" />
                    ) : (
                      <LuUser {...ICON} className="h-5 w-5 text-bk-muted" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-bk-muted">Traveller {index + 1}</p>
                    <p className="truncate text-[14px] font-semibold text-bk-ink">{p.fullName || 'Name not added'}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <StatusBadge tone={photo.tone} label={photo.label} />
                      <StatusBadge tone={passport.tone} label={passport.label} />
                      {inProcessing && <StatusBadge tone={visa.tone} label={visa.label} />}
                    </div>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-3 rounded-xl bg-bk-hover px-3.5 py-3 sm:grid-cols-4">
                  <div className="min-w-0">
                    <dt className="text-[10.5px] text-bk-muted">Passport no.</dt>
                    <dd className="truncate font-mono text-[13px] font-semibold text-bk-ink">{d.passportNumber || '—'}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10.5px] text-bk-muted">Nationality</dt>
                    <dd className="truncate text-[13px] font-semibold text-bk-ink">{d.nationality || '—'}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10.5px] text-bk-muted">Date of birth</dt>
                    <dd className="text-[13px] font-semibold tabular-nums text-bk-ink">{d.dateOfBirth ? formatLedgerDate(d.dateOfBirth) : '—'}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10.5px] text-bk-muted">Expiry</dt>
                    <dd
                      className={`text-[13px] font-semibold tabular-nums ${
                        months != null && months < 6 ? 'text-bk-danger-ink' : 'text-bk-ink'
                      }`}
                      title={months != null && months < 6 ? 'Less than 6 months validity' : undefined}
                    >
                      {d.dateOfExpiry ? formatLedgerDate(d.dateOfExpiry) : '—'}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-col gap-2 md:items-stretch [&>a]:md:w-full">
                  {p.visaStatus === 'rejected' && p.visaRejectionReason && (
                    <p className="rounded-lg bg-bk-danger-soft px-2.5 py-1.5 text-[11.5px] text-bk-danger-ink">{p.visaRejectionReason}</p>
                  )}
                  {uploaded ? (
                    <Link
                      to={`${base}/passports/${p.id}`}
                      className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-bk-line bg-white px-3 text-[12.5px] font-semibold text-bk-ink transition-colors hover:border-bk-ink/30 hover:bg-bk-hover md:flex-none"
                    >
                      <LuBookOpen {...ICON} className="h-3.5 w-3.5 text-bk-muted" /> Passport details
                    </Link>
                  ) : (
                    application.status === 'draft' && (
                      <Link
                        to={`${base}/passports`}
                        className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-bk-line bg-white px-3 text-[12.5px] font-semibold text-bk-ink transition-colors hover:border-bk-ink/30 hover:bg-bk-hover md:flex-none"
                      >
                        <LuStamp {...ICON} className="h-3.5 w-3.5 text-bk-muted" /> Add passport
                      </Link>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      </div>
    </div>
  );
}
