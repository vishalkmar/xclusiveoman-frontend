import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LuArrowDown,
  LuArrowLeft,
  LuArrowRight,
  LuArrowUp,
  LuCamera,
  LuCheck,
  LuCopy,
  LuCrosshair,
  LuEye,
  LuFocus,
  LuImageUp,
  LuLightbulb,
  LuListChecks,
  LuLoader,
  LuLoaderCircle,
  LuRefreshCw,
  LuRotateCcw,
  LuScanFace,
  LuShieldCheck,
  LuSmartphone,
  LuSun,
  LuUser,
  LuUsers,
  LuVideoOff,
  LuX,
  LuZoomIn,
  LuZoomOut,
} from 'react-icons/lu';
import QRCode from 'qrcode';
import {
  OVAL_GUIDE,
  captureCrop,
  centeredCrop,
  createClarityTracker,
  evaluateFrame,
  loadFaceLandmarker,
  measureImage,
} from '../../lib/faceScan.js';
import { FOCUS } from './visaFlowTokens.js';
import { InfoBanner } from './VisaFlowUi.jsx';

// Visa applicant photo — shown in place of the photo grid on the Traveller
// photos page (VisaPhotos.jsx), under its heading. Two ways in:
//   'scan'   guided live camera scan (FaceScanner): align → hold still with
//            every check green for 4 seconds → automatic capture.
//   'upload' pick an existing photo from the device.
//   'phone'  "Scan with phone" (PhoneHandoff): a QR code the traveller's
//            phone opens without logging in (pages/VisaPhonePhoto.jsx); the
//            same scan runs there and the saved photo shows up here.
// Either way the photo goes to the backend (onSubmit), which re-runs every
// check itself (visaPhotoCheck.service.js) and either saves it or returns
// the failed checks, shown here with a retake option.
//
// Two presentations (`variant`):
//   'dialog' — the Traveller photos page: a pop-up over the photo cards. The
//              camera is large, and what still needs fixing is shown INSIDE
//              the camera image (instruction on top, failing checks + count
//              at the bottom) — no side checklist. Upload / phone / review
//              open in the same pop-up.
//   'page'   — inline (the phone page, VisaPhonePhoto.jsx), as below.
//
// Page layout (fits one laptop screen, no scrolling): camera preview card with
// the traveller + Cancel / Capture row at its foot (left) · Photo quality +
// Photo tips (right). The preview shows the WHOLE camera image at its own
// aspect ratio (never cropped) and sizes itself to the screen height; the
// 7:9 area that's captured is marked on it with corner marks and the oval.
//
// ── Scan flow ──────────────────────────────────────────────────────────
// Stages (machine.stage) move forward only when the detector's real results
// allow it:
//   align     → waiting until every live check is green (full face, in the
//               oval, right distance, straight, eyes open, lighting, clarity)
//   hold      → all checks must STAY green and the face still (centre moves
//               < STILL_DELTA per frame) for HOLD_MS; any check going red
//               (beyond a short grace) or a jump restarts the countdown
//   capturing → photo taken, camera stopped
//   success   → brief confirmation, then the preview (onCaptured)
const HOLD_MS = 4000;
const STILL_DELTA = 0.02; // share of the frame width per detection
const LOST_GRACE_MS = 250; // a single flickering frame doesn't restart the 4s
const NATURAL_BLINK_MS = 600; // eyes shut longer than this restarts the 4s
const MAX_FRAME_GAP_MS = 500; // a longer gap between analysed frames restarts the 4s
const SUCCESS_MS = 700;
const DETECT_INTERVAL_MS = 80;

// [key, label] — live checks in the order the agent should fix them. A
// failing check shows the detector's own instruction under its label.
const LIVE_CHECKS = [
  ['face', 'Face detected'],
  ['centered', 'Centred in oval'],
  ['distance', 'Right distance'],
  ['straight', 'Looking straight'],
  ['eyes', 'Eyes open'],
  ['lighting', 'Good lighting'],
  ['clarity', 'Sharp & clear'],
];
// Oval while aligning; terracotta once every check is green (countdown / capture).
const AMBER = '#FFBF47';
const TERRACOTTA = '#E87535';

// The oval guide in the 7:9 capture area's SVG space (viewBox 100 × H), from
// the same OVAL_GUIDE that evaluateFrame() measures "inside the oval" against.
const H = 128.57;
const OVAL = { cx: 50, cy: OVAL_GUIDE.cy * H, rx: OVAL_GUIDE.rx * 100, ry: OVAL_GUIDE.ry * H };
const RING = { rx: OVAL.rx + 2.6, ry: OVAL.ry + 2.6 };
// Preview height: the screen height minus the app bar, step bar, heading,
// banner and the rest of the camera card (≈ 490px), kept between 150px and
// 600px — so the whole scan fits on one laptop screen without scrolling.
const PREVIEW_HEIGHT = 'clamp(150px, calc(100dvh - 490px), 600px)';
// In the pop-up: big enough to see the face clearly, never taller than
// 560px, and the pop-up (header + camera switch + bottom bar ≈ 270px)
// always fits the screen.
const DIALOG_PREVIEW_HEIGHT = 'clamp(240px, calc(100dvh - 270px), 560px)';
// Progress ring drawn as two arcs from 12 o'clock so it fills clockwise.
const RING_PATH = `M50 ${OVAL.cy - RING.ry} A${RING.rx} ${RING.ry} 0 1 1 50 ${OVAL.cy + RING.ry} A${RING.rx} ${RING.ry} 0 1 1 50 ${OVAL.cy - RING.ry}`;

function cameraErrorMessage(err) {
  if (err?.name === 'NotAllowedError') {
    return 'Camera access was blocked. Allow camera access for this site in your browser settings and try again, or upload a photo instead.';
  }
  if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
    return 'No camera was found on this device. Connect a camera and try again, or upload a photo instead.';
  }
  if (err?.name === 'NotReadableError') {
    return 'The camera is being used by another app. Close it and try again.';
  }
  return 'The camera could not be started. Try again, or upload a photo instead.';
}

/**
 * Turns the current frame + stage into one UI state:
 *   { key, headline, subline, Icon, guide }  — `guide` is the LIVE_CHECKS
 * key the instruction is about (highlighted in the checklist).
 * key ∈ starting | no-face | multiple-faces | partial-face | align-face |
 *       move-closer | move-back | look-straight | eyes-open | lighting |
 *       clarity | hold-still | capturing | success
 */
