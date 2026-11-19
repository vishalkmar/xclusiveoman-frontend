import { useEffect, useRef, useState } from 'react';
import { LuPaperclip, LuSend } from 'react-icons/lu';
import { Navigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../../shared/components/ToastProvider.jsx';
import { Button, Card, ErrorText, TextInput } from '../components/ui.jsx';
import { RichTextDisplay } from '../../shared/components/RichTextEditor.jsx';

// Admin Chat Support (Task 18) — chat detail: status controls,
// assignment, threaded replies, activity history. Mirrors
// OperationsDetail.jsx's own "load once, refetch after any write" pattern.

function Thread({ ticketId, messages, onReplied }) {
  const fileRef = useRef(null);
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleReply() {
    if (!message.trim() && !file) return;
    setError('');
    setSubmitting(true);
    try {
      if (file) {
        const form = new FormData();
        form.append('image', file);
        form.append('message', message.trim());
        await api.postForm(`/admin/support/tickets/${ticketId}/messages/image`, form);
      } else {
        await api.post(`/admin/support/tickets/${ticketId}/messages`, { message: message.trim() });
      }
      setMessage('');
      setFile(null);
      toast.success('Reply sent.');
      onReplied();
    } catch (err) {
      setError(err.message || 'Unable to send reply');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card label="Chat Conversation" className="border-white">
      {messages.length === 0 ? (
        <p className="text-sm text-muted">No replies yet.</p>
      ) : (
        <div className="mb-3 space-y-2">
          {messages.map((m) => (
            <div key={m.id} className="rounded-lg bg-panel px-3 py-2 text-sm">
              <div className="mb-0.5 flex items-center justify-between text-[10px] text-muted">
                <span className="font-semibold">
                  {m.senderName} <span className="font-normal">({m.senderRole?.replace(/_/g, ' ')})</span>
                </span>
                <span>{new Date(m.createdAt).toLocaleString()}</span>
              </div>
              {m.message && <div>{m.message}</div>}
              {m.attachmentUrl && <img src={m.attachmentUrl} alt="Chat attachment" className="mt-2 max-h-64 rounded-lg object-contain" />}
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button type="button" className="rounded-lg p-2 text-muted hover:bg-panel" onClick={() => fileRef.current?.click()} aria-label="Attach image">
          <LuPaperclip size={18} />
        </button>
        <TextInput placeholder={file ? file.name : 'Type a message…'} value={message} onChange={(e) => setMessage(e.target.value)} />
        <Button variant="accent" disabled={submitting || (!message.trim() && !file)} onClick={handleReply} aria-label="Send message">
          <LuSend size={16} />
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

function ActivityHistory({ activity }) {
  return (
    <Card label="Activity History" className="border-white">
      {activity.length === 0 ? (
        <p className="text-sm text-muted">No activity recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {activity.map((a, i) => (
            <div key={i} className="flex items-start justify-between border-b border-line-light py-2 text-xs last:border-0">
              <span className="text-ink">{a.description}</span>
              <span className="flex-none pl-3 text-right text-muted">
                {new Date(a.at).toLocaleString()}
                {a.by && <div>{a.by}</div>}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function SupportTicketDetail() {
  return <Navigate to="/admin/support" replace />;
  /*
  const { ticketId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function loadDetail() {
    setLoading(true);
    setError('');
    return api
      .get(`/admin/support/tickets/${ticketId}`)
      .then(setData)
      .catch((err) => setError(err.message || 'Unable to load this ticket'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#F4F7FF] p-10">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#F4F7FF] p-10">
        <Link to="/admin/support" className="text-sm text-accent hover:underline">
          ← Back to Chat Support
        </Link>
        <p className="mt-4 text-sm text-[#a5162d]">{error}</p>
      </div>
    );
  }

  const { ticket, messages, activity } = data;

  return (
    <div className="min-h-screen bg-[#F4F7FF]">
      <div className="mx-auto max-w-5xl p-6 lg:p-10">
        <Link to="/admin/support" className="text-sm text-accent hover:underline">
          ← Back to Chat Support
        </Link>

        <div className="mt-3 mb-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-3xl font-bold">{ticket.subject}</h2>
          </div>
          <p className="mt-1 text-sm text-muted">
            {ticket.agencyName} · Raised by {ticket.createdByName} ({ticket.createdByEmail}) ·{' '}
            {new Date(ticket.createdAt).toLocaleDateString()}
          </p>
        </div>

        <Card label="Description" className="mb-5 border-white">
          <RichTextDisplay html={ticket.description} className="text-sm text-ink" />
        </Card>

        <div className="mb-5">
          <Thread ticketId={ticket.id} messages={messages} onReplied={loadDetail} />
        </div>

        <ActivityHistory activity={activity} />
      </div>
    </div>
  );
  */
}
