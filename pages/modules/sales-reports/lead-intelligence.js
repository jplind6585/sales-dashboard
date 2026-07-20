import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, TrendingUp, Users, Target, DollarSign, ChevronDown, ChevronUp } from 'lucide-react'
import AppShell from '../../../components/layout/AppShell'
import { useAuthStore } from '../../../stores/useAuthStore'
import ApiError from '../../../components/common/ApiError'

const SDR_LABELS = { KW: 'Kristin', TA: 'Tony', NB: 'Nash', SD: 'Stephen', LK: 'Logan', JL: 'James', JA: 'Jovan', MM: 'Mark' }
const AE_LABELS  = { JL: 'James', LK: 'Logan', JA: 'Jovan', MM: 'Mark' }

function fmt$  (n) { return n == null ? '—' : `$${Number(n).toLocaleString()}` }
function fmtPct(n) { return n == null ? '—' : `${Math.round(n * 100)}%` }

function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className={`text-2xl font-bold ${color || 'text-gray-900'}`}>{value}</div>
      <div className="text-sm font-medium text-gray-600 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

function FunnelBar({ stage, count, pct, convFromPrev, total, isLast }) {
  const width = Math.max(pct * 100, 2)
  const color = isLast
    ? 'bg-emerald-500'
    : stage === 'Showed' ? 'bg-blue-500'
    : stage === 'Qualified' ? 'bg-violet-500'
    : stage === 'Presented' ? 'bg-amber-500'
    : 'bg-gray-400'

  return (
    <div className="flex items-center gap-3">
      <div className="w-24 text-right text-sm text-gray-500 shrink-0">{stage}</div>
      <div className="flex-1 relative h-8 bg-gray-100 rounded">
        <div
          className={`h-full rounded ${color} transition-all duration-500`}
          style={{ width: `${width}%` }}
        />
        <span className="absolute inset-0 flex items-center pl-3 text-sm font-semibold text-white mix-blend-difference">
          {count}
        </span>
      </div>
      <div className="w-16 text-sm text-gray-500 shrink-0">
        {convFromPrev != null ? fmtPct(convFromPrev) : ''}
      </div>
    </div>
  )
}

function PctBar({ value, max }) {
  const w = max ? Math.round((value / max) * 100) : 0
  const color = value >= 0.75 ? 'bg-emerald-500' : value >= 0.5 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-10 text-right">{fmtPct(value)}</span>
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    Won: 'bg-emerald-100 text-emerald-700',
    Lost: 'bg-red-100 text-red-700',
    Working: 'bg-blue-100 text-blue-700',
    Showed: 'bg-green-100 text-green-700',
    'No Show': 'bg-red-100 text-red-700',
    Cancelled: 'bg-gray-100 text-gray-600',
    Upcoming: 'bg-blue-100 text-blue-700',
    Rescheduling: 'bg-amber-100 text-amber-700',
    Qualified: 'bg-violet-100 text-violet-700',
    'Not Qualified': 'bg-red-100 text-red-600',
    TBD: 'bg-gray-100 text-gray-500',
  }
  const cls = map[status] || 'bg-gray-100 text-gray-500'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {status || '—'}
    </span>
  )
}

function AgeBadge({ flag }) {
  if (!flag) return null
  if (flag.includes('Won')) return <span className="text-emerald-600 text-xs">Won</span>
  if (flag.includes('Lost')) return <span className="text-red-500 text-xs">Lost</span>
  if (flag.includes('Stale')) return <span className="text-red-500 text-xs font-medium">Stale</span>
  if (flag.includes('Aging')) return <span className="text-amber-500 text-xs">Aging</span>
  return <span className="text-gray-400 text-xs">{flag}</span>
}

