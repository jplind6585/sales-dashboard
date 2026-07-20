import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft, RefreshCw, Search, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, Clock, Link2Off } from 'lucide-react'
import UserMenu from '../../../components/auth/UserMenu'
import { useAuthStore } from '../../../stores/useAuthStore'
import ModulesNav from '../../../components/layout/ModulesNav'
import StageBadge from '../../../components/ui/StageBadge'

const CALL_TYPE_META = {
  intro:               { label: 'Intro',            color: 'bg-blue-100 text-blue-700' },
  demo:                { label: 'Demo',             color: 'bg-violet-100 text-violet-700' },
  solution_validation: { label: 'Sol. Validation',  color: 'bg-amber-100 text-amber-700' },
  implementation:      { label: 'Implementation',   color: 'bg-emerald-100 text-emerald-700' },
  training:            { label: 'Training',         color: 'bg-green-100 text-green-700' },
  customer_success:    { label: 'Cust. Success',    color: 'bg-teal-100 text-teal-700' },
  other:               { label: 'Other',            color: 'bg-gray-100 text-gray-500' },
  unknown:             { label: '—',                color: 'bg-gray-50 text-gray-400' },
  // Legacy — some older rows may still carry these
  evaluation:          { label: 'Evaluation',       color: 'bg-indigo-100 text-indigo-700' },
  discovery:           { label: 'Discovery',        color: 'bg-cyan-100 text-cyan-700' },
  pricing:             { label: 'Pricing',          color: 'bg-orange-100 text-orange-700' },
  contract:            { label: 'Contract',         color: 'bg-rose-100 text-rose-700' },
  qbr:                 { label: 'QBR',              color: 'bg-purple-100 text-purple-700' },
  cs:                  { label: 'Cust. Success',    color: 'bg-teal-100 text-teal-700' },
  recurring:           { label: 'Recurring',        color: 'bg-gray-100 text-gray-600' },
}

const CATEGORY_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'sales', label: 'Sales' },
  { value: 'cs', label: 'CS' },
  { value: 'internal', label: 'Internal' },
  { value: 'unknown', label: 'Unknown' },
]

