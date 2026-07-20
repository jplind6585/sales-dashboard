import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft, Phone, Mail, Loader2, RefreshCw, Sparkles, ExternalLink, Check, Copy, ChevronDown, ChevronRight, Building2 } from 'lucide-react'
import UserMenu from '../../components/auth/UserMenu'
import ModulesNav from '../../components/layout/ModulesNav'
import StageBadge from '../../components/ui/StageBadge'

export default function CallQueue() {
  const router = useRouter()
  const [scope, setScope] = useState('mine')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [drafts, setDrafts] = useState({})       // accountId -> content (success only)
  const [draftError, setDraftError] = useState({}) // accountId -> error message
  const [draftingId, setDraftingId] = useState(null)
  const [logged, setLogged] = useState({})        // accountId -> touch type
  const [extraTouches, setExtraTouches] = useState(0)
  const [copiedId, setCopiedId] = useState(null)
  const [pendingTouch, setPendingTouch] = useState(null) // { accountId, touchType } — awaiting outcome

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/sdr/call-queue?scope=${scope}`)
      const json = await res.json()
      if (!res.ok || json.success === false) throw new Error(json.error || 'Failed to load queue')
      // Reset per-session state so a fresh server ranking is not filtered by stale touches and
      // an expanded row does not point at an account outside the new scope.
      setData(json); setExtraTouches(0); setLogged({}); setExpanded(null)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [scope])

  // Fetch (or retry) a draft without toggling the row's expansion.
  const fetchDraft = async (accountId) => {
    setDraftError(e => { const n = { ...e }; delete n[accountId]; return n })
    setDraftingId(accountId)
    try {
      const res = await fetch('/api/content/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, type: 'follow_up_email' }),
      })
      const json = await res.json()
      if (!res.ok || json.success === false) throw new Error(json.error || 'Draft failed')
      setDrafts(d => ({ ...d, [accountId]: json.content || '' }))
    } catch (e) { setDraftError(er => ({ ...er, [accountId]: e.message })) }
    finally { setDraftingId(null) }
  }

  const draftOpener = (accountId) => {
    const willClose = expanded === accountId
    setExpanded(willClose ? null : accountId)
    if (willClose) return
    if (typeof drafts[accountId] === 'string') return // good draft already cached
    fetchDraft(accountId)
  }

  const logTouch = async (accountId, touchType, outcome = null) => {
    setPendingTouch(null)
    try {
      const res = await fetch('/api/sdr/log-touch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, touchType, outcome }),
      })
      const json = await res.json()
      if (!res.ok || json.success === false) throw new Error(json.error || 'Log failed')
      setLogged(l => ({ ...l, [accountId]: touchType })); setExtraTouches(n => n + 1)
    } catch (e) { setError(e.message) }
  }

  const copyDraft = (accountId) => { navigator.clipboard.writeText(drafts[accountId] || '').then(() => { setCopiedId(accountId); setTimeout(() => setCopiedId(null), 1500) }).catch(() => setError('Copy failed — select and copy manually.')) }
  const openGmail = (accountId, name) => {
    const c = drafts[accountId] || ''
    const m = c.match(/^subject:\s*(.+)$/im)
    const subject = m ? m[1].trim() : `Following up — ${name}`
    const body = c.replace(/^subject:\s*.+$\n?/im, '').trim()
    window.open(`https://mail.google.com/mail/u/0/?view=cm&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.slice(0, 1800))}`, '_blank')
  }

  const target = data?.target || 20
  const touches = (data?.touchesToday || 0) + extraTouches
  const pct = Math.min(100, Math.round((touches / target) * 100))
  const queue = (data?.queue || []).filter(q => !logged[q.accountId])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><ArrowLeft className="w-4 h-4" /></button>
            <div>
              <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Phone className="w-4 h-4 text-coral-600" /> Call Queue</h1>
              <p className="text-xs text-gray-400">Who to reach today — ranked by ICP fit + how overdue</p>
            </div>
            <ModulesNav router={router} />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              <button onClick={() => setScope('mine')} className={`px-3 py-1.5 ${scope === 'mine' ? 'bg-coral-600 text-white' : 'text-gray-600'}`}>My accounts</button>
              <button onClick={() => setScope('all')} className={`px-3 py-1.5 ${scope === 'all' ? 'bg-coral-600 text-white' : 'text-gray-600'}`}>All</button>
            </div>
            <button onClick={load} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        {/* Daily target */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-gray-700">Today's outreach</span>
            <span className="text-sm text-gray-500">{touches} / {target} touches</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-coral-500" style={{ width: `${pct}%` }} /></div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
        {loading && !data && <div className="text-gray-400 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Building your ranked queue…</div>}
        {data && !queue.length && !loading && <div className="text-gray-400 text-sm bg-white rounded-xl border border-gray-100 p-6 text-center">Queue clear — every account in scope was touched recently. Switch to "All" or check back tomorrow.</div>}

        <div className="space-y-2">
          {queue.map((q, i) => (
            <div key={q.accountId} className="bg-white rounded-xl border border-gray-100">
              <div className="p-4 flex items-center gap-3">
                <span className="text-xs font-mono text-gray-300 w-5 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <button onClick={() => router.push(`/modules/account-pipeline?account=${q.accountId}`)} className="font-medium text-gray-900 hover:text-coral-700 truncate">{q.name}</button>
                    <StageBadge stage={q.stage} />
                    {q.tier === 'hot' && <span className="text-xs text-orange-500">🔥</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{q.why}{q.owner && scope === 'all' ? ` · ${q.owner}` : ''}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${q.channel === 'call' ? 'bg-coral-50 text-coral-700' : 'bg-slate-100 text-slate-600'}`}>
                  {q.channel === 'call' ? <Phone className="w-3 h-3" /> : <Mail className="w-3 h-3" />}{q.channel}
                </span>
                <button onClick={() => draftOpener(q.accountId)} className="text-xs flex items-center gap-1 px-2 py-1.5 border rounded-lg text-coral-600 hover:bg-coral-50">
                  <Sparkles className="w-3.5 h-3.5" /> Draft {expanded === q.accountId ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                <div className="flex gap-1">
                  {['call', 'email', 'linkedin'].map(t => (
                    <button key={t} onClick={() => setPendingTouch({ accountId: q.accountId, touchType: t })} title={`Log ${t}`}
                      className={`text-[11px] px-2 py-1.5 border rounded-lg ${pendingTouch?.accountId === q.accountId && pendingTouch?.touchType === t ? 'border-coral-300 bg-coral-50 text-coral-700' : 'text-gray-500 hover:bg-gray-50'}`}>{t === 'call' ? '📞' : t === 'email' ? '✉️' : 'in'}</button>
                  ))}
                </div>
              </div>
              {pendingTouch?.accountId === q.accountId && (
                <div className="px-4 pb-3 -mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-gray-400 mr-1">Outcome:</span>
                  {[['connected', 'Connected'], ['meeting_booked', 'Meeting booked'], ['no_answer', 'No answer'], ['voicemail', 'Voicemail']].map(([val, label]) => (
                    <button key={val} onClick={() => logTouch(q.accountId, pendingTouch.touchType, val)} className="text-[11px] px-2 py-1 rounded-full bg-coral-50 text-coral-700 hover:bg-coral-100">{label}</button>
                  ))}
                  <button onClick={() => logTouch(q.accountId, pendingTouch.touchType, null)} className="text-[11px] px-2 py-1 rounded-full text-gray-400 hover:bg-gray-50">skip</button>
                </div>
              )}
              {expanded === q.accountId && (
                <div className="border-t border-gray-50 p-4 bg-gray-50">
                  {draftingId === q.accountId ? <div className="text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Drafting opener from {q.name}'s calls…</div> : draftError[q.accountId] && !drafts[q.accountId] ? (
                    <div className="flex items-center gap-3 text-sm text-red-600">
                      <span>Could not draft: {draftError[q.accountId]}</span>
                      <button onClick={() => fetchDraft(q.accountId)} className="text-xs flex items-center gap-1 px-2 py-1 border rounded-lg text-gray-600 hover:bg-gray-50"><RefreshCw className="w-3.5 h-3.5" /> Retry</button>
                    </div>
                  ) : (
                    <>
                      <textarea value={drafts[q.accountId] || ''} onChange={e => setDrafts(d => ({ ...d, [q.accountId]: e.target.value }))} className="w-full border border-gray-200 rounded-lg p-3 text-sm font-mono" rows={8} />
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => openGmail(q.accountId, q.name)} className="text-xs flex items-center gap-1 px-2 py-1 border rounded-lg text-blue-600 hover:bg-blue-50"><ExternalLink className="w-3.5 h-3.5" /> Open in Gmail</button>
                        <button onClick={() => copyDraft(q.accountId)} className="text-xs flex items-center gap-1 px-2 py-1 border rounded-lg text-gray-600 hover:bg-gray-50">{copiedId === q.accountId ? <><Check className="w-3.5 h-3.5 text-coral-500" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400">Ranked from real pipeline data — recency, ICP fit, stage, and tier. Log a touch and its outcome to advance the daily target and de-prioritize the account.</p>
      </main>
    </div>
  )
}
