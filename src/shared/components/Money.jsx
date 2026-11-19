import { useSyncExternalStore } from 'react';
import {
  formatOmr,
  formatInr,
  getOmrToInrRate,
  subscribeOmrToInrRate,
} from '../currency.js';

// An amount in OMR with its INR equivalent in small text underneath (admin
// portal). The INR line appears as soon as the rate has loaded and follows
// every refresh of it, and is simply omitted until then.
//   <Money amount={1177} />            -> OMR 1,177.00
//                                         INR 285,917.62
//   <Money amount={x} align="right" /> -> right-aligned for table cells
export function Money({ amount, align = 'left', className = '', inrClassName = '' }) {
  useSyncExternalStore(subscribeOmrToInrRate, getOmrToInrRate);
  const inr = formatInr(amount);
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : '';
  return (
    <span className={`inline-block ${alignClass} ${className}`}>
      <span className="block">{formatOmr(amount)}</span>
      {inr && (
        <span className={`block text-[10px] font-normal leading-tight text-muted ${inrClassName}`}>
          {inr}
        </span>
      )}
    </span>
  );
}
