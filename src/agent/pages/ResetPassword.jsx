import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiLock } from 'react-icons/fi';
import { api } from '../api/client.js';
import { ErrorText } from '../components/ui.jsx';
import AuthShell, { AUTH_ACCENT, AuthButton, AuthFieldLabel, AuthTextInput } from '../components/AuthShell.jsx';

// Public page behind the emailed "Forgot password" link
// (/agent/reset-password?token=…): choose a new password, confirm it, done.
// The link is single-use and expires after 30 minutes; the server says so
// when it's invalid, and the person is pointed back to sign-in to ask again.
const RULE_TEXT = 'Use 8–64 characters, including at least one letter and one number.';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [linkProblem, setLinkProblem] = useState(!/^[a-f0-9]{64}$/i.test(token));
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8 || password.length > 64 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError(RULE_TEXT);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, password }, { skipAuth: true });
      setDone(true);
    } catch (err) {
      if (err.data?.error === 'invalid_or_expired_token') setLinkProblem(true);
      else setError(err.message || 'Unable to reset your password');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <AuthShell title="Password changed" tagline="Your trade gateway to exclusive Oman experiences">
        <div className="text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#e9f7ef] text-lg text-[#227647]">
            ✓
          </div>
          <h2 className="mt-3 text-xl font-bold text-slate-900">Password changed</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Your password has been updated and your other devices were signed out. Sign in with your new password.
          </p>
          <Link to="/agent" className="mt-6 block">
            <AuthButton type="button">Go to Sign In</AuthButton>
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (linkProblem) {
    return (
      <AuthShell title="Link not valid" tagline="Your trade gateway to exclusive Oman experiences">
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-900">This reset link isn't valid</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            It may have expired (links last 30 minutes) or already been used. Go to Sign In, choose “Sign in with
            password”, then “Forgot password?” to get a new link.
          </p>
          <Link to="/agent" className="mt-6 block">
            <AuthButton type="button">Back to Sign In</AuthButton>
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Agent Portal"
      title="Choose a new password"
      subtitle="Pick a password you haven't used elsewhere."
      tagline="Your trade gateway to exclusive Oman experiences"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <AuthFieldLabel>New password</AuthFieldLabel>
          <AuthTextInput
            icon={FiLock}
            type="password"
            required
            autoFocus
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <AuthFieldLabel>Confirm new password</AuthFieldLabel>
          <AuthTextInput
            icon={FiLock}
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-slate-500">{RULE_TEXT}</p>
        </div>
        <ErrorText>{error}</ErrorText>
        <AuthButton type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Set new password'}
        </AuthButton>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        <Link to="/agent" className="font-semibold hover:underline" style={{ color: AUTH_ACCENT }}>
          Back to Sign In
        </Link>
      </p>
    </AuthShell>
  );
}
