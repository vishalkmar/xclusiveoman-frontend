import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  LuArrowLeft, LuCalendarDays, LuCheck, LuCircleDollarSign, LuClock3, LuCreditCard, LuEllipsisVertical, LuFileText,
  LuHeart, LuHistory, LuHouse, LuMail, LuMails, LuPhone, LuReceipt, LuSend, LuTicket, LuUser, LuUserRound, LuUsers, LuWallet,
} from 'react-icons/lu';
import { api } from '../api/client.js';
import ConfirmDialog from '../../shared/components/ConfirmDialog.jsx';
import { formatCurrency as formatOmr } from '../../shared/currency.js';
import { Badge, Button, Card, ErrorText, Textarea } from '../components/ui.jsx';

const TABS = [
  { label: 'Overview', icon: LuHouse },
  { label: 'Personal Details', icon: LuUser },
  { label: 'Bookings', icon: LuFileText },
  { label: 'Payments', icon: LuCreditCard },
  { label: 'Vouchers', icon: LuTicket },
  { label: 'Wishlist', icon: LuHeart },
  { label: 'Support', icon: LuMail },
  { label: 'Email', icon: LuMails },
  { label: 'Activity', icon: LuHistory },
];
const STATUS_BADGE = { approved: 'green', pending: 'amber', rejected: 'red', suspended: 'grey' };
const formatCurrency = (value) => formatOmr(value || 0);
const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

