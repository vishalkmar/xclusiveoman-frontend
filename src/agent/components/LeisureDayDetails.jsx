import { FaHotel, FaUmbrellaBeach } from 'react-icons/fa6';

// Body of an FD itinerary day the admin marked as a Leisure day
// (0105_fd_itinerary_leisure.sql, FdPackageEditor.jsx) — no tours, transfers
// or activities, just free time, the hotel for that night if one was chosen,
// and the admin's optional remark. Shared by DepartureDetail.jsx's
// day-by-day list and FdItineraryDocument.jsx (the downloadable PDF) so both
// say the same thing.
export default function LeisureDayDetails({ day }) {
  const hotels = (day.items || []).filter((item) => item.type === 'hotel');
  const transfers = (day.items || []).filter((item) => item.type === 'transfer');
  const remark = (day.leisureRemark || '').trim();

  return (
    <div className="space-y-2.5 break-inside-avoid">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-agent-accent/50 bg-agent-accent-soft px-3 py-1 text-xs font-semibold text-agent-accent-dark">
        <FaUmbrellaBeach size={12} />
        Leisure Day — free time at your own pace
      </span>
      {hotels.map((hotel, idx) => (
        <p key={`${hotel.id}:${idx}`} className="flex items-start gap-2 text-sm text-[#4B4844]">
          <FaHotel size={13} className="mt-0.5 flex-none text-agent-accent-dark" />
          <span>
            <span className="font-semibold text-[#1B1B1B]">Stay: {hotel.name || 'Hotel'}</span>
            {hotel.city && ` · ${hotel.city}`}
          </span>
        </p>
      ))}
      {transfers.map((transfer, idx) => (
        <p key={`${transfer.id}:${idx}`} className="flex items-start gap-2 text-sm text-[#4B4844]">
          <span className="font-semibold text-agent-accent-dark">Transfer:</span>
          <span>{transfer.name || 'Transfer'}{transfer.note ? ` (${transfer.note})` : ''}</span>
        </p>
      ))}
      {remark && <p className="whitespace-pre-line text-sm leading-relaxed text-[#6B6B65]">{remark}</p>}
    </div>
  );
}
