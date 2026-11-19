import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiBriefcase, FiHash, FiMail, FiPhone, FiUser } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { ErrorText } from '../components/ui.jsx';
import AuthShell, { AUTH_ACCENT, AuthButton, AuthFieldLabel, AuthSelect, AuthTextInput } from '../components/AuthShell.jsx';
import { ImageUpload } from '../../shared/components/ImageUpload.jsx';

const COUNTRIES = ['Oman', 'India', 'UAE', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Other'];

// jpg/jpeg files report as image/jpeg — there's no separate "image/jpg" MIME
// type — so this list already covers everything the label promises. Mirrors
// the backend's own allow-list (middleware/upload.js), which additionally
// allows image/webp; not offered here since it wasn't asked for, but a webp
// file wouldn't be rejected server-side if someone renamed one past this
// accept filter.
const LICENSE_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const LICENSE_ACCEPT_HINT = 'JPG, PNG, PDF';

// Business proof the agency can register with — values match the backend's
// registerSchema / agencies.license_document_type enum.
// `numberLabel` titles the number field; `numberText` is the same phrase as
// it reads mid-sentence (placeholder / error), keeping acronyms upper-case.
const DOCUMENT_TYPES = [
  { value: 'iata', label: 'IATA', numberLabel: 'IATA number', numberText: 'IATA number' },
  { value: 'gst', label: 'GST', numberLabel: 'GST number', numberText: 'GST number' },
  {
    value: 'company_registration',
    label: 'Company Registration',
    numberLabel: 'Company registration number',
    numberText: 'company registration number',
  },
];

// Optional company logo — images only (the backend's /register/logo
// refuses anything else).
const LOGO_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const LOGO_ACCEPT_HINT = 'JPG, PNG, WebP';

const FOOTER_NOTE = "By creating an account, you agree to Xclusive Oman's current Terms of Service and Privacy Policy.";

// No password field — nothing in this app ever collects one anymore. Once
// approved, the new owner signs in the same way everyone else does: email
// OTP (LoginModal.jsx), using this same email address.
//
// Agency Type is no longer a choice here — MICE Company self-signup was
// dropped (every new registration is a Travel Agent; MICE-type agencies are
// still created another way, admin-side, unaffected by this) — so
// agencyType is just a fixed constant, not form state with a picker.
const AGENCY_TYPE = 'travel_agent';

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({
    agencyName: '',
    country: 'Oman',
    ownerFullName: '',
    email: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Business proof — all mandatory: the document type (IATA / GST / Company
  // Registration), the document itself (jpg/png/jpeg/pdf) and its number.
  // Files are uploaded immediately on selection (same upload-then-submit-the-URL
  // pattern as every other file upload in this app, e.g. Payment.jsx's NEFT
  // slip) rather than deferred to form submit, so the Sign Up form itself
  // stays a plain JSON POST. The shared ImageUpload component owns the
  // uploading/error state around that upload itself — this only needs to
  // remember the resulting URL.
  const [licenseDocumentUrl, setLicenseDocumentUrl] = useState('');
  const [licenseDocumentType, setLicenseDocumentType] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  // Optional — uploaded the same way, through the same shared ImageUpload.
  const [logoUrl, setLogoUrl] = useState('');

  const documentType = DOCUMENT_TYPES.find((t) => t.value === licenseDocumentType);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function uploadLicenseDocument(file) {
    const formData = new FormData();
    formData.append('licenseDocument', file);
    const { url } = await api.postForm('/auth/register/license-document', formData);
    return url;
  }

  async function uploadLogo(file) {
    const formData = new FormData();
    formData.append('logo', file);
    const { url } = await api.postForm('/auth/register/logo', formData);
    return url;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!licenseDocumentType) {
      setError('Choose the document type you are registering with');
      return;
    }
    if (!licenseDocumentUrl) {
      setError(`Upload your ${documentType.label} document to continue`);
      return;
    }
    if (!licenseNumber.trim()) {
      setError(`Enter the ${documentType.numberText}`);
      return;
    }
    setSubmitting(true);
    try {
      await register({
        ...form,
        agencyType: AGENCY_TYPE,
        licenseDocumentType,
        licenseDocumentUrl,
        licenseNumber: licenseNumber.trim(),
        ...(logoUrl ? { logoUrl } : {}),
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Unable to submit registration');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <AuthShell title="Registration submitted" tagline="Your trade gateway to exclusive Oman experiences">
        <div className="text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#e9f7ef] text-lg text-[#227647]">
            ✓
          </div>
          <h2 className="mt-3 text-xl font-bold text-slate-900">Registration submitted</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Thanks — your registration is now <span className="font-semibold text-slate-900">Pending Approval</span>. A
            Super Admin will review it, and you'll be able to sign in once approved.
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
      eyebrow="Agent Sign Up"
      title="Create your account"
      subtitle="Register your agency for trade access — takes about two minutes."
      tagline="Register your agency for trade access — takes about two minutes."
      footerNote={FOOTER_NOTE}
      maxWidthClassName="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <AuthFieldLabel>Company name*</AuthFieldLabel>
            <AuthTextInput
              icon={FiBriefcase}
              required
              autoFocus
              value={form.agencyName}
              onChange={(e) => update('agencyName', e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <AuthFieldLabel>Country*</AuthFieldLabel>
            <AuthSelect value={form.country} onChange={(e) => update('country', e.target.value)}>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </AuthSelect>
          </div>

          <div className="sm:col-span-2">
            <ImageUpload
              label="Company logo"
              hint="Optional — shown on your agency profile."
              value={logoUrl}
              onChange={setLogoUrl}
              onUpload={uploadLogo}
              acceptedTypes={LOGO_ACCEPTED_TYPES}
              acceptHint={LOGO_ACCEPT_HINT}
              accentColor={AUTH_ACCENT}
            />
          </div>

          <div className="sm:col-span-2">
            <AuthFieldLabel>Document type*</AuthFieldLabel>
            <AuthSelect required value={licenseDocumentType} onChange={(e) => setLicenseDocumentType(e.target.value)}>
              <option value="" disabled>
                Select document type
              </option>
              {DOCUMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </AuthSelect>
          </div>

          {documentType && (
            <>
              <div className="sm:col-span-2">
                <ImageUpload
                  label={`${documentType.label} document`}
                  required
                  value={licenseDocumentUrl}
                  onChange={setLicenseDocumentUrl}
                  onUpload={uploadLicenseDocument}
                  acceptedTypes={LICENSE_ACCEPTED_TYPES}
                  acceptHint={LICENSE_ACCEPT_HINT}
                  accentColor={AUTH_ACCENT}
                />
              </div>
              <div className="sm:col-span-2">
                <AuthFieldLabel>{documentType.numberLabel}*</AuthFieldLabel>
                <AuthTextInput
                  icon={FiHash}
                  required
                  maxLength={100}
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder={`Enter the ${documentType.numberText}`}
                />
              </div>
            </>
          )}

          <div>
            <AuthFieldLabel>Owner full name*</AuthFieldLabel>
            <AuthTextInput icon={FiUser} required value={form.ownerFullName} onChange={(e) => update('ownerFullName', e.target.value)} />
          </div>
          <div>
            <AuthFieldLabel>Phone*</AuthFieldLabel>
            <AuthTextInput icon={FiPhone} required value={form.phone} onChange={(e) => update('phone', e.target.value)} />
          </div>

          <div className="sm:col-span-2">
            <AuthFieldLabel>Email*</AuthFieldLabel>
            <AuthTextInput
              icon={FiMail}
              type="email"
              required
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="Enter your email"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              No password to set — once approved, you'll sign in with a code emailed to this address.
            </p>
          </div>
        </div>

        <ErrorText>{error}</ErrorText>
        <AuthButton type="submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit for Approval'}
        </AuthButton>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        Already registered?{' '}
        <Link to="/agent" className="font-semibold hover:underline" style={{ color: AUTH_ACCENT }}>
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