function Metric({ label, value, hint, icon: Icon, tone = 'blue' }) {
  const colors = { blue: 'bg-blue-50 text-blue-600', green: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', red: 'bg-rose-50 text-rose-600', violet: 'bg-violet-50 text-violet-600' };
  return <Card className="border-white p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</div><div className="mt-2 text-xl font-bold text-ink">{value}</div><div className="mt-1 text-[10px] text-muted">{hint}</div></div><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${colors[tone]}`}><Icon size={16} /></span></div></Card>;
}

function EmptyState({ children = 'No information available yet.' }) { return <div className="py-10 text-center text-sm text-muted">{children}</div>; }

function EmailModal({ agency, onClose, onSent }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function sendEmail(event) {
    event.preventDefault();
    setError('');
    setSending(true);
    try {
      await api.post(`/admin/agencies/${agency.id}/email`, { subject, message });
      setSent(true);
      onSent?.();
    } catch (err) {
      setError(err.message || 'Unable to send email');
    } finally {
      setSending(false);
    }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="fixed inset-0 bg-slate-950/35" onClick={onClose} /><div className="relative z-10 w-full max-w-xl rounded-lg border border-line-light bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-line-light px-5 py-4"><div><h2 className="flex items-center gap-2 text-base font-bold text-ink"><LuMail size={17} className="text-accent" /> Send Email to Agent</h2><p className="mt-1 text-xs text-muted">Send an email directly to the agent. The recipient email cannot be changed.</p></div><button type="button" onClick={onClose} aria-label="Close" className="text-lg leading-none text-muted hover:text-ink">×</button></div>{sent ? <div className="px-5 py-10 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><LuSend size={18} /></div><h3 className="mt-3 font-bold text-ink">Email sent</h3><p className="mt-1 text-sm text-muted">Your message was sent to {agency.email || agency.ownerEmail}.</p><Button variant="accent" className="mt-5" onClick={onClose}>Done</Button></div> : <form onSubmit={sendEmail} className="space-y-4 px-5 py-5"><div><label className="mb-1.5 block text-[11px] font-semibold uppercase text-muted">To</label><div className="flex items-center justify-between rounded-md border border-line-light bg-panel px-3 py-2.5 text-sm text-muted"><span>{agency.email || agency.ownerEmail || 'Email unavailable'}</span><LuMail size={14} /></div></div><div><label className="mb-1.5 block text-[11px] font-semibold uppercase text-muted">Subject <span className="text-red-500">*</span></label><input required maxLength={200} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Enter email subject…" className="w-full rounded-md border border-[#D7DDF0] bg-[#FAFBFF] px-3 py-2.5 text-sm text-ink shadow-sm focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/15" /></div><div><label className="mb-1.5 block text-[11px] font-semibold uppercase text-muted">Message <span className="text-red-500">*</span></label><Textarea required maxLength={20000} rows={7} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write your message here…" /></div><ErrorText>{error}</ErrorText><div className="flex justify-end gap-2 border-t border-line-light pt-4"><Button type="button" disabled={sending} onClick={onClose}>Cancel</Button><Button variant="accent" type="submit" disabled={sending || !agency.email && !agency.ownerEmail}><LuSend size={14} className="mr-1.5" />{sending ? 'Sending…' : 'Send Email'}</Button></div></form>}</div></div>;
}

function BookingTable({ bookings }) {
  if (!bookings.length) return <EmptyState>No bookings for this agent yet.</EmptyState>;
  return <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-line-light text-[10px] uppercase text-muted">{['Booking ID', 'Package', 'Travel date', 'Travellers', 'Amount', 'Status'].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>)}</tr></thead><tbody>{bookings.map((booking) => <tr key={booking.id} className="border-b border-line-light last:border-0 hover:bg-panel/50"><td className="px-3 py-3 font-semibold text-accent">{booking.bookingReference || booking.id}</td><td className="px-3 py-3">{booking.packageTitle || booking.packageName || 'Booking'}</td><td className="px-3 py-3 whitespace-nowrap">{formatDate(booking.travelDate || booking.departureDate)}</td><td className="px-3 py-3">{booking.pax || booking.travellers || '—'}</td><td className="px-3 py-3 whitespace-nowrap">{formatCurrency(booking.totalPrice || booking.agreedTotalPrice)}</td><td className="px-3 py-3"><Badge tone={booking.status === 'cancelled' ? 'red' : booking.status === 'confirmed' || booking.status === 'completed' ? 'green' : 'amber'}>{booking.status || '—'}</Badge></td></tr>)}</tbody></table></div>;
}

function PaymentTable({ payments }) {
  if (!payments.length) return <EmptyState>No payments for this agent yet.</EmptyState>;
  return <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-line-light text-[10px] uppercase text-muted">{['Payment ID', 'Booking', 'Date', 'Amount', 'Method', 'Status'].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>)}</tr></thead><tbody>{payments.map((payment) => <tr key={payment.id} className="border-b border-line-light last:border-0 hover:bg-panel/50"><td className="px-3 py-3 font-semibold text-accent">{payment.reference || payment.id}</td><td className="px-3 py-3">{payment.bookingId || '—'}</td><td className="px-3 py-3 whitespace-nowrap">{formatDate(payment.createdAt || payment.date)}</td><td className="px-3 py-3 whitespace-nowrap">{formatCurrency(payment.amount)}</td><td className="px-3 py-3">{payment.method || '—'}</td><td className="px-3 py-3"><Badge tone="green">{payment.status || 'Verified'}</Badge></td></tr>)}</tbody></table></div>;
}

function EmailHistory({ emails, loading }) {
  if (loading) return <EmptyState>Loading sent emails…</EmptyState>;
  if (!emails.length) return <EmptyState>No emails have been sent to this agent yet.</EmptyState>;
  return <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-line-light text-[10px] uppercase text-muted">{['Subject', 'Sent by', 'Sent at', 'Recipient'].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-2">{heading}</th>)}</tr></thead><tbody>{emails.map((email) => <tr key={email.id} className="border-b border-line-light last:border-0 hover:bg-panel/50"><td className="px-3 py-3 font-semibold text-ink">{email.subject || 'No subject'}</td><td className="px-3 py-3">{email.sentByName || email.senderName || 'Admin'}</td><td className="px-3 py-3 whitespace-nowrap">{formatDate(email.sentAt || email.createdAt)}</td><td className="px-3 py-3 text-muted">{email.recipientEmail || email.to || '—'}</td></tr>)}</tbody></table></div>;
}

export default function AgentDetails() {
  const { agencyId } = useParams();
  const navigate = useNavigate();
  const [agency, setAgency] = useState(null);
  const [stats, setStats] = useState({});
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [supportTicket, setSupportTicket] = useState(null);
  const [supportMessages, setSupportMessages] = useState([]);
  const [emailHistory, setEmailHistory] = useState([]);
  const [emailHistoryLoading, setEmailHistoryLoading] = useState(false);
  const [emailRefresh, setEmailRefresh] = useState(0);
  const [tab, setTab] = useState('Overview');
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [actionError, setActionError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.get('/admin/agencies?page=1&pageSize=100'),
      api.get(`/admin/analytics/summary?agencyId=${encodeURIComponent(agencyId)}`),
      api.get(`/admin/bookings?agencyId=${encodeURIComponent(agencyId)}&page=1&pageSize=5`),
      api.get(`/admin/transactions?agencyId=${encodeURIComponent(agencyId)}&page=1&pageSize=5`),
    ])
      .then(([agencyData, summary, bookingData, paymentData]) => {
        if (cancelled) return;
        setAgency((agencyData.agencies || []).find((item) => item.id === agencyId) || null);
        setStats(summary || {});
        setBookings(bookingData.bookings || []);
        setPayments(paymentData.transactions || paymentData.payments || []);
      })
      .catch((err) => !cancelled && setError(err.message || 'Unable to load agent details'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [agencyId]);

  useEffect(() => {
    let cancelled = false;
    setEmailHistoryLoading(true);
    api.get(`/admin/agencies/${encodeURIComponent(agencyId)}/emails?page=1&pageSize=50`)
      .then(({ emails }) => !cancelled && setEmailHistory(emails || []))
      .catch(() => !cancelled && setEmailHistory([]))
      .finally(() => !cancelled && setEmailHistoryLoading(false));
    return () => { cancelled = true; };
  }, [agencyId, emailRefresh]);

  useEffect(() => {
    let cancelled = false;
    api.get('/admin/support/tickets?page=1&pageSize=100')
      .then(async ({ tickets }) => {
        const latest = (tickets || []).find((ticket) => ticket.agencyId === agencyId);
        if (!latest) return;
        const detail = await api.get(`/admin/support/tickets/${latest.id}`);
        if (!cancelled) {
          setSupportTicket(latest);
          setSupportMessages(detail.messages || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSupportTicket(null);
          setSupportMessages([]);
        }
      });
    return () => { cancelled = true; };
  }, [agencyId]);

  const metrics = useMemo(() => [
    ['Lifetime Revenue', formatCurrency(stats.totalRevenue), 'From agent bookings', LuCircleDollarSign, 'green'],
    ['Total Bookings', stats.totalBookings || 0, 'All time bookings', LuCalendarDays, 'blue'],
    ['Pending Payments', formatCurrency(stats.outstanding || stats.outstandingBalance), 'Unpaid amount', LuClock3, 'amber'],
    ['Cancelled Bookings', stats.cancelledBookings || 0, 'Of total bookings', LuReceipt, 'red'],
    ['Completed Bookings', stats.completedBookings || 0, 'Completed trips', LuCheck, 'green'],
    ['Total Travellers', stats.totalTravellers || 0, 'Across all bookings', LuUsers, 'violet'],
    ['Outstanding Balance', formatCurrency(stats.outstanding || stats.outstandingBalance), 'Pending balance', LuWallet, 'amber'],
    ['Refunded Amount', formatCurrency(stats.refundedAmount), 'Total refunded', LuCircleDollarSign, 'violet'],
  ], [stats]);

  // Asked first in the shared ConfirmDialog; a failure shows there.
  const [confirmDisable, setConfirmDisable] = useState(false);

  async function disableAgent() {
    setDisabling(true);
    setActionError('');
    try {
      const { agency: updated } = await api.patch(`/admin/agencies/${agencyId}`, { status: 'suspended' });
      setAgency((current) => ({ ...current, ...updated, status: updated?.status || 'suspended' }));
      setActionsOpen(false);
      setConfirmDisable(false);
    } finally {
      setDisabling(false);
    }
  }

  if (loading) return <div className="p-8 text-sm text-muted">Loading agent details…</div>;
  if (!agency) return <div className="p-8"><ErrorText>{error || 'Agent not found.'}</ErrorText><Link to="/admin/manage-agents" className="mt-4 inline-flex text-sm font-semibold text-accent">Back to Manage Agents</Link></div>;

  return <><div className="min-h-screen bg-[#F4F7FF]"><div className="mx-auto max-w-7xl p-5 lg:p-8">
    <div className="mb-4 flex items-center justify-between"><button type="button" onClick={() => navigate('/admin/manage-agents')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-accent"><LuArrowLeft size={14} /> Back to Manage Agents</button><div className="relative"><button type="button" aria-label="More actions" aria-expanded={actionsOpen} onClick={() => setActionsOpen((open) => !open)} className="flex h-8 w-8 items-center justify-center rounded-md border border-line-light bg-white text-muted hover:border-accent hover:text-accent"><LuEllipsisVertical size={15} /></button>{actionsOpen && <div className="absolute right-0 top-10 z-20 w-44 rounded-md border border-line-light bg-white p-1.5 shadow-lg"><button type="button" disabled={disabling || agency.status === 'suspended'} onClick={() => setConfirmDisable(true)} className="w-full rounded px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">{disabling ? 'Disabling…' : agency.status === 'suspended' ? 'Account disabled' : 'Disable Account'}</button></div>}</div></div>
    {actionError && <ErrorText>{actionError}</ErrorText>}
    <Card className="mb-4 border-white p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#132447] text-sm font-bold text-white">{agency.name.slice(0, 2).toUpperCase()}</div><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-bold text-ink">{agency.name}</h1><Badge tone={STATUS_BADGE[agency.status] || 'grey'}>{agency.status}</Badge></div><p className="mt-1 text-xs text-muted">{agency.type === 'mice_company' ? 'MICE Company' : 'Travel Agent'} · Registered {formatDate(agency.createdAt)}</p></div></div><div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-muted sm:grid-cols-4"><span className="flex items-center gap-1.5"><LuMail size={13} />{agency.email || agency.ownerEmail || '—'}</span><span className="flex items-center gap-1.5"><LuPhone size={13} />{agency.phone || '—'}</span><span className="flex items-center gap-1.5"><LuUserRound size={13} />{agency.rmName || 'No RM assigned'}</span><span className="flex items-center gap-1.5"><LuFileText size={13} />{agency.licenseNumber || '—'}</span></div></div></Card>
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value, hint, icon, tone]) => <Metric key={label} label={label} value={value} hint={hint} icon={icon} tone={tone} />)}</div>
    <div className="mb-4 rounded-xl border border-[#E6E9F5] bg-white p-1.5 shadow-sm"><div className="grid grid-cols-9 items-center gap-1">{TABS.map(({ label, icon: Icon }) => { const active = tab === label; return <button key={label} type="button" onClick={() => setTab(label)} className={`relative flex min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-1.5 py-2.5 text-[11px] font-semibold transition-colors ${active ? 'bg-[#EEF0FF] text-[#4F46E5]' : 'text-[#4B5575] hover:bg-slate-50 hover:text-ink'}`}><Icon size={16} className={active ? 'shrink-0 text-[#4F46E5]' : 'shrink-0 text-[#5B6484]'} />{label}{active && <span className="absolute inset-x-1 bottom-0 h-[3px] rounded-full bg-[#4F46E5]" />}</button>; })}</div></div>
    {tab === 'Overview' && <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]"><div className="space-y-4"><Card label="Recent Bookings" className="border-white p-4"><BookingTable bookings={bookings} /></Card><Card label="Recent Payments" className="border-white p-4"><PaymentTable payments={payments} /></Card></div><Card label="Booking Summary" className="border-white p-4"><div className="space-y-3 text-xs">{[['Total bookings', stats.totalBookings || 0], ['Completed bookings', stats.completedBookings || 0], ['Pending payments', formatCurrency(stats.outstanding || stats.outstandingBalance)], ['Cancelled bookings', stats.cancelledBookings || 0], ['Total paid', formatCurrency(stats.totalRevenue)], ['Outstanding balance', formatCurrency(stats.outstanding || stats.outstandingBalance)], ['Last booking date', formatDate(stats.lastBookingAt)], ['Last payment date', formatDate(stats.lastPaymentAt)]].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 border-b border-line-light pb-2 last:border-0"><span className="text-muted">{label}</span><span className="font-semibold text-ink">{value}</span></div>)}</div></Card></div>}
    {tab === 'Bookings' && <Card label="Bookings" className="border-white p-4"><BookingTable bookings={bookings} /></Card>}
    {tab === 'Payments' && <Card label="Payments" className="border-white p-4"><PaymentTable payments={payments} /></Card>}
    {tab === 'Personal Details' && <Card label="Personal & Company Details" className="border-white"><div className="grid gap-3 text-sm sm:grid-cols-2">{[['Company name', agency.name], ['Email', agency.email || agency.ownerEmail], ['Phone', agency.phone], ['Country', agency.country], ['Agency type', agency.type === 'mice_company' ? 'MICE Company' : 'Travel Agent'], ['License number', agency.licenseNumber], ['Credit limit', formatCurrency(agency.creditLimit)], ['Relationship Manager', agency.rmName]].map(([label, value]) => <div key={label} className="rounded-md bg-panel px-3 py-2"><div className="text-[10px] font-semibold uppercase text-muted">{label}</div><div className="mt-1">{value || '—'}</div></div>)}</div></Card>}
    {tab === 'Support' && <Card label="Support" className="border-white"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-ink">Latest Chat</h2><p className="mt-1 text-xs text-muted">The most recent Contact Support conversation with this agent.</p></div><Link to="/admin/support" className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-accent/90"><LuSend size={14} /> Open Support</Link></div>{supportTicket ? <div className="rounded-lg border border-line-light bg-panel/50 p-4"><div><h3 className="font-semibold text-ink">{supportTicket.subject || 'Support conversation'}</h3><p className="mt-1 text-xs text-muted">Started {formatDate(supportTicket.createdAt)} · Last updated {formatDate(supportTicket.updatedAt)}</p></div><div className="mt-4 space-y-2">{supportMessages.slice(-3).map((message) => <div key={message.id} className="rounded-md bg-white px-3 py-2 text-sm text-ink"><div className="mb-1 flex justify-between gap-3 text-[10px] text-muted"><span>{message.senderName || 'Support'}</span><span>{formatDate(message.createdAt)}</span></div>{message.message || 'Attachment'}</div>)}</div><Link to={`/admin/support/${supportTicket.id}`} className="mt-4 inline-flex text-xs font-semibold text-accent hover:underline">View full conversation</Link></div> : <EmptyState>No support chats found for this agent.</EmptyState>}</Card>}
    {tab === 'Email' && <Card label="Email" className="border-white"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-ink">Sent Emails</h2><p className="mt-1 text-xs text-muted">Messages sent to this agent from the admin portal.</p></div><Button variant="accent" disabled={!agency.email && !agency.ownerEmail} onClick={() => setEmailModalOpen(true)}><LuMail size={14} /> Send Email</Button></div><EmailHistory emails={emailHistory} loading={emailHistoryLoading} /></Card>}
    {['Vouchers', 'Wishlist', 'Activity'].includes(tab) && <Card label={tab} className="border-white"><EmptyState>No {tab.toLowerCase()} available yet.</EmptyState></Card>}
  </div></div>{emailModalOpen && <EmailModal agency={agency} onClose={() => setEmailModalOpen(false)} onSent={() => setEmailRefresh((value) => value + 1)} />}
    {confirmDisable && (
      <ConfirmDialog
        title={`Disable ${agency.name || 'this agent'}?`}
        tone="warning"
        confirmLabel="Disable account"
        busyLabel="Disabling…"
        onCancel={() => setConfirmDisable(false)}
        onConfirm={disableAgent}
      >
        They will no longer be able to sign in to the agent portal.
      </ConfirmDialog>
    )}</>;
}
