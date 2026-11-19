import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { LuArrowRight, LuCamera, LuCircleAlert, LuCircleCheck, LuLightbulb, LuSmartphone, LuTrash2, LuUpload, LuUser } from 'react-icons/lu';
import { api } from '../api/client.js';
import PhotoCaptureModal, { PhotoCheckList } from '../components/visa/PhotoCaptureModal.jsx';
import RemoveConfirmDialog from '../components/visa/RemoveConfirmDialog.jsx';
import VisaLockedNotice from '../components/visa/VisaLockedNotice.jsx';
import { isEditable } from '../components/visa/visaMeta.js';
import {
  DangerIconButton,
  FlowCard,
  FlowError,
  FlowLoading,
  InfoBanner,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  TravellerNumber,
  VisaFlowPage,
  VisaPageHeading,
} from '../components/visa/VisaFlowUi.jsx';
import { FOCUS, PHOTO_BADGE, visaSummaryLine } from '../components/visa/visaFlowTokens.js';

// Visa application step 3 — a verified photo for every traveller, by guided
// camera scan or upload (PhotoCaptureModal, rendered in place of the grid on
// this page; it also shows "verifying" and any rejected checks). The server re-checks every photo; a saved one is
// approved, or needs_review when the AI check couldn't run.
//
// Layout (VisaFlowUi.jsx): compact traveller cards, four to a row on desktop
// so a family fits on one screen — number, name and photo status, the 7:9
// photo (or a placeholder), then Scan / Upload (Rescan / Replace once saved)
// and "Use a phone instead". Footer: what's left to do + Continue.

const BADGE_ICON = { approved: LuCircleCheck, needs_review: LuCircleAlert };