function deriveState(status, stage, frame, secondsLeft) {
  if (status !== 'ready' || !frame) {
    return { key: 'starting', headline: 'Starting camera…', subline: 'Allow camera access if your browser asks.', Icon: LuCamera };
  }
  if (stage === 'success') return { key: 'success', headline: 'Photo captured', subline: 'Opening the preview…', Icon: LuCheck };
  if (stage === 'capturing') return { key: 'capturing', headline: 'Capturing your photo…', subline: 'Don’t move for a moment.', Icon: LuCamera };
  if (stage === 'hold') {
    return {
      key: 'hold-still',
      headline: `Hold still — capturing in ${secondsLeft}s`,
      subline: 'All checks are green. Keep them green until the countdown ends.',
      Icon: LuScanFace,
    };
  }

  const { checks, faceCount } = frame;
  if (faceCount === 0) {
    return { key: 'no-face', headline: 'Position your face inside the oval', subline: 'Look straight at the camera.', Icon: LuScanFace, guide: 'face' };
  }
  if (faceCount > 1) {
    return { key: 'multiple-faces', headline: 'Only one person should be in the frame', subline: 'Ask others to step out of view.', Icon: LuUsers, guide: 'face' };
  }
  if (!checks.face.ok) {
    return { key: 'partial-face', headline: 'Move your full face into the frame', subline: 'Your whole face must be visible.', Icon: LuScanFace, guide: 'face' };
  }
  // Too close usually also spills out of the oval — say "back" first.
  if (!checks.distance.ok && checks.distance.hint && /back/.test(checks.distance.hint)) {
    return { key: 'move-back', headline: checks.distance.hint, subline: 'Your face should just fill the oval.', Icon: LuZoomOut, guide: 'distance' };
  }
  if (!checks.centered.ok) {
    const h = checks.centered.hint || 'Center your face inside the oval';
    const Icon = /left/.test(h) ? LuArrowLeft : /right/.test(h) ? LuArrowRight : /up/.test(h) ? LuArrowUp : /down/.test(h) ? LuArrowDown : LuCrosshair;
    return { key: 'align-face', headline: h, subline: 'Line your face up with the oval.', Icon, guide: 'centered' };
  }
  if (!checks.distance.ok) {
    return { key: 'move-closer', headline: checks.distance.hint || 'Move closer to the camera', subline: 'Your face should fill most of the oval.', Icon: LuZoomIn, guide: 'distance' };
  }
  if (!checks.straight.ok) {
    return { key: 'look-straight', headline: checks.straight.hint || 'Look straight at the camera', subline: 'Face the camera directly, chin level.', Icon: LuEye, guide: 'straight' };
  }
  if (!checks.eyes.ok) {
    return { key: 'eyes-open', headline: 'Keep both eyes open', subline: 'Look straight at the camera without blinking.', Icon: LuEye, guide: 'eyes' };
  }
  if (!checks.lighting.ok) {
    return { key: 'lighting', headline: checks.lighting.hint, subline: 'Light your face evenly from the front.', Icon: LuSun, guide: 'lighting' };
  }
  if (!checks.clarity.ok) {
    return {
      key: 'clarity',
      headline: 'Your face is aligned. Getting a sharp picture…',
      subline: checks.clarity.hint,
      Icon: LuFocus,
      guide: 'clarity',
    };
  }
  return { key: 'hold-still', headline: 'Hold still', subline: 'All checks are green.', Icon: LuScanFace };
}
// Returns `value` once `key` has stayed the same for `delay` ms (0 = at once).
function useSettled(value, key, delay) {
  const [settled, setSettled] = useState(value);
  const latest = useRef(value);
  latest.current = value;
  useEffect(() => {
    const t = setTimeout(() => setSettled(latest.current), delay);
    return () => clearTimeout(t);
  }, [key, delay]);
  return settled;
}

// ── Shared pieces ─────────────────────────────────────────────────────────

function Card({ className = '', children }) {
  return <section className={`rounded-2xl border border-[#F0DFC7] bg-white shadow-[0_12px_30px_-26px_rgba(23,36,58,0.45)] ${className}`}>{children}</section>;
}

