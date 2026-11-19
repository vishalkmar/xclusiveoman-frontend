import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { LuArrowRight, LuBookOpen, LuCircleAlert, LuCircleCheck, LuHouse, LuPencil, LuTrash2, LuUpload } from 'react-icons/lu';
import { api } from '../api/client.js';
import PassportUploadModal from '../components/visa/PassportUploadModal.jsx';
import RemoveConfirmDialog from '../components/visa/RemoveConfirmDialog.jsx';
import VisaLockedNotice from '../components/visa/VisaLockedNotice.jsx';
import { isEditable } from '../components/visa/visaMeta.js';
import {
  DangerIconButton,
  FlowCard,
  FlowError,
  FlowFooter,
  FlowLoading,
  InfoBanner,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  TravellerNumber,
  VisaFlowPage,
  VisaPageHeading,
} from '../components/visa/VisaFlowUi.jsx';
import { FOCUS, PASSPORT_BADGE, visaSummaryLine } from '../components/visa/visaFlowTokens.js';

// Visa application step 4 — each traveller's passport: upload/scan
// (PassportUploadModal — it shows uploading / scanning / rejected, and takes
// the front page, the back page or the whole passport), then review the
// extracted details (VisaPassportDetails.jsx).
//
// Layout (VisaFlowUi.jsx): a row per traveller — number + name, a Front page
// tile and a Back page tile (each with what's uploaded), then the status and
// actions.

// Mirrors the required fields in VisaPassportDetails.jsx / the backend's
// visaPassportDetailsSchema.
const REQUIRED_PASSPORT_FIELDS = {
  passportNumber: 'passport number',
  surname: 'surname',
  nationality: 'nationality',
  sex: 'sex',
  dateOfBirth: 'date of birth',
  dateOfExpiry: 'expiry date',
};

// What still stops a traveller's details being complete (empty = done).
function missingDetails(p) {
  const missing = [];
  if (!p.fullName) missing.push('name');
  if (!p.photoStatus || p.photoStatus === 'pending') missing.push('photo');
  if (!p.passportStatus || p.passportStatus === 'pending') {
    missing.push('passport upload');
    return missing;
  }
  const d = p.passportDetails || {};
  const empty = Object.entries(REQUIRED_PASSPORT_FIELDS)
    .filter(([key]) => !String(d[key] || '').trim())
    .map(([, label]) => label);
  missing.push(...empty);
  // The back page must show the same passport number as the front.
  if (!p.passportScan?.backCheck?.matched) missing.push('back page matching the passport number');
  if (p.passportStatus !== 'confirmed') missing.push('passport details confirmation');
  return missing;
}

const BADGE_ICON = { confirmed: LuCircleCheck, needs_review: LuCircleAlert };

