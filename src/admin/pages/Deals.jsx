import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Button, Card, ErrorText, FieldLabel, Table, TextInput } from '../components/ui.jsx';
import { ImageUpload } from '../../shared/components/ImageUpload.jsx';

// Admin sidebar "Deals" tab (see 0082_deals.sql) — admin-uploaded promo card
// photos for the agent dashboard's "Deals For You" carousel (agent/pages/
// Dashboard.jsx's own PLACEHOLDER_DEAL, swapped out for this once real
// content exists). A plain growable list, same "add form + list with
// edit/delete" shape MiceCatalog.jsx's own Oman Overview tab already uses —
// no draft state, every field required up front except duration.
const EMPTY_DEAL_FORM = { title: '', duration: '', imageUrl: '' };

// The agent "Deals For You" banner (agent/pages/Dashboard.jsx) is an 8:3
// frame on tablet/desktop, so photos in that shape fill it edge to edge with
// nothing cropped. Below MIN the banner gets upscaled and looks soft on
// large/retina screens, so those uploads are rejected outright; an off-ratio
// photo is still accepted (the banner letterboxes it rather than cropping)
// but the admin is warned.
const DEAL_IMAGE = {
  recommendedWidth: 1920,
  recommendedHeight: 720,
  minWidth: 1600,
  minHeight: 600,
  ratio: 8 / 3,
  ratioTolerance: 0.1,
};
const DEAL_IMAGE_GUIDE = `Recommended ${DEAL_IMAGE.recommendedWidth} × ${DEAL_IMAGE.recommendedHeight} px (8:3 landscape), minimum ${DEAL_IMAGE.minWidth} × ${DEAL_IMAGE.minHeight} px. JPG or WebP, under 5MB. Keep the main subject centred — the title and duration are overlaid at the top and bottom.`;

