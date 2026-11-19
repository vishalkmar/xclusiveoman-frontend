// Browser-side itinerary PDF download — the server renders no PDFs (an
// earlier headless-Chrome export couldn't run on shared/cPanel hosting).
//
// Two halves of one flow, both in this file:
//   - downloadItineraryPdf() runs on the page the agent clicked from. It
//     loads a standalone print page (ItineraryPrint.jsx /
//     DepartureItineraryPrint.jsx) in a hidden same-origin iframe, waits for
//     the readiness signal those pages already set for the old export
//     (window.__PDF_READY__ / __PDF_ERROR__), asks the page to build the PDF,
//     and saves the file.
//   - exposeItineraryPdfBuilder() runs inside that print page and registers
//     window.__buildItineraryPdf: draws the rendered itinerary to a canvas
//     (html-to-image — the browser's own renderer, so it matches the page),
//     cuts it into A4 pages at clean break points, and assembles them with
//     jsPDF. Done inside the iframe so the capture runs against that
//     document's own window and styles.

const A4_MM = { width: 210, height: 297 };
const PX_PER_MM = 96 / 25.4;
const READY_TIMEOUT_MS = 60000;
const POLL_MS = 150;
const MAX_CANVAS_PX = 30000; // browsers cap canvas height at ~32k px

// Page margins in mm.
export const FD_ITINERARY_MARGINS_MM = { top: 14, right: 12, bottom: 16, left: 12 };
export const FIT_ITINERARY_MARGINS_MM = { top: 14, right: 12, bottom: 16, left: 12 };

function contentSizePx(margins) {
  return {
    width: Math.round((A4_MM.width - margins.left - margins.right) * PX_PER_MM),
    height: Math.floor((A4_MM.height - margins.top - margins.bottom) * PX_PER_MM),
  };
}

// "Wonders of Oman" -> "Itinerary - Wonders of Oman.pdf"
export function itineraryFileName(name) {
  const clean = String(name || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  return `${clean ? `Itinerary - ${clean}` : 'Itinerary'}.pdf`;
}

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ---- Clicking page -------------------------------------------------------

// `printPath`: the print route plus its pdfToken query, e.g.
// `/agent/departures/<id>/print?pdfToken=...`. Resolves once the file has
// been handed to the browser to save.
export async function downloadItineraryPdf({ printPath, fileName, margins }) {
  const { width } = contentSizePx(margins);
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  // Off-screen rather than display:none so the page lays out and its images
  // load. The width is the A4 content width, so the layout matches the page
  // it will be cut into.
  frame.style.cssText = `position:fixed;left:-20000px;top:0;width:${width}px;height:1600px;border:0;opacity:0;pointer-events:none;`;
  frame.src = printPath;
  document.body.appendChild(frame);

  try {
    const win = await new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const timer = window.setInterval(() => {
        const w = frame.contentWindow;
        if (Date.now() - startedAt > READY_TIMEOUT_MS) {
          window.clearInterval(timer);
          reject(new Error('The itinerary took too long to load. Please try again.'));
        } else if (w && w.__PDF_READY__ === true) {
          window.clearInterval(timer);
          if (w.__PDF_ERROR__ || typeof w.__buildItineraryPdf !== 'function') {
            reject(new Error('Unable to load the itinerary. Please try again.'));
          } else {
            resolve(w);
          }
        }
      }, POLL_MS);
    });

    const built = await win.__buildItineraryPdf({ margins });
    // Re-wrapped so the Blob belongs to this window, not the iframe's.
    const blob = new Blob([await built.arrayBuffer()], { type: 'application/pdf' });
    saveBlob(blob, fileName);
  } finally {
    frame.remove();
  }
}

// ---- Inside the print page -----------------------------------------------

// Tailwind `print:` utilities live in @media print rules, which a canvas
// capture never applies. Copy them out unconditionally so the PDF gets the
// same print styling the server-side export (and a real print) used.
function applyPrintStyles() {
  const rules = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let cssRules;
    try {
      cssRules = sheet.cssRules;
    } catch {
      continue; // cross-origin stylesheet (e.g. Google Fonts) — not readable
    }
    for (const rule of Array.from(cssRules)) {
      if (rule instanceof CSSMediaRule && /\bprint\b/.test(rule.media.mediaText) && !/\bscreen\b/.test(rule.media.mediaText)) {
        for (const inner of Array.from(rule.cssRules)) rules.push(inner.cssText);
      }
    }
  }
  const style = document.createElement('style');
  style.textContent = rules.join('\n');
  document.head.appendChild(style);
}

