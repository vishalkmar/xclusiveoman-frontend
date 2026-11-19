import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// Live face checks for the visa photo scan (components/visa/PhotoCaptureModal.jsx).
// Google MediaPipe Face Landmarker runs fully in the browser (free, no API
// key): 478 face landmarks + blendshape scores (eyeBlinkLeft/Right) per
// frame. The backend re-verifies everything on the captured photo
// (visaPhotoCheck.service.js) — these checks only guide the agent live.

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// Passport photo shape (35 × 45 mm). The scan shows and captures the same
// centred 7:9 crop of the camera frame, so what the agent sees in the oval
// is exactly what gets uploaded.
export const PHOTO_ASPECT = 7 / 9;

// Thresholds — head (forehead to chin) as a share of the photo height,
// matching the backend's "too far / too close" judgement.
const MIN_FACE_HEIGHT = 0.45;
const MAX_FACE_HEIGHT = 0.72;
const MAX_CENTER_OFFSET_X = 0.09;
const MAX_CENTER_OFFSET_Y = 0.1;
const MAX_ROLL_DEG = 8;
// Clarity has no fixed target percentage: every webcam has its own best
// sharpness, and many laptop cameras never score high even when perfectly in
// focus. A frame counts as clear when it is
//   1. above CLARITY_FLOOR — only truly blurred frames (smeared by movement,
//      badly out of focus, a smudged lens) fall below it; the backend uses
//      the same floor; and
//   2. close to the sharpest frame this camera produced in the last few
//      seconds (CLARITY_SETTLED_SHARE of that peak) — focus has settled and
//      nothing is moving, so the photo is as clear as this camera allows.
export const CLARITY_FLOOR = 15;
const CLARITY_SETTLED_SHARE = 0.7;
const CLARITY_PEAK_WINDOW_MS = 3000;
// Same formula and reference as the backend's analyseImage(), so the live
// score matches what the server will measure on the captured photo.
const CLARITY_REFERENCE_VARIANCE = 110;
const MIN_BRIGHTNESS = 60;
const MAX_BRIGHTNESS = 210;
// Blink detection uses two signals: MediaPipe's eyeBlink blendshape score
// and the eye aspect ratio (eyelid gap / eye width) from the landmarks.
// Tested with a fake camera: fully closed lids only scored ~0.45 on the
// blendshape but dropped the aspect ratio from ~0.32 to ~0.05, so either
// signal counts as closed.
export const EYES_CLOSED = 0.45;
export const EYES_OPEN = 0.3;
const EAR_CLOSED = 0.15;
const EAR_OPEN = 0.22;

function eyeAspectRatio(lm, outer, inner, top, bottom) {
  const width = Math.hypot(lm[outer].x - lm[inner].x, lm[outer].y - lm[inner].y);
  return width ? Math.hypot(lm[top].x - lm[bottom].x, lm[top].y - lm[bottom].y) / width : 0;
}

let landmarkerPromise = null;

async function createLandmarker(delegate) {
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: 'VIDEO',
    numFaces: 2,
    outputFaceBlendshapes: true,
  });
}

export function loadFaceLandmarker() {
  if (!landmarkerPromise) {
    // GPU is much faster but not available on every device/browser.
    landmarkerPromise = createLandmarker('GPU')
      .catch(() => createLandmarker('CPU'))
      .catch((err) => {
        landmarkerPromise = null;
        throw err;
      });
  }
  return landmarkerPromise;
}

// Largest centred 7:9 rectangle inside the video frame.
export function centeredCrop(videoWidth, videoHeight) {
  if (videoWidth / videoHeight > PHOTO_ASPECT) {
    const width = Math.round(videoHeight * PHOTO_ASPECT);
    return { x: Math.round((videoWidth - width) / 2), y: 0, width, height: videoHeight };
  }
  const height = Math.round(videoWidth / PHOTO_ASPECT);
  return { x: 0, y: Math.round((videoHeight - height) / 2), width: videoWidth, height };
}

function laplacianVariance(grey, w, h) {
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      const v = grey[i - w] + grey[i + w] + grey[i - 1] + grey[i + 1] - 4 * grey[i];
      sum += v;
      sumSq += v * v;
      n += 1;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

// Clarity + brightness of the crop's centre region (20–80% across, 15–75%
// down), downscaled to 384px wide — identical to the backend measurement.
export function measureImage(video, crop, canvas) {
  const region = {
    x: crop.x + crop.width * 0.2,
    y: crop.y + crop.height * 0.15,
    width: crop.width * 0.6,
    height: crop.height * 0.6,
  };
  const w = 384;
  const h = Math.max(1, Math.round((region.height / region.width) * w));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, region.x, region.y, region.width, region.height, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const grey = new Float32Array(w * h);
  let total = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    // Same luma weights libvips uses for greyscale.
    const g = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    grey[p] = Math.round(g);
    total += g;
  }
  return {
    clarity: Math.min(100, Math.round((laplacianVariance(grey, w, h) / CLARITY_REFERENCE_VARIANCE) * 100)),
    brightness: Math.round(total / (w * h)),
  };
}