function readImageSize(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      reject(new Error('Unable to read this image.'));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

function describeRatioMismatch({ width, height }) {
  const ratio = width / height;
  if (Math.abs(ratio - DEAL_IMAGE.ratio) / DEAL_IMAGE.ratio <= DEAL_IMAGE.ratioTolerance) return '';
  return `This photo is ${width} × ${height} px, not 8:3 — it will still fill the banner, but its ${
    ratio > DEAL_IMAGE.ratio ? 'left and right sides' : 'top and bottom'
  } will be trimmed to fit. Check the preview below, or crop it to ${DEAL_IMAGE.recommendedWidth} × ${DEAL_IMAGE.recommendedHeight} px.`;
}

function dealToForm(item) {
  return {
    title: item.title || '',
    duration: item.duration || '',
    imageUrl: item.imageUrl ?? item.image_url ?? '',
  };
}

function validateDealForm(form) {
  if (!form.title.trim()) return 'Title is required.';
  if (!form.imageUrl) return 'Upload a photo.';
  return '';
}

// Re-mounted (key={editingItem?.id || 'new'} in DealsTab below) on every
// edit/cancel-edit, same convention OmanOverviewForm already uses, so a
// half-filled entry never ends up submitted against the wrong row.
function DealForm({ editingItem, onSaved, onCancelEdit }) {
  const [form, setForm] = useState(() => (editingItem ? dealToForm(editingItem) : EMPTY_DEAL_FORM));
  const [error, setError] = useState('');
  const [imageWarning, setImageWarning] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Same shared picker every other catalog upload uses (ActivityImagesUpload
  // etc.), single-file mode — see its own POST /admin/deals/image endpoint
  // (catalog.controller.js). Dimensions are checked first; a throw here
  // surfaces in ImageUpload's own error line and nothing is uploaded.
  async function uploadImage(file) {
    setImageWarning('');
    if (file.type !== 'image/svg+xml') {
      const size = await readImageSize(file);
      if (size.width < DEAL_IMAGE.minWidth || size.height < DEAL_IMAGE.minHeight) {
        throw new Error(
          `${file.name} is ${size.width} × ${size.height} px — too small, it would look blurry on the banner. Use at least ${DEAL_IMAGE.minWidth} × ${DEAL_IMAGE.minHeight} px (ideally ${DEAL_IMAGE.recommendedWidth} × ${DEAL_IMAGE.recommendedHeight}).`,
        );
      }
      setImageWarning(describeRatioMismatch(size));
    }
    const formData = new FormData();
    formData.append('image', file);
    const { url } = await api.postForm('/admin/deals/image', formData);
    return url;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationError = validateDealForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const payload = { title: form.title.trim(), duration: form.duration.trim(), imageUrl: form.imageUrl };
      const { deal: saved } = editingItem
        ? await api.patch(`/admin/deals/${editingItem.id}`, payload)
        : await api.post('/admin/deals', payload);
      onSaved(saved);
      if (!editingItem) setForm(EMPTY_DEAL_FORM);
    } catch (err) {
      setError(err.message || 'Unable to save deal');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card label={editingItem ? 'Edit deal' : 'Add deal'} className="mt-4 border-white">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <FieldLabel>Title *</FieldLabel>
          <TextInput required value={form.title} onChange={(e) => update('title', e.target.value)} />
        </div>
        <div>
          <FieldLabel>Duration</FieldLabel>
          <TextInput
            placeholder="e.g. 4N | 5D"
            value={form.duration}
            onChange={(e) => update('duration', e.target.value)}
          />
        </div>
        <ImageUpload
          label="Card photo"
          required
          description={DEAL_IMAGE_GUIDE}
          acceptedTypes={['image/jpeg', 'image/png', 'image/webp']}
          acceptHint="JPG, PNG, WebP"
          value={form.imageUrl}
          onChange={(url) => {
            update('imageUrl', url);
            if (!url) setImageWarning('');
          }}
          onUpload={uploadImage}
        />
        {imageWarning && (
          <p className="rounded-md border border-[#f5d9a8] bg-[#fffaf0] px-3 py-2 text-xs text-[#8a5a00]">{imageWarning}</p>
        )}
        {form.imageUrl && (
          <div>
            <FieldLabel>Banner preview (desktop 8:3)</FieldLabel>
            <div className="relative aspect-[8/3] w-full max-w-xl overflow-hidden rounded-xl bg-[#0B1130]">
              {/* Same as the agent dashboard banner: fills the frame, centred. */}
              <img src={form.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
            </div>
          </div>
        )}
        <ErrorText>{error}</ErrorText>
        <div className="flex items-center gap-3">
          <Button variant="accent" type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : editingItem ? 'Save changes' : 'Add deal'}
          </Button>
          {editingItem && (
            <button type="button" onClick={onCancelEdit} className="text-xs font-semibold text-[#666] hover:underline">
              Cancel
            </button>
          )}
        </div>
      </form>
    </Card>
  );
}

function DealsTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState(null);

  function load() {
    setLoading(true);
    api
      .get('/deals')
      .then((data) => setItems(data.deals))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleDelete(id) {
    await api.del(`/admin/deals/${id}`);
    setItems((list) => list.filter((i) => i.id !== id));
    if (editingItem?.id === id) setEditingItem(null);
  }

  function handleSaved(saved) {
    setItems((list) => (list.some((i) => i.id === saved.id) ? list.map((i) => (i.id === saved.id ? saved : i)) : [saved, ...list]));
    setEditingItem(null);
  }

  return (
    <div>
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : (
        <Table
          columns={['Photo', 'Title', 'Duration', '']}
          rows={items}
          renderRow={(item) => {
            const imageUrl = item.imageUrl ?? item.image_url;
            return (
              <tr key={item.id} className="border-b border-line-light last:border-0">
                <td className="px-3 py-2">
                  <img src={imageUrl} alt="" className="aspect-[8/3] h-12 rounded-md border border-line-light object-cover" />
                </td>
                <td className="px-3 py-2 font-semibold">{item.title}</td>
                <td className="px-3 py-2">{item.duration || '—'}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-3">
                    <button onClick={() => setEditingItem(item)} className="text-accent hover:underline">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="text-[#a5162d] hover:underline">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          }}
        />
      )}
      {!loading && items.length === 0 && (
        <p className="mt-3 rounded-lg border border-line-light bg-panel px-3 py-3 text-xs text-muted">
          No deals yet — add one below.
        </p>
      )}
      <DealForm
        key={editingItem?.id || 'new'}
        editingItem={editingItem}
        onSaved={handleSaved}
        onCancelEdit={() => setEditingItem(null)}
      />
    </div>
  );
}

export default function Deals() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-5 lg:p-8">
      <div>
        <h2 className="mb-1 text-2xl font-bold text-ink">Deals</h2>
        <p className="text-sm text-muted">
          Promo card photos shown in the agent portal's "Deals For You" carousel — upload a landscape photo of{' '}
          <strong>
            {DEAL_IMAGE.recommendedWidth} × {DEAL_IMAGE.recommendedHeight} px
          </strong>{' '}
          (8:3) so it fills the banner on every screen without cropping or pixelation.
        </p>
      </div>
      <DealsTab />
    </div>
  );
}