const ATOMIC_SELECTOR = 'img,svg,p,h1,h2,h3,h4,h5,h6,li,tr,td,th,span,a,button,label';

// A bordered box (the itinerary's day/hotel/inclusion cards) — cutting one
// leaves a stray strip of its border on the next page.
function isBoxed(style) {
  return parseFloat(style.borderTopWidth) > 0 && parseFloat(style.borderBottomWidth) > 0;
}

// Everything on the page that must not be sliced through, measured from the
// top of `root` as it is laid out right now: a line of text, an image, a card,
// or a block marked break-inside: avoid. A block taller than ~90% of a page
// can't be kept whole, so it's allowed to split (between its own children).
function measureBlocks(root, pageHeight) {
  const rootTop = root.getBoundingClientRect().top;
  const blocks = [];
  for (const el of Array.from(root.querySelectorAll('*'))) {
    const style = window.getComputedStyle(el);
    const atomic =
      el.matches(ATOMIC_SELECTOR) ||
      isBoxed(style) ||
      style.breakInside === 'avoid' ||
      style.breakInside === 'avoid-page';
    if (!atomic) continue;
    const rect = el.getBoundingClientRect();
    if (rect.height <= 0 || rect.height > pageHeight * 0.9) continue;
    blocks.push({ top: rect.top - rootTop, bottom: rect.bottom - rootTop, el });
  }

  // Headings marked data-pdf-keep-with-next (section titles, day headers) are
  // glued to the start of what follows, so a heading is never stranded alone
  // at the bottom of a page. Only the start: when what follows is a large
  // block (over a third of a page) the heading is glued to its first child
  // instead, so a long section can begin on the current page rather than
  // pushing the whole thing to the next one.
  for (const el of Array.from(root.querySelectorAll('[data-pdf-keep-with-next]'))) {
    let next = el.nextElementSibling;
    while (next && next.getBoundingClientRect().height > pageHeight * 0.35 && next.firstElementChild) next = next.firstElementChild;
    if (!next) continue;
    const top = el.getBoundingClientRect().top - rootTop;
    const bottom = next.getBoundingClientRect().bottom - rootTop;
    if (bottom - top <= pageHeight * 0.9) blocks.push({ top, bottom, el });
  }

  // Cards that are allowed to split (data-pdf-card) — a break just inside one's
  // top edge would leave a sliver of its padding and rounded corner on the
  // previous page, so such a break moves up to the card's own top.
  const cardTops = Array.from(root.querySelectorAll('[data-pdf-card]')).map(
    (el) => el.getBoundingClientRect().top - rootTop
  );

  return { rootTop, total: root.scrollHeight, blocks, cardTops };
}

// Where the page that starts at `start` has to end: as low as possible
// without cutting any block, a few px above the first block that doesn't fit
// (so rounding when the canvas is sliced can't leave a 1px sliver of it).
function breakAfter(start, { blocks, cardTops }, pageHeight) {
  let y = start + pageHeight;
  for (let moved = true, guard = 0; moved && guard < 500; guard += 1) {
    moved = false;
    for (const { top, bottom } of blocks) {
      if (top > start && top < y - 0.5 && bottom > y + 0.5) {
        y = top;
        moved = true;
      }
    }
  }
  for (const top of cardTops) {
    if (top > start && top < y && y - top <= 40) y = top;
  }
  if (y < start + pageHeight) y = Math.max(start + 1, y - 3);
  // Don't leave a mostly-empty page just to keep one block whole.
  if (y - start < pageHeight * 0.5) y = start + pageHeight;
  return y;
}

// Most extra space added above any one section when a page is spread out.
const MAX_FLOW_GAP_PX = 28;

function makeSpacer(height) {
  const spacer = document.createElement('div');
  spacer.setAttribute('data-pdf-spacer', '');
  spacer.style.cssText = `height:${height}px;margin:0;padding:0;border:0;`;
  return spacer;
}

