import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, CheckCircle2, XCircle, Search, ChevronDown, ChevronUp } from 'lucide-react'
import AppShell from '../../../components/layout/AppShell'

const ACTION_LABELS = {
  note_created: 'Note created',
  deal_updated: 'Deal updated',
  stage_synced: 'Stage synced',
  contact_created: 'Contact created',
  deal_created: 'Deal created',
}

const ACTION_COLORS = {
  note_created: 'bg-blue-50 text-blue-700 border-blue-200',
  deal_updated: 'bg-purple-50 text-purple-700 border-purple-200',
  stage_synced: 'bg-teal-50 text-teal-700 border-teal-200',
  contact_created: 'bg-green-50 text-green-700 border-green-200',
  deal_created: 'bg-indigo-50 text-indigo-700 border-indigo-200',
}

function ActionBadge({ action }) {
  const label = ACTION_LABELS[action] || action
  const color = ACTION_COLORS[action] || 'bg-gray-50 text-gray-700 border-gray-200'
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${color}`}>
      {label}
    </span>
  )
}

function EntryRow({ entry }) {
  const [expanded, setExpanded] = useState(false)

  const time = entry.created_at
    ? new Date(entry.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—'

  const payload = entry.payload || {}
  const result = entry.result || {}

  return (
    <div className={`border-b border-gray-100 ${entry.success === false ? 'bg-red-50' : ''}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        {entry.success === false
          ? <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          : <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <ActionBadge action={entry.action} />
            <span className="text-sm font-medium text-gray-900 truncate">
              {entry.account_name || '—'}
            </span>
            {entry.triggered_by && (
              <span className="text-xs text-gray-400">{entry.triggered_by}</span>
            )}
          </div>
          {entry.success === false && result.error && (
            <p className="text-xs text-red-600 mt-0.5 truncate">{result.error}</p>
          )}
          {payload.subject && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">"{payload.subject}"</p>
          )}
        </div>

        <span className="text-xs text-gray-400 flex-shrink-0 mr-2">{time}</span>

        <button
          onClick={() => setExpanded(e => !e)}
          className="text-gray-400 hover:text-gray-600 flex-shrink-0"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-3 ml-7 space-y-2">
          {entry.hubspot_deal_id && (
            <p className="text-xs text-gray-500">HubSpot deal: <span className="font-mono text-gray-700">{entry.hubspot_deal_id}</span></p>
          )}
          {Object.keys(payload).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Payload</p>
              <pre className="text-xs bg-gray-50 rounded p-2 overflow-x-auto text-gray-700">
                {JSON.stringify(payload, null, 2)}
              </pre>
            </div>
          )}
          {Object.keys(result).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Result</p>
              <pre className="text-xs bg-gray-50 rounded p-2 overflow-x-auto text-gray-700">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function HubSpotAuditLog() {
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [successFilter, setSuccessFilter] = useState('')
  const LIMIT = 50

  const load = useCallback(async (off, acct, action) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset: off })
      if (acct) params.set('account', acct)
      if (action) params.set('action', action)
      const r = await fetch(`/api/hubspot/sync-log?${params}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to load')
      setEntries(d.entries || [])
      setTotal(d.total || 0)
      setOffset(off)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(0, '', '') }, [load])

  const handleSearch = () => {
    setSearch(searchInput)
    load(0, searchInput, actionFilter)
  }

  const handleActionFilter = (val) => {
    setActionFilter(val)
    load(0, search, val)
  }

  const filteredEntries = successFilter === 'failed'
    ? entries.filter(e => e.success === false)
    : successFilter === 'success'
    ? entries.filter(e => e.success !== false)
    : entries

  const failCount = entries.filter(e => e.success === false).length

  return (
    <AppShell
      title="HubSpot Audit Log"
      subtitle="All HubSpot writes from the sales dashboard"
      actions={
        <button onClick={() => load(0, search, actionFilter)} className="p-1.5 hover:bg-gray-100 rounded-lg">
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>
      }
    >
      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Stats strip */}
        <div className="flex items-center gap-6 mb-5 text-sm text-gray-600">
          <span><strong className="text-gray-900">{total.toLocaleString()}</strong> total entries</span>
          {failCount > 0 && (
            <span className="text-red-600"><strong>{failCount}</strong> failed in this page</span>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-0">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search account name..."
              className="flex-1 text-sm outline-none bg-transparent"
            />
            {searchInput && (
              <button onClick={() => { setSearchInput(''); setSearch(''); load(0, '', actionFilter) }} className="text-gray-400 hover:text-gray-600">×</button>
            )}
          </div>

          <select
            value={actionFilter}
            onChange={e => handleActionFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none"
          >
            <option value="">All actions</option>
            {Object.entries(ACTION_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>

          <select
            value={successFilter}
            onChange={e => setSuccessFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none"
          >
            <option value="">All results</option>
            <option value="success">Success only</option>
            <option value="failed">Failed only</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center py-16 text-sm text-gray-400 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Loading…
            </div>
          )}

          {!loading && error && (
            <div className="p-6 text-center text-sm text-red-600">{error}</div>
          )}

          {!loading && !error && filteredEntries.length === 0 && (
            <div className="py-16 text-center text-sm text-gray-400">No entries found.</div>
          )}

          {!loading && !error && filteredEntries.map(entry => (
            <EntryRow key={entry.id} entry={entry} />
          ))}
        </div>

        {/* Pagination */}
        {!loading && total > LIMIT && (
          <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
            <button
              onClick={() => load(Math.max(0, offset - LIMIT), search, actionFilter)}
              disabled={offset === 0}
              className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              {offset + 1}–{Math.min(offset + LIMIT, total)} of {total.toLocaleString()}
            </span>
            <button
              onClick={() => load(offset + LIMIT, search, actionFilter)}
              disabled={offset + LIMIT >= total}
              className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </AppShell>
  )
}
