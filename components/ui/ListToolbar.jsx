import { Search, X } from 'lucide-react'

// One reusable list control — search + dropdown filters + sort, and a mass-select action bar when
// rows are selected. Fully controlled: the parent owns state and does the actual filtering/selection.
// Used by the Tasks wall, By-Account, and any future list so the affordance is identical everywhere.
export default function ListToolbar({
  search, onSearch, searchPlaceholder = 'Search…',
  filters = [], sort, selectedCount = 0, onClearSelection, bulkActions = [], rightSlot,
}) {
  if (selectedCount > 0) {
    return (
      <div className="bg-coral-50 border border-coral-200 rounded-xl px-3 py-2 flex items-center gap-3">
        <button onClick={onClearSelection} className="p-1 rounded hover:bg-coral-100 text-coral-500" aria-label="Clear selection"><X className="w-4 h-4" /></button>
        <span className="text-sm font-medium text-coral-800">{selectedCount} selected</span>
        <div className="flex-1" />
        {bulkActions.map((a, i) => (
          <button key={i} onClick={a.onClick} disabled={a.disabled}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium disabled:opacity-40 ${a.variant === 'danger' ? 'text-red-600 border border-red-200 bg-white hover:bg-red-50' : 'text-slate-700 border border-slate-200 bg-white hover:bg-slate-50'}`}>
            {a.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-2 flex-wrap">
      {onSearch && (
        <div className="flex items-center gap-2 bg-gray-50 border border-slate-200 rounded-lg px-2.5 h-8 min-w-[180px] flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <input value={search || ''} onChange={(e) => onSearch(e.target.value)} placeholder={searchPlaceholder}
            className="flex-1 min-w-0 text-sm outline-none bg-transparent" />
          {search && <button onClick={() => onSearch('')} className="text-slate-300 hover:text-slate-500 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>}
        </div>
      )}
      {filters.map((f) => (
        <select key={f.key} value={f.value} onChange={(e) => f.onChange(e.target.value)}
          className="h-8 text-sm border border-slate-200 rounded-lg px-2 bg-white text-slate-700 max-w-[160px]">
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ))}
      {sort && (
        <select value={sort.value} onChange={(e) => sort.onChange(e.target.value)}
          className="h-8 text-sm border border-slate-200 rounded-lg px-2 bg-white text-slate-600">
          {sort.options.map((o) => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}
        </select>
      )}
      {rightSlot && <><div className="flex-1" />{rightSlot}</>}
    </div>
  )
}
