import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

/**
 * TeacherPicker — searchable teacher selector.
 *
 * Props:
 *   teachers  – full teacher array (already filtered to Active if desired)
 *   value     – currently selected teacher id (string | number | '')
 *   onChange  – (id: string) => void
 *   placeholder – optional search placeholder
 *   allowClear  – show "No Supervisor" clear option (default true)
 */
export default function TeacherPicker({ teachers, value, onChange, placeholder = 'Search by name or employee ID…', allowClear = true }) {
  const [query,  setQuery]  = useState('');
  const [open,   setOpen]   = useState(false);
  const containerRef        = useRef(null);

  const active = teachers.find(t => String(t.id) === String(value)) || null;

  // Reset search when modal closes / value changes externally
  useEffect(() => { setQuery(''); setOpen(false); }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = teachers.filter(t => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      t.name?.toLowerCase().includes(q) ||
      t.employeeId?.toLowerCase().includes(q)
    );
  });

  const select = (t) => {
    onChange(t ? String(t.id) : '');
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative space-y-1.5">
      {/* Selected chip */}
      {active && (
        <div className="flex items-center justify-between px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 truncate">{active.name}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-mono">{active.employeeId}</p>
          </div>
          {allowClear && (
            <button
              type="button"
              onClick={() => select(null)}
              className="ml-2 p-0.5 text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 shrink-0 rounded"
              title="Remove supervisor"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={active ? 'Search to change…' : placeholder}
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg pl-8 pr-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
        />
        {query && (
          <button type="button" onClick={() => { setQuery(''); setOpen(false); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X size={13} />
          </button>
        )}
      </div>

      {/* Dropdown list */}
      {open && (
        <div className="absolute z-50 w-full mt-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
          <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
            {allowClear && (
              <button
                type="button"
                onClick={() => select(null)}
                className="w-full px-3 py-2.5 text-left text-sm text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 italic"
              >
                — No Supervisor —
              </button>
            )}
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-sm text-slate-400 dark:text-slate-500 text-center">No teachers found</p>
            ) : (
              filtered.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => select(t)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${String(t.id) === String(value) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                >
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{t.name}</span>
                  <span className="text-xs font-mono text-slate-400 dark:text-slate-500 shrink-0 ml-2">{t.employeeId}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {!open && !active && (
        <p className="text-xs text-slate-400 dark:text-slate-500">Type a name or employee ID to search</p>
      )}
    </div>
  );
}
