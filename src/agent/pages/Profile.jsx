import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LuBuilding2, LuCircleHelp, LuImage, LuInfo, LuLock, LuSave, LuUserRound } from 'react-icons/lu';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { Badge, Button, ErrorText } from '../components/ui.jsx';

// AUTH-6 "Company profile management" — reuses the existing GET/PATCH
// /agencies/me endpoint (already called by Dashboard.jsx for read access).
// Three cards, each with a round icon and a gold caption: account status,
// password, company details. Currency isn't editable here — an agency's
// currency preference is no longer something agents change.

// Same list the agent Sign Up form offers (Register.jsx).
const COUNTRIES = ['Oman', 'India', 'UAE', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Other'];

const STATUS_TONE = { approved: 'green', pending: 'amber', rejected: 'red', suspended: 'grey' };

const FIELD_CLASS =
  'w-full rounded-lg border border-agent-accent/40 bg-white px-3.5 py-2.5 text-sm text-agent-ink shadow-sm placeholder:text-agent-muted focus:border-agent-accent focus:outline-none focus:ring-2 focus:ring-agent-accent/20 disabled:cursor-not-allowed disabled:bg-agent-panel disabled:text-agent-muted';

function ProfileCard({ icon: Icon, label, description, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-agent-line-light/60 bg-white p-5 shadow-[0_6px_24px_rgba(23,37,84,0.07)] sm:p-6 ${className}`}>
      <div className="flex items-start gap-4">
      <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-agent-accent-soft text-agent-accent-dark">
        <Icon size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-bold text-agent-ink-dark">{label}</h3>
        {description && <p className="mt-1 text-xs leading-5 text-agent-muted">{description}</p>}
        {children}
      </div>
      </div>
    </section>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase text-agent-muted">{label}</span>
      {children}
    </label>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const [agency, setAgency] = useState(null);
  const [form, setForm] = useState({ name: '', country: '', logoAssetUrl: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/agencies/me')
      .then(({ agency: a }) => {
        setAgency(a);
        setForm({
          name: a.name || '',
          country: a.country || '',
          logoAssetUrl: a.logoAssetUrl || '',
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSaving(true);
    try {
      const payload = {};
      if (form.name) payload.name = form.name;
      if (form.country) payload.country = form.country;
      if (form.logoAssetUrl) payload.logoAssetUrl = form.logoAssetUrl;
      const { agency: updated } = await api.patch('/agencies/me', payload);
      setAgency(updated);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Unable to save changes');
    } finally {
      setSaving(false);
    }
  }

  const canEdit = user?.role === 'agency_owner';

  if (loading) {
    return <div className="p-8 text-sm text-agent-muted">Loading…</div>;
  }

  // The saved country stays selectable even if it isn't one of the listed
  // options (older agencies could type anything).
  const countryOptions = form.country && !COUNTRIES.includes(form.country) ? [form.country, ...COUNTRIES] : COUNTRIES;

  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-agent-bg p-5 sm:p-7 lg:p-8">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-agent-accent-soft/50 blur-3xl" />
      <div className="relative mx-auto max-w-6xl space-y-5">
        <div>
          <h2 className="mb-1 text-3xl font-extrabold text-agent-ink-dark">Profile</h2>
          <p className="text-sm text-agent-muted">Your agency's company details, as seen by Xclusive Oman.</p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <ProfileCard icon={LuUserRound} label="Account status" description="Your current account status and ownership details.">
            <div className="mt-3 border-t border-agent-line-light pt-3">
              <Badge tone={STATUS_TONE[agency?.status] || 'grey'} className="!px-3 !text-xs !normal-case">
                <span className="mr-1">●</span><span className="capitalize">{agency?.status || 'Unknown'}</span>
              </Badge>
              <p className="mt-3 text-xs text-agent-muted">Signed in as {user?.fullName} ({user?.email})</p>
              <p className="mt-1 text-xs text-agent-muted capitalize">{user?.role?.replace(/_/g, ' ')}</p>
            </div>
          </ProfileCard>

          <ProfileCard icon={LuLock} label="Password" description={user?.hasPassword === false ? "You haven't set a password yet." : 'Manage the password used to sign in.'}>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="max-w-sm text-xs leading-5 text-agent-muted">Create one to also sign in with your email and password.</p>
              <Link to="/agent/change-password" className="flex-none">
                <Button className="!border-agent-accent !bg-white !text-agent-accent-dark hover:!bg-agent-accent-soft">
                  {user?.hasPassword === false ? 'Create password' : 'Change password'}
                </Button>
              </Link>
            </div>
          </ProfileCard>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
        <ProfileCard icon={LuBuilding2} label="Company details" description="Basic information about your agency, as seen by Xclusive Oman." className="lg:p-6">
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_276px]">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Company name">
              <input
                className={FIELD_CLASS}
                value={form.name}
                disabled={!canEdit}
                onChange={(e) => update('name', e.target.value)}
              />
            </Field>
            <Field label="Country">
              <select
                className={FIELD_CLASS}
                value={form.country}
                disabled={!canEdit}
                onChange={(e) => update('country', e.target.value)}
              >
                {!form.country && <option value="">Select country</option>}
                {countryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Logo URL" className="sm:col-span-2">
              <input
                className={FIELD_CLASS}
                placeholder="https://…"
                value={form.logoAssetUrl}
                disabled={!canEdit}
                onChange={(e) => update('logoAssetUrl', e.target.value)}
              />
              <p className="mt-1 text-[11px] text-agent-muted">Enter the URL of your company logo. This will be used across the platform.</p>
            </Field>
            </div>
            <div className="rounded-xl border border-dashed border-agent-accent/40 bg-agent-panel/40 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-agent-ink-dark">Logo preview <LuInfo size={13} className="text-agent-muted" /></div>
              <div className="mt-3 flex h-28 items-center justify-center overflow-hidden rounded-lg bg-white">
                {form.logoAssetUrl ? <img src={form.logoAssetUrl} alt="Company logo preview" className="max-h-full max-w-full object-contain" /> : <LuImage size={38} className="text-agent-muted/60" />}
              </div>
              <p className="mt-2 text-center text-[11px] text-agent-muted">Your logo will appear here</p>
            </div>
          </div>
          {!canEdit && (
            <p className="mt-3 text-xs text-agent-muted">Only the agency owner can edit company details.</p>
          )}
        </ProfileCard>

        <ErrorText>{error}</ErrorText>
        {success && <p className="text-xs font-semibold text-[#227647]">Saved.</p>}
        {canEdit && (
          <div className="flex items-center justify-between rounded-2xl border border-agent-line-light/60 bg-white p-4 shadow-[0_6px_24px_rgba(23,37,84,0.07)]">
          <Button variant="accent" type="submit" disabled={saving} className="gap-2 !px-6 !py-3 !text-sm">
            <LuSave size={16} />
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          <span className="hidden items-center gap-2 rounded-lg bg-agent-accent-soft px-4 py-3 text-xs text-agent-muted sm:flex"><LuCircleHelp size={15} className="text-agent-accent-dark" />Your changes will be updated across the platform.</span>
          </div>
        )}
      </form>
      </div>
    </div>
  );
}
