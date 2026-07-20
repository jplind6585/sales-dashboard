import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft, FileText, Mail, Layers, Calendar, FileSpreadsheet, Sparkles, Loader2, Copy, RefreshCw, Check, ExternalLink, AlertTriangle, Phone, Share2, Eye, ChevronLeft, ChevronRight, Wand2, UserPlus } from 'lucide-react'
import UserMenu from '../../components/auth/UserMenu'
import ModulesNav from '../../components/layout/ModulesNav'
import { useAccounts } from '../../hooks/useAccounts'
import { getSupabase } from '../../lib/supabase'
import AccountCombobox from '../../components/ui/AccountCombobox'

const TYPES = [
  { id: 'follow_up_email', label: 'Follow-up email', icon: Mail, auto: true, email: true },
  { id: 'business_case', label: 'Business case', icon: FileText, auto: true },
  { id: 'one_pager', label: 'One-pager', icon: FileText, auto: true },
  { id: 'meeting_agenda', label: 'Meeting agenda', icon: Calendar, auto: true },
  { id: 'email_sequence', label: 'Email sequence', icon: Layers, auto: true, email: true },
  { id: 'call_script', label: 'Call script', icon: Phone, auto: true },
  { id: 'rfp_response', label: 'RFP / questionnaire', icon: FileSpreadsheet, auto: false },
]

const PURPOSES = [
  { id: 'follow_up', label: 'Follow-up (references your calls)' },
  { id: 'cold_intro', label: 'Cold intro (no prior contact)' },
  { id: 'reengage', label: 'Re-engage (gone quiet)' },
  { id: 'breakup', label: 'Break-up (last touch)' },
]

const STORE_KEY = 'content_versions_v1'
const MAX_CTX = 15   // keep the most-recent N draft contexts in localStorage
const MAX_VER = 12   // versions kept per context

// Trim the persisted store so it can't grow unbounded.
function pruneStore(s) {
  const out = {}
  for (const [k, v] of Object.entries(s || {})) {
    if (!v?.versions?.length) continue
    const versions = v.versions.slice(-MAX_VER)
    out[k] = { ...v, versions, idx: Math.min(v.idx ?? 0, versions.length - 1) }
  }
  const keys = Object.keys(out)
  if (keys.length <= MAX_CTX) return out
  const keep = keys.sort((a, b) => (out[b].at || 0) - (out[a].at || 0)).slice(0, MAX_CTX)
  return Object.fromEntries(keep.map(k => [k, out[k]]))
}

