import { useState, useRef, useEffect, useMemo } from 'react';

/**
 * SearchableSelect — a dropdown with a built-in search box and scrollable option list.
 *
 * Props:
 *   options   : Array<{ value: string|number, label: string }>
 *   value     : currently selected value (or '')
 *   onChange  : (value) => void
 *   placeholder : text shown when nothing is selected
 *   clearable : if true, shows a small ✕ button to clear the selection
 *   emptyText : message shown when the search returns no results
 */
export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Select...',
  clearable = false,
  emptyText = 'No matching options',
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);

  const selected = options.find(o => String(o.value) === String(value));

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, search]);

  // Close when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus search box when opened
  useEffect(() => {
    if (open) {
      setSearch('');
      setHighlight(0);
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlight]) {
        onChange(filtered[highlight].value);
        setOpen(false);
        setSearch('');
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Keep highlighted option in view while scrolling
  useEffect(() => {
    if (open && listRef.current) {
      const el = listRef.current.querySelector(`[data-index="${highlight}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlight, open]);

  const clear = (e) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`input text-left flex items-center justify-between gap-2 ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        <span className={`truncate ${selected ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-300'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {clearable && selected && (
            <span
              role="button"
              tabIndex={-1}
              onClick={clear}
              className="text-gray-400 hover:text-red-500 transition-colors"
              aria-label="Clear selection"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          )}
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-gray-600">
            <div className="relative">
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                ref={searchRef}
                className="input pl-9"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKey}
              />
            </div>
          </div>
          <ul ref={listRef} role="listbox" className="max-h-60 overflow-y-auto py-1">
            {filtered.length ? filtered.map((o, i) => (
              <li key={o.value} role="option" aria-selected={String(o.value) === String(value)} data-index={i}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => { onChange(o.value); setOpen(false); setSearch(''); }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    i === highlight ? 'bg-green-50 dark:bg-green-900/40' : ''
                  } ${
                    String(o.value) === String(value)
                      ? 'text-green-700 dark:text-green-300 font-medium'
                      : 'text-gray-700 dark:text-gray-200'
                  }`}
                >
                  {o.label}
                </button>
              </li>
            )) : (
              <li className="px-3 py-3 text-sm text-gray-400 dark:text-gray-400 text-center">{emptyText}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