// Remembers the clarity of recent frames. Webcam grain makes the raw score
// jump from frame to frame, so each reading is smoothed (median of the last
// CLARITY_SMOOTH_MS) and compared with the best smoothed reading of the last
// CLARITY_PEAK_WINDOW_MS — the sharpest this camera has just shown. One
// tracker per scan. Returns { clarity, peak }.
const CLARITY_SMOOTH_MS = 400;

export function createClarityTracker() {
  let raw = [];
  let smoothed = [];
  return (value, now) => {
    raw.push({ t: now, v: value });
    raw = raw.filter((s) => now - s.t <= CLARITY_SMOOTH_MS);
    const sorted = raw.map((s) => s.v).sort((x, y) => x - y);
    const clarity = sorted[Math.floor(sorted.length / 2)];
    smoothed.push({ t: now, v: clarity });
    smoothed = smoothed.filter((s) => now - s.t <= CLARITY_PEAK_WINDOW_MS);
    return { clarity, peak: Math.max(...smoothed.map((s) => s.v)) };
  };
}

function blendshape(result, name) {
  return result.faceBlendshapes?.[0]?.categories?.find((c) => c.categoryName === name)?.score ?? 0;
}


// The oval guide drawn on the scanner, in 0..1 crop coordinates (rx is a
// share of the width, ry of the height). PhotoCaptureModal draws it from
// the same numbers, so "inside the oval" here means inside what's on screen.
export const OVAL_GUIDE = { cx: 0.5, cy: 0.48, rx: 0.33, ry: 0.358 };
// Landmarks allowed to sit just past the oval line (the head fills the oval
// at the closest allowed distance), as a squared-radius factor.
const OVAL_TOLERANCE = 1.15;
// A face counts as "partial" once more than this share of its landmarks
// falls outside the frame (MediaPipe extrapolates hidden landmarks).
const MAX_OUTSIDE_SHARE = 0.01;
// Outline points used for the oval-containment test: forehead, chin,
// cheeks and jaw corners.
const OUTLINE_POINTS = [10, 152, 234, 454, 172, 397];

/**
 * One frame's checks:
 *   { faceCount, fullFace, inOval, checks: {key: {ok, hint, value?}}, eyes,
 *     positionOk, landmarksReady, face }
 * `checks.*.hint` is null when that check can't be judged yet (e.g. no face)
 * — the UI shows it as pending rather than failed. `landmarksReady` is true
 * only when one complete face sits inside the oval at the right distance;
 * the overlay draws the detector's real landmarks (`face.points`) only then.
 * `measure` = measureImage() output for the same frame, with `clarity`
 * smoothed and `clarityPeak` added by createClarityTracker.
 */
