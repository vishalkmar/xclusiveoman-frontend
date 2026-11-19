import { useRef, useState } from 'react';
import { FiFileText, FiLink, FiUploadCloud, FiX } from 'react-icons/fi';

// Portal-agnostic file/image picker — moved here from
// admin/components/ImageUpload.jsx (its original home, when it only served
// the admin Catalog image pickers: FD package hero + carousel, Activity/
// Tour/Hotel/Transfer galleries). Colors are literal hex here rather than
// the admin-only `ink`/`accent`/`panel`/`line-light`/`muted` Tailwind tokens
// (unchanged values, just spelled out) so the same widget renders
// consistently no matter which portal's palette is active around it —
// e.g. src/agent/pages/Register.jsx's IATA/GST/Company Registration
// document picker.
//
// - `multiple: false` (default) — single file picker. `value` is a URL
//   string or empty; `onUpload(file)` resolves to the uploaded URL.
// - `multiple: true` — gallery picker. `value` is an array of URLs;
//   `onUpload(files)` resolves to the *next full array* of URLs (so each
//   caller decides whether its endpoint returns the whole list or just the
//   newly-added ones and merges accordingly). Gallery mode stays
//   images-only regardless of `acceptedTypes` — its thumbnails assume `<img>`.
// - `acceptedTypes` / `acceptHint` / `maxBytes` widen the single-file picker
//   past the image-only default — e.g. Register.jsx also allows PDF. When
//   the accepted types aren't image-only, wording switches from
//   "image" to "file" and a non-image value renders as a document chip
//   instead of a broken `<img>`.
//
// Adding a file "from a link" or by pasting a URL never calls `onUpload` —
// the link is already a hosted URL, so it's added straight to `value`.
const DEFAULT_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const DEFAULT_ACCEPT_HINT = 'JPG, PNG, WebP, GIF, SVG';
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|svg)(\?|#|$)/i;

function isLikelyUrl(text) {
  return /^https?:\/\/\S+$/i.test(text.trim());
}

function isImageUrl(url) {
  return IMAGE_EXT_RE.test(url || '');
}

// The label as it reads mid-sentence ("Drag & drop hero image…"): only an
// ordinary capitalised first word is lowercased, so acronyms survive —
// "PDF document" / "GST document" stay as they are.
function inlineLabel(label) {
  return /^[A-Z][a-z]/.test(label) ? label[0].toLowerCase() + label.slice(1) : label;
}

function FieldLabel({ children }) {
  return <div className="mb-1.5 text-[11px] font-semibold uppercase text-[#64748B]">{children}</div>;
}

function ErrorText({ children }) {
  if (!children) return null;
  return <p className="rounded-md border border-[#f2bdc6] bg-[#fff7f8] px-3 py-2 text-xs text-[#a5162d]">{children}</p>;
}

// Checked client-side before every upload so a bad file never round-trips to
// the server just to be rejected — the backend enforces its own rules too.
function describeInvalidFile(file, acceptedTypes, acceptHint, maxBytes) {
  if (!acceptedTypes.includes(file.type)) {
    return `${file.name}: unsupported format. Use ${acceptHint}.`;
  }
  if (file.size > maxBytes) {
    return `${file.name}: file is larger than ${Math.round((maxBytes / (1024 * 1024)) * 10) / 10}MB.`;
  }
  return null;
}

/**
 * Drag & drop / click-to-browse / paste (file data or a link) file picker.
 */
export function ImageUpload({
  label,
  required = false,
  multiple = false,
  value,
  onChange,
  onUpload,
  onRemove,
  disabled = false,
  disabledHint,
  hint,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  acceptHint = DEFAULT_ACCEPT_HINT,
  maxBytes = DEFAULT_MAX_BYTES,
  // Highlight colour for the "Add … from a link" button, the drag-over state
  // and the link input's focus — admin indigo by default; the agent Sign Up
  // passes its own orange (AuthShell.jsx's AUTH_ACCENT) so it matches.
  accentColor = '#4F46E5',
  // Optional line under the label.
  description,
  // 'compact' (default) — the original layout every caller already uses.
  // 'stacked' — the dropzone always stays on top (picking a new file
  // replaces a single image, exactly like "Change image" did) and larger
  // previews sit underneath it. Purely visual; upload/remove/link behave
  // the same in both.
  layout = 'compact',
  // Overrides the outer wrapper's classes (default keeps gallery mode's
  // sm:col-span-2 for callers that drop it into a 2-col grid).
  wrapperClassName,
}) {
  const stacked = layout === 'stacked';
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [removingUrl, setRemovingUrl] = useState('');
  const inputRef = useRef(null);

  const acceptAttr = acceptedTypes.join(',');
  const maxMb = Math.round((maxBytes / (1024 * 1024)) * 10) / 10;
  // Gallery mode is always images; single-file mode is "images" only when
  // the caller kept the image-only default — used purely for copy below
  // ("image" vs "file") so existing admin image pickers read exactly as
  // they did before this widget could also take PDFs.
  const isImageOnly = multiple || acceptedTypes.every((t) => t.startsWith('image/'));

  const images = multiple ? value || [] : [];
  const hasValue = multiple ? images.length > 0 : !!value;
  const busy = disabled || uploading;

  async function uploadFiles(files) {
    if (!files.length) return;
    const invalid = files.map((f) => describeInvalidFile(f, acceptedTypes, acceptHint, maxBytes)).find(Boolean);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError('');
    setUploading(true);
    try {
      if (multiple) {
        onChange(await onUpload(files));
      } else {
        onChange(await onUpload(files[0]));
      }
    } catch (err) {
      setError(err.message || `Unable to upload ${isImageOnly ? 'image' : 'file'}`);
    } finally {
      setUploading(false);
    }
  }

  function handleInputChange(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // allow re-selecting the same file later
    uploadFiles(files);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) uploadFiles(multiple ? files : files.slice(0, 1));
  }

  function handlePaste(e) {
    if (busy) return;
    const files = Array.from(e.clipboardData?.files || []);
    if (files.length) {
      e.preventDefault();
      uploadFiles(multiple ? files : files.slice(0, 1));
      return;
    }
    const text = e.clipboardData?.getData('text');
    if (text && isLikelyUrl(text)) {
      e.preventDefault();
      addLink(text);
    }
  }

  function addLink(url) {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!isLikelyUrl(trimmed)) {
      setError('Enter a valid link (starting with http:// or https://).');
      return;
    }
    setError('');
    onChange(multiple ? [...images, trimmed] : trimmed);
    setLinkValue('');
    setLinkOpen(false);
  }

  async function removeImage(url) {
    if (!onRemove) {
      onChange(images.filter((u) => u !== url));
      return;
    }
    setError('');
    setRemovingUrl(url);
    try {
      await onRemove(url);
    } catch (err) {
      setError(err.message || 'Unable to remove image');
    } finally {
      setRemovingUrl('');
    }
  }

  const thumbnails = multiple && images.length > 0 && (
    <div className={stacked ? 'mt-3 flex flex-wrap gap-3' : 'mb-2 flex flex-wrap gap-2'}>
      {images.map((url) => (
        <div
          key={url}
          className={`group relative flex-none ${stacked ? 'h-24 w-32 overflow-hidden rounded-lg shadow-sm ring-1 ring-[#E4E9FB]' : 'h-20 w-20'}`}
        >
          <img
            src={url}
            alt=""
            className={stacked ? 'h-full w-full object-cover transition duration-200 group-hover:scale-105' : 'h-20 w-20 rounded-md border border-[#E4E9FB] object-cover'}
          />
          <button
            type="button"
            onClick={() => removeImage(url)}
            disabled={removingUrl === url}
            title="Remove image"
            className={
              stacked
                ? 'absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#172554] shadow-md transition hover:bg-[#FEF2F2] hover:text-[#DC2626] disabled:opacity-50'
                : 'absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-[#172554] bg-white text-[#172554] shadow-sm hover:bg-[#F3F4FF] disabled:opacity-50'
            }
          >
            {removingUrl === url ? '…' : <FiX size={stacked ? 13 : 11} />}
          </button>
          {url === images[0] && (
            <span
              className={`absolute bottom-0 left-0 right-0 bg-[#172554]/80 py-0.5 text-center font-semibold uppercase text-white ${
                stacked ? 'text-[9px] tracking-wide' : 'rounded-b-md text-[8px]'
              }`}
            >
              Primary
            </span>
          )}
        </div>
      ))}
    </div>
  );

  const changeRow = (
    <div className="flex items-center gap-3">
      {isImageUrl(value) ? (
        <img src={value} alt="" className="h-16 w-16 flex-none rounded-md border border-[#E4E9FB] object-cover" />
      ) : (
        <div className="flex h-16 w-16 flex-none items-center justify-center rounded-md border border-[#E4E9FB] bg-[#F3F4FF]">
          <FiFileText size={24} className="text-[#64748B]" />
        </div>
      )}
      <label
        className={`inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-xs font-semibold shadow-sm ${
          busy
            ? 'cursor-not-allowed border-[#E4E9FB] bg-[#F3F4FF] text-[#64748B]'
            : 'border-[#E4E9FB] bg-white text-[#172554] hover:border-[#172554] hover:bg-[#F3F4FF]'
        }`}
      >
        {uploading ? 'Uploading…' : isImageOnly ? 'Change image' : 'Change file'}
        <input ref={inputRef} type="file" accept={acceptAttr} className="hidden" disabled={busy} onChange={handleInputChange} />
      </label>
    </div>
  );

  // Stacked single-file preview: the dropzone above already handles
  // replacing it, so this is just the picture.
  const singlePreview = stacked && !multiple && hasValue && (
    <div className="mt-3">
      {isImageUrl(value) ? (
        <img src={value} alt="" className="h-28 w-44 rounded-lg object-cover shadow-sm ring-1 ring-[#E4E9FB]" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-md border border-[#E4E9FB] bg-[#F3F4FF]">
          <FiFileText size={24} className="text-[#64748B]" />
        </div>
      )}
    </div>
  );

  const dropzone = (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onPaste={handlePaste}
      onClick={() => !busy && inputRef.current?.click()}
      role="button"
      tabIndex={busy ? -1 : 0}
      className={`flex flex-col items-center justify-center gap-1 border border-dashed px-4 text-center transition ${
        stacked ? 'rounded-lg py-7' : 'rounded-md py-8'
      } ${
        busy
          ? 'cursor-not-allowed border-[#E4E9FB] bg-[#F3F4FF]/40'
          : `cursor-pointer ${
              dragging
                ? 'border-[var(--upload-accent)] bg-[color-mix(in_srgb,var(--upload-accent)_5%,transparent)]'
                : stacked
                  ? 'border-[#C7D2FE] bg-[#FAFBFF] hover:border-[var(--upload-accent)] hover:bg-[color-mix(in_srgb,var(--upload-accent)_4%,transparent)]'
                  : 'border-[#E4E9FB] hover:border-[#172554]'
            }`
      }`}
    >
      <FiUploadCloud
        aria-hidden
        size={stacked ? 28 : 26}
        className={stacked ? 'text-[var(--upload-accent)]' : 'text-[#64748B]'}
      />
      <p className={`text-xs font-semibold text-[#172554] sm:text-sm ${stacked ? 'mt-1' : ''}`}>
        {uploading
          ? 'Uploading…'
          : multiple
            ? 'Add multiple images — drag & drop, browse, or paste links'
            : `Drag & drop ${label ? inlineLabel(label) : isImageOnly ? 'an image' : 'a file'}, click to browse, or paste a link`}
      </p>
      <p className="text-[10px] text-[#64748B] sm:text-[11px]">
        Accepted: {acceptHint} · max {maxMb}MB
      </p>
      <input ref={inputRef} type="file" accept={acceptAttr} multiple={multiple} className="hidden" disabled={busy} onChange={handleInputChange} />
    </div>
  );

  const linkRow = (
    <div className="mt-1.5">
      {linkOpen ? (
        <div className="flex gap-1.5">
          <input
            autoFocus
            type="text"
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addLink(linkValue);
              }
              if (e.key === 'Escape') setLinkOpen(false);
            }}
            placeholder="https://…"
            className="flex-1 rounded-md border border-[#E4E9FB] bg-white px-2.5 py-1.5 text-xs text-[#172554] shadow-sm focus:border-[var(--upload-accent)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--upload-accent)_15%,transparent)]"
          />
          <button
            type="button"
            onClick={() => addLink(linkValue)}
            className="flex-none rounded-md border border-[#E4E9FB] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#172554] shadow-sm hover:border-[#172554]"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setLinkOpen(false);
              setLinkValue('');
            }}
            className="flex-none text-xs text-[#64748B] hover:text-[#172554]"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setLinkOpen(true)}
          disabled={disabled}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--upload-accent)] hover:underline disabled:cursor-not-allowed disabled:text-[#64748B] disabled:no-underline"
        >
          <FiLink size={12} />
          Add {isImageOnly ? 'image' : 'file'} from a link
        </button>
      )}
    </div>
  );

  return (
    <div
      className={wrapperClassName ?? (multiple ? 'sm:col-span-2' : '')}
      style={{ '--upload-accent': accentColor }}
    >
      {stacked ? (
        <div className="mb-2">
          <div className="text-xs font-semibold text-[#334155]">
            {label}
            {required && <span className="ml-0.5 text-[#F43F5E]">*</span>}
          </div>
          {description && <p className="mt-0.5 text-[11px] text-[#64748B]">{description}</p>}
        </div>
      ) : (
        <>
          <FieldLabel>
            {label}
            {required ? ' *' : ''}
          </FieldLabel>
          {description && <p className="-mt-1 mb-1.5 text-[11px] text-[#64748B]">{description}</p>}
        </>
      )}

      {stacked ? (
        <>
          {dropzone}
          {linkRow}
          {thumbnails}
          {singlePreview}
        </>
      ) : (
        <>
          {thumbnails}
          {!multiple && hasValue ? changeRow : dropzone}
          {linkRow}
        </>
      )}

      {disabled && disabledHint && <p className="mt-1 text-[10px] text-[#64748B]">{disabledHint}</p>}
      {hint && <p className="mt-1 text-[10px] text-[#64748B]">{hint}</p>}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
