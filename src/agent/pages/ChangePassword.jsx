import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setAccessToken } from '../api/client.js';
import { Button, Card, ErrorText, FieldLabel, TextInput } from '../components/ui.jsx';

// Profile → "Change password". Its own page (not a modal on the Profile):
//   - the account has a password: current password, then new + confirm;
//   - the account has none yet (it signs in with emailed codes): the same
//     page says "Create password" and only asks for new + confirm.
// POST /auth/change-password signs every other device out and hands back a
// fresh access token for this one, which replaces the old one here.
const RULE_TEXT = 'Use 8–64 characters, including at least one letter and one number.';

function PasswordField({ label, value, onChange, autoComplete, autoFocus }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <TextInput
        type="password"
        required
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export default function ChangePassword() {
  const navigate = useNavigate();
  // null while loading; then whether this account already has a password.
  const [hasPassword, setHasPassword] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/auth/me')
      .then(({ user }) => setHasPassword(Boolean(user.hasPassword)))
      .catch((err) => setLoadError(err.message || 'Unable to load your account'));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8 || newPassword.length > 64 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError(RULE_TEXT);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The new password and the confirmation do not match.');
      return;
    }
    setSaving(true);
    try {
      const result = await api.post('/auth/change-password', {
        ...(hasPassword ? { currentPassword } : {}),
        newPassword,
      });
      // The server revoked every earlier token and issued this fresh one.
      if (result.accessToken) setAccessToken(result.accessToken);
      setDone(result.message || (hasPassword ? 'Your password has been changed.' : 'Your password has been created.'));
      setHasPassword(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Unable to save your password');
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-xl p-5 lg:p-8">
        <ErrorText>{loadError}</ErrorText>
      </div>
    );
  }
  if (hasPassword === null) {
    return <div className="p-8 text-sm text-agent-muted">Loading…</div>;
  }

  const creating = !hasPassword && !done;

  return (
    <div className="mx-auto max-w-xl space-y-5 p-5 lg:p-8">
      <Link to="/agent/profile" className="inline-block text-xs text-agent-muted hover:text-agent-ink">
        ← Back to profile
      </Link>
      <div>
        <h2 className="mb-1 text-2xl font-bold text-agent-ink">{creating ? 'Create password' : 'Change password'}</h2>
        <p className="text-sm text-agent-muted">
          {creating
            ? "You don't have a password yet — you've been signing in with emailed codes. Create one to also sign in with your email and password."
            : 'Enter your current password, then choose a new one. You’ll be signed out of your other devices.'}
        </p>
      </div>

      <Card className="border-white">
        {done ? (
          <div className="space-y-4">
            <p className="rounded-md border border-[#bfe3cc] bg-[#f3fbf6] px-3 py-2.5 text-sm font-semibold text-[#1f6b3f]">
              {done}
            </p>
            <Button variant="accent" onClick={() => navigate('/agent/profile')}>
              Back to profile
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {hasPassword && (
              <PasswordField
                label="Current password"
                value={currentPassword}
                onChange={setCurrentPassword}
                autoComplete="current-password"
                autoFocus
              />
            )}
            <PasswordField
              label="New password"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
              autoFocus={!hasPassword}
            />
            <PasswordField
              label="Confirm new password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />
            <p className="text-xs text-agent-muted">{RULE_TEXT}</p>
            <ErrorText>{error}</ErrorText>
            <div className="flex flex-wrap gap-2">
              <Button variant="accent" type="submit" disabled={saving}>
                {saving ? 'Saving…' : creating ? 'Create password' : 'Change password'}
              </Button>
              <Button type="button" onClick={() => navigate('/agent/profile')} disabled={saving}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