// One passport page slot: preview (or icon), label, hint and its upload button.
function PageTile({ Icon, label, hint, imageUrl, note, noteTone, onUpload, uploadLabel }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[#F0DFC7] bg-[#FFFCF7] p-3">
      <span className="flex h-16 w-12 flex-none items-center justify-center overflow-hidden rounded-lg border border-[#F0DFC7] bg-white text-[#C9B79C]">
        {imageUrl ? <img src={imageUrl} alt={label} className="h-full w-full object-cover" /> : <Icon size={22} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-[#17243A]">{label}</span>
        <span
          className={`flex items-center gap-1 truncate text-[13px] ${
            noteTone === 'ok' ? 'font-semibold text-[#17243A]' : noteTone === 'warn' ? 'font-semibold text-[#D74747]' : 'text-[#737D8C]'
          }`}
          title={note || hint}
        >
          {noteTone === 'ok' && <LuCircleCheck size={14} className="flex-none text-[#E87535]" />}
          <span className="truncate">{note || hint}</span>
        </span>
        <button
          type="button"
          onClick={onUpload}
          className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full text-[13px] font-semibold text-[#E87535] hover:underline ${FOCUS}`}
        >
          <LuUpload size={14} /> {uploadLabel}
        </button>
      </span>
    </div>
  );
}

export default function VisaPassports() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(null);
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    api
      .get(`/visa/applications/${id}`)
      .then(({ application: a }) => setApplication(a))
      .catch((err) => setError(err.status === 404 ? 'This application was not found.' : err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const applicants = application?.applicants || [];
  const confirmed = applicants.filter((p) => p.passportStatus === 'confirmed').length;
  const incomplete = applicants
    .map((p, index) => ({ p, index, missing: missingDetails(p) }))
    .filter((t) => t.missing.length > 0);
  const allComplete = applicants.length > 0 && incomplete.length === 0;
  const editable = application ? isEditable(application) : false;

  return (
    <VisaFlowPage current={3} backTo={`/agent/visa/${id}/photos`}>
      <VisaPageHeading title="Traveller passports" subtitle={visaSummaryLine(application)} />

      {loading ? (
        <FlowLoading />
      ) : !application ? (
        <FlowError>{error}</FlowError>
      ) : (
        <>
          {!editable && <VisaLockedNotice application={application} />}

          <InfoBanner
            className="mb-5"
            action={
              <span className="text-sm font-semibold text-[#17243A]">
                {confirmed} of {applicants.length} confirmed
              </span>
            }
          >
            Upload the front page first — the passport number is read from it — then the back page. The back page is only accepted
            when it shows the same passport number.
          </InfoBanner>

          {/* Upload / Review / Remove are switched off once the application is locked (Review stays usable). */}
          <ol className="space-y-3" aria-disabled={!editable}>
            {applicants.map((p, index) => {
              const badge = PASSPORT_BADGE[p.passportStatus] || PASSPORT_BADGE.pending;
              const uploaded = p.passportStatus !== 'pending';
              const missing = missingDetails(p);
              const sameImage = uploaded && p.passportBackUrl && p.passportBackUrl === p.passportFrontUrl;
              const backMatched = uploaded && !!p.passportScan?.backCheck?.matched;
              const upload = () => setUploading(p);
              return (
                <li key={p.id}>
                  <FlowCard className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(180px,220px)_minmax(0,1fr)_minmax(0,1fr)_minmax(190px,auto)] lg:items-center">
                    <div className="flex items-center gap-3">
                      <TravellerNumber n={index + 1} done={p.passportStatus === 'confirmed'} />
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-bold text-[#17243A]">{p.fullName || `Traveller ${index + 1}`}</div>
                        <div className="truncate text-[13px] text-[#737D8C]">
                          {p.passportDetails?.passportNumber
                            ? `${p.passportDetails.passportNumber}${p.passportDetails.dateOfExpiry ? ` · exp. ${p.passportDetails.dateOfExpiry}` : ''}`
                            : `Traveller ${index + 1}`}
                        </div>
                      </div>
                    </div>

                    <div className={editable ? '' : '[&_button]:pointer-events-none [&_button]:opacity-40'}>
                      <PageTile
                        Icon={LuBookOpen}
                        label="Front page"
                        hint="Photo page with MRZ"
                        imageUrl={p.passportFrontUrl}
                        onUpload={upload}
                        uploadLabel={p.passportFrontUrl ? 'Replace' : 'Upload'}
                      />
                    </div>
                    <div className={editable ? '' : '[&_button]:pointer-events-none [&_button]:opacity-40'}>
                      <PageTile
                        Icon={LuHouse}
                        label="Back page"
                        hint={p.passportFrontUrl ? 'Must match the passport number' : 'Upload the front page first'}
                        imageUrl={backMatched && !sameImage ? p.passportBackUrl : null}
                        note={
                          backMatched
                            ? `${sameImage ? 'In the front image · ' : ''}Matches ${p.passportScan.backCheck.passportNumber}`
                            : p.passportScan?.backCheck?.reason === 'number_changed'
                              ? 'Passport number changed — upload again'
                              : null
                        }
                        noteTone={backMatched ? 'ok' : p.passportScan?.backCheck?.reason ? 'warn' : null}
                        onUpload={upload}
                        uploadLabel={backMatched && !sameImage ? 'Replace' : 'Upload'}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-end">
                      <StatusBadge tone={badge.tone} icon={BADGE_ICON[p.passportStatus]}>
                        {badge.label}
                      </StatusBadge>
                      {uploaded && (
                        <div className="flex items-center gap-1">
                          <SecondaryButton
                            size="md"
                            className="!h-9 !px-3.5 !text-[13px]"
                            onClick={() => navigate(`/agent/visa/${id}/passports/${p.id}`)}
                          >
                            <LuPencil size={14} /> {p.passportStatus === 'confirmed' ? 'View details' : 'Review details'}
                          </SecondaryButton>
                          {editable && (
                            <DangerIconButton label={`Remove ${p.fullName}'s passport`} onClick={() => setRemoving(p)}>
                              <LuTrash2 size={16} />
                            </DangerIconButton>
                          )}
                        </div>
                      )}
                    </div>

                    {uploaded && missing.length > 0 && (
                      <p className="text-[13px] font-medium text-[#D74747] lg:col-span-4">Missing: {missing.join(', ')}</p>
                    )}
                  </FlowCard>
                </li>
              );
            })}
          </ol>

          <FlowFooter
            hint={
              allComplete ? (
                'All traveller details are complete — pay the visa fee to submit.'
              ) : (
                <div className="space-y-0.5">
                  <p>Complete every traveller&apos;s passport to continue.</p>
                  {incomplete.map(({ p, index, missing }) => (
                    <p key={p.id}>
                      <span className="font-semibold text-[#17243A]">{p.fullName || `Traveller ${index + 1}`}:</span> {missing.join(', ')}
                    </p>
                  ))}
                </div>
              )
            }
          >
            <PrimaryButton disabled={!allComplete} onClick={() => navigate(`/agent/visa/${id}/pay`)}>
              {editable ? 'Continue to payment' : 'View payment'} <LuArrowRight size={18} />
            </PrimaryButton>
          </FlowFooter>
        </>
      )}

      <AnimatePresence>
        {uploading && (
          <PassportUploadModal
            key={uploading.id}
            applicationId={id}
            applicant={uploading}
            onClose={() => setUploading(null)}
            onScanned={(updated) => navigate(`/agent/visa/${id}/passports/${updated.id}`)}
          />
        )}
        {removing && (
          <RemoveConfirmDialog
            key="remove"
            title="Remove this passport?"
            confirmLabel="Remove passport"
            onCancel={() => setRemoving(null)}
            onConfirm={async () => {
              const { applicant } = await api.del(`/visa/applications/${id}/applicants/${removing.id}/passport`);
              setApplication((a) => ({ ...a, applicants: a.applicants.map((x) => (x.id === applicant.id ? applicant : x)) }));
              setRemoving(null);
            }}
          >
            {removing.fullName}&apos;s passport images will be permanently deleted from storage, along with the details read
            from them. You can upload the passport again afterwards.
          </RemoveConfirmDialog>
        )}
      </AnimatePresence>
    </VisaFlowPage>
  );
}