export function evaluateFrame(result, video, crop, measure) {
  const faceCount = result.faceLandmarks?.length || 0;
  const checks = {};
  let eyes = { left: 0, right: 0, closed: false, open: false };
  let face = null;
  let fullFace = false;
  let inOval = false;

  const pending = { ok: false, hint: null };
  checks.distance = pending;
  checks.centered = pending;
  checks.straight = pending;
  checks.eyes = pending;

  if (faceCount === 0) {
    checks.face = { ok: false, hint: 'Position your face inside the oval' };
  } else if (faceCount > 1) {
    checks.face = { ok: false, hint: 'Only one person should be in the frame', severe: true };
  } else {
    const lm = result.faceLandmarks[0];
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    // Landmarks are normalised to the full video frame; re-express them in
    // the 7:9 crop the agent actually sees (the preview is that same crop).
    const toCrop = (p) => ({ x: (p.x * vw - crop.x) / crop.width, y: (p.y * vh - crop.y) / crop.height });
    const pts = lm.map(toCrop);

    const outside = pts.filter((p) => p.x < -0.005 || p.x > 1.005 || p.y < -0.005 || p.y > 1.005).length;
    fullFace = outside / pts.length <= MAX_OUTSIDE_SHARE;
    checks.face = fullFace ? { ok: true, hint: null } : { ok: false, hint: 'Move your full face into the frame' };

    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    face = {
      box: { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) },
      points: OVERLAY_POINTS.map((i) => pts[i]).filter(Boolean),
    };

    const left = blendshape(result, 'eyeBlinkLeft');
    const right = blendshape(result, 'eyeBlinkRight');
    // Aspect ratio in real pixels (landmarks are normalised separately on
    // each axis, so scale them back before measuring).
    const px = lm.map((p) => ({ x: p.x * vw, y: p.y * vh }));
    const ear = (eyeAspectRatio(px, 33, 133, 159, 145) + eyeAspectRatio(px, 263, 362, 386, 374)) / 2;
    eyes = {
      left,
      right,
      ear,
      closed: (left > EYES_CLOSED && right > EYES_CLOSED) || ear < EAR_CLOSED,
      open: left < EYES_OPEN && right < EYES_OPEN && ear > EAR_OPEN,
    };

    // Position, distance and pose are only judged on a complete face — a
    // half-visible face gives meaningless numbers.
    if (fullFace) {
      const forehead = pts[10];
      const chin = pts[152];
      const nose = pts[1];
      const eyeA = pts[33];
      const eyeB = pts[263];
      const faceHeight = chin.y - forehead.y;
      const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
      const centerY = (forehead.y + chin.y) / 2;

      const { cx, cy, rx, ry } = OVAL_GUIDE;
      inOval = OUTLINE_POINTS.every((i) => ((pts[i].x - cx) / rx) ** 2 + ((pts[i].y - cy) / ry) ** 2 <= OVAL_TOLERANCE);
      const offX = centerX - cx;
      const offY = centerY - cy;
      const centred = inOval && Math.abs(offX) <= MAX_CENTER_OFFSET_X && Math.abs(offY) <= MAX_CENTER_OFFSET_Y;
      // Direction in the agent's own terms. The preview is mirrored like a
      // selfie, so the face sits at screen x = 1 - centerX and "move to your
      // left" moves it left on screen.
      const screenOffX = -offX;
      let centerHint = 'Center your face inside the oval';
      if (Math.abs(screenOffX) / rx > Math.abs(offY) / ry && Math.abs(screenOffX) > MAX_CENTER_OFFSET_X / 2) {
        centerHint = screenOffX > 0 ? 'Move slightly to your left' : 'Move slightly to your right';
      } else if (Math.abs(offY) > MAX_CENTER_OFFSET_Y / 2) {
        centerHint = offY > 0 ? 'Move up a little' : 'Move down a little';
      }
      checks.centered = { ok: centred, hint: centred ? null : centerHint };

      checks.distance = {
        ok: faceHeight >= MIN_FACE_HEIGHT && faceHeight <= MAX_FACE_HEIGHT,
        hint: faceHeight < MIN_FACE_HEIGHT ? 'Move closer to the camera' : faceHeight > MAX_FACE_HEIGHT ? 'Move a little further back' : null,
        value: Math.round(faceHeight * 100),
      };

      // Head pose: roll from the eye line, yaw from where the nose sits
      // between the eyes, pitch from where it sits between eyes and chin.
      const roll = (Math.atan2(eyeB.y - eyeA.y, eyeB.x - eyeA.x) * 180) / Math.PI;
      const yaw = (nose.x - Math.min(eyeA.x, eyeB.x)) / Math.abs(eyeB.x - eyeA.x);
      const eyeMidY = (eyeA.y + eyeB.y) / 2;
      const pitch = (nose.y - eyeMidY) / (chin.y - eyeMidY);
      const straight = Math.abs(roll) <= MAX_ROLL_DEG && yaw >= 0.38 && yaw <= 0.62 && pitch >= 0.2 && pitch <= 0.6;
      checks.straight = {
        ok: straight,
        hint: straight ? null : Math.abs(roll) > MAX_ROLL_DEG ? 'Keep your head level' : 'Look straight at the camera',
      };
      // Visa photos need both eyes clearly open (the backend checks this too).
      checks.eyes = { ok: eyes.open, hint: eyes.open ? null : 'Keep both eyes open' };
    }
  }

  checks.lighting = {
    ok: measure.brightness >= MIN_BRIGHTNESS && measure.brightness <= MAX_BRIGHTNESS,
    hint:
      measure.brightness < MIN_BRIGHTNESS
        ? 'Lighting is too low. Move to a brighter area.'
        : measure.brightness > MAX_BRIGHTNESS
          ? 'Too bright — avoid strong light on or behind you'
          : null,
    value: measure.brightness,
  };
  const clarityPeak = Math.max(measure.clarityPeak ?? measure.clarity, measure.clarity);
  const aboveFloor = measure.clarity >= CLARITY_FLOOR;
  const settled = measure.clarity >= clarityPeak * CLARITY_SETTLED_SHARE;
  checks.clarity = {
    ok: aboveFloor && settled,
    hint: !aboveFloor
      ? 'Image is blurry — clean the lens and add more light'
      : !settled
        ? 'Hold still while the camera focuses'
        : null,
    value: measure.clarity,
  };

  const positionOk = ['face', 'distance', 'centered', 'straight', 'eyes', 'lighting', 'clarity'].every((k) => checks[k].ok);
  const landmarksReady = checks.face.ok && checks.centered.ok && checks.distance.ok;
  return { faceCount, fullFace, inOval, checks, eyes, positionOk, landmarksReady, face };
}


// Landmarks drawn on the scanner overlay: face outline, brows, eyes, nose
// bridge, lips (MediaPipe Face Mesh indices).
const OVERLAY_POINTS = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 70, 63, 105, 66, 107, 336, 296, 334, 293, 300, 33, 160, 158,
  133, 153, 144, 263, 387, 385, 362, 380, 373, 168, 6, 197, 195, 5, 4, 1, 98, 327, 61, 40, 37, 0, 267, 270, 291, 321,
  314, 17, 84, 91,
];

// Draws the 7:9 crop (unmirrored, as the camera really sees it) to a JPEG blob.
export function captureCrop(video, crop) {
  const canvas = document.createElement('canvas');
  canvas.width = crop.width;
  canvas.height = crop.height;
  canvas.getContext('2d').drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not capture the photo'))), 'image/jpeg', 0.95)
  );
}
