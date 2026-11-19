import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { LuCheck, LuCheckCheck, LuHeadset, LuMail, LuMic, LuPaperclip, LuPhone, LuSend, LuX } from 'react-icons/lu';
import { api } from '../api/client.js';
import { getSocket } from '../lib/socket.js';
import { ErrorText } from '../components/ui.jsx';
import { VoiceMessage, VoiceRecordingBar } from '../../shared/components/chat/VoiceMessage.jsx';
import { isVoiceRecordingSupported, useVoiceRecorder } from '../../shared/components/chat/useVoiceRecorder.js';

// Agent Contact & Support (Task 18 — Screen 27, SUP-1/SUP-3) — one
// continuous chat with the Xclusive Oman support team, like any messaging
// app. The backend stores support as tickets (GET/POST /support/tickets,
// POST /support/tickets/:id/messages(/image)); this page hides that: every
// ticket's messages are merged into one timeline, the agent's first message
// opens a ticket behind the scenes, and every later message is a reply on
// the most recent one. Support replies arrive live over the socket
// (ticket:new_message); a quiet poll is the fallback if the socket drops.
// Messages can be text, a photo, or a recorded voice note.

const POLL_MS = 5000;

const isAgencyRole = (role) => Boolean(role?.startsWith('agency'));

// One timeline across every ticket, oldest first. A ticket's description is
// the agent's opening message (it isn't a row in ticket.messages).
function buildTimeline(tickets) {
  const messages = [];
  for (const ticket of tickets) {
    messages.push({ id: `opening-${ticket.id}`, ticketId: ticket.id, mine: true, message: ticket.description, createdAt: ticket.createdAt, seen: ticket.messages.some((m) => !isAgencyRole(m.senderRole)) });
    for (const m of ticket.messages) messages.push({ ...m, ticketId: ticket.id, mine: isAgencyRole(m.senderRole) });
  }
  return messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function dayLabel(value) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

const timeOf = (value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function RelationshipManagerPanel({ rm }) {
  if (!rm) {
    return (
      <div className="rounded-xl border border-agent-line-light bg-white p-4 text-xs text-agent-muted">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide">Your Relationship Manager</p>
        Not assigned yet — one will be assigned by Xclusive Oman shortly.
      </div>
    );
  }
  const initials = rm.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="rounded-xl border border-agent-line-light bg-white p-4 shadow-sm">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-agent-muted">Your Relationship Manager</p>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-agent-ink text-sm font-bold text-white">{initials}</div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-agent-ink">{rm.fullName}</p>
          <p className="text-[11px] text-agent-muted">Xclusive Oman</p>
        </div>
      </div>
      <div className="mt-3 space-y-1.5 text-xs">
        {rm.email && (
          <a href={`mailto:${rm.email}`} className="flex items-center gap-2 truncate text-agent-ink hover:text-agent-accent-dark">
            <LuMail size={14} className="flex-none text-agent-muted" /> {rm.email}
          </a>
        )}
        {rm.phone && (
          <a href={`tel:${rm.phone}`} className="flex items-center gap-2 text-agent-ink hover:text-agent-accent-dark">
            <LuPhone size={14} className="flex-none text-agent-muted" /> {rm.phone}
          </a>
        )}
      </div>
      {rm.whatsappNumber && (
        <a
          href={`https://wa.me/${rm.whatsappNumber.replace(/[^\d]/g, '')}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#2f7d32] bg-[#eef7ee] px-3 py-1.5 text-[11px] font-semibold text-[#2f7d32] hover:bg-[#e2f1e2]"
        >
          <FaWhatsapp size={14} /> Chat on WhatsApp
        </a>
      )}
    </div>
  );
}

function Bubble({ message, firstInGroup }) {
  const mine = message.mine;
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'} ${firstInGroup ? 'mt-3' : 'mt-1'}`}>
      <div
        className={`max-w-[80%] px-3.5 py-2 text-sm shadow-sm sm:max-w-[65%] ${
          mine ? 'rounded-2xl rounded-br-md bg-[#ffe7c2] text-agent-ink' : 'rounded-2xl rounded-bl-md bg-white text-agent-ink'
        }`}
      >
        {!mine && firstInGroup && <p className="mb-0.5 text-[11px] font-semibold text-[#d9860f]">{message.senderName || 'Support Team'}</p>}
        {message.attachmentUrl && message.attachmentType === 'audio' && <VoiceMessage src={message.attachmentUrl} tone="amber" />}
        {message.attachmentUrl && message.attachmentType !== 'audio' && (
          <a href={message.attachmentUrl} target="_blank" rel="noreferrer" className="block">
            <img src={message.attachmentUrl} alt="Attachment" className="mb-1 max-h-64 rounded-lg object-contain" />
          </a>
        )}
        {message.message && <span className="whitespace-pre-line break-words">{message.message}</span>}
        <span className="float-right ml-3 mt-1.5 inline-flex translate-y-0.5 items-center gap-1 text-[10px] text-agent-muted">
          {timeOf(message.createdAt)}
          {mine && (message.pending ? <LuCheck size={13} className="text-[#c0c4cc]" /> : message.seen ? <LuCheckCheck aria-label="Seen" size={14} strokeWidth={2.6} className="text-[#2196f3]" /> : <LuCheck aria-label="Sent" size={13} strokeWidth={2.4} className="text-[#9ca3af]" />)}
        </span>
      </div>
    </div>
  );
}

export default function Support() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [rm, setRm] = useState(null);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState(null);
  const [sendError, setSendError] = useState('');
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const inputRef = useRef(null);
  const stickToBottom = useRef(true);

  const loadTickets = useCallback(async () => {
    try {
      const { tickets: list } = await api.get('/support/tickets');
      setTickets(list);
      setLoadError('');
      return list;
    } catch (err) {
      setLoadError(err.message || 'Unable to load your chat');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadTickets();
    }, POLL_MS);
    const socket = getSocket();
    socket?.on('ticket:new_message', loadTickets);
    return () => {
      window.clearInterval(timer);
      socket?.off('ticket:new_message', loadTickets);
    };
  }, [loadTickets]);

  useEffect(() => {
    api.get('/agencies/me').then((res) => setRm(res.agency?.relationshipManager || null)).catch(() => {});
  }, []);

  const timeline = buildTimeline(tickets);
  if (pending) timeline.push(pending);

  // Mark support replies as seen while the chat is open.
  const unreadTicketIds = [...new Set(tickets.filter((t) => t.messages.some((m) => !isAgencyRole(m.senderRole) && !m.seen)).map((t) => t.id))];
  const unreadKey = unreadTicketIds.join(',');
  useEffect(() => {
    if (!unreadKey) return;
    unreadKey.split(',').forEach((id) => api.post(`/support/tickets/${id}/seen`).catch(() => {}));
    setTickets((list) => list.map((t) => ({ ...t, messages: t.messages.map((m) => (isAgencyRole(m.senderRole) ? m : { ...m, seen: true })) })));
  }, [unreadKey]);

  // Follow new messages, unless the agent has scrolled up to read history.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [timeline.length, loading]);

  function onScroll() {
    const el = scrollRef.current;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  // Auto-grow the composer up to ~5 lines.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
    el.style.overflowY = el.scrollHeight > 128 ? 'auto' : 'hidden';
  }, [text]);

  const voice = useVoiceRecorder({ onError: setSendError });

  // `attachment` is { file, kind: 'image' | 'audio' } or null.
  async function deliver({ message, attachment }) {
    // The newest ticket is the live conversation; the very first message
    // (or a first message that's only a photo/voice note) opens one.
    const latest = [...tickets].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    let ticketId = latest?.id;
    let caption = message;
    if (!ticketId) {
      const opening = message || (attachment?.kind === 'audio' ? 'Sent a voice message' : 'Sent a photo');
      const { ticket } = await api.post('/support/tickets', { subject: 'Support chat', description: opening });
      ticketId = ticket.id;
      caption = '';
    }
    if (attachment) {
      const form = new FormData();
      form.append(attachment.kind === 'audio' ? 'audio' : 'image', attachment.file);
      form.append('message', caption);
      await api.postForm(`/support/tickets/${ticketId}/messages/${attachment.kind === 'audio' ? 'voice' : 'image'}`, form);
    } else if (caption) {
      await api.post(`/support/tickets/${ticketId}/messages`, { message: caption });
    }
  }

  async function send() {
    const message = text.trim();
    if (sending || (!message && !file)) return;
    setSendError('');
    setSending(true);
    stickToBottom.current = true;
    setPending({ id: 'pending', mine: true, pending: true, message, attachmentUrl: file ? URL.createObjectURL(file) : null, attachmentType: file ? 'image' : null, createdAt: new Date().toISOString() });
    const sentFile = file;
    setText('');
    setFile(null);
    try {
      await deliver({ message, attachment: sentFile ? { file: sentFile, kind: 'image' } : null });
      await loadTickets();
    } catch (err) {
      setSendError(err.message || 'Message not sent. Please try again.');
      setText(message);
      setFile(sentFile);
    } finally {
      setPending(null);
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function sendVoice() {
    if (sending) return;
    const recorded = await voice.stop();
    if (!recorded) return;
    if (recorded.duration < 1) {
      setSendError('Hold on a little longer — that recording was too short.');
      return;
    }
    setSendError('');
    setSending(true);
    stickToBottom.current = true;
    setPending({ id: 'pending', mine: true, pending: true, message: '', attachmentUrl: URL.createObjectURL(recorded.file), attachmentType: 'audio', createdAt: new Date().toISOString() });
    try {
      await deliver({ message: '', attachment: { file: recorded.file, kind: 'audio' } });
      await loadTickets();
    } catch (err) {
      setSendError(err.message || 'Voice message not sent. Please try again.');
    } finally {
      setPending(null);
      setSending(false);
    }
  }

  return (
    <div className="h-[calc(100vh-5rem)] min-h-[560px] bg-agent-bg p-3 sm:p-5">
      <div className="mx-auto grid h-full max-w-6xl gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-agent-line-light bg-white shadow-sm">
          <header className="flex items-center gap-3 border-b border-agent-line-light px-5 py-3.5">
            <span className="relative flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#ffb347] text-white">
              <LuHeadset size={20} />
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-agent-ink">Xclusive Oman Support</h2>
              <p className="text-xs text-agent-muted">Typically replies within a few hours</p>
            </div>
          </header>

          <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto bg-[#faf6ef] px-4 py-4 sm:px-6">
            {loading ? (
              <p className="py-10 text-center text-sm text-agent-muted">Loading chat…</p>
            ) : (
              <>
                {/* Greeting — always the first thing in the chat. */}
                <div className="mt-1 flex justify-start">
                  <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2 text-sm text-agent-ink shadow-sm sm:max-w-[65%]">
                    <p className="mb-0.5 text-[11px] font-semibold text-[#d9860f]">Support Team</p>
                    Hi 👋 Welcome to Xclusive Oman support. Send us a message about any booking, payment or package and we’ll get back to you here.
                  </div>
                </div>
                {loadError && tickets.length === 0 && <div className="mt-4 text-center"><ErrorText>{loadError}</ErrorText></div>}
                {timeline.map((m, i) => {
                  const prev = timeline[i - 1];
                  const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
                  const firstInGroup = newDay || !prev || prev.mine !== m.mine;
                  return (
                    <div key={m.id}>
                      {newDay && (
                        <div className="my-4 flex justify-center">
                          <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-agent-muted shadow-sm">{dayLabel(m.createdAt)}</span>
                        </div>
                      )}
                      <Bubble message={m} firstInGroup={firstInGroup} />
                    </div>
                  );
                })}
              </>
            )}
          </div>

          <footer className="border-t border-agent-line-light bg-white px-3 py-3 sm:px-4">
            {file && (
              <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-full bg-agent-panel px-3 py-1 text-xs text-agent-ink">
                <LuPaperclip size={13} className="flex-none" />
                <span className="truncate">{file.name}</span>
                <button type="button" onClick={() => setFile(null)} aria-label="Remove attachment" className="text-agent-muted hover:text-agent-ink">
                  <LuX size={13} />
                </button>
              </div>
            )}
            {voice.recording ? (
              <VoiceRecordingBar seconds={voice.seconds} onCancel={voice.cancel} onSend={sendVoice} sending={sending} tone="amber" />
            ) : (
            <div className="flex items-end gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] || null); e.target.value = ''; }} />
              <button type="button" onClick={() => fileRef.current?.click()} aria-label="Attach a photo" className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-agent-muted hover:bg-agent-panel hover:text-agent-ink">
                <LuPaperclip size={19} />
              </button>
              <textarea
                ref={inputRef}
                rows={1}
                value={text}
                maxLength={5000}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Type a message"
                className="max-h-32 min-h-10 flex-1 resize-none rounded-3xl border border-agent-line-light bg-agent-bg px-4 py-2.5 text-sm text-agent-ink placeholder:text-agent-muted focus:border-agent-accent focus:outline-none focus:ring-2 focus:ring-agent-accent/15"
              />
              {!text.trim() && !file && isVoiceRecordingSupported() ? (
                <button
                  type="button"
                  onClick={() => { setSendError(''); voice.start(); }}
                  disabled={sending}
                  aria-label="Record a voice message"
                  title="Record a voice message"
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-agent-accent text-agent-ink-dark shadow-sm transition hover:bg-agent-accent-dark disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <LuMic size={18} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={send}
                  disabled={sending || (!text.trim() && !file)}
                  aria-label="Send message"
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-agent-accent text-agent-ink-dark shadow-sm transition hover:bg-agent-accent-dark disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <LuSend size={17} />
                </button>
              )}
            </div>
            )}
            {sendError && <div className="mt-1.5 px-12"><ErrorText>{sendError}</ErrorText></div>}
          </footer>
        </section>

        <aside className="hidden min-h-0 space-y-4 overflow-y-auto xl:block">
          <RelationshipManagerPanel rm={rm} />
          <div className="rounded-xl border border-agent-line-light bg-white p-4 text-xs leading-relaxed text-agent-muted">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide">Tips</p>
            Include your booking ID for faster help. You can attach screenshots or payment receipts with the paperclip, or tap the mic to send a voice message.
          </div>
        </aside>
      </div>
    </div>
  );
}
