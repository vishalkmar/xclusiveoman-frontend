// Page title (navy serif) with an accent-dashed subtitle on the left and the
// page's search/filter controls (`children`) on the right.
export function PageHeading({ title, subtitle, children, compact = false, theme = 'ledger' }) {
  const palette = theme === 'agent'
    ? { title: 'text-agent-ink-dark', accent: 'bg-agent-accent-dark' }
    : { title: 'text-bk-navy', accent: 'bg-bk-accent' };
  return (
    <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-10">
      <div className="min-w-0">
        <h2 className={`font-serif font-bold leading-tight tracking-tight ${palette.title} ${compact ? 'text-[28px] sm:text-[32px]' : 'text-[32px] sm:text-[38px]'}`}>{title}</h2>
        {subtitle && (
          <p className="mt-1.5 flex items-start gap-2.5 text-sm text-agent-muted">
            <span aria-hidden className={`mt-[0.6em] h-[2px] w-5 flex-none rounded-full ${palette.accent}`} />
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </header>
  );
}