// Page breaks for `root`, page by page. Blocks are never cut, so when the next
// block doesn't fit, the page ends early. Instead of leaving all of that
// leftover space as an empty band at the bottom, it is shared out as extra
// spacing above the sections that start on that page (elements marked
// data-pdf-flow — the brochure's sections and day cards), up to
// MAX_FLOW_GAP_PX each, so the page reads as evenly filled. Spacers are real
// DOM nodes, so the capture that follows includes them. If spreading would
// push anything onto the next page, it's undone for that page.
function paginate(root, pageHeight) {
  const breaks = [];
  let start = 0;
  for (let guard = 0; guard < 300; guard += 1) {
    let measured = measureBlocks(root, pageHeight);
    if (measured.total - start <= pageHeight) break;
    let y = breakAfter(start, measured, pageHeight);

    const leftover = start + pageHeight - y;
    if (leftover > 16) {
      const rootTop = measured.rootTop;
      // Never between a heading and what it introduces: skip a section's first
      // child and anything straight after a keep-with-next heading.
      const flows = Array.from(root.querySelectorAll('[data-pdf-flow]')).filter((el) => {
        if (!el.previousElementSibling || el.previousElementSibling.hasAttribute('data-pdf-keep-with-next')) return false;
        const top = el.getBoundingClientRect().top - rootTop;
        return top > start + 2 && top < y - 2;
      });
      // The block that will open the next page — it must stay there.
      const anchor = measured.blocks
        .filter((blk) => blk.top >= y - 1)
        .sort((p, q) => p.top - q.top)[0]?.el;
      if (flows.length > 0 && anchor) {
        const per = Math.min(MAX_FLOW_GAP_PX, Math.floor((leftover - 8) / flows.length));
        if (per >= 4) {
          const spacers = flows.map((el) => {
            const spacer = makeSpacer(per);
            el.parentNode.insertBefore(spacer, el);
            return spacer;
          });
          measured = measureBlocks(root, pageHeight);
          const anchorTop = anchor.getBoundingClientRect().top - measured.rootTop;
          const next = breakAfter(start, measured, pageHeight);
          if (anchorTop - start <= pageHeight && next >= anchorTop - 6) {
            y = next;
          } else {
            spacers.forEach((spacer) => spacer.remove());
            measured = measureBlocks(root, pageHeight);
            y = breakAfter(start, measured, pageHeight);
          }
        }
      }
    }
    breaks.push(y);
    start = y;
  }
  return breaks;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

async function buildItineraryPdf({ margins }) {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);

  const root = document.querySelector('[data-itinerary-pdf-root]');
  if (!root) throw new Error('Itinerary not rendered');

  applyPrintStyles();
  document.documentElement.style.background = '#fff';
  document.body.style.background = '#fff';
  await nextFrame();

  const { width: contentWidth, height: pageHeight } = contentSizePx(margins);
  const width = root.offsetWidth;
  // Pagination may add spacers, so the height is read after it.
  const breaks = paginate(root, pageHeight);
  await nextFrame();
  const height = root.scrollHeight;

  const scale = Math.min(2, MAX_CANVAS_PX / height);
  const canvas = await toCanvas(root, {
    width,
    height,
    pixelRatio: scale,
    backgroundColor: '#ffffff',
    // A broken/blocked image shouldn't fail the whole download.
    imagePlaceholder: 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
  });

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const widthMm = (width / contentWidth) * (A4_MM.width - margins.left - margins.right);
  const edges = [0, ...breaks, height];
  for (let i = 0; i < edges.length - 1; i += 1) {
    const sliceTop = edges[i];
    const sliceHeight = edges[i + 1] - sliceTop;
    const page = document.createElement('canvas');
    page.width = canvas.width;
    page.height = Math.max(1, Math.round(sliceHeight * scale));
    const ctx = page.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, page.width, page.height);
    ctx.drawImage(canvas, 0, Math.round(sliceTop * scale), canvas.width, page.height, 0, 0, page.width, page.height);

    if (i > 0) pdf.addPage();
    pdf.addImage(
      page.toDataURL('image/jpeg', 0.92),
      'JPEG',
      margins.left,
      margins.top,
      widthMm,
      sliceHeight / PX_PER_MM,
      undefined,
      'FAST'
    );
  }
  return pdf.output('blob');
}

// Called by the print pages so the hidden-iframe flow above can ask them to
// build the PDF once they've signalled __PDF_READY__.
export function exposeItineraryPdfBuilder() {
  window.__buildItineraryPdf = buildItineraryPdf;
}