export default function ContentStudio() {
  const router = useRouter()
  const { accounts } = useAccounts()
  const [accountId, setAccountId] = useState('')
  const [type, setType] = useState('follow_up_email')
  const [person, setPerson] = useState(null)      // { id?, name, title } | null (null = whole account)
  const [purpose, setPurpose] = useState('follow_up')
  const [stakeholders, setStakeholders] = useState([])
  const [addingPerson, setAddingPerson] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [rfpText, setRfpText] = useState('')
  const [store, setStore] = useState({})          // ctxKey -> { versions:[{content,callsUsed,instruction,edited,at}], idx, at }
  const [loading, setLoading] = useState(false)    // fresh generation
  const [refining, setRefining] = useState(false)
  const [refineText, setRefineText] = useState('')
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [dealRoom, setDealRoom] = useState(null)
  const [dealRoomBusy, setDealRoomBusy] = useState(false)
  const [dealRoomCopied, setDealRoomCopied] = useState(false)
  const [draftBusy, setDraftBusy] = useState(false)
  const reqRef = useRef(0)

  const activeType = TYPES.find(t => t.id === type)
  const isEmailType = !!activeType?.email
  const sortedAccounts = [...(accounts || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  const account = sortedAccounts.find(a => a.id === accountId) || null
  const accountName = account?.name || ''

  const personKey = person ? (person.id || `x:${person.name}`) : 'account'
  const ctxKey = accountId ? `${accountId}|${type}|${personKey}|${isEmailType ? purpose : 'na'}` : ''
  const cur = (ctxKey && store[ctxKey]) || { versions: [], idx: 0 }
  const versionCount = cur.versions.length
  const idx = Math.min(cur.idx || 0, Math.max(0, versionCount - 1))
  const version = cur.versions[idx] || null
  const content = version?.content || ''
  const callsUsed = version?.callsUsed ?? null

  // Hydrate persisted versions once.
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); if (s && typeof s === 'object') setStore(s) } catch {}
  }, [])

  const writeCtx = (key, updater) => {
    if (!key) return
    setStore(prev => {
      const base = prev[key] || { versions: [], idx: 0 }
      const next = { ...prev, [key]: { ...updater(base), at: Date.now() } }
      const pruned = pruneStore(next)
      try { localStorage.setItem(STORE_KEY, JSON.stringify(pruned)) } catch {}
      return pruned
    })
  }

  // Preselect an account from the URL (?accountId= or ?account=) so other surfaces can deep-link in.
  useEffect(() => {
    const q = router.query.accountId || router.query.account
    if (q && typeof q === 'string') setAccountId(q)
  }, [router.query.accountId, router.query.account])

  // Load the account's stakeholders for the "To" picker; reset recipient on account change.
  useEffect(() => {
    setPerson(null); setStakeholders([]); setAddingPerson(false)
    if (!accountId) return
    getSupabase().from('stakeholders').select('id, name, title, role, email').eq('account_id', accountId).order('name')
      .then(({ data }) => setStakeholders(data || [])).catch(() => {})
  }, [accountId])

  const runGenerate = async () => {
    if (!accountId) { setError('Pick an account first.'); return }
    if (type === 'rfp_response' && !rfpText.trim()) { setError('Paste the RFP / questionnaire text first.'); return }
    const key = ctxKey
    const reqId = ++reqRef.current
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/content/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, type, person, purpose: isEmailType ? purpose : undefined, input: type === 'rfp_response' ? { rawText: rfpText } : undefined }),
      })
      const data = await res.json()
      if (reqId !== reqRef.current) return
      if (!res.ok || data.success === false) throw new Error(data.error || 'Generation failed')
      writeCtx(key, (c) => {
        const v = { content: data.content || '', callsUsed: data.callsUsed ?? null, at: Date.now() }
        if (c.versions.length) { const vs = [...c.versions, v]; return { versions: vs, idx: vs.length - 1 } } // Regenerate → new version, keep history
        return { versions: [v], idx: 0 }
      })
    } catch (e) { if (reqId === reqRef.current) setError(e.message) }
    finally { if (reqId === reqRef.current) setLoading(false) }
  }

  // AI-first: when a context has no draft yet, draft one automatically (auto types only).
  useEffect(() => {
    if (!accountId || !activeType?.auto) return
    if ((store[ctxKey]?.versions?.length || 0) > 0) return
    runGenerate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, type, personKey, purpose])

  const refine = async () => {
    const instruction = refineText.trim()
    if (!instruction || !content || refining) return
    const key = ctxKey
    const reqId = ++reqRef.current
    setRefining(true); setError(null)
    try {
      const res = await fetch('/api/content/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, type, person, purpose: isEmailType ? purpose : undefined, refine: { instruction, priorDraft: content } }),
      })
      const data = await res.json()
      if (reqId !== reqRef.current) return
      if (!res.ok || data.success === false) throw new Error(data.error || 'Refine failed')
      writeCtx(key, (c) => {
        const vs = [...c.versions, { content: data.content || '', callsUsed: data.callsUsed ?? callsUsed, instruction, at: Date.now() }]
        return { versions: vs, idx: vs.length - 1 }
      })
      setRefineText('')
    } catch (e) { if (reqId === reqRef.current) setError(e.message) }
    finally { if (reqId === reqRef.current) setRefining(false) }
  }

  const goVersion = (delta) => writeCtx(ctxKey, (c) => ({ ...c, idx: Math.max(0, Math.min((c.idx || 0) + delta, c.versions.length - 1)) }))

  const onEdit = (v) => writeCtx(ctxKey, (c) => {
    const vs = c.versions.slice()
    if (!vs[idx]) return c
    vs[idx] = { ...vs[idx], content: v, edited: true }
    return { ...c, versions: vs, idx }
  })

  const choosePerson = (v) => {
    if (v === 'account') setPerson(null)
    else if (v === '__add') setAddingPerson(true)
    else { const s = stakeholders.find(x => x.id === v); if (s) setPerson({ id: s.id, name: s.name, title: s.title || s.role || '' }) }
  }
  const addCustomPerson = () => {
    if (!newName.trim()) return
    setPerson({ name: newName.trim(), title: newTitle.trim() })
    setAddingPerson(false); setNewName(''); setNewTitle('')
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 1500) }
    catch { setError('Copy failed — select the draft text and copy it manually.') }
  }

  // Deal Room — load existing on account change, create + copy the public share link.
  useEffect(() => {
    setDealRoom(null)
    if (!accountId) return
    fetch(`/api/deal-room?accountId=${accountId}`).then(r => r.json()).then(j => setDealRoom(j.room || null)).catch(() => {})
  }, [accountId])

  const shareDealRoom = async () => {
    if (!accountId) return
    setDealRoomBusy(true)
    try {
      const res = await fetch('/api/deal-room', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId }) })
      const j = await res.json()
      if (j.room?.path) {
        setDealRoom(j.room)
        const url = `${window.location.origin}${j.room.path}`
        await navigator.clipboard.writeText(url).then(() => { setDealRoomCopied(true); setTimeout(() => setDealRoomCopied(false), 1800) }).catch(() => {})
      }
    } finally { setDealRoomBusy(false) }
  }

  // Create a real Gmail draft (needs the gmail.compose scope); falls back to the compose URL if the
  // Google token isn't available on the session.
  const createGmailDraft = async () => {
    setDraftBusy(true); setError(null)
    try {
      const { data: { session } } = await getSupabase().auth.getSession()
      const token = session?.provider_token
      if (!token) { openGmail(); return }
      const m = content.match(/^subject:\s*(.+)$/im)
      const subject = m ? m[1].trim() : `Following up — ${accountName}`
      const body = content.replace(/^subject:\s*.+$\n?/im, '').trim()
      const res = await fetch('/api/gmail/create-draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, to: person?.email || '', subject, body }) })
      const j = await res.json()
      if (!res.ok || j.success === false) { setError(j.error || 'Could not create draft — try Open in Gmail.'); return }
      window.open(j.url || 'https://mail.google.com/mail/u/0/#drafts', '_blank')
    } catch (e) { setError(e.message) } finally { setDraftBusy(false) }
  }

  const openGmail = () => {
    const m = content.match(/^subject:\s*(.+)$/im)
    const subject = m ? m[1].trim() : `Following up — ${accountName}`
    const body = content.replace(/^subject:\s*.+$\n?/im, '').trim()
    const to = person?.email ? `to=${encodeURIComponent(person.email)}&` : ''
    if (encodeURIComponent(body).length > 1800) { // compose-URL length guard
      navigator.clipboard.writeText(body).catch(() => {})
      window.open(`https://mail.google.com/mail/u/0/?view=cm&${to}su=${encodeURIComponent(subject)}`, '_blank')
      setError('Draft was long — opened Gmail with the subject and copied the body to your clipboard. Paste it in.')
      return
    }
    window.open(`https://mail.google.com/mail/u/0/?view=cm&${to}su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
  }

  const personSelectValue = person ? (person.id || 'custom') : 'account'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><ArrowLeft className="w-4 h-4" /></button>
            <div>
              <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Sparkles className="w-4 h-4 text-coral-500" /> Content Studio</h1>
              <p className="text-xs text-gray-400">AI-drafted from this account's calls — adapt and send</p>
            </div>
            <ModulesNav router={router} />
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <label className="text-xs font-semibold text-gray-500 uppercase">Account</label>
            <AccountCombobox accounts={sortedAccounts} value={accountId} onChange={setAccountId} />
            {!sortedAccounts.length && <p className="text-xs text-gray-400 mt-1">Loading accounts…</p>}
          </div>

          {accountId && (
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">To</label>
                {!addingPerson ? (
                  <select value={personSelectValue} onChange={e => choosePerson(e.target.value)}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="account">Whole account (no specific person)</option>
                    {stakeholders.map(s => <option key={s.id} value={s.id}>{s.name}{(s.title || s.role) ? ` · ${s.title || s.role}` : ''}</option>)}
                    {person && !person.id && <option value="custom">{person.name}{person.title ? ` · ${person.title}` : ''} (custom)</option>}
                    <option value="__add">+ Add someone…</option>
                  </select>
                ) : (
                  <div className="mt-1 space-y-2">
                    <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name (e.g. Jordan Lee)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Title (e.g. CFO)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    <div className="flex gap-2">
                      <button onClick={addCustomPerson} disabled={!newName.trim()} className="flex-1 bg-coral-600 text-white rounded-lg py-1.5 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-1"><UserPlus className="w-3.5 h-3.5" /> Use</button>
                      <button onClick={() => setAddingPerson(false)} className="px-3 py-1.5 text-sm border rounded-lg text-gray-500 hover:bg-gray-50">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
              {isEmailType && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Purpose</label>
                  <select value={purpose} onChange={e => setPurpose(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {PURPOSES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <label className="text-xs font-semibold text-gray-500 uppercase">Content type</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {TYPES.map(t => {
                const Icon = t.icon
                return (
                  <button key={t.id} onClick={() => setType(t.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border text-left ${type === t.id ? 'border-coral-400 bg-coral-50 text-coral-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    <Icon className="w-4 h-4 shrink-0" /> <span className="truncate">{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {accountId && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1"><Share2 className="w-3.5 h-3.5" /> Deal Room</label>
              <p className="text-xs text-gray-400 mt-1">A shareable, branded value page for this prospect with an ROI estimate from their metrics.</p>
              <button onClick={shareDealRoom} disabled={dealRoomBusy} className="mt-2 w-full bg-coral-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-coral-700 disabled:opacity-40">
                {dealRoomBusy ? 'Creating…' : dealRoomCopied ? 'Link copied!' : dealRoom ? 'Copy share link' : 'Create & copy link'}
              </button>
              {dealRoom && <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1"><Eye className="w-3 h-3" /> {dealRoom.views || 0} view{dealRoom.views === 1 ? '' : 's'} so far</p>}
            </div>
          )}

          {type === 'rfp_response' && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <label className="text-xs font-semibold text-gray-500 uppercase">Paste the RFP / questionnaire</label>
              <textarea value={rfpText} onChange={e => setRfpText(e.target.value)} rows={8} placeholder="Paste the questions here…"
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" />
              <button onClick={runGenerate} disabled={loading || !accountId || !rfpText.trim()}
                className="mt-2 w-full bg-coral-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40">
                {loading ? 'Drafting…' : 'Draft answers'}
              </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-100 p-5 min-h-[480px] flex flex-col">
            <div className="flex items-center justify-between mb-3 gap-3">
              <h2 className="font-semibold text-gray-900 min-w-0 truncate">
                {activeType?.label}{accountName ? ` · ${accountName}` : ''}{person?.name ? ` → ${person.name}` : ''}
              </h2>
              <div className="flex items-center gap-2 flex-shrink-0">
                {versionCount > 0 && (
                  <div className="flex items-center gap-0.5 mr-1 border border-gray-200 rounded-lg px-1 py-0.5">
                    <button onClick={() => goVersion(-1)} disabled={idx <= 0} title="Previous version"
                      className="p-1 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-25 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="text-xs font-medium text-gray-600 tabular-nums px-0.5">v{idx + 1}<span className="text-gray-300">/{versionCount}</span></span>
                    <button onClick={() => goVersion(1)} disabled={idx >= versionCount - 1} title="Next version"
                      className="p-1 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-25 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                )}
                {content && activeType?.auto && <button onClick={runGenerate} disabled={loading || refining} className="text-xs flex items-center gap-1 px-2 py-1 border rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40"><RefreshCw className="w-3.5 h-3.5" /> Regenerate</button>}
                {content && activeType?.email && <button onClick={createGmailDraft} disabled={draftBusy} className="text-xs flex items-center gap-1 px-2 py-1 border rounded-lg text-coral-600 hover:bg-coral-50 disabled:opacity-50"><Mail className="w-3.5 h-3.5" /> {draftBusy ? 'Drafting…' : 'Create draft'}</button>}
                {content && activeType?.email && <button onClick={openGmail} className="text-xs flex items-center gap-1 px-2 py-1 border rounded-lg text-blue-600 hover:bg-blue-50"><ExternalLink className="w-3.5 h-3.5" /> Open in Gmail</button>}
                {content && <button onClick={copy} className="text-xs flex items-center gap-1 px-2 py-1 border rounded-lg text-gray-600 hover:bg-gray-50">{copied ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}</button>}
              </div>
            </div>

            {version?.instruction && (
              <p className="text-xs text-gray-400 mb-2 flex items-center gap-1"><Wand2 className="w-3 h-3 text-coral-400" /> Adjusted: “{version.instruction}”</p>
            )}

            {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-3">{error}</div>}
            {content && callsUsed === 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-sm mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> No analyzed calls for this account yet — this draft is an ungrounded skeleton. Capture/analyze a call for a real draft.
              </div>
            )}

            {!accountId && !loading && <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Pick an account and a content type — the draft appears automatically.</div>}
            {loading && <div className="flex-1 flex items-center justify-center text-gray-400 text-sm gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Drafting from {accountName}'s calls…</div>}
            {content && !loading && (
              <textarea value={content} onChange={e => onEdit(e.target.value)} disabled={refining}
                className="flex-1 w-full border border-gray-100 rounded-lg p-4 text-[15px] font-serif leading-relaxed text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-coral-200 disabled:opacity-60" style={{ minHeight: 380 }} />
            )}

            {content && !loading && (
              <div className="mt-3">
                <div className="flex gap-2">
                  <input value={refineText} onChange={e => setRefineText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); refine() } }}
                    placeholder="Adjust this draft — e.g. “drop the Builder Edge reference”, “make it 30% more concise”" disabled={refining}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-coral-200" />
                  <button onClick={refine} disabled={refining || !refineText.trim()} className="px-3.5 bg-coral-600 text-white rounded-lg text-sm font-medium hover:bg-coral-700 disabled:opacity-40 flex items-center gap-1">
                    {refining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Refine
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">Refine adds a new version (v{versionCount + 1}) and keeps the current one. Edit the text directly anytime — edits stay on this version.</p>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">Grounded in this account's analyzed calls + your sales process. Nothing is sent or saved automatically. Versions are kept in this browser.</p>
        </div>
      </main>
    </div>
  )
}
