import { Badge } from '../ui.jsx';
import { requestStatus } from './visaAdminMeta.js';

export function RequestStatusBadge({ status, className = '' }) {
  const meta = requestStatus(status);
  return (
    <Badge tone={meta.tone} className={`${meta.className || ''} ${className}`}>
      {meta.label}
    </Badge>
  );
}
