import { useEffect, useState } from 'react';
import { FiImage, FiTrash2 } from 'react-icons/fi';
import { api } from '../api/client.js';
import { Button, Card, ErrorText } from '../components/ui.jsx';
import { ImageUpload } from '../../shared/components/ImageUpload.jsx';
import { SIDEBAR_CATEGORY } from '../../agent/components/SidebarBackground.jsx';

export default function AgentSidebarAppearance() {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const current = item?.imageUrl || item?.image_url || '';

  useEffect(() => {
    api.get('/admin/gallery').then((data) => {
      setItem((data.gallery || data.items || []).find((entry) => (entry.category || entry.type) === SIDEBAR_CATEGORY) || null);
    }).catch((err) => setError(err.message || 'Unable to load sidebar appearance.')).finally(() => setLoading(false));
  }, []);

  async function uploadImage(file) {
    const form = new FormData();
    form.append('image', file);
    const result = await api.postForm('/admin/gallery/image', form);
    return result.url;
  }

  async function save(url) {
    setError(''); setSaving(true);
    try {
      if (!url) {
        if (item?.id) await api.del(`/admin/gallery/${item.id}`);
        setItem(null);
      } else {
        const payload = { category: SIDEBAR_CATEGORY, title: 'Agent sidebar background', imageUrl: url };
        const result = item?.id ? await api.patch(`/admin/gallery/${item.id}`, payload) : await api.post('/admin/gallery', payload);
        setItem(result.galleryItem || result.item || result.gallery);
      }
    } catch (err) { setError(err.message || 'Unable to save sidebar appearance.'); throw err; }
    finally { setSaving(false); }
  }

  return <div className="space-y-5">
    <div><h1 className="text-2xl font-bold text-ink">Sidebar Image</h1><p className="mt-1 max-w-2xl text-sm text-muted">Manage the background image displayed in the Xclusive Oman Agent Panel sidebar.</p></div>
    <Card className="overflow-hidden border-[#D7DDF0] p-0">
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,1fr)]">
        <div className="relative min-h-72 overflow-hidden rounded-xl bg-gradient-to-b from-[#E9A52F] via-[#8A531D] to-[#633A16]">
          {current && <img src={current} alt="Current agent sidebar background" className="absolute inset-0 h-full w-full object-cover object-bottom" onError={() => setItem(null)} />}
          <div className="absolute inset-0 bg-gradient-to-b from-[#633A16]/85 via-transparent to-[#241106]/60" />
          <div className="relative flex h-full items-end p-5 text-white"><div><div className="text-lg font-bold">Xclusive Oman</div><div className="mt-1 text-xs text-white/75">{current ? 'Custom background active' : 'Default solid gold design'}</div></div></div>
        </div>
        <div className="space-y-4">
          {loading ? <p className="text-sm text-muted">Loading current image…</p> : <ImageUpload label="Sidebar background image" value={current} onChange={(url) => save(url || '')} onUpload={uploadImage} disabled={saving} hint="JPG, JPEG, PNG or WebP. A wide landscape image works best; it will be cropped toward the bottom." />}
          {current && <Button type="button" disabled={saving} onClick={() => save('')} className="!border-rose-200 !bg-white !text-rose-700 hover:!bg-rose-50"><FiTrash2 size={14} /> Remove image</Button>}
          <ErrorText>{error}</ErrorText>
          <p className="text-[11px] text-muted">The image is used in both expanded and collapsed agent sidebars. If it is removed or cannot load, the solid gold design remains active.</p>
        </div>
      </div>
    </Card>
  </div>;
}
