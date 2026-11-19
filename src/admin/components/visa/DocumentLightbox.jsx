import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LuDownload, LuExternalLink, LuX } from 'react-icons/lu';

// Full-size view of one document — a traveller photo, a passport page or an
// image visa — with open-in-new-tab and download. `doc` = { url, title,
// subtitle } or null (closed). Esc / backdrop click closes it.
export function DocumentLightbox({ doc, onClose }) {
  useEffect(() => {
    if (!doc) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doc, onClose]);

  return createPortal(
    <AnimatePresence>
      {doc && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0F172A]/80 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={doc.title}
        >
          <motion.div
            className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            initial={{ scale: 0.96, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 10 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-line-light px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-ink">{doc.title}</div>
                {doc.subtitle && <div className="truncate text-[11px] text-muted">{doc.subtitle}</div>}
              </div>
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line-light text-muted hover:border-accent hover:text-accent"
                aria-label="Open in a new tab"
              >
                <LuExternalLink size={15} />
              </a>
              <a
                href={downloadUrl(doc.url)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line-light text-muted hover:border-accent hover:text-accent"
                aria-label="Download"
              >
                <LuDownload size={15} />
              </a>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-panel hover:text-ink"
                aria-label="Close"
              >
                <LuX size={17} />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#F1F5F9] p-4">
              <img src={doc.url} alt={doc.title} className="max-h-[75vh] max-w-full rounded-lg object-contain shadow" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

// Cloudinary download link: fl_attachment on image URLs makes the browser
// save the file instead of opening it. Raw files (PDF visas) and other
// hosts are returned as-is.
export function downloadUrl(url) {
  if (!url) return url;
  return url.replace('/image/upload/', '/image/upload/fl_attachment/');
}
