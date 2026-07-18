import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft, FileText, Mail, Layers, Calendar, FileSpreadsheet, Sparkles, Loader2, Copy, RefreshCw, Check, ExternalLink, AlertTriangle, Phone, Share2, Eye } from 'lucide-react'
import UserMenu from '../../components/auth/UserMenu'
import ModulesNav from '../../components/layout/ModulesNav'
import { useAccounts } from '../../hooks/useAccounts'
import { getSupabase } from '../../lib/supabase'

const TYPES = [
  { id: 'follow_up_email', label: 'Follow-up email', icon: Mail, auto: true, email: true },
  { id: 'business_case', label: 'Business case', icon: FileText, auto: true },
  { id: 'one_pager', label: 'One-pager', icon: FileText, auto: true },
  { id: 'meeting_agenda', label: 'Meeting agenda', icon: Calendar, auto: true },
  { id: 'email_sequence', label: 'Email sequence', icon: Layers, auto: true },
  { id: 'call_script', label: 'Call script', icon: Phone, auto: true },
  { id: 'rfp_response', label: 'RFP / questionnaire', icon: FileSpreadsheet, auto: false },
]

export default function ContentStudio() {
  const router = useRouter()
  const { accounts } = useAccounts()
  const [accountId, setAccountId] = useState('')
  const [type, setType] = useState('follow_up_email')
  const [rfpText, setRfpText] = useState('')
  const [content, setContent] = useState('')
  const [callsUsed, setCallsUsed] = useState(null)
  const [edited, setEdited] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [dealRoom, setDealRoom] = useState(null)
  const [dealRoomBusy, setDealRoomBusy] = useState(false)
  const [dealRoomCopied, setDealRoomCopied] = useState(false)
  const [draftBusy, setDraftBusy] = useState(false)
  const reqRef = useRef(0)
  const cacheRef = useRef({}) // `${accountId}:${type}` -> { content, callsUsed }

  const activeType = TYPES.find(t => t.id === type)
  const sortedAccounts = [...(accounts || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  const accountName = sortedAccounts.find(a => a.id === accountId)?.name || ''
  const cacheKey = `${accountId}:${type}`

  // Preselect an account from the URL (?accountId= or ?account=) so other surfaces can deep-link in.
  useEffect(() => {
    const q = router.query.accountId || router.query.account
    if (q && typeof q === 'string') setAccountId(q)
  }, [router.query.accountId, router.query.account])

  const runGenerate = async () => {
    if (!accountId) { setError('Pick an account first.'); return }
    if (type === 'rfp_response' && !rfpText.trim()) { setError('Paste the RFP / questionnaire text first.'); return }
    const reqId = ++reqRef.current
    setLoading(true); setError(null); setContent(''); setCallsUsed(null)
    try {
      const res = await fetch('/api/content/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, type, input: type === 'rfp_response' ? { rawText: rfpText } : undefined }),
      })
      const data = await res.json()
      if (reqId !== reqRef.current) return // superseded by a newer request
      if (!res.ok || data.success === false) throw new Error(data.error || 'Generation failed')
      setContent(data.content || ''); setCallsUsed(data.callsUsed ?? null); setEdited(false)
      cacheRef.current[cacheKey] = { content: data.content || '', callsUsed: data.callsUsed ?? null }
    } catch (e) { if (reqId === reqRef.current) setError(e.message) }
    finally { if (reqId === reqRef.current) setLoading(false) }
  }

  // AI-first + non-destructive: restore a cached draft (preserving edits) or draft fresh.
  useEffect(() => {
    if (!accountId || !activeType?.auto) { setContent(''); setCallsUsed(null); setEdited(false); return }
    const cached = cacheRef.current[`${accountId}:${type}`]
    if (cached) { setContent(cached.content); setCallsUsed(cached.callsUsed); setEdited(false); setError(null) }
    else runGenerate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, type])

  const regenerate = () => {
    if (edited && content.trim() && !window.confirm('Discard your edits and regenerate from scratch?')) return
    runGenerate()
  }

  const onEdit = (v) => { setContent(v); setEdited(true); if (accountId) cacheRef.current[cacheKey] = { content: v, callsUsed } }

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
      const res = await fetch('/api/gmail/create-draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, subject, body }) })
      const j = await res.json()
      if (!res.ok || j.success === false) { setError(j.error || 'Could not create draft — try Open in Gmail.'); return }
      window.open(j.url || 'https://mail.google.com/mail/u/0/#drafts', '_blank')
    } catch (e) { setError(e.message) } finally { setDraftBusy(false) }
  }

  const openGmail = () => {
    const m = content.match(/^subject:\s*(.+)$/im)
    const subject = m ? m[1].trim() : `Following up — ${accountName}`
    const body = content.replace(/^subject:\s*.+$\n?/im, '').trim()
    if (encodeURIComponent(body).length > 1800) { // compose-URL length guard
      navigator.clipboard.writeText(body).catch(() => {})
      window.open(`https://mail.google.com/mail/u/0/?view=cm&su=${encodeURIComponent(subject)}`, '_blank')
      setError('Draft was long — opened Gmail with the subject and copied the body to your clipboard. Paste it in.')
      return
    }
    window.open(`https://mail.google.com/mail/u/0/?view=cm&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
  }

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
            <select value={accountId} onChange={e => setAccountId(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Select an account…</option>
              {sortedAccounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.stage ? ` · ${a.stage}` : ''}</option>)}
            </select>
            {!sortedAccounts.length && <p className="text-xs text-gray-400 mt-1">Loading accounts…</p>}
          </div>

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
              <button onClick={regenerate} disabled={loading || !accountId || !rfpText.trim()}
                className="mt-2 w-full bg-coral-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40">
                {loading ? 'Drafting…' : 'Draft answers'}
              </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-100 p-5 min-h-[480px] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">{activeType?.label}{accountName ? ` · ${accountName}` : ''}</h2>
              <div className="flex items-center gap-2">
                {content && activeType?.auto && <button onClick={regenerate} disabled={loading} className="text-xs flex items-center gap-1 px-2 py-1 border rounded-lg text-gray-600 hover:bg-gray-50"><RefreshCw className="w-3.5 h-3.5" /> Regenerate</button>}
                {content && activeType?.email && <button onClick={createGmailDraft} disabled={draftBusy} className="text-xs flex items-center gap-1 px-2 py-1 border rounded-lg text-coral-600 hover:bg-coral-50 disabled:opacity-50"><Mail className="w-3.5 h-3.5" /> {draftBusy ? 'Drafting…' : 'Create draft'}</button>}
                {content && activeType?.email && <button onClick={openGmail} className="text-xs flex items-center gap-1 px-2 py-1 border rounded-lg text-blue-600 hover:bg-blue-50"><ExternalLink className="w-3.5 h-3.5" /> Open in Gmail</button>}
                {content && <button onClick={copy} className="text-xs flex items-center gap-1 px-2 py-1 border rounded-lg text-gray-600 hover:bg-gray-50">{copied ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}</button>}
              </div>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-3">{error}</div>}
            {content && callsUsed === 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-sm mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> No analyzed calls for this account yet — this draft is an ungrounded skeleton. Capture/analyze a call for a real draft.
              </div>
            )}

            {!accountId && !loading && <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Pick an account and a content type — the draft appears automatically.</div>}
            {loading && <div className="flex-1 flex items-center justify-center text-gray-400 text-sm gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Drafting from {accountName}'s calls…</div>}
            {content && !loading && (
              <textarea value={content} onChange={e => onEdit(e.target.value)}
                className="flex-1 w-full border border-gray-100 rounded-lg p-3 text-sm font-mono leading-relaxed resize-none" style={{ minHeight: 380 }} />
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">Grounded in this account's analyzed calls + your sales process. Edit freely — your edits are kept as you switch types, and nothing is sent or saved automatically.</p>
        </div>
      </main>
    </div>
  )
}
