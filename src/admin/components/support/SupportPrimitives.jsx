import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuChevronDown, LuChevronRight, LuEllipsis } from 'react-icons/lu';
import { PRIORITY_META, STATUS_META } from './supportMeta.js';

// Small building blocks for the Support Center analytics. Visual language
// follows admin/components/ui.jsx (#E4E9FB borders, indigo accent, 11px
// uppercase labels) — just tighter, since a dashboard packs more per screen.

export function StatusPill({ status, className = '' }) {
  const meta = STATUS_META[status] || STATUS_META.new;
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.pill} ${className}`}>
      {meta.label}
    </span>
  );
}

export function PriorityTag({ priority }) {
  const meta = PRIORITY_META[priority] || PRIORITY_META.medium;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-ink">
      <span className="h-2 w-2 flex-none rounded-full" style={{ background: meta.dot }} />
      {meta.label}
    </span>
  );
}

export function Avatar({ name, size = 'md' }) {
  const sizes = { sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-xs', lg: 'h-11 w-11 text-sm' };
  const initials = String(name || '?').split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?';
  return <span className={`flex flex-none items-center justify-center rounded-full bg-[#EEF2FF] font-semibold text-[#4338CA] ${sizes[size]}`}>{initials}</span>;
}

export function Panel({ title, subtitle, actions, children, className = '', bodyClassName = 'p-4 sm:p-5' }) {
  return (
    <section className={`min-w-0 rounded-lg border border-[#E4E9FB] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-[#EEF1FA] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-[#EEF1FA] ${className}`} />;
}

export function EmptyState({ icon: Icon, title, hint, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center px-4 py-8 text-center ${className}`}>
      {Icon && (
        <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F4FF] text-[#6366F1]">
          <Icon size={18} />
        </span>
      )}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-xs text-muted">{hint}</p>}
    </div>
  );
}

// Compact select used across the filter bar and the drawer.
export function MiniSelect({ label, value, onChange, children, className = '', ...props }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      {label && <span className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full min-w-0 rounded-md border border-[#D7DDF0] bg-white px-2.5 text-xs text-ink focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/15"
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

// Row/drawer action menu. Rendered in a portal with fixed positioning so it
// is never clipped by a horizontally-scrolling table, and flips upward when
// there's no room below. Items: { label, icon, onClick, disabled, tone } or
// { label, icon, children: [{ label, onClick, active }] } for an inline
// sub-list (Assign / Change priority).
export function ActionMenu({ items, label = 'Actions', trigger }) {
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [position, setPosition] = useState(null);

  useLayoutEffect(() => {
    if (!open) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight || 240;
    const width = 220;
    const below = rect.bottom + 4 + menuHeight < window.innerHeight;
    setPosition({
      top: below ? rect.bottom + 4 : Math.max(8, rect.top - 4 - menuHeight),
      left: Math.min(window.innerWidth - width - 8, Math.max(8, rect.right - width)),
      width,
    });
  }, [open, expanded]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (e.type === 'keydown' && e.key !== 'Escape') return;
      if (e.type === 'mousedown' && (menuRef.current?.contains(e.target) || buttonRef.current?.contains(e.target))) return;
      setOpen(false);
    };
    const closeOnScroll = (e) => {
      if (!menuRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', closeOnScroll, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [open]);

  function run(fn) {
    setOpen(false);
    setExpanded(null);
    fn?.();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(null);
          setOpen((v) => !v);
        }}
        className={trigger ? '' : 'flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-[#F3F4FF] hover:text-[#4F46E5]'}
      >
        {trigger || <LuEllipsis size={17} />}
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onClick={(e) => e.stopPropagation()}
            style={position ? { top: position.top, left: position.left, width: position.width } : { visibility: 'hidden', top: 0, left: 0 }}
            className="fixed z-[1000] max-h-[70vh] overflow-y-auto rounded-lg border border-[#E4E9FB] bg-white py-1 shadow-[0_12px_32px_rgba(15,23,42,0.14)]"
          >
            {items.filter(Boolean).map((item) => {
              const Icon = item.icon;
              if (item.children) {
                const isOpen = expanded === item.label;
                return (
                  <div key={item.label}>
                    <button type="button" role="menuitem" onClick={() => setExpanded(isOpen ? null : item.label)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-ink hover:bg-[#F6F7FF]">
                      {Icon && <Icon size={15} className="flex-none text-muted" />}
                      <span className="flex-1">{item.label}</span>
                      {isOpen ? <LuChevronDown size={14} className="text-muted" /> : <LuChevronRight size={14} className="text-muted" />}
                    </button>
                    {isOpen && (
                      <div className="border-y border-[#F1F3FA] bg-[#FAFBFF] py-1">
                        {item.children.length === 0 && <p className="px-9 py-1.5 text-[11px] text-muted">No options</p>}
                        {item.children.map((child) => (
                          <button key={child.label} type="button" role="menuitem" onClick={() => run(child.onClick)} className={`flex w-full items-center px-9 py-1.5 text-left text-xs hover:bg-[#EEF2FF] ${child.active ? 'font-semibold text-[#4F46E5]' : 'text-ink'}`}>
                            <span className="truncate">{child.label}</span>
                            {child.active && <span className="ml-auto pl-2 text-[10px] uppercase">Current</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => run(item.onClick)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium hover:bg-[#F6F7FF] disabled:cursor-not-allowed disabled:opacity-40 ${item.tone === 'success' ? 'text-[#047857]' : 'text-ink'}`}
                >
                  {Icon && <Icon size={15} className="flex-none text-muted" />}
                  {item.label}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
