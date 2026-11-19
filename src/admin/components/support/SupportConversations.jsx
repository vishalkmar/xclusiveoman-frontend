import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LuArrowLeft, LuChartColumn, LuCheck, LuCheckCheck, LuCircleCheck, LuMessagesSquare, LuMic, LuPaperclip, LuRotateCcw, LuSearch, LuSend, LuX } from 'react-icons/lu';
import { api } from '../../api/client.js';
import { getSocket } from '../../lib/socket.js';
import { useToast } from '../../../shared/components/ToastProvider.jsx';
import { VoiceMessage, VoiceRecordingBar } from '../../../shared/components/chat/VoiceMessage.jsx';
import { isVoiceRecordingSupported, useVoiceRecorder } from '../../../shared/components/chat/useVoiceRecorder.js';
import { CATEGORY_META, CLOSED_STATUSES, conversationRef, dateTime, dayLabel, messagePreview, relativeTime } from './supportMeta.js';
import { Avatar, EmptyState, PriorityTag, Skeleton, StatusPill } from './SupportPrimitives.jsx';

// Admin Support Center — Conversations. Agent chats on the left, the open
// chat in the middle, agent details on the right. New messages arrive live
// over the socket (ticket:new_message, emitted by
// supportTicketNotify.service.js); a quiet poll covers a dropped socket.

const LIST_POLL_MS = 10000;
const CHAT_POLL_MS = 5000;
const AGENT_ROLES = new Set(['agency_owner', 'agency_staff']);
const LIST_TABS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'awaiting', label: 'Awaiting reply' },
];

