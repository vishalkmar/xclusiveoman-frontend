import { StatusBadge } from '../ledger/StatusBadge.jsx';
import { bookingStatus } from './bookingMeta.js';

// Booking status label — colour comes from the real status (bookingMeta.js),
// so every state reads at a glance.
export function BookingStatusBadge({ status, className = '' }) {
  const { label, tone } = bookingStatus(status);
  return <StatusBadge tone={tone} label={label} className={className} />;
}
