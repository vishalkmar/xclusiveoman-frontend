import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LuArrowRight, LuPlus, LuTrash2 } from 'react-icons/lu';
import { api } from '../api/client.js';
import ConfirmDialog from '../../shared/components/ConfirmDialog.jsx';
import VisaLockedNotice from '../components/visa/VisaLockedNotice.jsx';
import { isEditable } from '../components/visa/visaMeta.js';
import {
  DangerIconButton,
  FlowCard,
  FlowError,
  FlowFooter,
  FlowLoading,
  InfoBanner,
  PrimaryButton,
  TravellerNumber,
  VisaFlowPage,
  VisaPageHeading,
} from '../components/visa/VisaFlowUi.jsx';
import { FOCUS, visaSummaryLine } from '../components/visa/visaFlowTokens.js';

// Visa application step 2 — each traveller's full name exactly as printed on
// the passport. Saving (PUT /visa/applications/:id/applicants) replaces the
// list: renamed rows keep their id (and any photo already taken), new rows
// are added, removed rows are deleted.
//
// Layout (VisaFlowUi.jsx): one row card per traveller — number, label, name
// input, remove — then an inline "Add another traveller" row.

const MAX_MEMBERS = 20;
const NAME_RE = /^[\p{L}][\p{L} .'-]*$/u;
const PLACEHOLDERS = ['e.g. Rahul Kumar Sharma', 'e.g. Priya Singh', 'e.g. Amit Verma'];

function nameError(name) {
  const trimmed = name.trim();
  if (trimmed.length < 2) return 'Enter the full name as on the passport';
  if (!NAME_RE.test(trimmed)) return "Only letters, spaces, . ' and - are allowed";
  return '';
}

export default function VisaTravellers() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get(`/visa/applications/${id}`)
      .then(({ application: a }) => {
        setApplication(a);
        setRows(a.applicants.map((p) => ({ key: p.id, id: p.id, fullName: p.fullName || '', hasPhoto: !!p.photoUrl })));
      })
      .catch((err) => setError(err.status === 404 ? 'This application was not found.' : err.message))
      .finally(() => setLoading(false));
  }, [id]);

  function update(key, fullName) {
    setRows((list) => list.map((r) => (r.key === key ? { ...r, fullName } : r)));
  }

  function addRow() {
    setRows((list) => [...list, { key: `new-${Date.now()}`, fullName: '', hasPhoto: false }]);
  }

  // A traveller with a photo is asked about first (shared ConfirmDialog).
  const [removing, setRemoving] = useState(null);

  function removeRow(row, confirmed = false) {
    if (row.hasPhoto && !confirmed) return setRemoving(row);
    setRows((list) => list.filter((r) => r.key !== row.key));
  }

  async function save(e) {
    e.preventDefault();
    if (rows.some((r) => nameError(r.fullName))) {
      setShowErrors(true);
      setError('Fix the highlighted names before continuing.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await api.put(`/visa/applications/${id}/applicants`, {
        applicants: rows.map((r) => ({ ...(r.id ? { id: r.id } : {}), fullName: r.fullName.trim().replace(/\s+/g, ' ') })),
      });
      navigate(`/agent/visa/${id}/photos`);
    } catch (err) {
      setError(err.message || 'Unable to save names');
      setSaving(false);
    }
  }

  const editable = application ? isEditable(application) : false;

  return (
    <VisaFlowPage current={1} backTo="/agent/visa">
      <VisaPageHeading title="Traveller details" subtitle={visaSummaryLine(application)} />

      {loading ? (
        <FlowLoading />
      ) : !application ? (
        <FlowError>{error}</FlowError>
      ) : (
        <form onSubmit={save} noValidate>
          {!editable && <VisaLockedNotice application={application} />}
          {/* Read-only once paid / payment in review. */}
          <fieldset disabled={!editable} className="min-w-0 disabled:opacity-70">
            <InfoBanner className="mb-5">
              Enter each name exactly as it appears on the passport — first name, middle name (if any) and surname. Use only
              letters, spaces, <b>.</b> <b>&apos;</b> and <b>-</b>; at least 2 characters.
            </InfoBanner>

            <ol className="space-y-3">
              {rows.map((row, index) => {
                const err = showErrors ? nameError(row.fullName) : '';
                const inputId = `traveller-${row.key}`;
                return (
                  <li key={row.key}>
                    <FlowCard className="flex items-start gap-4 px-4 py-4 sm:items-center sm:px-5">
                      <TravellerNumber n={index + 1} done={!!row.fullName.trim() && !nameError(row.fullName)} />
                      <div className="min-w-0 flex-1">
                        <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-semibold text-[#737D8C]">
                          Traveller {index + 1} — Full name <span className="text-[#D74747]">*</span>
                        </label>
                        <input
                          id={inputId}
                          autoFocus={index === 0 && !row.fullName}
                          autoComplete="off"
                          placeholder={PLACEHOLDERS[index % PLACEHOLDERS.length]}
                          value={row.fullName}
                          onChange={(e) => update(row.key, e.target.value)}
                          aria-invalid={!!err}
                          aria-describedby={err ? `${inputId}-error` : undefined}
                          className={`h-12 w-full rounded-xl border bg-white px-4 text-[15px] text-[#17243A] outline-none transition placeholder:text-[#A9AFB8] focus:ring-2 ${
                            err ? 'border-[#D74747] focus:ring-[#D74747]/20' : 'border-[#F0DFC7] focus:border-[#FFBF47] focus:ring-[#FFBF47]/30'
                          }`}
                        />
                        {err && (
                          <p id={`${inputId}-error`} className="mt-1.5 text-[13px] font-medium text-[#D74747]">
                            {err}
                          </p>
                        )}
                      </div>
                      {rows.length > 1 && (
                        <DangerIconButton label={`Remove traveller ${index + 1}`} onClick={() => removeRow(row)} className="mt-6 sm:mt-6">
                          <LuTrash2 size={17} />
                        </DangerIconButton>
                      )}
                    </FlowCard>
                  </li>
                );
              })}
            </ol>

            {rows.length < MAX_MEMBERS && (
              <button
                type="button"
                onClick={addRow}
                className={`mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#E9C99B] bg-[#FFFCF7] text-[15px] font-semibold text-[#17243A] transition hover:border-[#FFBF47] hover:bg-[#FFF1DF] ${FOCUS}`}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FFF1DF] text-[#E87535]">
                  <LuPlus size={15} strokeWidth={2.5} />
                </span>
                Add another traveller
                <span className="font-normal text-[#737D8C]">
                  ({rows.length} of {MAX_MEMBERS})
                </span>
              </button>
            )}

            {error && (
              <div className="mt-5">
                <FlowError>{error}</FlowError>
              </div>
            )}

            <FlowFooter>
              <PrimaryButton type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Continue to photos'} <LuArrowRight size={18} />
              </PrimaryButton>
            </FlowFooter>
          </fieldset>
        </form>
      )}
      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.fullName || 'this traveller'}?`}
          confirmLabel="Remove traveller"
          busyLabel="Removing…"
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            removeRow(removing, true);
            setRemoving(null);
          }}
        >
          Their photo will be deleted too when you save the traveller list.
        </ConfirmDialog>
      )}
    </VisaFlowPage>
  );
}
