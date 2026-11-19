import { useEffect, useState } from 'react';
import { LuArrowLeft, LuCircleCheck, LuExternalLink, LuMessagesSquare, LuRotateCcw, LuX } from 'react-icons/lu';
import { api } from '../../api/client.js';
import { VoiceMessage } from '../../../shared/components/chat/VoiceMessage.jsx';
import { buildAnalyticsQuery, CATEGORY_OPTIONS, CLOSED_STATUSES, conversationRef, dateTime, formatMinutes, PRIORITY_OPTIONS, relativeTime, shortDate } from './supportMeta.js';
import { Avatar, EmptyState, MiniSelect, PriorityTag, Skeleton, StatusPill } from './SupportPrimitives.jsx';

// Right-side drawer for Chat Logs — never navigates away from the
// dashboard. Two modes: one conversation (details, workflow actions,
// transcript) or one user's full support history (list → conversation).

const AGENT_ROLES = new Set(['agency_owner', 'agency_staff']);
const minutesBetween = (from, to) => (from && to ? Math.max(0, (new Date(to) - new Date(from)) / 60000) : null);

function Detail({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">{label}</dt>
      <dd className="mt-0.5 truncate text-xs font-medium text-ink">{children}</dd>
    </div>
  );
}

function Transcript({ messages }) {
  if (!messages.length) return <p className="text-xs text-muted">No messages.</p>;
  return (
    <ol className="space-y-2.5">
      {messages.map((m) => {
        const fromAgent = AGENT_ROLES.has(m.senderRole);
        return (
          <li key={m.id} className={`flex ${fromAgent ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] rounded-lg border px-3 py-2 text-xs ${fromAgent ? 'border-[#E4E9FB] bg-white' : 'border-[#E0E7FF] bg-[#F5F7FF]'}`}>
              <div className="mb-1 flex items-center justify-between gap-3 text-[10px] text-muted">
                <span className="font-semibold text-[#475569]">{m.senderName}</span>
                <span className="tabular-nums">{dateTime(m.createdAt)}</span>
              </div>
              {m.attachmentUrl && m.attachmentType === 'audio' && <VoiceMessage src={m.attachmentUrl} />}
              {m.attachmentUrl && m.attachmentType !== 'audio' && (
                <a href={m.attachmentUrl} target="_blank" rel="noreferrer">
                  <img src={m.attachmentUrl} alt="Attachment" className="mb-1 max-h-48 rounded-md object-contain" />
                </a>
              )}
              {m.message && <p className="whitespace-pre-line break-words leading-relaxed text-ink">{m.message}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ConversationView({ id, agents, onUpdate, onOpenInChat, refreshKey, onError }) {
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/admin/support/tickets/${id}`)
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && onError(err.message || 'Unable to load this conversation'));
    return () => {
      cancelled = true;
    };
  }, [id, refreshKey, onError]);

  if (!data) {
    return (
      <div className="space-y-3 p-5">
        <Skeleton className="h-14" />
        <Skeleton className="h-28" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const { ticket, messages } = data;
  const closed = CLOSED_STATUSES.has(ticket.status);
  const lastActivity = messages.length ? messages[messages.length - 1].createdAt : ticket.createdAt;

  async function update(patch) {
    setSaving(true);
    try {
      await onUpdate(ticket.id, patch);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`flex min-h-full flex-col ${saving ? 'pointer-events-none opacity-70' : ''}`}>
      <section className="border-b border-[#EEF1FA] p-5">
        <div className="flex items-center gap-3">
          <Avatar name={ticket.createdByName} size="lg" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink">{ticket.createdByName}</div>
            <div className="truncate text-xs text-muted">{ticket.createdByEmail}</div>
            <div className="truncate text-xs text-muted">{ticket.agencyName}</div>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Detail label="Conversation">
            <span className="font-mono">{conversationRef(ticket.id)}</span>
          </Detail>
          <Detail label="Status"><StatusPill status={ticket.status} /></Detail>
          <Detail label="Priority"><PriorityTag priority={ticket.priority} /></Detail>
          <Detail label="Assigned agent">{ticket.assignedToName || <span className="text-muted">Unassigned</span>}</Detail>
          <Detail label="Category"><span className="capitalize">{ticket.category}</span></Detail>
          <Detail label="Messages">{messages.length}</Detail>
          <Detail label="Created">{dateTime(ticket.createdAt)}</Detail>
          <Detail label="Last activity">{relativeTime(lastActivity)}</Detail>
          <Detail label="Reopened">{ticket.reopenedCount ? `${ticket.reopenedCount}×` : 'Never'}</Detail>
          <Detail label="First response">{formatMinutes(minutesBetween(ticket.createdAt, ticket.firstResponseAt))}</Detail>
          <Detail label="Resolution time">{closed ? formatMinutes(minutesBetween(ticket.createdAt, ticket.resolvedAt)) : '—'}</Detail>
        </dl>
      </section>

      <section className="border-b border-[#EEF1FA] p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MiniSelect label="Assign" value={ticket.assignedToUserId || ''} onChange={(v) => update({ assignedToUserId: v || null })}>
            <option value="">Unassigned</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.fullName}</option>)}
          </MiniSelect>
          <MiniSelect label="Priority" value={ticket.priority} onChange={(priority) => update({ priority })}>
            {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </MiniSelect>
          <MiniSelect label="Category" value={ticket.category} onChange={(category) => update({ category })}>
            {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </MiniSelect>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {closed ? (
            <button type="button" onClick={() => update({ status: 'open' })} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#D7DDF0] bg-white px-3 text-xs font-semibold text-ink hover:border-[#6366F1] hover:text-[#4F46E5]">
              <LuRotateCcw size={14} /> Reopen
            </button>
          ) : (
            <button type="button" onClick={() => update({ status: 'resolved' })} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#059669] px-3 text-xs font-semibold text-white hover:bg-[#047857]">
              <LuCircleCheck size={14} /> Mark resolved
            </button>
          )}
          <button type="button" onClick={() => onOpenInChat(ticket.id)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#D7DDF0] bg-white px-3 text-xs font-semibold text-ink hover:border-[#6366F1] hover:text-[#4F46E5]">
            <LuExternalLink size={14} /> Reply in Conversations
          </button>
        </div>
      </section>

      <section className="flex-1 bg-[#FAFBFF] p-5">
        <h4 className="mb-3 text-xs font-semibold text-ink">Transcript</h4>
        <Transcript messages={messages} />
      </section>
    </div>
  );
}

function UserHistory({ user, onOpenConversation, onError }) {
  const [logs, setLogs] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/admin/support/tickets/analytics/logs?${buildAnalyticsQuery({ range: 'all', userId: user.userId, pageSize: 100, sort: 'created' })}`)
      .then((res) => !cancelled && setLogs(res.logs))
      .catch((err) => !cancelled && onError(err.message || 'Unable to load this user’s history'));
    return () => {
      cancelled = true;
    };
  }, [user.userId, onError]);

  return (
    <div>
      <section className="flex items-center gap-3 border-b border-[#EEF1FA] p-5">
        <Avatar name={user.name} size="lg" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">{user.name}</div>
          <div className="truncate text-xs text-muted">{user.email}</div>
          <div className="truncate text-xs text-muted">{user.agencyName}</div>
        </div>
      </section>
      {!logs ? (
        <div className="space-y-2 p-5">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : logs.length === 0 ? (
        <EmptyState icon={LuMessagesSquare} title="No conversations found" />
      ) : (
        <ul className="divide-y divide-[#F1F3FA]">
          <li className="px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted">All time · {logs.length} conversation{logs.length === 1 ? '' : 's'}</li>
          {logs.map((log) => (
            <li key={log.id}>
              <button type="button" onClick={() => onOpenConversation(log.id)} className="w-full px-5 py-3 text-left hover:bg-[#FAFBFF]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-[#64748B]">{log.ref}</span>
                  <StatusPill status={log.status} />
                </div>
                <p className="mt-1 truncate text-xs text-ink">{log.lastMessage || '—'}</p>
                <p className="mt-1 text-[11px] text-muted">
                  {shortDate(log.createdAt)} · {log.messageCount} messages · first reply {formatMinutes(log.firstResponseMinutes)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// `target`: { type: 'conversation', id } | { type: 'user', user }
export function ChatDrawer({ target, onClose, agents, onUpdate, onOpenInChat, refreshKey, onError }) {
  const [stack, setStack] = useState([]);
  const current = stack[stack.length - 1] || target;

  useEffect(() => {
    setStack([]);
  }, [target]);

  useEffect(() => {
    if (!target) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [target, onClose]);

  if (!target) return null;

  return (
    <div className="fixed inset-0 z-[900]" role="dialog" aria-modal="true" aria-label={current.type === 'user' ? 'Support history' : 'Conversation details'}>
      <div className="absolute inset-0 bg-[#0F172A]/30" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-[-12px_0_40px_rgba(15,23,42,0.18)]">
        <header className="flex flex-none items-center gap-2 border-b border-[#E4E9FB] px-4 py-3">
          {stack.length > 0 && (
            <button type="button" onClick={() => setStack((s) => s.slice(0, -1))} aria-label="Back" className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-[#F3F4FF] hover:text-ink">
              <LuArrowLeft size={17} />
            </button>
          )}
          <h2 className="flex-1 text-sm font-semibold text-ink">{current.type === 'user' ? 'Support history' : 'Conversation details'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-[#F3F4FF] hover:text-ink">
            <LuX size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {current.type === 'user' ? (
            <UserHistory user={current.user} onError={onError} onOpenConversation={(id) => setStack((s) => [...s, { type: 'conversation', id }])} />
          ) : (
            <ConversationView key={current.id} id={current.id} agents={agents} onUpdate={onUpdate} onOpenInChat={onOpenInChat} refreshKey={refreshKey} onError={onError} />
          )}
        </div>
      </aside>
    </div>
  );
}