const timeOf = (value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function ConversationList({ items, loading, selectedId, onSelect, search, onSearch, tab, onTab }) {
  const visible = items.filter((t) => (tab === 'unread' ? t.unreadCount > 0 : tab === 'awaiting' ? ['new', 'waiting_admin'].includes(t.status) : true));
  return (
    <>
      <div className="px-5">
        <label className="relative block">
          <LuSearch size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search conversations…"
            className="h-10 w-full rounded-md border border-[#D7DDF0] bg-[#FAFBFF] pl-9 pr-3 text-sm text-ink placeholder:text-[#94A3B8] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/15"
          />
        </label>
        <div className="mt-3 flex gap-1.5">
          {LIST_TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => onTab(t.key)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${tab === t.key ? 'bg-accent text-white' : 'bg-[#F3F4FF] text-[#475569] hover:text-accent'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {loading && items.length === 0 ? (
          <div className="space-y-2 px-5">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : visible.length === 0 ? (
          <EmptyState icon={LuMessagesSquare} title="No conversations found" hint={search ? 'Try a different search.' : undefined} />
        ) : (
          visible.map((item) => {
            const active = selectedId === item.id;
            const preview = messagePreview(item.lastMessage, item.lastAttachmentType) || item.description?.replace(/<[^>]*>/g, ' ');
            return (
              <button key={item.id} type="button" onClick={() => onSelect(item.id)} className={`flex w-full gap-3 border-l-2 px-4 py-3.5 text-left transition ${active ? 'border-accent bg-indigo-50' : 'border-transparent hover:bg-[#f7f8fc]'}`}>
                <Avatar name={item.createdByName} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${item.unreadCount ? 'font-bold' : 'font-semibold'} text-ink`}>{item.createdByName}</span>
                    <span className="flex-none text-[11px] text-muted">{relativeTime(item.lastMessageAt || item.createdAt)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className={`min-w-0 flex-1 truncate text-xs ${item.unreadCount ? 'font-medium text-ink' : 'text-muted'}`}>{preview}</span>
                    {item.unreadCount > 0 && <span className="flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">{item.unreadCount}</span>}
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-[#94A3B8]">{item.agencyName}</span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}

function MessageBubble({ message, firstInGroup }) {
  const fromAgent = AGENT_ROLES.has(message.senderRole);
  return (
    <div className={`flex ${fromAgent ? 'justify-start' : 'justify-end'} ${firstInGroup ? 'mt-3' : 'mt-1'}`}>
      <div className={`max-w-[85%] px-3.5 py-2 text-sm shadow-sm sm:max-w-[70%] ${fromAgent ? 'rounded-2xl rounded-bl-md bg-white text-ink' : 'rounded-2xl rounded-br-md bg-indigo-100 text-ink'} ${message.pending ? 'opacity-70' : ''}`}>
        {firstInGroup && <div className="mb-0.5 text-[11px] font-semibold text-accent">{message.senderName}</div>}
        {message.attachmentUrl && message.attachmentType === 'audio' && <VoiceMessage src={message.attachmentUrl} />}
        {message.attachmentUrl && message.attachmentType !== 'audio' && (
          <a href={message.attachmentUrl} target="_blank" rel="noreferrer" className="block">
            <img src={message.attachmentUrl} alt="Chat attachment" className="mb-1 max-h-64 rounded-lg object-contain" />
          </a>
        )}
        {message.message && <span className="whitespace-pre-line break-words">{message.message}</span>}
        <span className="float-right ml-3 mt-1.5 inline-flex translate-y-0.5 items-center gap-1 text-[10px] text-muted">
          {timeOf(message.createdAt)}
          {!fromAgent && (message.pending ? <LuCheck size={13} className="text-[#c0c4cc]" /> : message.seen ? <LuCheckCheck aria-label="Seen" size={14} strokeWidth={2.6} className="text-[#2563eb]" /> : <LuCheck aria-label="Sent" size={13} strokeWidth={2.4} className="text-[#9ca3af]" />)}
        </span>
      </div>
    </div>
  );
}

function Composer({ ticketId, onSent }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const inputRef = useRef(null);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const voice = useVoiceRecorder({ onError: (message) => toast.error(message) });

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
    el.style.overflowY = el.scrollHeight > 128 ? 'auto' : 'hidden';
  }, [text]);

  // Switching chats discards a half-typed reply's attachment/recording.
  useEffect(() => {
    setFile(null);
    voice.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  async function post({ message, attachment }) {
    if (attachment) {
      const form = new FormData();
      form.append(attachment.kind === 'audio' ? 'audio' : 'image', attachment.file);
      form.append('message', message);
      await api.postForm(`/admin/support/tickets/${ticketId}/messages/${attachment.kind === 'audio' ? 'voice' : 'image'}`, form);
    } else {
      await api.post(`/admin/support/tickets/${ticketId}/messages`, { message });
    }
  }

  async function send() {
    const message = text.trim();
    if (sending || (!message && !file)) return;
    setSending(true);
    const sentFile = file;
    onSent({ pending: { message, attachmentUrl: sentFile ? URL.createObjectURL(sentFile) : null, attachmentType: sentFile ? 'image' : null } });
    setText('');
    setFile(null);
    try {
      await post({ message, attachment: sentFile ? { file: sentFile, kind: 'image' } : null });
      onSent({ done: true });
    } catch (err) {
      toast.error(err.message || 'Message not sent. Please try again.');
      setText(message);
      setFile(sentFile);
      onSent({ failed: true });
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function sendVoice() {
    if (sending) return;
    const recorded = await voice.stop();
    if (!recorded) return;
    if (recorded.duration < 1) {
      toast.error('That recording was too short.');
      return;
    }
    setSending(true);
    onSent({ pending: { message: '', attachmentUrl: URL.createObjectURL(recorded.file), attachmentType: 'audio' } });
    try {
      await post({ message: '', attachment: { file: recorded.file, kind: 'audio' } });
      onSent({ done: true });
    } catch (err) {
      toast.error(err.message || 'Voice message not sent. Please try again.');
      onSent({ failed: true });
    } finally {
      setSending(false);
    }
  }

  return (
    <footer className="border-t border-line-light bg-white px-3 py-3 sm:px-4">
      {file && (
        <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-full bg-[#F3F4FF] px-3 py-1 text-xs text-ink">
          <LuPaperclip size={13} className="flex-none" />
          <span className="truncate">{file.name}</span>
          <button type="button" onClick={() => setFile(null)} aria-label="Remove attachment" className="text-muted hover:text-ink">
            <LuX size={13} />
          </button>
        </div>
      )}
      {voice.recording ? (
        <VoiceRecordingBar seconds={voice.seconds} onCancel={voice.cancel} onSend={sendVoice} sending={sending} />
      ) : (
        <div className="flex items-end gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] || null); e.target.value = ''; }} />
          <button type="button" aria-label="Attach image" onClick={() => fileRef.current?.click()} className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-muted hover:bg-[#F3F4FF] hover:text-accent">
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
            placeholder="Type your message…"
            className="max-h-32 min-h-10 flex-1 resize-none rounded-3xl border border-[#D7DDF0] bg-[#FAFBFF] px-4 py-2.5 text-sm text-ink placeholder:text-[#94A3B8] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/15"
          />
          {!text.trim() && !file && isVoiceRecordingSupported() ? (
            <button type="button" onClick={voice.start} disabled={sending} aria-label="Record a voice message" title="Record a voice message" className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-accent text-white shadow-sm transition hover:bg-[#4338CA] disabled:opacity-40">
              <LuMic size={18} />
            </button>
          ) : (
            <button type="button" onClick={send} disabled={sending || (!text.trim() && !file)} aria-label="Send message" className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-accent text-white shadow-sm transition hover:bg-[#4338CA] disabled:opacity-40">
              <LuSend size={17} />
            </button>
          )}
        </div>
      )}
    </footer>
  );
}

function AgentInfo({ ticket }) {
  const rows = [
    ['Agency', ticket.agencyName],
    ['Conversation', conversationRef(ticket.id)],
    ['Category', CATEGORY_META[ticket.category]?.label || ticket.category],
    ['Assigned to', ticket.assignedToName || 'Unassigned'],
    ['Started', dateTime(ticket.createdAt)],
  ];
  return (
    <aside className="hidden min-h-0 overflow-y-auto border-l border-line-light bg-white p-5 xl:block">
      <h3 className="text-sm font-semibold text-ink">Agent Information</h3>
      <div className="mt-4 flex items-center gap-3 rounded-lg border border-line-light bg-[#f7f8fc] p-3">
        <Avatar name={ticket.createdByName} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">{ticket.createdByName}</div>
          <a href={`mailto:${ticket.createdByEmail}`} className="block truncate text-xs text-muted hover:text-accent">{ticket.createdByEmail}</a>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StatusPill status={ticket.status} />
        <PriorityTag priority={ticket.priority} />
      </div>
      <dl className="mt-4 space-y-3 rounded-lg border border-line-light p-4">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] text-muted">{label}</dt>
            <dd className="truncate text-sm font-medium text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11px] leading-relaxed text-muted">Assign, re-prioritise or categorise this chat from Show Analytics → Chat Logs.</p>
    </aside>
  );
}

export default function SupportConversations({ initialChatId, onShowAnalytics }) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [items, setItems] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(initialChatId || null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [pending, setPending] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const scrollRef = useRef(null);
  const stickToBottom = useRef(true);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  const loadList = useCallback(async () => {
    try {
      const q = new URLSearchParams({ pageSize: '100' });
      if (search.trim()) q.set('search', search.trim());
      const { tickets } = await api.get(`/admin/support/tickets?${q}`);
      setItems(tickets);
      // Wide screens open the newest chat straight away; phones stay on the list.
      if (!selectedRef.current && tickets[0] && window.matchMedia('(min-width: 1024px)').matches) setSelectedId(tickets[0].id);
    } catch (err) {
      toast.error(err.message || 'Unable to load conversations');
    } finally {
      setListLoading(false);
    }
  }, [search, toast]);

  const loadDetail = useCallback(async (id = selectedRef.current) => {
    if (!id) return;
    try {
      const data = await api.get(`/admin/support/tickets/${id}`);
      if (id !== selectedRef.current) return;
      setDetail(data);
      setDetailError('');
      // Opening the chat marks it read server-side; reflect that in the list.
      setItems((list) => list.map((t) => (t.id === id ? { ...t, unreadCount: 0 } : t)));
    } catch (err) {
      if (id === selectedRef.current) setDetailError(err.message || 'Unable to load this conversation');
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadList, search ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [loadList, search]);

  useEffect(() => {
    setDetail(null);
    setDetailError('');
    setPending(null);
    stickToBottom.current = true;
    loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  // Live updates + fallback polling (only while the tab is visible).
  useEffect(() => {
    const visible = () => document.visibilityState === 'visible';
    const listTimer = window.setInterval(() => visible() && loadList(), LIST_POLL_MS);
    const chatTimer = window.setInterval(() => visible() && loadDetail(), CHAT_POLL_MS);
    const socket = getSocket();
    const onMessage = (payload) => {
      loadList();
      if (payload?.ticketId && payload.ticketId === selectedRef.current) loadDetail();
    };
    socket?.on('ticket:new_message', onMessage);
    socket?.on('ticket:updated', onMessage);
    return () => {
      window.clearInterval(listTimer);
      window.clearInterval(chatTimer);
      socket?.off('ticket:new_message', onMessage);
      socket?.off('ticket:updated', onMessage);
    };
  }, [loadList, loadDetail]);

  const ticket = detail?.ticket;
  const messages = [...(detail?.messages || [])];
  if (pending) messages.push(pending);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, ticket?.id]);

  function onScroll() {
    const el = scrollRef.current;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function handleSent({ pending: p, done, failed }) {
    if (p) {
      stickToBottom.current = true;
      setPending({ id: 'pending', pending: true, senderName: 'You', senderRole: 'support', createdAt: new Date().toISOString(), ...p });
    }
    if (done) {
      Promise.all([loadDetail(), loadList()]).finally(() => setPending(null));
    }
    if (failed) setPending(null);
  }

  async function setStatus(status) {
    setStatusSaving(true);
    try {
      await api.patch(`/admin/support/tickets/${ticket.id}`, { status });
      toast.success(status === 'resolved' ? 'Conversation marked as resolved.' : 'Conversation reopened.');
      await Promise.all([loadDetail(), loadList()]);
    } catch (err) {
      toast.error(err.message || 'Unable to update this conversation');
    } finally {
      setStatusSaving(false);
    }
  }

  const closed = ticket && CLOSED_STATUSES.has(ticket.status);

  return (
    <div className="h-[calc(100vh-57px)] min-h-[560px] overflow-hidden bg-[#f4f7ff]">
      <div className="grid h-full grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_280px]">
        <aside className={`min-h-0 flex-col border-r border-line-light bg-white pt-5 ${selectedId ? 'hidden lg:flex' : 'flex'}`}>
          <div className="px-5">
            <h2 className="text-2xl font-bold text-ink">Support Center</h2>
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="text-sm text-muted">Chat with agents</p>
              <button type="button" onClick={onShowAnalytics} className="inline-flex h-8 flex-none items-center gap-1.5 rounded-md border border-[#C7D2FE] bg-[#EEF2FF] px-3 text-xs font-semibold text-[#4338CA] transition hover:border-[#6366F1] hover:bg-[#E0E7FF]">
                <LuChartColumn size={15} /> Show Analytics
              </button>
            </div>
          </div>
          <div className="mt-5 flex min-h-0 flex-1 flex-col">
            <ConversationList items={items} loading={listLoading} selectedId={selectedId} onSelect={setSelectedId} search={search} onSearch={setSearch} tab={tab} onTab={setTab} />
          </div>
        </aside>

        <main className={`min-h-0 flex-col ${selectedId ? 'flex' : 'hidden lg:flex'}`}>
          {!selectedId ? (
            <EmptyState icon={LuMessagesSquare} title="Select a chat to begin" className="h-full" />
          ) : !ticket ? (
            detailError ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <p className="text-sm text-[#a5162d]">{detailError}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => loadDetail()} className="rounded-md border border-[#D7DDF0] bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:border-[#6366F1]">Try again</button>
                  <button type="button" onClick={() => setSelectedId(null)} className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink lg:hidden">Back to list</button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 p-6">
                <Skeleton className="h-12" />
                <Skeleton className="ml-auto h-10 w-2/3" />
                <Skeleton className="h-10 w-1/2" />
              </div>
            )
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-line-light bg-white px-4 py-3 sm:px-6">
                <button type="button" onClick={() => setSelectedId(null)} aria-label="Back to conversations" className="flex h-9 w-9 flex-none items-center justify-center rounded-md text-muted hover:bg-[#F3F4FF] lg:hidden">
                  <LuArrowLeft size={18} />
                </button>
                <Avatar name={ticket.createdByName} size="lg" />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-bold text-ink">{ticket.createdByName}</h3>
                  <p className="truncate text-xs text-muted">{ticket.agencyName} · Started {dayLabel(ticket.createdAt)}</p>
                </div>
                <StatusPill status={ticket.status} className="hidden sm:inline-flex" />
                {closed ? (
                  <button type="button" disabled={statusSaving} onClick={() => setStatus('open')} className="inline-flex h-9 flex-none items-center gap-1.5 rounded-md border border-[#D7DDF0] bg-white px-3 text-xs font-semibold text-ink hover:border-[#6366F1] disabled:opacity-50">
                    <LuRotateCcw size={14} /> <span className="hidden sm:inline">Reopen</span>
                  </button>
                ) : (
                  <button type="button" disabled={statusSaving} onClick={() => setStatus('resolved')} className="inline-flex h-9 flex-none items-center gap-1.5 rounded-md bg-[#059669] px-3 text-xs font-semibold text-white hover:bg-[#047857] disabled:opacity-50">
                    <LuCircleCheck size={14} /> <span className="hidden sm:inline">Mark resolved</span>
                  </button>
                )}
              </header>
              <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
                {messages.map((m, i) => {
                  const prev = messages[i - 1];
                  const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
                  const firstInGroup = newDay || prev.senderUserId !== m.senderUserId || Boolean(m.pending) !== Boolean(prev.pending);
                  return (
                    <div key={m.id}>
                      {newDay && (
                        <div className="my-4 flex justify-center">
                          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-muted shadow-sm">{dayLabel(m.createdAt)}</span>
                        </div>
                      )}
                      <MessageBubble message={m} firstInGroup={firstInGroup} />
                    </div>
                  );
                })}
                {closed && (
                  <p className="mt-4 text-center text-[11px] text-muted">This conversation is {ticket.status}. A new message from the agent reopens it automatically.</p>
                )}
              </div>
              <Composer ticketId={ticket.id} onSent={handleSent} />
            </>
          )}
        </main>

        {ticket && <AgentInfo ticket={ticket} />}
      </div>
    </div>
  );
}
