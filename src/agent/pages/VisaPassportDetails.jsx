import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { LuCheck, LuRefreshCw, LuShieldCheck, LuTrash2, LuTriangleAlert, LuX } from 'react-icons/lu';
import { api } from '../api/client.js';
import { Checkbox, FieldLabel, Select, TextInput, Textarea } from '../components/ui.jsx';
import PassportUploadModal from '../components/visa/PassportUploadModal.jsx';
import RemoveConfirmDialog from '../components/visa/RemoveConfirmDialog.jsx';
import VisaLockedNotice from '../components/visa/VisaLockedNotice.jsx';
import { isEditable } from '../components/visa/visaMeta.js';
import {
  FlowCard,
  FlowError,
  FlowLoading,
  InfoBanner,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  VisaFlowPage,
  VisaPageHeading,
} from '../components/visa/VisaFlowUi.jsx';
import { FOCUS, PASSPORT_BADGE } from '../components/visa/visaFlowTokens.js';

// Extracted passport details for one traveller, pre-filled from the scan
// (passportScan.service.js) for the agent to check and correct. Fields the
// scan was unsure about carry a warning; fields taken from the checksum-
// verified MRZ are marked. Saving (PUT .../passport) re-runs the rule checks
// server-side and marks the passport confirmed.

const FRONT = [
  ['passportNumber', 'Passport number', { required: true, upper: true }],
  ['surname', 'Surname', { required: true, upper: true }],
  ['givenNames', 'Given names', { upper: true }],
  ['nationality', 'Nationality', { required: true, upper: true }],
  ['sex', 'Sex', { required: true, type: 'sex' }],
  ['dateOfBirth', 'Date of birth', { required: true, type: 'date' }],
  ['placeOfBirth', 'Place of birth', { upper: true }],
  ['placeOfIssue', 'Place of issue', { upper: true }],
  ['dateOfIssue', 'Date of issue', { type: 'date' }],
  ['dateOfExpiry', 'Date of expiry', { required: true, type: 'date' }],
];
const BACK = [
  ['fatherName', "Father's / legal guardian's name", { upper: true }],
  ['motherName', "Mother's name", { upper: true }],
  ['spouseName', "Spouse's name", { upper: true }],
  ['fileNumber', 'File number', { upper: true }],
  ['oldPassportNumber', 'Old passport number', { upper: true }],
  ['address', 'Address', { upper: true, type: 'textarea', wide: true }],
];
const ALL_FIELDS = [...FRONT, ...BACK].map(([key]) => key);

function titleCase(value) {
  return value.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (m) => m.toUpperCase());
}

function Field({ name, label, opts, value, onChange, warning, fromMrz, error }) {
  const common = {
    id: `pp-${name}`,
    value: value || '',
    onChange: (e) => onChange(opts.upper ? e.target.value.toUpperCase() : e.target.value),
    'aria-invalid': !!error,
    className: error ? '!border-[#D74747]' : warning ? '!border-agent-accent' : '',
  };
  return (
    <div className={opts.wide ? 'sm:col-span-2' : ''}>
      <label htmlFor={`pp-${name}`} className="flex items-center justify-between gap-2">
        <FieldLabel>
          {label}
          {opts.required ? ' *' : ''}
        </FieldLabel>
        {fromMrz && (
          <span className="mb-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#168765]" title="Read from the machine-readable code and verified by its checksum">
            <LuShieldCheck size={11} /> MRZ verified
          </span>
        )}
      </label>
      {opts.type === 'sex' ? (
        <Select {...common}>
          <option value="">Select</option>
          <option value="M">M — Male</option>
          <option value="F">F — Female</option>
          <option value="X">X — Unspecified</option>
        </Select>
      ) : opts.type === 'textarea' ? (
        <Textarea rows={2} {...common} />
      ) : (
        <TextInput type={opts.type === 'date' ? 'date' : 'text'} autoComplete="off" {...common} />
      )}
      {error ? (
        <p className="mt-1 text-[11px] font-semibold text-[#D74747]">{error}</p>
      ) : warning ? (
        <p className="mt-1 flex items-start gap-1 text-[11px] text-[#B4561F]">
          <LuTriangleAlert size={12} className="mt-0.5 flex-none" /> {warning}
        </p>
      ) : null}
    </div>
  );
}

