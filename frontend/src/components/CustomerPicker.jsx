import { useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-react';
import { referenceService } from '../services/referenceService';

/**
 * Search-as-you-type customer chooser. Looks customers up on the server, so it works the same with
 * ten customers or ten thousand (the old dropdown only ever showed the first 100).
 */
export default function CustomerPicker({ selected, onSelect, initial = [] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(initial);
  const [loading, setLoading] = useState(false);
  const box = useRef(null);
  const input = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    let stale = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const rows = await referenceService.customers(query.trim());
        if (!stale) setResults(rows);
      } finally {
        if (!stale) setLoading(false);
      }
    }, query ? 250 : 0);
    return () => { stale = true; clearTimeout(t); };
  }, [query, open]);

  const pick = (c) => {
    onSelect(c);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium text-left focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <span className="truncate">
          {selected ? (
            <>
              {selected.name}
              {selected.company ? <span className="text-slate-500 font-normal"> ({selected.company})</span> : null}
            </>
          ) : (
            <span className="text-slate-400 font-normal">Search for a customer…</span>
          )}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-slate-200 bg-white shadow-lg animate-[pop-in_0.2s_var(--ease-apple)]">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              ref={input}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a name, company or email"
              className="bare-input h-10 flex-1 border-0 bg-transparent text-sm"
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {results.length === 0 && !loading && (
              <li className="px-3 py-6 text-center text-sm text-slate-500">No customers match “{query}”.</li>
            )}
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected?.id === c.id}
                  onClick={() => pick(c)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{c.name}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {[c.company, c.email].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {selected?.id === c.id && <Check className="h-4 w-4 text-brand-600" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
