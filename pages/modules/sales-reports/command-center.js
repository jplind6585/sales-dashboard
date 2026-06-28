import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft, RefreshCw, Target, TrendingUp, Activity, MessageSquare, Lightbulb, AlertTriangle, CheckCircle2, Eye } from 'lucide-react'
import UserMenu from '../../../components/auth/UserMenu'
import ModulesNav from '../../../components/layout/ModulesNav'

function fmtMoney(n) {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1000000) return `$${(v / 1000000).toFixed(1)}M`
  if (Math.abs(v) >= 1000) return `$${Math.round(v / 1000)}k`
  return `$${Math.round(v)}`
}
function timeAgo(d) {
  if (!d) return ''
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

const FEED_ICON = { task_done: CheckCircle2, stage_change: TrendingUp, call: MessageSquare }
const FEED_COLOR = { task_done: 'text-emerald-500', stage_change: 'text-violet-500', call: 'text-blue-500' }

function GoalSetter({ onSaved }) {
  const [target, setTarget] = useState('')
  const [period, setPeriod] = useState('quarter')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const save = async () => {
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/reports/goals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metric: 'revenue', period, target: Number(target), label: `${period} revenue goal` }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to save')
      onSaved()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="bg-white rounded-xl border border-dashed border-gray-300 p-5">
      <div className="flex items-center gap-2 mb-2"><Target className="w-4 h-4 text-gray-400" /><p className="text-sm font-semibold text-gray-700">Set a revenue goal to track against</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={period} onChange={e => setPeriod(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="month">This month</option>
          <option value="quarter">This quarter</option>
          <option value="year">This year</option>
        </select>
        <input value={target} onChange={e => setTarget(e.target.value)} placeholder="Target $ (e.g. 500000)" type="number"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px]" />
        <button onClick={save} disabled={busy || !target} className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40">
          {busy ? 'Saving…' : 'Set goal'}
        </button>
      </div>
      {err && <p className="text-xs text-red-500 mt-2">{err}</p>}
    </div>
  )
}

export default function CommandCenter() {
  const router = useRouter()
  const [period, setPeriod] = useState('quarter')
  const [scorecard, setScorecard] = useState(null)
  const [feed, setFeed] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const [sRes, fRes] = await Promise.all([
        fetch(`/api/reports/scorecard?period=${period}`),
        fetch('/api/reports/feed?days=14'),
      ])
      const sJson = await sRes.json(); const fJson = await fRes.json()
      if (!sRes.ok || !sJson.success) throw new Error(sJson.error || 'Failed to load scorecard')
      setScorecard(sJson); setFeed(fJson.success ? fJson : null)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [period])

  const goal = scorecard?.goal
  const syn = feed?.synthesis
  const pros = feed?.prospects

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><ArrowLeft className="w-4 h-4" /></button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Command Center</h1>
              <p className="text-xs text-gray-400">Goal tracking · live feed · what's working</p>
            </div>
            <ModulesNav router={router} />
          </div>
          <div className="flex items-center gap-3">
            <select value={period} onChange={e => setPeriod(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
              <option value="month">Month</option><option value="quarter">Quarter</option><option value="year">Year</option>
            </select>
            <button onClick={load} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">{error}</div>}
        {loading && !scorecard && <div className="text-gray-400 text-sm">Loading…</div>}

        {/* ── Goal scorecard ───────────────────────────────────────────── */}
        {scorecard && (
          <section>
            {!goal && <GoalSetter onSaved={load} />}
            {goal && (
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2"><Target className="w-5 h-5 text-gray-700" /><h2 className="font-bold text-gray-900">{goal.label || 'Revenue goal'}</h2></div>
                  <span className="text-xs text-gray-400 uppercase tracking-wide">{scorecard.period} · since {scorecard.periodStart}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  <div><p className="text-xs text-gray-500 uppercase">Closed Won</p><p className="text-3xl font-bold text-emerald-600">{fmtMoney(scorecard.closedWonValue)}</p><p className="text-xs text-gray-400">{scorecard.closedWonCount} deals</p></div>
                  <div><p className="text-xs text-gray-500 uppercase">Target</p><p className="text-3xl font-bold text-gray-900">{fmtMoney(goal.target)}</p><p className="text-xs text-gray-400">{goal.attainmentPct ?? 0}% attained</p></div>
                  <div><p className="text-xs text-gray-500 uppercase">Weighted Pipeline</p><p className="text-3xl font-bold text-blue-600">{fmtMoney(scorecard.weightedPipeline)}</p><p className="text-xs text-gray-400">{scorecard.activeDeals} active</p></div>
                  <div><p className="text-xs text-gray-500 uppercase">Projected</p><p className={`text-3xl font-bold ${goal.projectedPct >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>{goal.projectedPct ?? 0}%</p><p className="text-xs text-gray-400">closed + weighted</p></div>
                </div>
                <div className="mt-5">
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                    <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(100, goal.attainmentPct || 0)}%` }} />
                    <div className="bg-blue-300 h-full" style={{ width: `${Math.min(Math.max(0, 100 - (goal.attainmentPct || 0)), Math.max(0, (goal.projectedPct || 0) - (goal.attainmentPct || 0)))}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1"><span>Closed {goal.attainmentPct ?? 0}%</span><span>{goal.gap > 0 ? `${fmtMoney(goal.gap)} to go` : 'Goal hit 🎉'}</span></div>
                </div>
                {scorecard.coverage && scorecard.coverage.valuedAccounts < scorecard.coverage.totalAccounts && (
                  <p className="text-xs text-amber-500 mt-3">Note: only {scorecard.coverage.valuedAccounts} of {scorecard.coverage.totalAccounts} accounts have a deal value set — figures reflect valued deals only.</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── AI synthesis ─────────────────────────────────────────────── */}
        {syn && (
          <section className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-1"><Lightbulb className="w-5 h-5 text-amber-500" /><h2 className="font-bold text-gray-900">What's working / what's not</h2></div>
            <p className="text-sm text-gray-700 mb-4">{syn.headline}</p>
            <div className="grid md:grid-cols-3 gap-4">
              <div><p className="text-xs font-semibold text-emerald-600 uppercase mb-2 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Working</p><ul className="space-y-1.5">{(syn.working || []).map((w, i) => <li key={i} className="text-sm text-gray-600">• {w}</li>)}</ul></div>
              <div><p className="text-xs font-semibold text-red-500 uppercase mb-2 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Not working</p><ul className="space-y-1.5">{(syn.not_working || []).map((w, i) => <li key={i} className="text-sm text-gray-600">• {w}</li>)}</ul></div>
              <div><p className="text-xs font-semibold text-gray-700 uppercase mb-2 flex items-center gap-1"><Lightbulb className="w-3.5 h-3.5" /> Do this week</p><ul className="space-y-1.5">{(syn.team_suggestions || []).map((w, i) => <li key={i} className="text-sm text-gray-600">• {w}</li>)}</ul></div>
            </div>
            {syn.watch && <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-center gap-2"><Eye className="w-4 h-4" /> <span><strong>Watch:</strong> {syn.watch}</span></div>}
          </section>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* ── Per-rep + prospect voice ──────────────────────────────── */}
          <div className="lg:col-span-1 space-y-6">
            {scorecard?.byRep?.length > 0 && (
              <section className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-3 text-sm">Pipeline by rep</h3>
                <div className="space-y-2">
                  {scorecard.byRep.map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 truncate">{r.rep}</span>
                      <span className="text-gray-400">{fmtMoney(r.weightedPipeline)} <span className="text-gray-300">·</span> {fmtMoney(r.closedWon)} won</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {pros && (
              <section className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-3"><MessageSquare className="w-4 h-4 text-gray-400" /><h3 className="font-semibold text-gray-900 text-sm">What prospects are saying</h3></div>
                {[['Objections', pros.objections], ['Buying signals', pros.buyingSignals], ['Pain points', pros.pains], ['Competitors', pros.competitors]].map(([label, arr]) => (
                  (arr?.length > 0) && (
                    <div key={label} className="mb-3">
                      <p className="text-xs font-medium text-gray-400 uppercase mb-1">{label}</p>
                      <div className="flex flex-wrap gap-1.5">{arr.map((x, i) => <span key={i} className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{x.text} {x.count > 1 && <span className="text-gray-400">×{x.count}</span>}</span>)}</div>
                    </div>
                  )
                ))}
                {!pros.objections?.length && !pros.buyingSignals?.length && !pros.pains?.length && !pros.competitors?.length && <p className="text-xs text-gray-400">No analyzed calls in this window.</p>}
              </section>
            )}
          </div>

          {/* ── Activity feed ─────────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <section className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-3"><Activity className="w-4 h-4 text-gray-400" /><h3 className="font-semibold text-gray-900 text-sm">Live feed{feed?.days ? ` · last ${feed.days} days` : ''}</h3></div>
              {feed?.feed?.length > 0 ? (
                <div className="space-y-0.5 max-h-[640px] overflow-y-auto">
                  {feed.feed.map((f, i) => {
                    const Icon = FEED_ICON[f.type] || Activity
                    return (
                      <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${FEED_COLOR[f.type] || 'text-gray-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700"><span className="font-medium">{f.who}</span> {f.account && <span className="text-gray-400">· {f.account}</span>}</p>
                          <p className="text-sm text-gray-500 truncate">{f.text}{f.meta && <span className="text-gray-300"> · {f.meta}</span>}</p>
                        </div>
                        <span className="text-xs text-gray-300 shrink-0">{timeAgo(f.at)}</span>
                      </div>
                    )
                  })}
                </div>
              ) : <p className="text-xs text-gray-400">No recent activity.</p>}
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