function CheckRow({ c }) {
  const tone = c.passed ? 'ok' : c.severity === 'error' ? 'error' : 'warn';
  return (
    <li className="flex items-start gap-2 text-xs">
      <span
        className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full ${
          tone === 'ok' ? 'bg-[#D1FAE5] text-[#168765]' : tone === 'error' ? 'bg-[#FBEBEB] text-[#D74747]' : 'bg-[#FFF1DF] text-[#E87535]'
        }`}
      >
        {tone === 'ok' ? <LuCheck size={11} /> : tone === 'error' ? <LuX size={11} /> : '!'}
      </span>
      <span className="text-[#17243A]">
        <span className="font-semibold">{c.label}</span>
        {c.detail && <span className="block text-[#737D8C]">{c.detail}</span>}
      </span>
    </li>
  );
}

function requiredErrors(details) {
  const errors = {};
  for (const [key, label, opts] of FRONT) {
    if (opts.required && !String(details[key] || '').trim()) errors[key] = `${label} is required`;
  }
  if (details.passportNumber && !/^[A-Z0-9]{5,12}$/.test(details.passportNumber)) {
    errors.passportNumber = 'Use 5–12 letters/digits, no spaces';
  }
  return errors;
}

export default function VisaPassportDetails() {
  const { id, applicantId } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [useNameFromPassport, setUseNameFromPassport] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rescan, setRescan] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [zoom, setZoom] = useState('');

  const applicant = application?.applicants.find((a) => a.id === applicantId);
  const scan = applicant?.passportScan;

  function load() {
    return api.get(`/visa/applications/${id}`).then(({ application: a }) => {
      setApplication(a);
      const p = a.applicants.find((x) => x.id === applicantId);
      setDetails(Object.fromEntries(ALL_FIELDS.map((k) => [k, p?.passportDetails?.[k] || ''])));
    });
  }

  useEffect(() => {
    load()
      .catch((err) => setError(err.status === 404 ? 'This application was not found.' : err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, applicantId]);

  const passportName = details ? titleCase(`${details.givenNames} ${details.surname}`.replace(/\s+/g, ' ').trim()) : '';
  const nameDiffers = useMemo(() => {
    if (!applicant || !passportName) return false;
    const tokens = (s) => s.toUpperCase().split(/[^A-Z]+/).filter(Boolean).sort().join(' ');
    return tokens(applicant.fullName) !== tokens(passportName);
  }, [applicant, passportName]);

  function update(key, value) {
    setDetails((d) => ({ ...d, [key]: value }));
    setFieldErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function save(e) {
    e.preventDefault();
    const errors = requiredErrors(details);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError('Fill the required fields before saving.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await api.put(`/visa/applications/${id}/applicants/${applicantId}/passport`, {
        details,
        useNameFromPassport: nameDiffers && useNameFromPassport,
      });
      navigate(`/agent/visa/${id}/passports`);
    } catch (err) {
      setError(err.message || 'Unable to save the passport details');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <VisaFlowPage current={3} backTo={`/agent/visa/${id}/passports`}>
        <FlowLoading />
      </VisaFlowPage>
    );
  }
  if (!applicant) {
    return (
      <VisaFlowPage current={3} backTo={`/agent/visa/${id}/passports`}>
        <FlowError>{error || 'Traveller not found.'}</FlowError>
      </VisaFlowPage>
    );
  }

  const badge = PASSPORT_BADGE[applicant.passportStatus] || PASSPORT_BADGE.pending;
  const warnings = scan?.fieldWarnings || {};
  const sources = scan?.fieldSources || {};
  const failedChecks = (scan?.checks || []).filter((c) => !c.passed);
  const pageImages = [
    ['Front page', applicant.passportFrontUrl],
    ['Back page', applicant.passportBackUrl !== applicant.passportFrontUrl ? applicant.passportBackUrl : null],
  ];
  const editable = isEditable(application);

  return (
    <VisaFlowPage current={3} backTo={`/agent/visa/${id}/passports`}>
      <VisaPageHeading
        title="Passport details"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {applicant.fullName} <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
          </span>
        }
        help={false}
        action={
          editable && (
            <>
              <SecondaryButton onClick={() => setRescan(true)}>
                <LuRefreshCw size={15} /> Re-upload passport
              </SecondaryButton>
              <SecondaryButton onClick={() => setRemoving(true)} className="!border-[#F2C9C9] !text-[#D74747] hover:!bg-[#FDF1F1]">
                <LuTrash2 size={15} /> Remove
              </SecondaryButton>
            </>
          )
        }
      />
      {!editable && <VisaLockedNotice application={application} />}

      {scan?.aiSkipped ? (
        <InfoBanner tone="warn" className="mb-5">
          The passport couldn&apos;t be read automatically right now — please type the details from the pages shown.
        </InfoBanner>
      ) : (
        failedChecks.length > 0 &&
        applicant.passportStatus !== 'confirmed' && (
          <InfoBanner tone="warn" className="mb-5">
            The scan found {failedChecks.length} thing{failedChecks.length === 1 ? '' : 's'} to check — see the highlighted fields and the
            checks list.
          </InfoBanner>
        )
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            {pageImages.map(([label, url]) => (
              <FlowCard as="figure" key={label} className="overflow-hidden">
                <figcaption className="border-b border-[#F0DFC7] px-4 py-2.5 text-[13px] font-semibold text-[#17243A]">{label}</figcaption>
                {url ? (
                  <button type="button" onClick={() => setZoom(url)} className={`block w-full bg-[#FFFCF7] ${FOCUS}`} aria-label={`Enlarge ${label}`}>
                    <img src={url} alt={label} className="max-h-80 w-full object-contain" />
                  </button>
                ) : (
                  <div className="flex h-32 items-center justify-center bg-[#FFFCF7] px-3 text-center text-[13px] text-[#737D8C]">
                    {label === 'Back page' && applicant.passportBackUrl === applicant.passportFrontUrl && applicant.passportBackUrl
                      ? 'Same image as the front page'
                      : 'Not uploaded'}
                  </div>
                )}
              </FlowCard>
            ))}
          </div>

          {scan?.checks?.length > 0 && (
            <FlowCard className="p-5">
              <h3 className="mb-3 text-[15px] font-bold text-[#17243A]">Automatic checks</h3>
              <ul className="space-y-2.5">
                {scan.checks.map((c) => (
                  <CheckRow key={c.key} c={c} />
                ))}
              </ul>
            </FlowCard>
          )}
        </div>

        <form onSubmit={save}>
          {/* Read-only once the application is paid / payment in review. */}
          <fieldset disabled={!editable} className="min-w-0 space-y-4">
            <FlowCard className="p-5">
              <h3 className="mb-4 text-[15px] font-bold text-[#17243A]">Front page</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {FRONT.map(([key, label, opts]) => (
                  <Field
                    key={key}
                    name={key}
                    label={label}
                    opts={opts}
                    value={details[key]}
                    onChange={(v) => update(key, v)}
                    warning={warnings[key]}
                    fromMrz={sources[key] === 'mrz'}
                    error={fieldErrors[key]}
                  />
                ))}
              </div>
            </FlowCard>

            <FlowCard className="p-5">
              <h3 className="mb-4 text-[15px] font-bold text-[#17243A]">Back page</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {BACK.map(([key, label, opts]) => (
                  <Field key={key} name={key} label={label} opts={opts} value={details[key]} onChange={(v) => update(key, v)} warning={warnings[key]} />
                ))}
              </div>
            </FlowCard>

            {nameDiffers && (
              <div className="rounded-xl border border-[#F3D9B5] bg-[#FFF1DF] px-4 py-3">
                <p className="text-sm text-[#17243A]">
                  The traveller was entered as <b>{applicant.fullName}</b>, but the passport reads <b>{passportName}</b>.
                </p>
                <Checkbox
                  checked={useNameFromPassport}
                  onChange={setUseNameFromPassport}
                  label={`Update the traveller's name to "${passportName}"`}
                />
              </div>
            )}

            <FlowError>{error}</FlowError>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <SecondaryButton onClick={() => navigate(`/agent/visa/${id}/passports`)} disabled={saving}>
                {editable ? 'Cancel' : 'Back to passports'}
              </SecondaryButton>
              {editable && (
                <PrimaryButton type="submit" size="md" disabled={saving}>
                  <LuCheck size={17} /> {saving ? 'Saving…' : 'Confirm details'}
                </PrimaryButton>
              )}
            </div>
          </fieldset>
        </form>
      </div>

      {zoom && (
        <button
          type="button"
          onClick={() => setZoom('')}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          aria-label="Close enlarged page"
        >
          <img src={zoom} alt="Passport page" className="max-h-full max-w-full rounded-lg object-contain" />
        </button>
      )}

      <AnimatePresence>
        {rescan && (
          <PassportUploadModal
            applicationId={id}
            applicant={applicant}
            onClose={() => setRescan(false)}
            onScanned={() => {
              setRescan(false);
              setLoading(true);
              load().finally(() => setLoading(false));
            }}
          />
        )}
        {removing && (
          <RemoveConfirmDialog
            key="remove"
            title="Remove this passport?"
            confirmLabel="Remove passport"
            onCancel={() => setRemoving(false)}
            onConfirm={async () => {
              await api.del(`/visa/applications/${id}/applicants/${applicantId}/passport`);
              navigate(`/agent/visa/${id}/passports`);
            }}
          >
            {applicant.fullName}&apos;s passport images will be permanently deleted from storage, along with the details on
            this page. You can upload the passport again afterwards.
          </RemoveConfirmDialog>
        )}
      </AnimatePresence>
    </VisaFlowPage>
  );
}
