// Turns whatever the agent drops in for a passport — photos, scans, or a
// PDF of some/all of the passport — into page images for the backend
// (POST /visa/.../passport/scan), which works out which page is the front
// (data) page and which the back (address) page.
//
// PDFs are rendered in the browser with pdf.js (loaded only when a PDF is
// actually added). The backend accepts at most MAX_PAGES images, so for a
// long full-passport scan only the first and last pages are sent — that's
// where the data page and the address page are.

export const MAX_PAGES = 20;
const LONG_PDF_EDGE_PAGES = 6;
// PDF pages are rendered this wide: enough pixels per character for the
// server's MRZ OCR to read the code lines (~1MB JPEG per page).
const RENDER_WIDTH = 2200;
const MAX_IMAGE_SIDE = 2400;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const PASSPORT_ACCEPT = ACCEPTED.join(',');

let pdfjsPromise = null;

function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

function canvasToJpeg(canvas, quality = 0.9) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process the page'))), 'image/jpeg', quality)
  );
}

function pickPdfPages(count) {
  const all = Array.from({ length: count }, (_, i) => i + 1);
  if (count <= LONG_PDF_EDGE_PAGES * 2) return all;
  return [...all.slice(0, LONG_PDF_EDGE_PAGES), ...all.slice(-LONG_PDF_EDGE_PAGES)];
}

async function pdfToPages(file, slot) {
  const pdfjs = await loadPdfjs();
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  } catch (err) {
    throw new Error(
      err?.name === 'PasswordException' ? `${file.name} is password-protected — remove the password and try again.` : `${file.name} could not be opened as a PDF.`
    );
  }
  const pages = [];
  for (const number of pickPdfPages(doc.numPages)) {
    const page = await doc.getPage(number);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: RENDER_WIDTH / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push({ blob: await canvasToJpeg(canvas), slot, label: `${file.name} · page ${number} of ${doc.numPages}` });
    page.cleanup();
  }
  await doc.destroy();
  return { pages, skipped: doc.numPages - pages.length };
}

async function imageToPage(file, slot) {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error(`${file.name} could not be read as an image.`);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return { blob: await canvasToJpeg(canvas, 0.92), slot, label: file.name };
}

/**
 * @param {File} file
 * @param {'front'|'back'} slot
 * @returns {Promise<{ pages: {blob, slot, label, url}[], skipped: number }>}
 */
export async function fileToPages(file, slot) {
  if (!ACCEPTED.includes(file.type)) throw new Error(`${file.name}: use a JPG, PNG, WebP image or a PDF.`);
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than 25MB.`);
  const result = file.type === 'application/pdf' ? await pdfToPages(file, slot) : { pages: [await imageToPage(file, slot)], skipped: 0 };
  return { ...result, pages: result.pages.map((p) => ({ ...p, url: URL.createObjectURL(p.blob) })) };
}
