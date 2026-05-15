import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft, RefreshCw, AlertTriangle, Link2Off, Copy, Clock, TrendingDown, Play } from 'lucide-react'
import UserMenu from '../../../components/auth/UserMenu'
import { useAuthStore } from '../../../stores/useAuthStore'

function SummaryBadge({ label, count, color, icon: Icon }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={16} className="text-white" />
      </div>
      <div>
        <div className="text-xl font-bold text-gray-900">{count ?? '—'}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  )
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function ConfBar({ value }) {
  const color = value >= 75 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-gray-500">{value}%</span>
    </div>
  )
}

// ── Tab: Unmatched Leads ─────────────────────────────────────────────────────
function UnmatchedLeads({ leads, onRunMatch, matching }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Leads with no linked HubSpot account. Run Match to attempt fuzzy linking.
        </p>
        <button
          onClick={onRunMatch}
          disabled={matching}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Play size={13} className={matching ? 'animate-pulse' : ''} />
          {matching ? 'Matching…' : 'Run Match'}
        </button>
      </div>
      {leads.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">All leads are matched.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Company</th>
                <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Year</th>
                <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Vertical</th>
                <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">SDR</th>
                <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">AE</th>
                <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Booked</th>
                <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Intro</th>
                <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Closed</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(l => (
                <tr key={`${l.year}-${l.seq}`} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800 max-w-[200px] truncate">{l.company}</td>
                  <td className="px-4 py-2.5 text-gray-500">{l.year}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{l.vertical || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{l.sdr || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{l.ae || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{fmtDate(l.date_booked)}</td>
                  <td className="px-4 py-2.5 text-xs">{l.intro_status || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5 text-xs">{l.closed_status || <span className="text-gray-300">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {leads.length >= 200 && (
            <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 text-xs text-amber-600">
              Showing first 200 — run match to reduce this list.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab: Duplicate Accounts ──────────────────────────────────────────────────
function DuplicateAccounts({ groups }) {
  const [expanded, setExpanded] = useState(null)
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        HubSpot accounts that normalize to the same company name. Likely duplicates — merge in HubSpot.
      </p>
      {groups.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No duplicate accounts found.</div>
      ) : (
        <div className="space-y-2">
          {groups.map(g => (
            <div key={g.normalizedName} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(expanded === g.normalizedName ? null : g.normalizedName)}
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                    {g.count}
                  </span>
                  <span className="font-medium text-gray-800 text-sm">{g.normalizedName}</span>
                </div>
                <span className="text-xs text-gray-400">{expanded === g.normalizedName ? '▲' : '▼'}</span>
              </button>
              {expanded === g.normalizedName && (
                <div className="border-t border-gray-100 px-5 py-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left text-xs text-gray-400 font-medium pb-2">Name in HubSpot</th>
                        <th className="text-left text-xs text-gray-400 font-medium pb-2">Stage</th>
                        <th className="text-left text-xs text-gray-400 font-medium pb-2">Owner</th>
                        <th className="text-right text-xs text-gray-400 font-medium pb-2">Deal Value</th>
                        <th className="text-left text-xs text-gray-400 font-medium pb-2">HubSpot ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.accounts.map(a => (
                        <tr key={a.id} className="border-t border-gray-50">
                          <td className="py-2 text-gray-800 font-medium">{a.name}</td>
                          <td className="py-2 text-gray-500 text-xs">{a.stage || '—'}</td>
                          <td className="py-2 text-gray-500 text-xs">{a.owner || '—'}</td>
                          <td className="py-2 text-right text-gray-500 text-xs">
                            {a.dealValue ? `$${Number(a.dealValue).toLocaleString()}` : '—'}
                          </td>
                          <td className="py-2 text-gray-400 text-xs font-mono">{a.hubspotId || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tab: Multi-Year Companies ────────────────────────────────────────────────
function MultiYearCompanies({ companies }) {
  const [expanded, setExpanded] = useState(null)
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Companies that appeared in intros across multiple years. May indicate a stalled deal or renewed interest.
      </p>
      {companies.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No multi-year companies found.</div>
      ) : (
        <div className="space-y-2">
          {companies.map(c => (
            <div key={c.company} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(expanded === c.company ? null : c.company)}
              >
                <div className="flex items-center gap-3">
                  <div>
                    <span className="font-medium text-gray-800 text-sm">{c.company}</span>
                    <div className="flex gap-1 mt-0.5">
                      {c.years.map(y => (
                        <span key={y} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded font-medium">{y}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-gray-400">
                  <span className="text-xs">{c.touchCount} touches</span>
                  <span className="text-xs">{expanded === c.company ? '▲' : '▼'}</span>
                </div>
              </button>
              {expanded === c.company && (
                <div className="border-t border-gray-100 px-5 py-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left text-xs text-gray-400 font-medium pb-2">Year</th>
                        <th className="text-left text-xs text-gray-400 font-medium pb-2">Seq</th>
                        <th className="text-left text-xs text-gray-400 font-medium pb-2">SDR</th>
                        <th className="text-left text-xs text-gray-400 font-medium pb-2">AE</th>
                        <th className="text-left text-xs text-gray-400 font-medium pb-2">Booked</th>
                        <th className="text-left text-xs text-gray-400 font-medium pb-2">Intro</th>
                        <th className="text-left text-xs text-gray-400 font-medium pb-2">Closed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.leads.map((l, i) => (
                        <tr key={i} className="border-t border-gray-50">
                          <td className="py-2 text-gray-800 font-medium">{l.year}</td>
                          <td className="py-2 text-gray-500 text-xs">{l.seq}</td>
                          <td className="py-2 text-gray-500 text-xs">{l.sdr || '—'}</td>
                          <td className="py-2 text-gray-500 text-xs">{l.ae || '—'}</td>
                          <td className="py-2 text-gray-500 text-xs whitespace-nowrap">{fmtDate(l.date_booked)}</td>
                          <td className="py-2 text-xs">{l.intro_status || '—'}</td>
                          <td className="py-2 text-xs">{l.closed_status || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tab: Data Gaps ───────────────────────────────────────────────────────────
function DataGaps({ leads }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Open leads missing key fields. These will skew reporting until filled in the source sheet.
      </p>
      {leads.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No data gaps found.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Company</th>
                <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Year</th>
                <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">SDR</th>
                <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Booked</th>
                <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Missing Fields</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(l => (
                <tr key={`${l.year}-${l.seq}`} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800 max-w-[200px] truncate">{l.company}</td>
                  <td className="px-4 py-2.5 text-gray-500">{l.year}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{l.sdr || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{fmtDate(l.date_booked)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {l.gaps.map(g => (
                        <span key={g} className="px-2 py-0.5 bg-red-50 text-red-600 text-xs rounded font-medium">
                          {g}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {leads.length >= 150 && (
            <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 text-xs text-amber-600">
              Showing first 150 results.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab: Low Confidence Matches ──────────────────────────────────────────────
function LowConfidence({ leads, onRunMatch, matching }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Leads linked to an account but with low match confidence. Verify these are correctly linked.
        </p>
        <button
          onClick={onRunMatch}
          disabled={matching}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Play size={13} className={matching ? 'animate-pulse' : ''} />
          {matching ? 'Matching…' : 'Re-run Match'}
        </button>
      </div>
      {leads.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No low-confidence matches.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Company</th>
                <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Year</th>
                <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">AE</th>
                <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Booked</th>
                <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Closed</th>
                <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Method</th>
                <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(l => (
                <tr key={`${l.year}-${l.id}`} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800 max-w-[200px] truncate">{l.company}</td>
                  <td className="px-4 py-2.5 text-gray-500">{l.year}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{l.ae || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{fmtDate(l.date_booked)}</td>
                  <td className="px-4 py-2.5 text-xs">{l.closed_status || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      l.match_method === 'exact' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {l.match_method || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <ConfBar value={l.match_confidence} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {leads.length >= 100 && (
            <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 text-xs text-amber-600">
              Showing 100 lowest-confidence matches.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'unmatched',   label: 'Unmatched Leads',     countKey: 'unmatchedCount' },
  { id: 'duplicates',  label: 'Duplicate Accounts',  countKey: 'duplicateAccountGroups' },
  { id: 'multi-year',  label: 'Multi-Year',           countKey: 'multiYearCount' },
  { id: 'gaps',        label: 'Data Gaps',            countKey: 'dataGapCount' },
  { id: 'low-conf',    label: 'Low Confidence',       countKey: 'lowConfidenceCount' },
]

export default function DataValidation() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('unmatched')
  const [matching, setMatching] = useState(false)
  const [matchResult, setMatchResult] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/sales-reports/data-validation')
      const j = await r.json()
      if (j.success) setData(j.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const runMatch = async () => {
    setMatching(true)
    setMatchResult(null)
    try {
      const r = await fetch('/api/sheets/match-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rematch: false }),
      })
      const j = await r.json()
      if (j.success) {
        setMatchResult({ ok: true, msg: `Matched ${j.data.matched} leads (${j.data.skipped} unresolved)` })
        await load()
      } else {
        setMatchResult({ ok: false, msg: j.error || 'Match failed' })
      }
    } catch (e) {
      setMatchResult({ ok: false, msg: e.message })
    } finally {
      setMatching(false)
    }
  }

  const summary = data?.summary || {}

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/modules/sales-reports')}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm"
            >
              <ArrowLeft size={16} />
              Reports
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Data Validation</h1>
              <p className="text-xs text-gray-500 mt-0.5">Admin queue — review and resolve uncertain data</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <UserMenu user={user} />
          </div>
        </div>
      </div>

      {/* Match result banner */}
      {matchResult && (
        <div className={`px-6 py-2 text-sm font-medium ${matchResult.ok ? 'bg-emerald-50 text-emerald-700 border-b border-emerald-200' : 'bg-red-50 text-red-700 border-b border-red-200'}`}>
          <div className="max-w-7xl mx-auto">
            {matchResult.ok ? '✓' : '✗'} {matchResult.msg}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6">
        {loading && !data ? (
          <div className="flex items-center justify-center py-24 text-gray-400">Loading…</div>
        ) : (
          <>
            {/* Summary bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              <SummaryBadge label="Unmatched leads" count={summary.unmatchedCount} color="bg-red-500" icon={Link2Off} />
              <SummaryBadge label="Duplicate accounts" count={summary.duplicateAccountGroups} color="bg-amber-500" icon={Copy} />
              <SummaryBadge label="Multi-year companies" count={summary.multiYearCount} color="bg-blue-500" icon={Clock} />
              <SummaryBadge label="Data gaps" count={summary.dataGapCount} color="bg-orange-500" icon={AlertTriangle} />
              <SummaryBadge label="Low confidence" count={summary.lowConfidenceCount} color="bg-violet-500" icon={TrendingDown} />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
              {TABS.map(t => {
                const count = summary[t.countKey]
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                      tab === t.id
                        ? 'text-blue-600 border-b-2 border-blue-600 -mb-px'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {t.label}
                    {count != null && count > 0 && (
                      <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold ${
                        tab === t.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Tab content */}
            {tab === 'unmatched'  && <UnmatchedLeads leads={data?.unmatchedLeads || []} onRunMatch={runMatch} matching={matching} />}
            {tab === 'duplicates' && <DuplicateAccounts groups={data?.duplicateAccounts || []} />}
            {tab === 'multi-year' && <MultiYearCompanies companies={data?.multiYearCompanies || []} />}
            {tab === 'gaps'       && <DataGaps leads={data?.dataGaps || []} />}
            {tab === 'low-conf'   && <LowConfidence leads={data?.lowConfidence || []} onRunMatch={runMatch} matching={matching} />}
          </>
        )}
      </div>
    </div>
  )
}