const CALL_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'intro', label: 'Intro' },
  { value: 'demo', label: 'Demo' },
  { value: 'solution_validation', label: 'Solution Validation' },
  { value: 'implementation', label: 'Implementation' },
  { value: 'training', label: 'Training' },
  { value: 'customer_success', label: 'Customer Success' },
  { value: 'other', label: 'Other' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'analyzed', label: 'Analyzed' },
  { value: 'pending', label: 'Pending' },
  { value: 'ignored', label: 'Ignored' },
]

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function fmtDuration(secs) {
  if (!secs) return '—'
  const m = Math.round(secs / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function ScoreDot({ value, max = 10 }) {
  if (value == null) return <span className="text-gray-300 text-xs">—</span>
  const pct = value / max
  const color = pct >= 0.7 ? 'text-green-600' : pct >= 0.5 ? 'text-amber-500' : 'text-red-500'
  return <span className={`text-xs font-semibold ${color}`}>{value}</span>
}

function SummaryCard({ label, value, color = 'text-gray-900', sub }) {
  return (
    <div className="bg-white rounded-lg border border-gray-100 px-4 py-3">
      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function CallTypeBadge({ type }) {
  const meta = CALL_TYPE_META[type] || CALL_TYPE_META.unknown
  return (
    <span className={`inline-block text-xs px-1.5 py-0.5 rounded-md font-medium whitespace-nowrap ${meta.color}`}>
      {meta.label}
    </span>
  )
}

function CategoryPill({ category }) {
  const meta = {
    sales:    { label: 'Sales',     color: 'bg-blue-50 text-blue-600 border-blue-100' },
    cs:       { label: 'CS',        color: 'bg-teal-50 text-teal-600 border-teal-100' },
    internal: { label: 'Internal',  color: 'bg-slate-50 text-slate-500 border-slate-100' },
    unknown:  { label: '?',         color: 'bg-gray-50 text-gray-400 border-gray-100' },
  }
  const m = meta[category] || meta.unknown
  return (
    <span className={`inline-block text-xs px-1.5 py-0.5 rounded-md border font-medium ${m.color}`}>
      {m.label}
    </span>
  )
}

export default function CallRegistry() {
  const router = useRouter()
  const profile = useAuthStore(s => s.profile)

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)

  const [page, setPage] = useState(0)
  const [rep, setRep] = useState('')
  const [status, setStatus] = useState('all')
  const [callCategory, setCallCategory] = useState('')
  const [callType, setCallType] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const searchTimer = useRef(null)

  const load = useCallback(async (pg = page) => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({
      page: pg,
      limit: 50,
      status,
      ...(rep && { rep }),
      ...(callCategory && { callCategory }),
      ...(callType && { callType }),
      ...(search && { search }),
      ...(dateFrom && { dateFrom }),
      ...(dateTo && { dateTo }),
    })
    try {
      const res = await fetch(`/api/call-registry?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load')
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [page, rep, status, callCategory, callType, search, dateFrom, dateTo])

  useEffect(() => {
    setPage(0)
    setExpanded(null)
    load(0)
  }, [rep, status, callCategory, callType, search, dateFrom, dateTo]) // eslint-disable-line

  useEffect(() => {
    load(page)
  }, [page]) // eslint-disable-line

  const handleSearchChange = (val) => {
    setSearchInput(val)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setSearch(val), 400)
  }

  const { calls = [], total = 0, reps = [], summary } = data || {}
  const totalPages = Math.ceil(total / 50)
  const hasFilters = rep || search || dateFrom || dateTo || status !== 'all' || callType || callCategory

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <ModulesNav router={router} />
            <div>
              <h1 className="text-base font-semibold text-gray-900">Call Registry</h1>
              <p className="text-xs text-gray-400">Every Gong call — account, type, analysis status</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => load(page)} disabled={loading} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <UserMenu profile={profile} />
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-6 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
        )}

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="Analyzed" value={summary.analyzed.toLocaleString()} color="text-green-600" sub="AI coaching data available" />
            <SummaryCard label="Pending analysis" value={summary.pending.toLocaleString()} color="text-amber-600" sub="Backlog processing ~15 min/batch" />
            <SummaryCard label="Ignored" value={summary.ignored.toLocaleString()} color="text-gray-400" sub="No-shows + internal calls" />
            <SummaryCard
              label="Linked to accounts"
              value={summary.linked.toLocaleString()}
              color="text-blue-600"
              sub={`${Math.max(0, summary.analyzed + summary.pending - summary.linked).toLocaleString()} non-ignored unlinked`}
            />
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border p-4 space-y-3">
          {/* Row 1: Search, rep, type */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search account…"
                value={searchInput}
                onChange={e => handleSearchChange(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 w-44"
              />
            </div>

            <select
              value={rep}
              onChange={e => setRep(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="">All reps</option>
              {reps.map(r => (
                <option key={r.email || r.name} value={r.name}>{r.name}</option>
              ))}
            </select>

            <select
              value={callType}
              onChange={e => setCallType(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              {CALL_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Row 2: Category + Status tabs */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400 font-medium">Category:</span>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                {CATEGORY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setCallCategory(opt.value)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      callCategory === opt.value
                        ? opt.value === 'sales' ? 'bg-blue-600 text-white'
                          : opt.value === 'cs' ? 'bg-teal-600 text-white'
                          : opt.value === 'internal' ? 'bg-slate-600 text-white'
                          : 'bg-gray-900 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400 font-medium">Status:</span>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setStatus(opt.value)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      status === opt.value
                        ? 'bg-gray-900 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {hasFilters && (
              <button
                onClick={() => {
                  setRep(''); setStatus('all'); setCallCategory(''); setCallType('')
                  setSearch(''); setSearchInput(''); setDateFrom(''); setDateTo('')
                }}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Clear filters
              </button>
            )}

            <span className="ml-auto text-xs text-gray-400">
              {loading ? 'Loading…' : `${total.toLocaleString()} calls`}
            </span>
          </div>

          {/* Row 3: Date range */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Date range:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-24">Date</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-28">Rep</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Account / Title</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-10">Cat.</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-32">Type</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-28">Stage</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-14">Dur.</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-24">Status</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-12">Disc.</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide w-12">ICP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading && !calls.length && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-sm text-gray-400">Loading…</td>
                  </tr>
                )}
                {!loading && !calls.length && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-sm text-gray-400">No calls match these filters.</td>
                  </tr>
                )}
                {calls.map(call => {
                  const isExpanded = expanded === call.id
                  return [
                    <tr
                      key={call.id}
                      onClick={() => setExpanded(isExpanded ? null : call.id)}
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                        call.isIgnored ? 'opacity-50' : ''
                      } ${isExpanded ? 'bg-blue-50 hover:bg-blue-50' : ''}`}
                    >
                      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDate(call.callDate)}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs text-gray-700 truncate block max-w-[110px]">
                          {call.repName?.split(' ')[0] || <span className="text-gray-300">—</span>}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 max-w-xs">
                        <div className="flex flex-col gap-0.5">
                          {call.accountName ? (
                            <span className="text-xs font-semibold text-gray-900 truncate">{call.accountName}</span>
                          ) : call.possibleCompany ? (
                            <span className="text-xs text-amber-600 flex items-center gap-1 truncate">
                              <Link2Off className="w-3 h-3 shrink-0" />
                              <span className="font-medium truncate">~{call.possibleCompany}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300 flex items-center gap-1">
                              <Link2Off className="w-3 h-3" /> Unlinked
                            </span>
                          )}
                          {call.title && (
                            <span className="text-xs text-gray-400 truncate">{call.title}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {call.callCategory && call.callCategory !== 'unknown' && (
                          <CategoryPill category={call.callCategory} />
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <CallTypeBadge type={call.callType} />
                      </td>
                      <td className="px-4 py-2.5">
                        {call.accountStage ? (
                          <StageBadge stage={call.accountStage} />
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDuration(call.durationSeconds)}</td>
                      <td className="px-4 py-2.5">
                        {call.isIgnored ? (
                          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">Ignored</span>
                        ) : call.analyzedAt ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded-md">
                            <CheckCircle2 className="w-3 h-3" /> Analyzed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center"><ScoreDot value={call.discoveryScore} /></td>
                      <td className="px-3 py-2.5 text-center"><ScoreDot value={call.icpScore} /></td>
                    </tr>,
                    isExpanded && (
                      <tr key={`${call.id}-exp`} className="bg-blue-50 border-b border-blue-100">
                        <td colSpan={10} className="px-6 py-3">
                          <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs">
                            {call.title && (
                              <div>
                                <span className="font-medium text-gray-500 uppercase tracking-wide text-[10px]">Full title</span>
                                <p className="mt-0.5 text-gray-700">{call.title}</p>
                              </div>
                            )}
                            {call.possibleCompany && !call.accountName && (
                              <div>
                                <span className="font-medium text-amber-600 uppercase tracking-wide text-[10px]">Possible account</span>
                                <p className="mt-0.5 text-amber-700 font-medium">{call.possibleCompany}</p>
                              </div>
                            )}
                            {call.talkRatio != null && (
                              <div>
                                <span className="font-medium text-gray-500 uppercase tracking-wide text-[10px]">Talk ratio</span>
                                <p className="mt-0.5 text-gray-700">{call.talkRatio}%</p>
                              </div>
                            )}
                            {call.matchMethod && (
                              <div>
                                <span className="font-medium text-gray-500 uppercase tracking-wide text-[10px]">Link method</span>
                                <p className="mt-0.5 text-gray-700">{call.matchMethod}{call.matchConfidence != null ? ` (${Math.round(call.matchConfidence * 100)}%)` : ''}</p>
                              </div>
                            )}
                            {call.hasRedFlags && (
                              <div className="flex items-center gap-1 text-red-500">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Red flags detected</span>
                              </div>
                            )}
                            {call.ignoreReason && (
                              <div>
                                <span className="font-medium text-gray-500 uppercase tracking-wide text-[10px]">Ignore reason</span>
                                <p className="mt-0.5 text-gray-700">{call.ignoreReason}</p>
                              </div>
                            )}
                            {call.summary && (
                              <div className="w-full">
                                <span className="font-medium text-gray-500 uppercase tracking-wide text-[10px]">Summary</span>
                                <p className="mt-0.5 text-gray-700 leading-relaxed max-w-2xl">{call.summary}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ),
                  ]
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              <span className="text-xs text-gray-500">
                Page {page + 1} of {totalPages.toLocaleString()} · {total.toLocaleString()} total
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || loading}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
