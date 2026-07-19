import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Search, Check, Clock } from 'lucide-react'
import StageBadge from './StageBadge'
import { ACTIVE_STAGE_ORDER } from '../../lib/constants'

const RECENTS_KEY = 'content_recent_accounts'
const ACTIVE = new Set(ACTIVE_STAGE_ORDER)
const CAP = 100 // cap rendered rows; search/scoping keeps the useful set well under this

function loadRecents() {
  try { const r = JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]'); return Array.isArray(r) ? r : [] } catch { return [] }
}

// Searchable account picker. Type to filter across ALL accounts; with no query it browses Recents +
// active pipeline (toggle reveals closed/inactive). Controlled like the old <select> — onChange(id)
// only fires on an explicit pick (click/Enter), so arrow-key highlighting can't trigger a paid
// re-generation, and Content Studio's accountId-keyed edit cache is preserved (no remount).
export default function AccountCombobox({ accounts = [], value, onChange, placeholder = 'Select an account…' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [hi, setHi] = useState(0)
  const [recentIds, setRecentIds] = useState([])
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => { setRecentIds(loadRecents()) }, [])

  useEffect(() => {
    const h = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => { if (open) { setQuery(''); setHi(0); setTimeout(() => inputRef.current?.focus(), 0) } }, [open])

  const selected = accounts.find(a => a.id === value) || null
  const q = query.trim().toLowerCase()

  const { recentRows, rows, overflow } = useMemo(() => {
    if (q) {
      const matches = accounts.filter(a => (a.name || '').toLowerCase().includes(q))
      return { recentRows: [], rows: matches.slice(0, CAP), overflow: Math.max(0, matches.length - CAP) }
    }
    const byId = new Map(accounts.map(a => [a.id, a]))
    const recents = recentIds.map(id => byId.get(id)).filter(Boolean).slice(0, 5)
    const recentSet = new Set(recents.map(a => a.id))
    const browse = accounts.filter(a => !recentSet.has(a.id) && (showAll || ACTIVE.has(a.stage)))
    return { recentRows: recents, rows: browse.slice(0, CAP), overflow: Math.max(0, browse.length - CAP) }
  }, [q, accounts, recentIds, showAll])

  const flat = q ? rows : [...recentRows, ...rows]

  useEffect(() => { setHi(0) }, [q, showAll])
  useEffect(() => { listRef.current?.querySelector(`[data-idx="${hi}"]`)?.scrollIntoView({ block: 'nearest' }) }, [hi, open])

  const commit = (a) => {
    if (!a) return
    onChange?.(a.id)
    const next = [a.id, ...recentIds.filter(id => id !== a.id)].slice(0, 5)
    setRecentIds(next)
    try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)) } catch {}
    setOpen(false); setQuery('')
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, flat.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); commit(flat[hi]) }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
  }

  const renderRow = (a, i, recent) => (
    <button
      key={recent ? `r-${a.id}` : a.id}
      type="button"
      data-idx={i}
      onClick={() => commit(a)}
      onMouseEnter={() => setHi(i)}
      className={`w-full flex items-center gap-2 px-3 py-2 text-left ${i === hi ? 'bg-coral-50' : 'hover:bg-slate-50'}`}
    >
      {recent && <Clock className="w-3 h-3 text-slate-300 flex-shrink-0" />}
      <span className={`flex-1 min-w-0 truncate text-sm ${a.id === value ? 'font-semibold text-coral-700' : 'font-medium text-slate-800'}`}>{a.name}</span>
      <StageBadge stage={a.stage} />
      {a.id === value && <Check className="w-3.5 h-3.5 text-coral-600 flex-shrink-0" />}
    </button>
  )

  let idx = -1

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="mt-1 w-full flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm text-left bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-coral-200"
      >
        <span className="flex-1 min-w-0 truncate">
          {selected
            ? <span className="font-medium text-slate-800">{selected.name}</span>
            : <span className="text-slate-400">{placeholder}</span>}
        </span>
        {selected && <StageBadge stage={selected.stage} />}
        <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search accounts…"
              className="flex-1 text-sm outline-none placeholder:text-slate-400 bg-transparent"
            />
          </div>

          <div ref={listRef} className="max-h-72 overflow-y-auto py-1">
            {flat.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-slate-400">
                {q ? `No accounts match “${query}”.` : 'No active accounts — use “Show all” below.'}
              </p>
            )}

            {!q && recentRows.length > 0 && (
              <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Recent</p>
            )}
            {!q && recentRows.map(a => { idx++; return renderRow(a, idx, true) })}

            {!q && recentRows.length > 0 && rows.length > 0 && (
              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {showAll ? 'All accounts' : 'Active pipeline'}
              </p>
            )}
            {rows.map(a => { idx++; return renderRow(a, idx, false) })}

            {overflow > 0 && (
              <p className="px-3 py-2 text-xs text-slate-400 italic">+{overflow} more — keep typing to narrow.</p>
            )}
          </div>

          {!q && (
            <button
              type="button"
              onClick={() => setShowAll(s => !s)}
              className="w-full px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 border-t border-gray-100 text-left"
            >
              {showAll ? '← Active pipeline only' : 'Show all accounts (incl. closed & inactive) →'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