function CardHeader({ Icon, title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon size={22} className="flex-none text-[#17243A]" />
        <div className="min-w-0">
          <h3 className="text-base font-bold leading-tight text-[#17243A]">{title}</h3>
          {subtitle && <p className="text-[13px] text-[#737D8C]">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function BarButton({ tone = 'secondary', className = '', children, ...props }) {
  const tones = {
    primary:
      'bg-[#FFBF47] text-[#17243A] shadow-[0_10px_22px_-12px_rgba(232,117,53,0.75)] hover:bg-[#F7AE2C] disabled:bg-[#FFE3B0] disabled:text-[#8C8F96] disabled:shadow-none',
    secondary: 'border border-[#F0DFC7] bg-white text-[#17243A] hover:border-[#FFBF47] hover:bg-[#FFF9EF] disabled:opacity-50',
  };
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-[15px] font-bold transition disabled:cursor-not-allowed ${FOCUS} ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

// Text-style action ("Upload instead", "Scan with phone").
function LinkButton({ children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded px-2 text-sm font-semibold text-[#E87535] hover:underline ${FOCUS}`}
    >
      {children}
    </button>
  );
}

// Foot of the left card: who the photo is for + the actions for the current stage.
export function TravellerActionBar({ number, name, thumbUrl, status, children }) {
  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-[#F4ECDF] pt-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#FFF1DF] text-base font-bold text-[#17243A] shadow-[0_0_0_3px_rgba(255,191,71,0.18)]">
          {number}
        </span>
        <span className="flex h-12 w-10 flex-none items-center justify-center overflow-hidden rounded-lg bg-[#FBF4E9] text-[#C9B79C] ring-1 ring-[#F0DFC7]">
          {thumbUrl ? <img src={thumbUrl} alt="" className="h-full w-full object-cover" /> : <LuUser size={18} />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-bold text-[#17243A]">{name}</span>
          <span className="block truncate text-[13px] text-[#737D8C]">{status}</span>
        </span>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row">{children}</div>
    </div>
  );
}

function PhotoTips() {
  const tips = [
    [LuScanFace, 'Centre your face'],
    [LuEye, 'Look straight'],
    [LuSun, 'Even lighting'],
  ];
  return (
    <Card className="px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#FFF1DF] text-[#E87535]" title="Photo tips">
          <LuLightbulb size={17} />
        </span>
        <h3 className="sr-only">Photo tips</h3>
        <ul className="grid flex-1 grid-cols-3 divide-x divide-[#F0DFC7]">
          {tips.map(([Icon, text]) => (
            <li key={text} className="flex items-center justify-center gap-1.5 px-1.5 text-center">
              <Icon size={16} className="flex-none text-[#17243A]" />
              <span className="text-[13px] font-medium leading-tight text-[#5E6878] sm:whitespace-nowrap">{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

// state: passed | warning (failing, with an instruction) | pending
function QualityRow({ label, state, hint, value, busy }) {
  return (
    <li className="flex min-w-0 items-center gap-3 border-b border-[#F4ECDF] py-[7px] last:border-b-0 [@media(max-height:820px)]:[&:nth-last-child(2)]:border-b-0">
      <span className="flex h-7 w-7 flex-none items-center justify-center">
        {state === 'passed' ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFF1DF] text-[#17243A]">
            <LuCheck size={14} strokeWidth={3} />
          </span>
        ) : busy ? (
          <LuLoaderCircle size={22} className="animate-spin text-[#E87535]" />
        ) : state === 'warning' ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFBF47] text-sm font-black text-white">!</span>
        ) : (
          <span className="h-5 w-5 rounded-full border-2 border-[#C9CED6]" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-semibold leading-tight ${state === 'pending' ? 'text-[#5E6878]' : 'text-[#17243A]'}`}>{label}</span>
        {state === 'warning' && hint && <span className="mt-0.5 block truncate text-[12.5px] leading-tight text-[#D97706]" title={hint}>{hint}</span>}
      </span>
      {value != null && <span className="flex-none text-[13px] font-semibold tabular-nums text-[#17243A]">{value}</span>}
    </li>
  );
}

function PhotoQualityChecklist({ rows }) {
  const passed = rows.filter((r) => r.state === 'passed').length;
  return (
    <Card className="px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <LuListChecks size={22} className="text-[#17243A]" />
          <h3 className="text-base font-bold text-[#17243A]">Photo quality</h3>
        </div>
        <div className="w-40 text-right">
          <div className="text-sm font-semibold text-[#17243A]" aria-live="polite">
            {passed} of {rows.length} checks passed
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#F1ECE4]">
            <div className="h-full rounded-full bg-[#FFBF47] transition-all duration-300" style={{ width: `${(passed / rows.length) * 100}%` }} />
          </div>
        </div>
      </div>
      <ul className="mt-1.5 [@media(max-height:820px)]:grid [@media(max-height:820px)]:grid-cols-2 [@media(max-height:820px)]:gap-x-5">
        {rows.map((r) => (
          <QualityRow key={r.key} {...r} />
        ))}
      </ul>
    </Card>
  );
}

// Oval guide (with the hold progress ring) inside the 7:9 capture area.
function OvalGuide({ color, dashed, progress }) {
  const circumference = 2 * Math.PI * 40;
  return (
    <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
      <ellipse cx={OVAL.cx} cy={OVAL.cy} rx={OVAL.rx} ry={OVAL.ry} fill="none" stroke={color} strokeWidth="2.2" opacity="0.28" style={{ filter: 'blur(1.4px)' }} />
      <ellipse
        cx={OVAL.cx}
        cy={OVAL.cy}
        rx={OVAL.rx}
        ry={OVAL.ry}
        fill="none"
        stroke={color}
        strokeWidth="0.9"
        strokeDasharray={dashed ? '3 2' : undefined}
        style={{ transition: 'stroke 250ms' }}
      />
      {progress > 0 && (
        <path
          d={RING_PATH}
          fill="none"
          stroke={TERRACOTTA}
          strokeWidth="1.3"
          strokeLinecap="round"
          pathLength={circumference}
          strokeDasharray={`${circumference * progress} ${circumference}`}
          style={{ transition: 'stroke-dasharray 120ms linear' }}
        />
      )}
    </svg>
  );
}

// Corner marks + faint centre guides on the capture area.
function CaptureFrameMarks({ color }) {
  const base = 'absolute h-8 w-8 border-[3px] transition-colors duration-300';
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <span className="absolute inset-y-0 left-1/2 w-px bg-white/25" />
      <span className="absolute inset-x-0 top-[48%] h-px bg-white/25" />
      <div className="absolute inset-3 sm:inset-4">
        <span className={`${base} left-0 top-0 rounded-tl-lg border-b-0 border-r-0`} style={{ borderColor: color }} />
        <span className={`${base} right-0 top-0 rounded-tr-lg border-b-0 border-l-0`} style={{ borderColor: color }} />
        <span className={`${base} bottom-0 left-0 rounded-bl-lg border-r-0 border-t-0`} style={{ borderColor: color }} />
        <span className={`${base} bottom-0 right-0 rounded-br-lg border-l-0 border-t-0`} style={{ borderColor: color }} />
      </div>
    </div>
  );
}

// ── Camera scan ───────────────────────────────────────────────────────────

function FaceScanner({ facing, onSwitchFacing, onCaptured, onUseUpload, onUsePhone, onRetry, onCancel, traveller, previewHeight = PREVIEW_HEIGHT, layout = 'page' }) {
  const videoRef = useRef(null);
  const measureCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const machine = useRef(null);

  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [videoSize, setVideoSize] = useState(null); // { w, h } once the stream plays
  const [cameraCount, setCameraCount] = useState(0);
  // Everything the UI shows from one detection, set together (one render per frame).
  const [view, setView] = useState({ frame: null, stage: 'align', progress: 0 });

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    streamRef.current?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    machine.current = {
      stage: 'align',
      holdSince: 0,
      lostSince: 0,
      lastCenter: null,
      readyStreak: 0,
      lastDetect: 0,
      // Sharpest recent frame from this camera (the clarity check is relative to it).
      trackClarity: createClarityTracker(),
      done: false,
    };

    const fail = (message) => {
      if (cancelled) return;
      stopCamera();
      setStatus('error');
      setError(message);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw Object.assign(new Error('unsupported'), { name: 'NotFoundError' });
        }
        // Camera + detector load in parallel; the detector is created once
        // per page (loadFaceLandmarker caches it) and reused on retakes.
        const [stream, landmarker] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: facing === 'environment' ? { ideal: 'environment' } : 'user', width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false,
          }),
          loadFaceLandmarker(),
        ]);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        // Front/back switching is offered only when the device has 2+ cameras
        // (labels/devices are readable once permission is granted).
        navigator.mediaDevices
          .enumerateDevices?.()
          .then((devices) => !cancelled && setCameraCount(devices.filter((d) => d.kind === 'videoinput').length))
          .catch(() => {});
        // Camera unplugged / taken by another app / permission revoked mid-scan.
        stream.getVideoTracks().forEach((t) => {
          t.onended = () => fail('The camera stopped working. Check it is connected and try again.');
        });
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;
        setVideoSize({ w: video.videoWidth, h: video.videoHeight });
        setStatus('ready');

        const tick = async (now) => {
          const m = machine.current;
          if (cancelled || m.done) return;
          rafRef.current = requestAnimationFrame(tick);
          if (!video.videoWidth || now - m.lastDetect < DETECT_INTERVAL_MS) return;
          m.lastDetect = now;

          const crop = centeredCrop(video.videoWidth, video.videoHeight);
          const result = landmarker.detectForVideo(video, now);
          const measure = measureImage(video, crop, measureCanvasRef.current);
          const sharpness = m.trackClarity(measure.clarity, now);
          const e = evaluateFrame(result, video, crop, { ...measure, clarity: sharpness.clarity, clarityPeak: sharpness.peak });
          // Countdown timing uses the time AFTER detection: the first
          // detections can block for seconds while the model warms up, and
          // that unobserved time must never count towards the 4 seconds.
          const at = performance.now();
          const stalled = m.lastEvalAt && at - m.lastEvalAt > MAX_FRAME_GAP_MS;
          m.lastEvalAt = at;

          const center = e.face ? { x: e.face.box.x + e.face.box.width / 2, y: e.face.box.y + e.face.box.height / 2 } : null;
          const moved = center && m.lastCenter ? Math.hypot(center.x - m.lastCenter.x, center.y - m.lastCenter.y) : 0;
          m.lastCenter = center;
          let progress = 0;

          if (m.stage === 'align') {
            // Every live check green → start the 4-second countdown.
            if (e.positionOk) Object.assign(m, { stage: 'hold', holdSince: at, lostSince: 0 });
          } else if (m.stage === 'hold') {
            // A natural blink (only "eyes open" red, briefly) doesn't restart
            // the countdown — but a photo is never taken with eyes closed.
            const failing = Object.keys(e.checks).filter((k) => !e.checks[k].ok);
            const blinking = failing.length === 1 && failing[0] === 'eyes';
            m.blinkSince = blinking ? m.blinkSince || at : 0;
            if (!e.positionOk && !(blinking && at - m.blinkSince <= NATURAL_BLINK_MS)) {
              // A check went red: after a one-frame grace, back to align
              // (the countdown starts again from 4s once all are green).
              m.lostSince ||= at;
              if (at - m.lostSince > LOST_GRACE_MS || blinking) Object.assign(m, { stage: 'align', holdSince: 0, lostSince: 0, blinkSince: 0 });
            } else {
              m.lostSince = 0;
              // Restart the countdown if the face jumps, or if frames stalled
              // (stillness wasn't observed during the gap).
              if (moved > STILL_DELTA || stalled) m.holdSince = at;
              progress = Math.min(1, (at - m.holdSince) / HOLD_MS);
              if (progress >= 1 && e.positionOk) {
                // Green for the full 4 seconds → capture this frame.
                m.done = true;
                m.stage = 'capturing';
                setView((v) => ({ ...v, frame: e, stage: 'capturing', progress: 1 }));
                let photo;
                try {
                  photo = await captureCrop(video, crop);
                } catch {
                  fail('The photo could not be captured. Try again, or upload a photo instead.');
                  return;
                }
                stopCamera();
                if (cancelled) return;
                m.stage = 'success';
                setView((v) => ({ ...v, stage: 'success' }));
                const report = {
                  clarity: e.checks.clarity.value,
                  brightness: e.checks.lighting.value,
                  faceHeightPct: e.checks.distance.value,
                  heldGreenMs: HOLD_MS,
                  width: crop.width,
                  height: crop.height,
                  userAgent: navigator.userAgent,
                };
                setTimeout(() => {
                  if (!cancelled) onCaptured({ photo, clientReport: report });
                }, SUCCESS_MS);
                return;
              }
            }
          }

          setView({ frame: e, stage: m.stage, progress });
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        fail(err?.name ? cameraErrorMessage(err) : 'The face scanner could not be loaded. Check your connection and try again, or upload a photo instead.');
      }
    })();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [onCaptured, stopCamera, facing]);

  const { frame, stage, progress } = view;
  const checks = frame?.checks;
  const secondsLeft = Math.max(1, Math.ceil(((1 - progress) * HOLD_MS) / 1000));
  const state = deriveState(status, stage, frame, secondsLeft);
  // Guidance can flip between two hints at a threshold every frame; only
  // switch between hints once one has held for a moment. Anything else
  // (stage changes, starting, success) shows at once.
  const isHint = !!state.guide;
  const shownWasHint = useRef(false);
  const settled = useSettled(state, `${state.key}|${state.headline}`, isHint && shownWasHint.current ? 280 : 0);
  // Countdown / capture / success show straight away (in step with the ring).
  const shown = isHint ? settled : state;
  shownWasHint.current = !!shown.guide;

  const locked = stage !== 'align';
  const color = locked ? TERRACOTTA : AMBER;

  // Checklist rows from the real results. Position checks can't be judged
  // without a complete face, so they stay pending until there is one.
  const rows = LIVE_CHECKS.map(([key, label]) => {
    const c = checks?.[key];
    let rowState = 'pending';
    if (c?.ok) rowState = 'passed';
    else if (c?.hint || c?.severe) rowState = 'warning';
    return { key, label, state: rowState, hint: c?.hint, value: null };
  });
  // The 4-second hold: passes only once it has run out with every check
  // still green (capture starts).
  rows.push({
    key: 'hold',
    label: 'Hold still for 4 seconds',
    state: stage === 'capturing' || stage === 'success' ? 'passed' : 'pending',
    busy: stage === 'hold',
    value: stage === 'hold' ? `${secondsLeft}s` : null,
  });

  // Capture area (the 7:9 crop) as a share of the full camera frame.
  const crop = videoSize ? centeredCrop(videoSize.w, videoSize.h) : null;
  const cropBox = crop
    ? {
        left: `${(crop.x / videoSize.w) * 100}%`,
        top: `${(crop.y / videoSize.h) * 100}%`,
        width: `${(crop.width / videoSize.w) * 100}%`,
        height: `${(crop.height / videoSize.h) * 100}%`,
      }
    : null;
  const ratio = videoSize ? videoSize.w / videoSize.h : 4 / 3;
  const ratioCss = videoSize ? `${videoSize.w} / ${videoSize.h}` : '4 / 3';
  const mirrored = facing !== 'environment';
  const canSwitch = cameraCount > 1;

  const captureLabel =
    stage === 'hold'
      ? `Capturing in ${secondsLeft}s`
      : stage === 'capturing'
        ? 'Capturing…'
        : stage === 'success'
          ? 'Captured'
          : 'Capture photo';

  // ── Pop-up layout: big camera, guidance drawn inside it ─────────────
  if (layout === 'dialog') {
    const failing = rows.filter((r) => r.key !== 'hold' && r.state === 'warning');
    const passedCount = rows.filter((r) => r.key !== 'hold' && r.state === 'passed').length;
    const overlays = status === 'ready' && stage !== 'success';
    return (
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-xl bg-[#F5EFE6] p-1" role="group" aria-label="Camera">
            {[
              ['user', 'Front camera', LuCamera],
              ['environment', 'Back camera', LuRefreshCw],
            ].map(([key, label, Icon]) => {
              const on = facing === key;
              const disabled = !on && !canSwitch;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  disabled={disabled}
                  title={disabled ? 'Only one camera was found on this device' : undefined}
                  onClick={() => !on && onSwitchFacing(key)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS} ${
                    on ? 'bg-white text-[#17243A] shadow-sm' : 'text-[#5E6878] hover:text-[#17243A]'
                  }`}
                >
                  <Icon size={15} /> {label}
                </button>
              );
            })}
          </div>
          <span
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#17243A]"
            title="Face detection runs on this device. Only the captured photo is uploaded."
          >
            <span className={`h-2 w-2 rounded-full ${status === 'ready' ? 'bg-[#168765]' : status === 'error' ? 'bg-[#D74747]' : 'animate-pulse bg-[#C9CED6]'}`} />
            {status === 'ready' ? 'Camera connected' : status === 'error' ? 'Camera unavailable' : 'Connecting camera…'}
          </span>
        </div>

        {status === 'error' ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#F0DFC7] bg-[#FFFCF7] px-6 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF1DF] text-[#E87535]">
              <LuVideoOff size={26} />
            </span>
            <p className="text-base font-bold text-[#17243A]">Camera unavailable</p>
            <p className="max-w-md text-sm text-[#737D8C]">{error}</p>
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              <BarButton onClick={onRetry} className="!h-11">
                <LuRotateCcw size={16} /> Try again
              </BarButton>
              <BarButton tone="primary" onClick={onUseUpload} className="!h-11">
                <LuImageUp size={16} /> Upload a photo instead
              </BarButton>
            </div>
          </div>
        ) : (
          <div
            className="relative mx-auto overflow-hidden rounded-2xl bg-[#1B2433]"
            style={{ aspectRatio: ratioCss, width: `min(100%, calc(${DIALOG_PREVIEW_HEIGHT} * ${ratio}))` }}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              className={`absolute inset-0 h-full w-full object-contain ${mirrored ? '-scale-x-100' : ''}`}
            />
            {cropBox && status === 'ready' && (
              <div className="absolute" style={cropBox}>
                <OvalGuide color={color} dashed={frame?.faceCount === 0} progress={stage === 'hold' ? progress : locked ? 1 : 0} />
                <CaptureFrameMarks color={color} />
              </div>
            )}
            {status === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/85">
                <LuLoader className="animate-spin" size={30} />
                <span className="text-sm font-semibold">Starting camera & face scanner…</span>
              </div>
            )}

            {/* What to do right now — on top of the camera. */}
            {overlays && (
              <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-3" aria-live="polite">
                <motion.div
                  key={shown.headline}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex max-w-[94%] items-center gap-2.5 rounded-2xl bg-[#17243A]/80 py-2 pl-2 pr-4 text-white shadow-lg backdrop-blur-md"
                >
                  <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-full ${locked ? 'bg-[#E87535] text-white' : 'bg-[#FFBF47] text-[#17243A]'}`}>
                    <shown.Icon size={17} strokeWidth={2.2} />
                  </span>
                  <span className="min-w-0">
                    <span data-instruction className="block text-[15px] font-bold leading-snug">
                      {shown.headline}
                    </span>
                    <span className="block text-xs leading-snug text-white/75">{shown.subline}</span>
                  </span>
                </motion.div>
              </div>
            )}

            {/* What still needs fixing — at the bottom of the camera. */}
            {overlays && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#17243A]/85 via-[#17243A]/45 to-transparent px-3 pb-3 pt-10">
                {stage === 'align' ? (
                  <div className="flex flex-wrap items-center justify-center gap-1.5" data-checks>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-[#17243A]">
                      <LuListChecks size={13} /> {passedCount}/{LIVE_CHECKS.length} checks passed
                    </span>
                    {failing.slice(0, 3).map((r) => (
                      <span key={r.key} data-failing className="inline-flex items-center gap-1 rounded-full bg-[#FFBF47] px-2.5 py-1 text-xs font-bold text-[#17243A]">
                        <span aria-hidden>!</span> {r.label}
                      </span>
                    ))}
                    {failing.length > 3 && (
                      <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold text-white">+{failing.length - 3} more</span>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#E87535] px-3.5 py-1.5 text-[13px] font-bold text-white shadow">
                      {stage === 'capturing' ? <LuLoaderCircle size={15} className="animate-spin" /> : <LuCheck size={15} strokeWidth={3} />}
                      {stage === 'capturing' ? 'Capturing…' : `All checks passed · capturing in ${secondsLeft}s`}
                    </span>
                  </div>
                )}
              </div>
            )}

            <AnimatePresence>
              {stage === 'success' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/60 backdrop-blur-[2px]"
                >
                  <motion.span
                    initial={{ scale: 0.6 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                    className="flex h-20 w-20 items-center justify-center rounded-full bg-[#17243A] text-[#FFBF47] shadow-[0_12px_30px_-10px_rgba(23,36,58,0.6)]"
                  >
                    <LuCheck size={40} strokeWidth={3} />
                  </motion.span>
                  <span className="text-lg font-bold text-[#17243A]">Photo captured</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#F4ECDF] pt-4">
          <div className="flex flex-wrap items-center gap-1">
            {onUsePhone && (
              <LinkButton onClick={onUsePhone}>
                <LuSmartphone size={16} /> Scan with phone
              </LinkButton>
            )}
            <LinkButton onClick={onUseUpload}>
              <LuImageUp size={16} /> Upload instead
            </LinkButton>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[13px] text-[#737D8C] md:inline">Taken automatically once every check stays green for 4 s</span>
            <BarButton onClick={onCancel}>Cancel</BarButton>
          </div>
        </div>
        <canvas ref={measureCanvasRef} className="hidden" />
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(330px,1fr)]">
        {/* ── Camera preview ─────────────────────────────────────── */}
        <Card className="p-4">
          <CardHeader Icon={LuCamera} title="Camera preview">
            <div className="flex gap-2" role="group" aria-label="Camera">
              {[
                ['user', 'Front camera', LuCamera],
                ['environment', 'Back camera', LuRefreshCw],
              ].map(([key, label, Icon]) => {
                const on = facing === key;
                const disabled = !on && !canSwitch;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    disabled={disabled}
                    title={disabled ? 'Only one camera was found on this device' : undefined}
                    onClick={() => !on && onSwitchFacing(key)}
                    className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS} ${
                      on ? 'border-[#FFBF47] bg-[#FFF1DF] text-[#17243A]' : 'border-[#F0DFC7] bg-white text-[#17243A] hover:border-[#FFBF47]'
                    }`}
                  >
                    <Icon size={16} /> {label}
                  </button>
                );
              })}
            </div>
          </CardHeader>

          {status === 'error' ? (
            <div className="mt-3 flex flex-col items-center gap-3 rounded-xl border border-[#F0DFC7] bg-[#FFFCF7] px-6 py-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF1DF] text-[#E87535]">
                <LuVideoOff size={26} />
              </span>
              <p className="text-base font-bold text-[#17243A]">Camera unavailable</p>
              <p className="max-w-md text-sm text-[#737D8C]">{error}</p>
              <div className="mt-1 flex flex-wrap justify-center gap-2">
                <BarButton onClick={onRetry} className="!h-11">
                  <LuRotateCcw size={16} /> Try again
                </BarButton>
                <BarButton tone="primary" onClick={onUseUpload} className="!h-11">
                  <LuImageUp size={16} /> Upload a photo instead
                </BarButton>
              </div>
            </div>
          ) : (
            <>
              {/* Whole camera frame at its own aspect ratio (no cropping); the
                  7:9 capture area sits centred on it with the oval guide. Its
                  height follows the screen (the width shrinks with it, so the
                  ratio — and the oval's position — never changes) to keep the
                  whole scan on one screen. */}
              <div
                className="relative mx-auto mt-3 overflow-hidden rounded-xl bg-[#E9E4DC]"
                style={{ aspectRatio: ratioCss, width: `min(100%, calc(${previewHeight} * ${ratio}))` }}
              >
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={`absolute inset-0 h-full w-full object-contain ${mirrored ? '-scale-x-100' : ''}`}
                />
                {cropBox && status === 'ready' && (
                  <div className="absolute" style={cropBox}>
                    <OvalGuide color={color} dashed={frame?.faceCount === 0} progress={stage === 'hold' ? progress : locked ? 1 : 0} />
                    <CaptureFrameMarks color={color} />
                  </div>
                )}
                <span
                  className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-[13px] font-semibold text-[#17243A] shadow-sm"
                  title="Face detection runs on this device. Only the captured photo is uploaded."
                >
                  <span className={`h-2 w-2 rounded-full ${status === 'ready' ? 'bg-[#17243A]' : 'animate-pulse bg-[#C9CED6]'}`} />
                  {status === 'ready' ? 'Camera connected' : 'Connecting camera…'}
                </span>
                {status === 'loading' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[#5E6878]">
                    <LuLoader className="animate-spin" size={30} />
                    <span className="text-sm font-semibold">Starting camera & face scanner…</span>
                  </div>
                )}
                <AnimatePresence>
                  {stage === 'success' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/60 backdrop-blur-[2px]"
                    >
                      <motion.span
                        initial={{ scale: 0.6 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                        className="flex h-20 w-20 items-center justify-center rounded-full bg-[#17243A] text-[#FFBF47] shadow-[0_12px_30px_-10px_rgba(23,36,58,0.6)]"
                      >
                        <LuCheck size={40} strokeWidth={3} />
                      </motion.span>
                      <span className="text-lg font-bold text-[#17243A]">Photo captured</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* What to do right now — from the real checks. */}
              <div className="mx-auto mt-2.5 flex max-w-xl items-center justify-center gap-3 rounded-xl bg-[#FFF9EF] px-4 py-2" aria-live="polite">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#FFF1DF] text-[#17243A]">
                  <shown.Icon size={18} strokeWidth={2.2} />
                </span>
                <motion.span key={shown.headline} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="min-w-0">
                  <span data-instruction className="block text-[15px] font-bold leading-snug text-[#17243A]">
                    {shown.headline}
                  </span>
                  <span className="block text-[13px] leading-snug text-[#737D8C]">{shown.subline}</span>
                </motion.span>
              </div>
            </>
          )}

          <TravellerActionBar
            number={traveller.number}
            name={traveller.name}
            thumbUrl={traveller.photoUrl}
            status={stage === 'success' ? 'Photo captured' : traveller.photoUrl ? 'New photo replaces the current one' : 'Photo not captured yet'}
          >
            {onUsePhone && (
              <LinkButton onClick={onUsePhone}>
                <LuSmartphone size={16} /> Scan with phone
              </LinkButton>
            )}
            <LinkButton onClick={onUseUpload}>
              <LuImageUp size={16} /> Upload instead
            </LinkButton>
            <BarButton onClick={onCancel}>Cancel scan</BarButton>
            {/* Capture is automatic once every check has stayed green for 4 s —
                the button shows that progress and is never a manual shutter. */}
            <BarButton tone="primary" disabled aria-live="polite" title="The photo is taken automatically when every check stays green for 4 seconds">
              {stage === 'capturing' ? <LuLoaderCircle size={18} className="animate-spin" /> : <LuCamera size={18} />} {captureLabel}
            </BarButton>
          </TravellerActionBar>
        </Card>

        {/* ── Photo quality + tips ─────────────────────────────────── */}
        <div className="space-y-4">
          <PhotoQualityChecklist rows={rows} />
          <PhotoTips />
        </div>
      </div>
      <canvas ref={measureCanvasRef} className="hidden" />
    </div>
  );
}

// ── Scan with phone ──────────────────────────────────────────────────────

const PHONE_POLL_MS = 2500;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
// QR size follows the screen height, like the camera preview.
const QR_SIZE = 'clamp(150px, calc(100dvh - 520px), 232px)';

const PHONE_STATUS_TEXT = {
  creating: 'Making a QR code…',
  pending: 'Waiting for the phone…',
  opened: 'Phone connected — scanning',
  completed: 'Photo received',
  expired: 'QR code expired',
  cancelled: 'QR code replaced',
  error: 'QR code unavailable',
};

function formatClock(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// QR code + live status for "Scan with phone". Makes a single-use link for
// this traveller (handoffApi.create), polls it until the phone has saved a
// photo, and closes the link again if the agent leaves this view first.
function PhoneHandoff({ handoffApi, traveller, onUseCamera, onUseUpload, onCancel, onDone }) {
  const [state, setState] = useState({ status: 'creating' });
  const [qr, setQr] = useState('');
  const [link, setLink] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const [attempt, setAttempt] = useState(0); // bumped by "New QR code"
  const handoffId = useRef(null);
  const completed = useRef(false);
  const doneTimer = useRef(0);
  // Latest callbacks, so the polling interval isn't restarted on every render.
  const callbacks = useRef({ onDone, onCancel });
  useEffect(() => {
    callbacks.current = { onDone, onCancel };
  });

  // Make the link (again on "New QR code" — the server retires the old one).
  useEffect(() => {
    let cancelled = false;
    let createdId = null;
    setState({ status: 'creating' });
    setCopied(false);
    handoffApi
      .create()
      .then(async (h) => {
        createdId = h.id;
        if (cancelled) {
          handoffApi.cancel(h.id).catch(() => {});
          return;
        }
        // The backend decides the address (AGENT_PORTAL_URL), like password
        // reset links. An older backend sends only the token — then the link
        // is built on this site's own address.
        const url = h.url || `${window.location.origin}/visa-photo/${h.token}`;
        const svg = await QRCode.toString(url, {
          type: 'svg',
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#17243A', light: '#FFFFFF' },
        });
        if (cancelled) return;
        handoffId.current = h.id;
        setLink(url);
        setQr(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
        setSecondsLeft(h.expiresInSeconds);
        setState({ status: 'pending' });
      })
      .catch((err) => !cancelled && setState({ status: 'error', message: err.message || 'The QR code could not be made.' }));
    return () => {
      cancelled = true;
      // Leaving this view closes the link, unless the photo already arrived.
      if (createdId && !completed.current) handoffApi.cancel(createdId).catch(() => {});
    };
  }, [handoffApi, attempt]);

  useEffect(() => () => clearTimeout(doneTimer.current), []);

  const live = (state.status === 'pending' || state.status === 'opened') && secondsLeft > 0;
  const status = (state.status === 'pending' || state.status === 'opened') && secondsLeft <= 0 ? 'expired' : state.status;

  // Countdown to expiry (re-synced from the server on every poll).
  useEffect(() => {
    if (!live) return undefined;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [live]);

  // Watch the link: phone opened it → photo saved (→ back to the grid).
  useEffect(() => {
    if (!live) return undefined;
    const id = handoffId.current;
    let stopped = false;
    const t = setInterval(async () => {
      try {
        const h = await handoffApi.poll(id);
        if (stopped) return;
        if (h.status === 'completed') {
          completed.current = true;
          setState({ status: 'completed' });
          clearInterval(t);
          doneTimer.current = setTimeout(() => {
            if (h.applicant) callbacks.current.onDone(h.applicant);
            else callbacks.current.onCancel();
          }, 1200);
        } else if (h.status === 'pending' || h.status === 'opened') {
          setState((s) => (s.status === h.status ? s : { status: h.status }));
          setSecondsLeft(h.expiresInSeconds);
        } else {
          setState({ status: h.status });
        }
      } catch {
        // A network blip — the next poll tries again.
      }
    }, PHONE_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [live, handoffApi]);

  function copyLink() {
    navigator.clipboard
      ?.writeText(link)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  // A link on localhost can't be opened from a phone.
  const isLocal = !!link && LOCAL_HOSTS.has(new URL(link).hostname);
  const dimQr = status !== 'pending';
  const steps = [
    "Open the phone's camera and point it at this QR code",
    'Tap the link — the face scan opens with the front camera, no login needed',
    'Hold still for 4 seconds — the photo appears here automatically',
  ];
  const progressRows = [
    { key: 'qr', label: 'QR code ready', state: status === 'creating' || status === 'error' ? 'pending' : 'passed', busy: status === 'creating' },
    {
      key: 'phone',
      label: 'Phone connected',
      state: status === 'opened' || status === 'completed' ? 'passed' : 'pending',
      busy: status === 'pending',
    },
    {
      key: 'photo',
      label: 'Photo received',
      state: status === 'completed' ? 'passed' : 'pending',
      busy: status === 'opened',
    },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(330px,1fr)]">
      <Card className="p-4">
        <CardHeader Icon={LuSmartphone} title="Scan with phone" subtitle="Take the photo on the traveller's phone — no login needed">
          <span
            aria-live="polite"
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-semibold ${
              status === 'expired' || status === 'cancelled' || status === 'error' ? 'bg-[#FFF1DF] text-[#B4561F]' : 'bg-[#FFF9EF] text-[#17243A] ring-1 ring-[#F0DFC7]'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                status === 'completed' || status === 'opened' ? 'bg-[#17243A]' : status === 'pending' || status === 'creating' ? 'animate-pulse bg-[#FFBF47]' : 'bg-[#E87535]'
              }`}
            />
            {PHONE_STATUS_TEXT[status]}
          </span>
        </CardHeader>

        <div className="mt-3 flex flex-col items-center gap-5 rounded-xl bg-[#FFF9EF] p-4 sm:flex-row sm:p-5">
          <div className="flex-none rounded-2xl border border-[#F0DFC7] bg-white p-3 shadow-[0_10px_24px_-20px_rgba(23,36,58,0.5)]">
            <div className="relative" style={{ width: QR_SIZE, height: QR_SIZE }}>
              {qr && (
                <img
                  src={qr}
                  alt="QR code that opens the face scan on a phone"
                  className={`h-full w-full transition ${dimQr ? 'opacity-10 blur-[2px]' : ''}`}
                />
              )}
              {status === 'creating' && (
                <div className="absolute inset-0 flex items-center justify-center text-[#5E6878]">
                  <LuLoader className="animate-spin" size={28} />
                </div>
              )}
              {(status === 'opened' || status === 'completed') && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#17243A] text-[#FFBF47]">
                    {status === 'completed' ? <LuCheck size={28} strokeWidth={3} /> : <LuSmartphone size={26} />}
                  </span>
                  <span className="text-sm font-bold text-[#17243A]">{status === 'completed' ? 'Photo received' : 'Scanning on the phone…'}</span>
                </div>
              )}
              {(status === 'expired' || status === 'cancelled' || status === 'error') && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-2 text-center">
                  <span className="text-sm font-bold text-[#17243A]">{PHONE_STATUS_TEXT[status]}</span>
                  {state.message && <span className="text-[12.5px] text-[#737D8C]">{state.message}</span>}
                  <BarButton tone="primary" className="!h-9 !px-3 !text-sm" onClick={() => setAttempt((a) => a + 1)}>
                    <LuRefreshCw size={15} /> New QR code
                  </BarButton>
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <ol className="space-y-3">
              {steps.map((text, i) => (
                <li key={text} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#FFBF47] text-sm font-bold text-[#17243A]">{i + 1}</span>
                  <span className="pt-0.5 text-sm font-medium leading-snug text-[#17243A]">{text}</span>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {live && (
                <span className="mr-1 text-[13px] font-semibold tabular-nums text-[#737D8C]">Expires in {formatClock(secondsLeft)}</span>
              )}
              <BarButton className="!h-9 !px-3 !text-sm" onClick={copyLink} disabled={!live}>
                <LuCopy size={15} /> {copied ? 'Link copied' : 'Copy link'}
              </BarButton>
              <BarButton className="!h-9 !px-3 !text-sm" onClick={() => setAttempt((a) => a + 1)} disabled={status === 'creating' || status === 'completed'}>
                <LuRefreshCw size={15} /> New QR code
              </BarButton>
            </div>
          </div>
        </div>

        {isLocal && (
          <InfoBanner tone="warn" className="mt-3 !py-2">
            This link points to localhost, so a phone can&apos;t open it. Set AGENT_PORTAL_URL on the server to the portal&apos;s public HTTPS address.
          </InfoBanner>
        )}

        <TravellerActionBar
          number={traveller.number}
          name={traveller.name}
          thumbUrl={traveller.photoUrl}
          status={status === 'completed' ? 'Photo received from the phone' : status === 'opened' ? 'Scanning on the phone…' : 'Waiting for the phone'}
        >
          <LinkButton onClick={onUseUpload}>
            <LuImageUp size={16} /> Upload instead
          </LinkButton>
          <BarButton onClick={onCancel}>Cancel</BarButton>
          <BarButton tone="primary" onClick={onUseCamera} disabled={status === 'completed'}>
            <LuCamera size={18} /> Use this computer
          </BarButton>
        </TravellerActionBar>
      </Card>

      <div className="space-y-4">
        <Card className="px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <LuListChecks size={22} className="text-[#17243A]" />
            <h3 className="text-base font-bold text-[#17243A]">Phone status</h3>
          </div>
          <ul className="mt-1.5">
            {progressRows.map((r) => (
              <QualityRow key={r.key} {...r} />
            ))}
          </ul>
        </Card>
        <Card className="px-4 py-3.5">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#FFF1DF] text-[#17243A]">
              <LuShieldCheck size={17} />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#17243A]">Private, single-use link</h3>
              <p className="mt-0.5 text-[13px] leading-snug text-[#737D8C]">
                Works only for {traveller.name}&apos;s photo, expires in 15 minutes and stops working once the photo is saved. The phone sees nothing else
                in this application.
              </p>
            </div>
          </div>
        </Card>
        <PhotoTips />
      </div>
    </div>
  );
}

// ── Upload ───────────────────────────────────────────────────────────────

function UploadPicker({ onPicked }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');

  function handleFile(file) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Use a JPG, PNG or WebP photo.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('The photo must be under 10MB.');
      return;
    }
    setError('');
    onPicked({ photo: file, clientReport: { fileName: file.name, fileSize: file.size } });
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-3 text-center">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-[#E9C99B] bg-[#FFFCF7] px-6 py-16 transition hover:border-[#FFBF47] hover:bg-[#FFF1DF] ${FOCUS}`}
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF1DF] text-[#E87535]">
          <LuImageUp size={26} />
        </span>
        <span className="text-[15px] font-bold text-[#17243A]">Choose a photo or drop it here</span>
        <span className="text-[13px] text-[#737D8C]">Passport-style, face straight to the camera, plain background · JPG, PNG or WebP · min 480 × 600 px</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {error && <p className="text-sm font-medium text-[#D97706]">{error}</p>}
      <p className="text-[13px] text-[#737D8C]">Uploaded photos can&apos;t prove a live person, so the camera scan is preferred.</p>
    </div>
  );
}

// Server check results (rejections, and the photo page's "View checks").
export function PhotoCheckList({ check }) {
  if (!check?.checks?.length) return null;
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2">
      {check.checks.map((c) => (
        <li key={c.key} className="flex items-start gap-2.5 rounded-lg border border-[#F0DFC7] bg-white px-2.5 py-2 text-[13px] text-[#17243A]">
          <span
            className={`mt-px flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-black ${
              c.passed ? 'bg-[#FFF1DF] text-[#17243A]' : 'bg-[#FFBF47] text-white'
            }`}
          >
            {c.passed ? <LuCheck size={12} strokeWidth={3} /> : '!'}
          </span>
          <span>
            <span className="font-semibold">{c.label}</span>
            {c.detail && c.detail !== 'OK' && <span className={`block ${c.passed ? 'text-[#737D8C]' : 'text-[#D97706]'}`}>{c.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ── Pop-up frame (variant 'dialog') ──────────────────────────────────────
// Rendered into document.body over the page. Closes with ✕ / Cancel / Esc
// (not a click outside — easy to hit by accident mid-scan).
function PhotoDialogFrame({ traveller, subtitle, onClose, closeDisabled, wide = false, children }) {
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#17243A]/55 p-2 backdrop-blur-sm sm:p-4"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-dialog-title"
        initial={{ y: 14, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className={`relative flex max-h-[calc(100dvh-16px)] w-full flex-col overflow-y-auto rounded-3xl bg-white p-4 shadow-[0_30px_80px_-24px_rgba(15,23,42,0.55)] sm:max-h-[calc(100dvh-32px)] sm:p-5 ${
          wide ? 'max-w-[1040px]' : 'max-w-[880px]'
        }`}
      >
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#FFF1DF] text-base font-bold text-[#17243A]">
            {traveller.number}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="photo-dialog-title" className="truncate text-lg font-bold leading-tight text-[#17243A]">
              {traveller.name}
            </h2>
            <p className="truncate text-[13px] text-[#737D8C]">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Close"
            className={`flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#F5EFE6] text-[#17243A] transition hover:bg-[#FFF1DF] disabled:opacity-40 ${FOCUS}`}
          >
            <LuX size={18} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>,
    document.body
  );
}

/**
 * The photo step for one traveller, rendered inline on the photos page.
 * @param {{ applicantName: string, applicantNumber?: number, currentPhotoUrl?: string|null, initialMode: 'scan'|'upload'|'phone',
 *           onSubmit: (capture) => Promise<object>, onClose: () => void, onDone: (applicant) => void,
 *           phoneHandoff?: { create: () => Promise<object>, poll: (id) => Promise<object>, cancel: (id) => Promise<void> } | null,
 *           previewHeight?: string }} props
 * onSubmit resolves to the saved applicant, or throws (err.data.check holds the failed checks).
 * phoneHandoff turns on "Scan with phone" (left out on the phone itself).
 * previewHeight overrides the camera preview's CSS height (the phone page uses a taller one).
 * variant: 'page' (inline) | 'dialog' (pop-up over the page — Traveller photos).
 */
export default function PhotoCaptureModal({
  applicantName,
  applicantNumber = 1,
  currentPhotoUrl = null,
  initialMode = 'scan',
  onSubmit,
  onClose,
  onDone,
  phoneHandoff = null,
  previewHeight = PREVIEW_HEIGHT,
  variant = 'page',
}) {
  const [mode, setMode] = useState(initialMode);
  const [facing, setFacing] = useState('user');
  const [capture, setCapture] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rejection, setRejection] = useState(null);
  const [scanKey, setScanKey] = useState(0);

  useEffect(() => {
    if (!capture?.photo) return undefined;
    const url = URL.createObjectURL(capture.photo);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [capture]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !submitting && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  const handleCaptured = useCallback((c) => setCapture({ ...c, source: 'camera' }), []);

  function retake(nextMode = mode) {
    setCapture(null);
    setRejection(null);
    setMode(nextMode);
    setScanKey((k) => k + 1);
  }

  async function submit(photo = capture) {
    setSubmitting(true);
    setRejection(null);
    try {
      const applicant = await onSubmit(photo);
      onDone(applicant);
    } catch (err) {
      setRejection({ message: err.message || 'This photo could not be verified.', check: err.data?.check || null });
    } finally {
      setSubmitting(false);
    }
  }

  // A camera scan is verified straight after the automatic 4-second capture
  // — no "Use this photo" click. (An uploaded photo still waits for it, so
  // the agent can check they picked the right file.) Each capture is sent
  // once; a rejected one shows its failed checks with Retake.
  const autoSubmitted = useRef(null);
  useEffect(() => {
    if (capture?.source !== 'camera' || autoSubmitted.current === capture) return;
    autoSubmitted.current = capture;
    submit(capture);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per new capture
  }, [capture]);

  const traveller = { number: applicantNumber, name: applicantName, photoUrl: currentPhotoUrl };
  // Follows the current mode (the agent can switch between scan and upload).
  const banner = (
    <InfoBanner className="mb-4 !py-2.5">
      {mode === 'scan'
        ? 'Keep the face inside the oval and follow the instruction under the camera — the photo is taken automatically once every check stays green for 4 seconds.'
        : mode === 'phone'
          ? "Scan the QR code with the traveller's phone — the face scan runs there with the front camera and the photo appears here automatically."
          : 'Upload a recent passport-style photo: face straight to the camera, eyes open, even lighting, plain background.'}
    </InfoBanner>
  );

  // ── Pop-up (Traveller photos page) ─────────────────────────────────
  if (variant === 'dialog') {
    const subtitle =
      capture != null
        ? submitting
          ? 'Verifying the photo…'
          : rejection
            ? 'This photo can’t be used'
            : capture.source === 'camera'
              ? 'Photo captured'
              : 'Check the photo before using it'
        : mode === 'phone'
          ? 'Scan with phone'
          : mode === 'upload'
            ? 'Upload a photo'
            : 'Face scan — follow the instruction on the camera';
    let body;
    if (!capture && mode === 'phone' && phoneHandoff) {
      body = (
        <PhoneHandoff
          handoffApi={phoneHandoff}
          traveller={traveller}
          onUseCamera={() => retake('scan')}
          onUseUpload={() => retake('upload')}
          onCancel={onClose}
          onDone={onDone}
        />
      );
    } else if (!capture && mode === 'scan') {
      body = (
        <FaceScanner
          key={`${scanKey}-${facing}`}
          layout="dialog"
          facing={facing}
          onSwitchFacing={setFacing}
          onCaptured={handleCaptured}
          onUseUpload={() => retake('upload')}
          onUsePhone={phoneHandoff ? () => retake('phone') : undefined}
          onRetry={() => retake('scan')}
          onCancel={onClose}
          traveller={traveller}
        />
      );
    } else if (!capture) {
      body = (
        <div>
          <UploadPicker onPicked={(c) => setCapture({ ...c, source: 'upload' })} />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#F4ECDF] pt-4">
            <div className="flex flex-wrap items-center gap-1">
              {phoneHandoff && (
                <LinkButton onClick={() => retake('phone')}>
                  <LuSmartphone size={16} /> Scan with phone
                </LinkButton>
              )}
              <LinkButton onClick={() => retake('scan')}>
                <LuCamera size={16} /> Use camera instead
              </LinkButton>
            </div>
            <BarButton onClick={onClose}>Cancel</BarButton>
          </div>
        </div>
      );
    } else {
      // Review: the photo where the camera was, then the result under it.
      body = (
        <div>
          <div
            className="relative mx-auto aspect-[7/9] overflow-hidden rounded-2xl bg-[#E9E4DC]"
            style={{ width: `min(100%, calc(${DIALOG_PREVIEW_HEIGHT} * 7 / 9))` }}
          >
            {previewUrl && <img src={previewUrl} alt="Captured" className="absolute inset-0 h-full w-full object-contain" />}
            {submitting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/75 px-4 text-center text-[#17243A] backdrop-blur-[2px]">
                <LuLoader className="animate-spin" size={30} />
                <p className="text-sm font-bold">Verifying photo…</p>
                <p className="text-[13px] text-[#737D8C]">Checking sharpness, face alignment and lighting</p>
              </div>
            )}
          </div>
          {rejection && (
            <div role="alert" className="mx-auto mt-4 max-w-2xl rounded-2xl border border-[#F3D9B5] bg-[#FFF9EF] p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#FFBF47] text-sm font-black text-white">!</span>
                <div>
                  <h3 className="text-[15px] font-bold text-[#17243A]">This photo can&apos;t be used</h3>
                  <p className="text-[13px] text-[#D97706]">{rejection.message}</p>
                </div>
              </div>
              {rejection.check?.checks?.length > 0 && (
                <div className="mt-3">
                  <PhotoCheckList check={rejection.check} />
                </div>
              )}
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#F4ECDF] pt-4">
            <p className="text-[13px] text-[#737D8C]">
              {submitting
                ? 'Checking it on our server before saving…'
                : rejection
                  ? 'Retake it following the instruction on the camera.'
                  : capture.source === 'camera'
                    ? 'Saved automatically once it passes the checks.'
                    : '“Use this photo” checks it on our server before saving.'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <BarButton onClick={() => retake()} disabled={submitting}>
                <LuRefreshCw size={16} /> {capture.source === 'camera' ? 'Retake' : 'Choose another'}
              </BarButton>
              {!rejection && (capture.source !== 'camera' || submitting) && (
                <BarButton tone="primary" onClick={() => submit()} disabled={submitting}>
                  {submitting ? <LuLoaderCircle size={18} className="animate-spin" /> : <LuCheck size={18} />} {submitting ? 'Verifying…' : 'Use this photo'}
                </BarButton>
              )}
            </div>
          </div>
        </div>
      );
    }
    return (
      <PhotoDialogFrame
        traveller={traveller}
        subtitle={subtitle}
        onClose={onClose}
        closeDisabled={submitting}
        wide={!capture && mode === 'phone'}
      >
        {body}
      </PhotoDialogFrame>
    );
  }

  if (!capture && mode === 'phone' && phoneHandoff) {
    return (
      <div role="region" aria-label={`Photo for ${applicantName}`}>
        {banner}
        <PhoneHandoff
          handoffApi={phoneHandoff}
          traveller={traveller}
          onUseCamera={() => retake('scan')}
          onUseUpload={() => retake('upload')}
          onCancel={onClose}
          onDone={onDone}
        />
      </div>
    );
  }

  if (!capture && mode === 'scan') {
    return (
      <div role="region" aria-label={`Photo for ${applicantName}`}>
        {banner}
        <FaceScanner
          key={`${scanKey}-${facing}`}
          facing={facing}
          onSwitchFacing={setFacing}
          onCaptured={handleCaptured}
          onUseUpload={() => retake('upload')}
          onUsePhone={phoneHandoff ? () => retake('phone') : undefined}
          onRetry={() => retake('scan')}
          onCancel={onClose}
          traveller={traveller}
          previewHeight={previewHeight}
        />
      </div>
    );
  }

  // Upload picker, or the review of a captured / chosen photo.
  return (
    <div role="region" aria-label={`Photo for ${applicantName}`}>
      {banner}
      <div>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(330px,1fr)]">
        <Card className="p-4">
          {!capture ? (
            <>
              <CardHeader Icon={LuImageUp} title="Upload a photo" subtitle="A recent passport-style photo of the traveller" />
              <UploadPicker onPicked={(c) => setCapture({ ...c, source: 'upload' })} />
            </>
          ) : (
            <>
              <CardHeader Icon={LuCamera} title="Review photo" subtitle={
                  submitting
                    ? 'Verifying the photo…'
                    : rejection
                      ? 'This photo didn’t pass — retake it'
                      : capture.source === 'camera'
                        ? 'Photo captured'
                        : 'Check the photo before using it'
                }
              />
              <div
                className="relative mx-auto mt-3 aspect-[7/9] overflow-hidden rounded-xl bg-[#E9E4DC]"
                style={{ width: `min(100%, calc(${previewHeight} * 7 / 9))` }}
              >
                {previewUrl && <img src={previewUrl} alt="Captured" className="absolute inset-0 h-full w-full object-contain" />}
                {submitting && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/75 text-[#17243A] backdrop-blur-[2px]">
                    <LuLoader className="animate-spin" size={30} />
                    <p className="text-sm font-bold">Verifying photo…</p>
                    <p className="text-[13px] text-[#737D8C]">Checking sharpness, face alignment and lighting</p>
                  </div>
                )}
              </div>
            </>
          )}
          <TravellerActionBar
            number={traveller.number}
            name={traveller.name}
            thumbUrl={previewUrl || traveller.photoUrl}
            status={
              submitting
                ? 'Verifying photo…'
                : rejection
                  ? 'Photo rejected — try another'
                  : capture
                    ? capture.source === 'camera'
                      ? 'Photo captured'
                      : 'Photo chosen'
                    : 'No photo chosen yet'
            }
          >
            {!capture ? (
              <>
                {phoneHandoff && (
                  <LinkButton onClick={() => retake('phone')}>
                    <LuSmartphone size={16} /> Scan with phone
                  </LinkButton>
                )}
                <BarButton onClick={onClose}>Cancel</BarButton>
                <BarButton tone="primary" onClick={() => retake('scan')}>
                  <LuCamera size={18} /> Use camera instead
                </BarButton>
              </>
            ) : (
              <>
                <BarButton onClick={() => retake()} disabled={submitting}>
                  <LuRefreshCw size={16} /> {capture.source === 'camera' ? 'Retake' : 'Choose another'}
                </BarButton>
                {/* Camera photos are verified automatically; only uploads wait for this. */}
                {!rejection && (capture.source !== 'camera' || submitting) && (
                  <BarButton tone="primary" onClick={() => submit()} disabled={submitting}>
                    {submitting ? <LuLoaderCircle size={18} className="animate-spin" /> : <LuCheck size={18} />} {submitting ? 'Verifying…' : 'Use this photo'}
                  </BarButton>
                )}
              </>
            )}
          </TravellerActionBar>
        </Card>

        <div className="space-y-4">
          {rejection ? (
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#FFBF47] text-base font-black text-white">!</span>
                <div>
                  <h3 className="text-base font-bold text-[#17243A]">This photo can&apos;t be used</h3>
                  <p className="text-[13px] text-[#D97706]">{rejection.message}</p>
                </div>
              </div>
              <div className="mt-4">
                <PhotoCheckList check={rejection.check} />
              </div>
            </Card>
          ) : capture ? (
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#FFF1DF] text-[#17243A]">
                  <LuShieldCheck size={18} />
                </span>
                <div>
                  <h3 className="text-base font-bold text-[#17243A]">{capture.source === 'camera' ? 'Verifying automatically' : 'Ready to verify'}</h3>
                  <p className="text-[13px] text-[#737D8C]">
                    {capture.source === 'camera'
                      ? 'The photo is being checked on our server — resolution, sharpness, lighting and the face checks — and saved if it passes.'
                      : '“Use this photo” checks it on our server — resolution, sharpness, lighting and the face checks — before saving.'}
                  </p>
                </div>
              </div>
            </Card>
          ) : null}
          <PhotoTips />
        </div>
      </div>

      </div>
    </div>
  );
}
