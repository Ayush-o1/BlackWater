import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check, Search } from 'lucide-react';

export interface ServiceOption {
  id: string;
  name: string;
  status?: string;
}

interface ServiceMultiSelectProps {
  label?: string;
  options: ServiceOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  isLoading?: boolean;
  placeholder?: string;
}

const statusDot: Record<string, string> = {
  OPERATIONAL: 'bg-green-400',
  DEGRADED: 'bg-yellow-400',
  PARTIAL_OUTAGE: 'bg-orange-400',
  MAJOR_OUTAGE: 'bg-red-400',
};

export function ServiceMultiSelect({
  label,
  options,
  selected,
  onChange,
  isLoading = false,
  placeholder = 'Select services...',
}: ServiceMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredOptions = options.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const remove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter((s) => s !== id));
  };

  const selectedOptions = options.filter((o) => selected.includes(o.id));

  return (
    <div className="w-full flex flex-col gap-1.5" ref={containerRef}>
      {label && (
        <label className="text-sm font-medium text-gray-300">{label}</label>
      )}

      {/* Trigger */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => !isLoading && setOpen((prev) => !prev)}
        onKeyDown={(e) => e.key === 'Enter' && setOpen((prev) => !prev)}
        className={`
          relative min-h-[42px] w-full rounded-lg border border-border bg-surface px-3 py-2
          text-sm text-white cursor-pointer select-none
          focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
          transition-all duration-200
          ${open ? 'ring-2 ring-primary border-transparent' : ''}
          ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/50'}
        `}
      >
        <div className="flex flex-wrap gap-1.5 pr-8">
          {isLoading ? (
            <span className="text-gray-500">Loading services...</span>
          ) : selectedOptions.length === 0 ? (
            <span className="text-gray-500">{placeholder}</span>
          ) : (
            selectedOptions.map((opt) => (
              <span
                key={opt.id}
                className="inline-flex items-center gap-1 rounded-md bg-primary/20 border border-primary/30 px-2 py-0.5 text-xs font-medium text-primary"
              >
                {opt.status && (
                  <span className={`w-1.5 h-1.5 rounded-full ${statusDot[opt.status] ?? 'bg-gray-400'}`} />
                )}
                {opt.name}
                <button
                  type="button"
                  onClick={(e) => remove(opt.id, e)}
                  className="ml-0.5 text-primary/60 hover:text-primary transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </div>
        <ChevronDown
          className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-[200] mt-1 w-full max-w-sm rounded-lg border border-border bg-[#1a1d27] shadow-2xl shadow-black/50 overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search services..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-600 focus:outline-none"
            />
          </div>

          {/* Options list */}
          <ul className="max-h-48 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500">No services found</li>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selected.includes(opt.id);
                return (
                  <li
                    key={opt.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggle(opt.id)}
                    className={`
                      flex items-center justify-between px-3 py-2 text-sm cursor-pointer
                      transition-colors duration-100
                      ${isSelected
                        ? 'bg-primary/10 text-white'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2">
                      {opt.status && (
                        <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot[opt.status] ?? 'bg-gray-400'}`} />
                      )}
                      <span>{opt.name}</span>
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                    )}
                  </li>
                );
              })
            )}
          </ul>

          {/* Footer */}
          {selected.length > 0 && (
            <div className="px-3 py-2 border-t border-border flex items-center justify-between">
              <span className="text-xs text-gray-500">{selected.length} selected</span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-gray-500 hover:text-white transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
