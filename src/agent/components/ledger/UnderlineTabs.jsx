// Tabs sitting on a ruled line, each with a count. They scroll sideways on
// narrow screens instead of wrapping, so the page itself never overflows.
//   tabs: [{ key, label }]   counts: { [key]: number }
export function UnderlineTabs({ label, tabs, counts, active, onChange, theme = 'ledger' }) {
  const palette = theme === 'agent'
    ? { border: 'border-agent-line-light', accent: 'border-agent-accent-dark', ink: 'text-agent-ink', muted: 'text-agent-muted', count: 'bg-agent-accent-soft text-agent-ink-dark', soft: 'bg-agent-panel' }
    : { border: 'border-bk-line', accent: 'border-bk-accent', ink: 'text-bk-ink', muted: 'text-bk-muted', count: 'bg-bk-amber text-bk-accent-deep', soft: 'bg-bk-line-soft' };
  return (
    <nav aria-label={label} className={`border-b ${palette.border}`}>
      <div className="-mb-px flex gap-7 overflow-x-auto [scrollbar-width:none]">
        {tabs.map((t) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(t.key)}
              className={`flex flex-none items-center gap-2 whitespace-nowrap border-b-2 pb-3 pt-1 text-[13.5px] transition-colors focus:outline-none focus-visible:${palette.ink} ${
                isActive ? `${palette.accent} font-semibold ${palette.ink}` : `border-transparent ${palette.muted} hover:${palette.ink.replace('text-', 'text-')}`
              }`}
            >
              {t.label}
              <span
                className={`rounded px-1.5 py-px text-[11px] font-semibold tabular-nums ${
                  isActive ? palette.count : `${palette.soft} ${palette.muted}`
                }`}
              >
                {counts[t.key] || 0}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