export default function VisaPhotos() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [capturing, setCapturing] = useState(null); // { applicant, mode }
  const [expanded, setExpanded] = useState('');
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    api
      .get(`/visa/applications/${id}`)
      .then(({ application: a }) => setApplication(a))
      .catch((err) => setError(err.status === 404 ? 'This application was not found.' : err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const submitPhoto = useCallback(
    async (capture) => {
      const form = new FormData();
      form.append('photo', capture.photo, capture.photo.name || 'photo.jpg');
      form.append('source', capture.source);
      form.append('clientReport', JSON.stringify(capture.clientReport || {}));
      const { applicant } = await api.postForm(
        `/visa/applications/${id}/applicants/${capturing.applicant.id}/photo`,
        form
      );
      return applicant;
    },
    [id, capturing]
  );

  // "Scan with phone": a single-use QR link for the traveller being captured
  // (backend visaPhotoHandoff.controller.js; the phone opens /visa-photo/:token).
  const capturingId = capturing?.applicant.id;
  const phoneHandoff = useMemo(
    () =>
      capturingId
        ? {
            create: () =>
              api.post(`/visa/applications/${id}/applicants/${capturingId}/photo-handoff`, {}).then(({ handoff }) => handoff),
            poll: (handoffId) => api.get(`/visa/photo-handoffs/${handoffId}`).then(({ handoff }) => handoff),
            cancel: (handoffId) => api.del(`/visa/photo-handoffs/${handoffId}`),
          }
        : null,
    [id, capturingId]
  );

  function handleDone(applicant) {
    setApplication((a) => ({ ...a, applicants: a.applicants.map((p) => (p.id === applicant.id ? applicant : p)) }));
    setCapturing(null);
  }

  // Scan / upload / phone open in a pop-up over the photo cards
  // (PhotoCaptureModal variant="dialog").
  function openCapture(applicant, mode) {
    setCapturing({ applicant, mode });
  }
  const closeCapture = useCallback(() => setCapturing(null), []);

  const applicants = application?.applicants || [];
  const done = applicants.filter((p) => p.photoStatus !== 'pending').length;
  const missingNames = applicants.some((p) => !p.fullName);
  const editable = application ? isEditable(application) : false;

  return (
    <VisaFlowPage current={2} backTo={`/agent/visa/${id}/travellers`}>
      <VisaPageHeading title="Traveller photos" subtitle={visaSummaryLine(application)} />

      {loading ? (
        <FlowLoading />
      ) : !application ? (
        <FlowError>{error}</FlowError>
      ) : (
        <>
          {!editable && <VisaLockedNotice application={application} />}

          <InfoBanner
            className="mb-2"
            action={
              <span className="flex items-center gap-3 text-sm font-semibold text-[#17243A]">
                {done} of {applicants.length} done
                <span className="h-1.5 w-28 overflow-hidden rounded-full bg-white">
                  <span
                    className="block h-full rounded-full bg-[#FFBF47] transition-all"
                    style={{ width: `${applicants.length ? (done / applicants.length) * 100 : 0}%` }}
                  />
                </span>
              </span>
            }
          >
            Each photo is checked for sharpness, face alignment, distance from the camera, eyes open and lighting.
          </InfoBanner>

          {missingNames && (
            <div className="mb-5">
              <FlowError>
                Some travellers have no name yet.{' '}
                <Link to={`/agent/visa/${id}/travellers`} className="font-semibold underline">
                  Add names first
                </Link>
                .
              </FlowError>
            </div>
          )}

          {/* Up to four travellers per row on desktop (more wrap to the next
              row; fewer keep the same card width) — 2 columns on tablets,
              1 on phones. Scan / Upload / Remove are switched off once the
              application is locked. */}
          <div
            className={`grid grid-cols-1 gap-4 sm:grid-cols-2 min-[1200px]:grid-cols-4 ${editable ? '' : '[&_button]:pointer-events-none [&_button]:opacity-40'}`}
            aria-disabled={!editable}
          >
            {applicants.map((p, index) => {
              const hasPhoto = p.photoStatus !== 'pending';
              const badge = PHOTO_BADGE[p.photoStatus] || PHOTO_BADGE.pending;
              const name = p.fullName || 'Name missing';
              return (
                <FlowCard key={p.id} selected={!hasPhoto && index === done} className="flex min-w-0 flex-col p-4">
                  {/* Traveller + photo status */}
                  <div className="flex items-center gap-3">
                    <TravellerNumber n={index + 1} done={hasPhoto} className={hasPhoto ? '' : '!text-[#17243A]'} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-bold text-[#17243A]" title={name}>
                        {name}
                      </div>
                      {/* Status under the name, so the name gets the card's full width. */}
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[13px] text-[#737D8C]">Traveller {index + 1}</span>
                        {hasPhoto ? (
                          <StatusBadge tone={badge.tone} icon={BADGE_ICON[p.photoStatus]} className="!py-0.5">
                            {badge.label}
                          </StatusBadge>
                        ) : (
                          <span className="inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full bg-[#FFF1DF] px-2.5 py-0.5 text-xs font-semibold text-[#17243A]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#FFBF47]" /> {badge.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Photo (7:9, passport-photo shape) */}
                  <div className="mt-3 flex flex-col items-center rounded-xl bg-[#FFF9EF] px-3 py-3">
                    <div className="relative aspect-[7/9] h-[128px] overflow-hidden rounded-lg bg-white ring-1 ring-[#F0DFC7]">
                      {p.photoUrl ? (
                        <img src={p.photoUrl} alt={`${name}'s photo`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-[#B9A98F]">
                          <LuUser size={34} strokeWidth={1.6} />
                          <span className="text-[12px] font-medium text-[#737D8C]">No photo yet</span>
                        </div>
                      )}
                      {hasPhoto && (
                        <DangerIconButton
                          label={`Remove ${name}'s photo`}
                          onClick={() => setRemoving(p)}
                          className="absolute right-1 top-1 !h-8 !w-8 bg-white/90 shadow-sm"
                        >
                          <LuTrash2 size={15} />
                        </DangerIconButton>
                      )}
                    </div>
                    <div className="mt-2 flex min-h-[20px] items-center gap-2 text-[12.5px] text-[#737D8C]">
                      {hasPhoto ? (
                        <>
                          <span>{p.photoSource === 'camera' ? 'Camera scan' : 'Uploaded'}</span>
                          {p.photoCheck?.checks?.length > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <button
                                type="button"
                                onClick={() => setExpanded((v) => (v === p.id ? '' : p.id))}
                                className={`rounded font-semibold text-[#E87535] hover:underline ${FOCUS}`}
                              >
                                {expanded === p.id ? 'Hide checks' : 'View checks'}
                              </button>
                            </>
                          )}
                        </>
                      ) : (
                        <span>Face straight, plain background</span>
                      )}
                    </div>
                  </div>

                  {expanded === p.id && (
                    <div className="mt-3 rounded-xl border border-[#F0DFC7] bg-[#FFFCF7] px-2.5 py-2.5 [&_ul]:!grid-cols-1">
                      <PhotoCheckList check={p.photoCheck} />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-auto pt-3">
                    <div className="grid grid-cols-2 gap-2">
                      <PrimaryButton
                        size="md"
                        className="!h-11 !px-3"
                        disabled={!p.fullName}
                        aria-label={`${hasPhoto ? 'Rescan' : 'Scan'} ${name}'s photo with the camera`}
                        onClick={() => openCapture(p, 'scan')}
                      >
                        <LuCamera size={17} /> {hasPhoto ? 'Rescan' : 'Scan'}
                      </PrimaryButton>
                      <SecondaryButton
                        size="md"
                        className="!h-11 !px-3"
                        disabled={!p.fullName}
                        aria-label={`${hasPhoto ? 'Replace' : 'Upload'} ${name}'s photo`}
                        onClick={() => openCapture(p, 'upload')}
                      >
                        <LuUpload size={17} /> {hasPhoto ? 'Replace' : 'Upload'}
                      </SecondaryButton>
                    </div>
                    <button
                      type="button"
                      disabled={!p.fullName}
                      onClick={() => openCapture(p, 'phone')}
                      className={`mx-auto mt-1.5 flex items-center gap-1.5 rounded text-[13px] font-semibold text-[#E87535] hover:underline disabled:opacity-40 ${FOCUS}`}
                    >
                      <LuSmartphone size={14} /> Use a phone instead
                    </button>
                  </div>
                </FlowCard>
              );
            })}
          </div>

          {/* Footer: what's left to do · Continue (only once every photo is saved) */}
          <div className="mt-4 flex flex-col gap-4 border-t border-[#F0DFC7] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#FFF1DF] text-[#E87535]">
                <LuLightbulb size={20} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#17243A]">
                  {done < applicants.length ? 'Add a photo for every traveller first.' : 'Every traveller has a photo.'}
                </p>
                <p className="text-[13px] text-[#737D8C]">
                  {done < applicants.length
                    ? 'Scan with the camera, use a phone, or upload a clear photo from your device.'
                    : 'Next, add each traveller\'s passport.'}
                </p>
              </div>
            </div>
            <PrimaryButton disabled={done < applicants.length} onClick={() => navigate(`/agent/visa/${id}/passports`)}>
              Continue to passports <LuArrowRight size={18} />
            </PrimaryButton>
          </div>
        </>
      )}

      {capturing && application && (
        <PhotoCaptureModal
          key={capturing.applicant.id}
          variant="dialog"
          applicantName={capturing.applicant.fullName}
          applicantNumber={applicants.findIndex((x) => x.id === capturing.applicant.id) + 1}
          currentPhotoUrl={capturing.applicant.photoUrl || null}
          initialMode={capturing.mode}
          onSubmit={submitPhoto}
          phoneHandoff={phoneHandoff}
          onClose={closeCapture}
          onDone={handleDone}
        />
      )}

      <AnimatePresence>
        {removing && (
          <RemoveConfirmDialog
            key="remove"
            title="Remove this photo?"
            confirmLabel="Remove photo"
            onCancel={() => setRemoving(null)}
            onConfirm={async () => {
              const { applicant } = await api.del(`/visa/applications/${id}/applicants/${removing.id}/photo`);
              setApplication((a) => ({ ...a, applicants: a.applicants.map((x) => (x.id === applicant.id ? applicant : x)) }));
              setRemoving(null);
            }}
          >
            {removing.fullName}&apos;s photo will be permanently deleted from storage. You can scan or upload a new one
            afterwards.
          </RemoveConfirmDialog>
        )}
      </AnimatePresence>
    </VisaFlowPage>
  );
}
