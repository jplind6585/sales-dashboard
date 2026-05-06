import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import {
  ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Minus,
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Zap, Users,
} from 'lucide-react'
import UserMenu from '../../components/auth/UserMenu'
import { useAuthStore } from '../../stores/useAuthStore'

const REPS = ['James Lindberg', 'Mark Murphy', 'Logan King', 'Tony Alic', 'Justin Goodkind', 'Jovan Arsovski']

function TrendIcon({ direction }) {
  if (direction === 'up') return <TrendingUp className="w-3.5 h-3.5 text-green-500" />
  if (direction === 'down') return <TrendingDown className="w-3.5 h-3.5 text-red-500" />
  return <Minus className="w-3.5 h-3.5 text-gray-400" />
}

function MetricCard({ label, value, unit = '', trend, description, invert = false }) {
  const trendDir = invert && trend ? (trend === 'up' ? 'down' : trend === 'down' ? 'up' : 'neutral') : trend
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">{label}</div>
      <div className="flex items-end gap-1.5">
        <span className="text-3xl font-bold text-gray-900">{value ?? '—'}</span>
        {value != null && unit && <span className="text-sm text-gray-500 mb-1">{unit}</span>}
        {trendDir && value != null && (
          <span className="mb-1 ml-1"><TrendIcon direction={trendDir} /></span>
        )}
      </div>
      {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
    </div>
  )
}

function ObservationCard({ obs }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="bg-white border border-amber-200 rounded-xl overflow-hidden">
      <button
        className="w-full text-left p-4 flex items-start justify-between gap-3"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{obs.pattern}</p>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{obs.evidence}</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-amber-100 pt-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-0.5">Why it matters</p>
            <p className="text-sm text-gray-700">{obs.impact}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs font-semibold text-blue-700 mb-0.5">Coaching tip</p>
            <p className="text-sm text-blue-800">{obs.coaching_tip}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function EvidenceCallRow({ call }) {
  const [expanded, setExpanded] = useState(false)
  const date = call.date ? new Date(call.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{call.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{date}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {call.discoveryScore != null && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${call.discoveryScore >= 7 ? 'bg-green-100 text-green-700' : call.discoveryScore >= 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
              {call.discoveryScore}/10
            </span>
          )}
          {call.talkRatio != null && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${call.talkRatio > 50 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
              {call.talkRatio}% talk
            </span>
          )}
          {!call.hasNextSteps && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">no next step</span>
          )}
          {call.hasRedFlags && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">⚠ flag</span>
          )}
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
        </div>
      </button>
      {expanded && call.summary && (
        <div className="px-4 pb-3 border-t border-gray-100 pt-2">
          <p className="text-xs text-gray-500">{call.summary}</p>
        </div>
      )}
    </div>
  )
}

export default function CoachingDashboard() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [selectedRep, setSelectedRep] = useState(REPS[0])
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function load(rep = selectedRep, d = days) {
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const r = await fetch(`/api/gong/rep-coaching?repName=${encodeURIComponent(rep)}&days=${d}`)
      const json = await r.json()
      if (!json.success) throw new Error(json.error || 'Failed to load')
      setData(json)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function handleRepChange(rep) {
    setSelectedRep(rep)
    load(rep, days)
  }

  function handleDaysChange(d) {
    setDays(d)
    load(selectedRep, d)
  }

  const card = data?.coachingCard
  const metrics = data?.metrics

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/modules/pipeline-overview')} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                Rep Coaching
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">AI-generated coaching cards from Gong call analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user && <UserMenu />}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Rep</label>
            <select
              value={selectedRep}
              onChange={e => handleRepChange(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {REPS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Window</label>
            {[14, 30, 60, 90].map(d => (
              <button
                key={d}
                onClick={() => handleDaysChange(d)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${days === d ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={() => load()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 ml-auto"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Generating…' : 'Regenerate'}
          </button>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
            <p className="text-sm text-gray-500">Analyzing {data?.daysAnalyzed || days} days of calls…</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {!loading && data?.message && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-500">{data.message}</p>
          </div>
        )}

        {!loading && metrics && (
          <>
            {/* Metric cards */}
            <div className="grid grid-cols-5 gap-4">
              <MetricCard
                label="Calls Analyzed"
                value={metrics.callCount}
                trend={metrics.trends?.callCount}
              />
              <MetricCard
                label="Discovery Score"
                value={metrics.avgDiscoveryScore}
                unit="/10"
                trend={metrics.trends?.discoveryScore}
                description="Higher is better (10 = fully qualified)"
              />
              <MetricCard
                label="Talk Ratio"
                value={metrics.avgTalkRatio}
                unit="%"
                trend={metrics.trends?.talkRatio}
                invert={true}
                description="Rep's share of call time. Target: 30–45%"
              />
              <MetricCard
                label="Next-Step Rate"
                value={metrics.nextStepRate}
                unit="%"
                trend={metrics.trends?.nextStepRate}
                description="% of calls with defined next step"
              />
              <MetricCard
                label="Red Flag Rate"
                value={metrics.redFlagRate}
                unit="%"
                description="% of calls with risk signals"
              />
            </div>

            {card && (
              <>
                {/* Coaching card */}
                <div className="bg-white border border-indigo-100 rounded-xl p-6 space-y-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="w-4 h-4 text-indigo-500" />
                        <h2 className="font-bold text-gray-900">Coaching Card — {selectedRep}</h2>
                      </div>
                      <p className="text-xs text-gray-400">Based on {metrics.callCount} calls in last {data.daysAnalyzed} days</p>
                    </div>
                  </div>

                  {/* Summary */}
                  <p className="text-sm text-gray-700 leading-relaxed">{card.summary}</p>

                  {/* Strengths */}
                  {card.strengths?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Strengths</p>
                      <div className="space-y-1.5">
                        {card.strengths.map((s, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-gray-700">{s}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Observations */}
                  {card.observations?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Observations to Coach</p>
                      <div className="space-y-2">
                        {card.observations.map((obs, i) => (
                          <ObservationCard key={i} obs={obs} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Focus area */}
                  {card.focus_area && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                      <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1">30-Day Focus Area</p>
                      <p className="text-sm text-indigo-900 font-medium">{card.focus_area}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    {/* 1:1 opener */}
                    {card.one_on_one_script && (
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">1:1 Opener</p>
                        <p className="text-sm text-gray-800 italic">"{card.one_on_one_script}"</p>
                      </div>
                    )}
                    {/* Leading indicators */}
                    {card.leading_indicators && (
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Watch For</p>
                        <p className="text-sm text-gray-700">{card.leading_indicators}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Evidence calls */}
                {data.evidenceCalls?.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Call Evidence ({data.evidenceCalls.length} calls)
                    </h3>
                    <div className="space-y-1.5">
                      {data.evidenceCalls.map(call => (
                        <EvidenceCallRow key={call.gongCallId} call={call} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
