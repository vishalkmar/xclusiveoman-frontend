import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { LuCamera, LuCheck, LuCircleAlert, LuEye, LuImageUp, LuLoader, LuScanFace, LuSun } from 'react-icons/lu';
import { api } from './publicApi.js';
import PhotoCaptureModal from '../agent/components/visa/PhotoCaptureModal.jsx';
import { FOCUS, SERIF } from '../agent/components/visa/visaFlowTokens.js';

// "Scan with phone" — the page a traveller's phone opens from the QR code on
// the agent's Traveller photos step (PhotoCaptureModal → PhoneHandoff).
// No login: the token in the URL is a single-use, short-lived key to exactly
// one traveller's photo (backend visaPhotoHandoff.controller.js), sent on
// the anonymous public API client. The same guided face scan runs here with
// the front camera; the photo goes through the same server checks and
// appears on the agent's computer by itself.

// A taller preview than on a laptop — the phone has the screen to itself.
const PHONE_PREVIEW_HEIGHT = 'clamp(280px, 62dvh, 640px)';

function Shell({ children }) {
  return (
    <div className="min-h-[100dvh] bg-[#FFF9EF] text-[#17243A]">
      <header className="flex items-center justify-between border-b border-[#F0DFC7] bg-white px-4 py-3">
        <img src="/Xclusive_Oman_Logo_New.png" alt="Xclusive Oman" className="h-8 w-auto object-contain" />
        <span className="text-[13px] font-semibold text-[#737D8C]">Visa photo</span>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">{children}</main>
    </div>
  );
}

function Notice({ icon: Icon, tone = 'neutral', title, children }) {
  return (
    <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-2xl border border-[#F0DFC7] bg-white px-6 py-10 text-center shadow-[0_12px_30px_-26px_rgba(23,36,58,0.45)]">
      <span
        className={`flex h-16 w-16 items-center justify-center rounded-full ${
          tone === 'done' ? 'bg-[#17243A] text-[#FFBF47]' : 'bg-[#FFF1DF] text-[#E87535]'
        }`}
      >
        <Icon size={tone === 'done' ? 32 : 28} strokeWidth={tone === 'done' ? 3 : 2} />
      </span>
      <h1 className={`${SERIF} text-[26px] font-bold leading-tight`}>{title}</h1>
      <div className="text-[15px] leading-relaxed text-[#5E6878]">{children}</div>
    </div>
  );
}

export default function VisaPhonePhoto() {
  const { token } = useParams();
  const [info, setInfo] = useState(null); // { traveller, visa, expiresInSeconds }
  const [error, setError] = useState('');
  const [view, setView] = useState('intro'); // intro | scan | upload | done
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    api
      .get(`/visa-photo-handoff/${encodeURIComponent(token)}`)
      .then(setInfo)
      .catch((err) => setError(err.message || 'This link could not be opened.'));
  }, [token]);

  const submitPhoto = useCallback(
    async (capture) => {
      const form = new FormData();
      form.append('photo', capture.photo, capture.photo.name || 'photo.jpg');
      form.append('source', capture.source);
      form.append('clientReport', JSON.stringify(capture.clientReport || {}));
      const { applicant } = await api.postForm(`/visa-photo-handoff/${encodeURIComponent(token)}/photo`, form);
      return applicant;
    },
    [token]
  );

  const backToIntro = useCallback(() => setView('intro'), []);

  if (error) {
    return (
      <Shell>
        <Notice icon={LuCircleAlert} title="Link not available">
          {error}
        </Notice>
      </Shell>
    );
  }

  if (!info) {
    return (
      <Shell>
        <div className="mt-24 flex flex-col items-center gap-3 text-[#5E6878]" aria-busy="true">
          <LuLoader className="animate-spin" size={30} />
          <span className="text-sm font-semibold">Opening the face scan…</span>
        </div>
      </Shell>
    );
  }

  const { traveller } = info;

  if (view === 'done') {
    return (
      <Shell>
        <Notice icon={LuCheck} tone="done" title="Photo saved">
          <p>
            {traveller.name}&apos;s photo is now on the agent&apos;s computer
            {saved?.photoStatus === 'needs_review' ? ' — our team will give it a final check' : ''}.
          </p>
          <p className="mt-2">You can close this page.</p>
        </Notice>
      </Shell>
    );
  }

  if (view === 'scan' || view === 'upload') {
    return (
      <Shell>
        <PhotoCaptureModal
          applicantName={traveller.name}
          applicantNumber={traveller.number}
          initialMode={view}
          previewHeight={PHONE_PREVIEW_HEIGHT}
          onSubmit={submitPhoto}
          onClose={backToIntro}
          onDone={(applicant) => {
            setSaved(applicant);
            setView('done');
          }}
        />
      </Shell>
    );
  }

  const minutes = Math.max(1, Math.ceil(info.expiresInSeconds / 60));
  const tips = [
    [LuScanFace, 'Face inside the oval'],
    [LuEye, 'Look straight, eyes open'],
    [LuSun, 'Even light, plain background'],
  ];

  return (
    <Shell>
      <div className="mx-auto max-w-md">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#E87535]">Face scan</p>
        <h1 className={`${SERIF} mt-1 text-[30px] font-bold leading-tight`}>Take the visa photo</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#5E6878]">
          This uses the front camera. Hold the phone at eye level — the photo is taken by itself once the face is steady for 4 seconds.
        </p>

        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-[#F0DFC7] bg-white p-4 shadow-[0_12px_30px_-26px_rgba(23,36,58,0.45)]">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#FFF1DF] text-base font-bold">{traveller.number}</span>
          <span className="min-w-0">
            <span className="block truncate text-[16px] font-bold">{traveller.name}</span>
            <span className="block truncate text-[13px] text-[#737D8C]">
              {info.visa}
              {traveller.hasPhoto ? ' · replaces the current photo' : ''}
            </span>
          </span>
        </div>

        <ul className="mt-4 grid gap-2">
          {tips.map(([Icon, text]) => (
            <li key={text} className="flex items-center gap-3 rounded-xl bg-white/70 px-3 py-2.5 text-sm font-medium">
              <Icon size={18} className="flex-none text-[#E87535]" /> {text}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setView('scan')}
          className={`mt-6 inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-[#FFBF47] py-3.5 text-base font-bold text-[#17243A] shadow-[0_10px_22px_-12px_rgba(232,117,53,0.75)] transition hover:bg-[#F7AE2C] ${FOCUS}`}
        >
          <LuCamera size={20} /> Start face scan
        </button>
        <button
          type="button"
          onClick={() => setView('upload')}
          className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full py-2 text-sm font-semibold text-[#E87535] hover:underline ${FOCUS}`}
        >
          <LuImageUp size={16} /> Upload a photo instead
        </button>
        <p className="mt-4 text-center text-[12.5px] text-[#737D8C]">
          This link works once, only for this traveller, and expires in about {minutes} minute{minutes === 1 ? '' : 's'}.
        </p>
      </div>
    </Shell>
  );
}