export default function LeadIntelligence() {
  const { user } = useAuthStore()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [tab, setTab] = useState('overview')
  const [year, setYear] = useState(2026)
  const [syncingAll, setSyncingAll] = useState(false)
  const [activityFilter, setActivityFilter] = useState('all')
  const [sortSDR, setSortSDR] = useState('booked')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const r = await fetch(`/api/lead-intelligence?year=${year}`)
      const j = await r.json()
      if (j.success) {
        setData(j.data)
      } else {
        setLoadError({ message: j.error || 'Failed to load lead data', status: r.status, source: `GET /api/lead-intelligence?year=${year}` })
      }
    } catch (e) {
      setLoadError({ message: e.message, source: `GET /api/lead-intelligence?year=${year}` })
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { load() }, [load])

  const runSync = async (yearArg) => {
    const isAll = !yearArg
    if (isAll) setSyncingAll(true)
    else setSyncing(true)
    setSyncResult(null)
    try {
      const body = isAll ? {} : { year: yearArg }
      const r = await fetch('/api/sheets/sync-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await r.json()
      if (j.success) {
        const results = j.results || []
        const totalSynced = results.reduce((s, r) => s + (r.synced || 0), 0)
        const errored = results.filter(r => r.error)
        if (errored.length && !totalSynced) {
          setSyncResult({ ok: false, msg: errored.map(r => `${r.year}: ${r.error}`).join(' | ') })
        } else {
          const parts = results.filter(r => r.synced).map(r => `${r.year}: ${r.synced}`)
          setSyncResult({ ok: true, msg: `Synced ${totalSynced} leads${parts.length > 1 ? ` (${parts.join(', ')})` : ''}` })
          await load()
        }
      } else {
        setSyncResult({ ok: false, msg: j.error || 'Sync failed' })
      }
    } catch (e) {
      setSyncResult({ ok: false, msg: e.message })
    } finally {
      setSyncing(false)
      setSyncingAll(false)
    }
  }

  const syncNow = () => runSync(year)

  const meta = data?.meta || {}
  const funnel = data?.funnel || []
  const bySDR = data?.bySDR || []
  const byAE = data?.byAE || []
  const bySource = data?.bySource || []
  const byVertical = data?.byVertical || []
  const bySize = data?.bySize || []
  const lostReasons = data?.lostReasons || []
  const recent = data?.recent || []

  const filteredRecent = activityFilter === 'all' ? recent
    : activityFilter === 'open' ? recent.filter(l => !['Won', 'Lost'].includes(l.closed_status))
    : activityFilter === 'won' ? recent.filter(l => l.closed_status === 'Won')
    : recent.filter(l => l.closed_status === 'Lost')

  const sortedSDR = [...bySDR].sort((a, b) => {
    if (sortSDR === 'showRate') return b.showRate - a.showRate
    if (sortSDR === 'demoRate') return b.demoRate - a.demoRate
    return b.booked - a.booked
  })

  return (
    <AppShell
      title="Lead Intelligence"
      subtitle={meta.lastSynced
        ? `Last synced ${new Date(meta.lastSynced).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
        : 'Not yet synced'}
      actions={
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
          >
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
            <option value={2024}>2024</option>
          </select>
          <button
            onClick={() => runSync(null)}
            disabled={syncing || syncingAll}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={13} className={syncingAll ? 'animate-spin' : ''} />
            {syncingAll ? 'Syncing…' : 'Sync All'}
          </button>
          <button
            onClick={syncNow}
            disabled={syncing || syncingAll}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : `Sync ${year}`}
          </button>
        </div>
      }
    >
      {/* Sync result banner */}
      {syncResult && (
        <div className={`px-6 py-2 text-sm font-medium ${syncResult.ok ? 'bg-emerald-50 text-emerald-700 border-b border-emerald-200' : 'bg-red-50 text-red-700 border-b border-red-200'}`}>
          <div className="max-w-7xl mx-auto">
            {syncResult.ok ? '✓' : '✗'} {syncResult.msg}
            {!syncResult.ok && (
              <span className="ml-2 text-xs font-normal opacity-70">
                Make sure the Google Sheet is shared as "Anyone with link can view"
              </span>
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6">
        {loadError ? (
          <div className="py-12 max-w-lg mx-auto">
            <ApiError error={loadError} onRetry={load} />
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400">Loading…</div>
        ) : !data || meta.total === 0 ? (
          <div className="text-center py-24">
            <div className="text-gray-400 text-sm mb-4">No lead data found for {year}.</div>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              Click <strong>Sync Now</strong> to pull from Google Sheets. The sheet must be shared
              as "Anyone with link can view" — File → Share → Change to Anyone with the link → Viewer.
            </p>
          </div>
        ) : (
          <>
            {/* Stats bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              <StatCard label="Booked YTD" value={meta.total} color="text-gray-900" />
              <StatCard label="Show Rate" value={fmtPct(meta.showed / meta.total)} color={meta.showed / meta.total >= 0.66 ? 'text-emerald-600' : 'text-amber-600'} sub={`${meta.showed} showed`} />
              <StatCard label="Demo Rate" value={fmtPct(meta.qualified / meta.showed)} color="text-violet-600" sub={`${meta.qualified} qualified`} />
              <StatCard label="Win Rate" value={fmtPct(meta.won / meta.total)} color="text-emerald-600" sub={`${meta.won} won`} />
              <StatCard label="ARR Won" value={fmt$(meta.arrWon)} color="text-emerald-700" />
              <StatCard label="Open Pipeline" value={fmt$(meta.arrOpen)} color="text-blue-600" sub={`${meta.open} open`} />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-gray-200">
              {['overview', 'by-rep', 'by-channel', 'activity'].map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
                    tab === t
                      ? 'text-blue-600 border-b-2 border-blue-600 -mb-px'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t.replace('-', ' ')}
                </button>
              ))}
            </div>

            {/* ── Overview Tab ─────────────────────────────────────── */}
            {tab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Funnel */}
                <div className="bg-white rounded-xl border border-gray-100 p-6">
                  <h2 className="text-sm font-semibold text-gray-700 mb-1">Conversion Funnel</h2>
                  <p className="text-xs text-gray-400 mb-4">% = conversion from previous stage</p>
                  <div className="space-y-2">
                    {funnel.map((f, i) => (
                      <FunnelBar
                        key={f.stage}
                        stage={f.stage}
                        count={f.count}
                        pct={f.convFromBooked}
                        convFromPrev={i === 0 ? null : f.convFromPrev}
                        total={meta.total}
                        isLast={i === funnel.length - 1}
                      />
                    ))}
                  </div>
                </div>

                {/* Lost Reasons */}
                <div className="bg-white rounded-xl border border-gray-100 p-6">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">Top Loss Reasons</h2>
                  <div className="space-y-3">
                    {lostReasons.length === 0 ? (
                      <div className="text-sm text-gray-400">No lost leads yet.</div>
                    ) : lostReasons.map(r => (
                      <div key={r.reason} className="flex items-center gap-3">
                        <div className="flex-1 text-sm text-gray-700 truncate">{r.reason}</div>
                        <div className="text-sm font-semibold text-gray-900 w-8 text-right">{r.count}</div>
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-400 rounded-full"
                            style={{ width: `${Math.round((r.count / (lostReasons[0]?.count || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* By vertical */}
                <div className="bg-white rounded-xl border border-gray-100 p-6 lg:col-span-2">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">By Vertical</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left text-xs text-gray-400 font-medium pb-2">Vertical</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">Booked</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">Showed</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">Show %</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">Presented</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">Demo %</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">Won</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byVertical.map(v => (
                          <tr key={v.vertical} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 font-medium text-gray-800">{v.vertical}</td>
                            <td className="py-2 text-right text-gray-600">{v.booked}</td>
                            <td className="py-2 text-right text-gray-600">{v.showed}</td>
                            <td className="py-2 text-right">
                              <span className={v.showRate >= 0.66 ? 'text-emerald-600 font-medium' : v.showRate >= 0.5 ? 'text-amber-600' : 'text-red-500'}>
                                {fmtPct(v.showRate)}
                              </span>
                            </td>
                            <td className="py-2 text-right text-gray-600">{v.presented}</td>
                            <td className="py-2 text-right text-gray-600">{fmtPct(v.demoRate)}</td>
                            <td className="py-2 text-right font-semibold text-emerald-600">{v.won}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── By Rep Tab ───────────────────────────────────────── */}
            {tab === 'by-rep' && (
              <div className="space-y-6">
                {/* SDR */}
                <div className="bg-white rounded-xl border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-gray-700">SDR Performance</h2>
                    <div className="flex gap-2">
                      {['booked', 'showRate', 'demoRate'].map(s => (
                        <button
                          key={s}
                          onClick={() => setSortSDR(s)}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            sortSDR === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {s === 'booked' ? 'Booked' : s === 'showRate' ? 'Show Rate' : 'Demo Rate'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left text-xs text-gray-400 font-medium pb-2">SDR</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">Booked</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">Showed</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2 w-32">Show Rate</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">Demos</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2 w-32">Demo Rate</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">Won</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedSDR.map(s => (
                          <tr key={s.sdr} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-3 font-medium text-gray-800">{s.name}</td>
                            <td className="py-3 text-right text-gray-600">{s.booked}</td>
                            <td className="py-3 text-right text-gray-600">{s.showed}</td>
                            <td className="py-3">
                              <PctBar value={s.showRate} max={1} />
                            </td>
                            <td className="py-3 text-right text-gray-600">{s.demos}</td>
                            <td className="py-3">
                              <PctBar value={s.demoRate} max={1} />
                            </td>
                            <td className="py-3 text-right font-semibold text-emerald-600">{s.won}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* AE */}
                <div className="bg-white rounded-xl border border-gray-100 p-6">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">AE Performance</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left text-xs text-gray-400 font-medium pb-2">AE</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">Assigned</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">Showed</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2 w-32">Show Rate</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">Presented</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">Won</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2 w-32">Close Rate</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">ARR Won</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byAE.map(a => (
                          <tr key={a.ae} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-3 font-medium text-gray-800">{a.name}</td>
                            <td className="py-3 text-right text-gray-600">{a.assigned}</td>
                            <td className="py-3 text-right text-gray-600">{a.showed}</td>
                            <td className="py-3">
                              <PctBar value={a.showRate} max={1} />
                            </td>
                            <td className="py-3 text-right text-gray-600">{a.presented}</td>
                            <td className="py-3 text-right font-semibold text-emerald-600">{a.won}</td>
                            <td className="py-3">
                              <PctBar value={a.closeRate} max={1} />
                            </td>
                            <td className="py-3 text-right font-semibold text-emerald-700">{fmt$(a.arr)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Company size breakdown */}
                <div className="bg-white rounded-xl border border-gray-100 p-6">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">By Company Size</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left text-xs text-gray-400 font-medium pb-2">Size</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">Booked</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">Won</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">Win Rate</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">ARR Won</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bySize.map(s => (
                          <tr key={s.size} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 font-medium text-gray-800">{s.size}</td>
                            <td className="py-2 text-right text-gray-600">{s.booked}</td>
                            <td className="py-2 text-right text-emerald-600 font-semibold">{s.won}</td>
                            <td className="py-2 text-right text-gray-600">{fmtPct(s.winRate)}</td>
                            <td className="py-2 text-right text-emerald-700 font-medium">{fmt$(s.arr)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── By Channel Tab ───────────────────────────────────── */}
            {tab === 'by-channel' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-gray-100 p-6">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">By Source / Channel</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left text-xs text-gray-400 font-medium pb-2">Source</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">Booked</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">Showed</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2 w-32">Show Rate</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">Qualified</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2 w-32">Qual Rate</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">Won</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">ARR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bySource.map(s => (
                          <tr key={s.source} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-3 font-medium text-gray-800">{s.source}</td>
                            <td className="py-3 text-right text-gray-600">{s.booked}</td>
                            <td className="py-3 text-right text-gray-600">{s.showed}</td>
                            <td className="py-3">
                              <PctBar value={s.showRate} max={1} />
                            </td>
                            <td className="py-3 text-right text-gray-600">{s.qualified}</td>
                            <td className="py-3">
                              <PctBar value={s.qualRate} max={1} />
                            </td>
                            <td className="py-3 text-right font-semibold text-emerald-600">{s.won}</td>
                            <td className="py-3 text-right font-medium text-emerald-700">{fmt$(s.arr)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── Activity Tab ─────────────────────────────────────── */}
            {tab === 'activity' && (
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-700">Recent Leads (last 40 booked)</h2>
                  <div className="flex gap-2">
                    {['all', 'open', 'won', 'lost'].map(f => (
                      <button
                        key={f}
                        onClick={() => setActivityFilter(f)}
                        className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${
                          activityFilter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs text-gray-400 font-medium pb-2">Company</th>
                        <th className="text-left text-xs text-gray-400 font-medium pb-2">Vertical</th>
                        <th className="text-left text-xs text-gray-400 font-medium pb-2">SDR</th>
                        <th className="text-left text-xs text-gray-400 font-medium pb-2">AE</th>
                        <th className="text-left text-xs text-gray-400 font-medium pb-2">Booked</th>
                        <th className="text-left text-xs text-gray-400 font-medium pb-2">Intro</th>
                        <th className="text-left text-xs text-gray-400 font-medium pb-2">Qualify</th>
                        <th className="text-left text-xs text-gray-400 font-medium pb-2">Status</th>
                        <th className="text-right text-xs text-gray-400 font-medium pb-2">ARR</th>
                        <th className="text-left text-xs text-gray-400 font-medium pb-2">Age</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecent.map(l => (
                        <tr key={l.seq} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 font-medium text-gray-800 max-w-[180px] truncate">{l.company}</td>
                          <td className="py-2 text-gray-500 text-xs">{l.vertical}</td>
                          <td className="py-2 text-gray-500 text-xs">{SDR_LABELS[l.sdr] || l.sdr}</td>
                          <td className="py-2 text-gray-500 text-xs">{AE_LABELS[l.ae] || l.ae}</td>
                          <td className="py-2 text-gray-500 text-xs whitespace-nowrap">
                            {l.date_booked ? new Date(l.date_booked + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                          </td>
                          <td className="py-2"><StatusBadge status={l.intro_status} /></td>
                          <td className="py-2"><StatusBadge status={l.qualify_status} /></td>
                          <td className="py-2"><StatusBadge status={l.closed_status} /></td>
                          <td className="py-2 text-right text-xs text-emerald-700 font-medium">
                            {l.arr_value ? fmt$(l.arr_value) : '—'}
                          </td>
                          <td className="py-2 text-xs pl-2"><AgeBadge flag={l.pipeline_age_flag} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredRecent.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm">No leads match this filter.</div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
