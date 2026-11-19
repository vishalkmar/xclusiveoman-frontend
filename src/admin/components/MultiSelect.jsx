import { useEffect, useRef, useState } from 'react';
import { LuChevronDown } from 'react-icons/lu';
import { Checkbox, TextInput } from './ui.jsx';

// Searchable multi-select combobox — the same look as FdPackageEditor's
// AddonMultiSelectCard selector: chosen options show as removable pills on
// the closed trigger; opening it reveals a search box and a checkbox per
// option. `options` is [{ value, label, hint? }], `value` an array of the
// selected option values.
export default function MultiSelect({ options, value, onChange, placeholder = 'Select…', searchPlaceholder = 'Search', emptyText = 'Nothing to choose from yet.' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const boxRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.filter((o) => value.includes(o.value));
  const query = search.trim().toLowerCase();
  const filtered = query ? options.filter((o) => o.label.toLowerCase().includes(query)) : options;

  function toggle(optionValue) {
    onChange(value.includes(optionValue) ? value.filter((v) => v !== optionValue) : [...value, optionValue]);
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-[2.75rem] w-full flex-wrap items-center gap-1.5 rounded-lg border border-line-light bg-white px-2.5 py-2 text-left"
      >
        {selected.length === 0 ? (
          <span className="text-xs text-muted">{placeholder}</span>
        ) : (
          selected.map((o) => (
            <span
              key={o.value}
              className="inline-flex items-center gap-1 rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-2 py-1 text-[11px] font-semibold text-[#4338CA]"
            >
              {o.label}
              <span
                role="button"
                aria-label={`Remove ${o.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(o.value);
                }}
                className="cursor-pointer opacity-70 hover:opacity-100"
              >
                ×
              </span>
            </span>
          ))
        )}
        <LuChevronDown size={14} className={`ml-auto flex-none text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute inset-x-0 z-20 mt-1.5 rounded-lg border border-line-light bg-white p-2 shadow-lg">
          <TextInput
            autoFocus
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-2 py-2 text-xs"
          />
          <div className="max-h-44 space-y-0.5 overflow-y-auto">
            {options.length === 0 ? (
              <p className="px-1 py-2 text-[11px] text-muted">{emptyText}</p>
            ) : filtered.length === 0 ? (
              <p className="px-1 py-2 text-[11px] text-muted">No matches.</p>
            ) : (
              filtered.map((o) => (
                <Checkbox key={o.value} checked={value.includes(o.value)} onChange={() => toggle(o.value)} label={o.label} hint={o.hint} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
