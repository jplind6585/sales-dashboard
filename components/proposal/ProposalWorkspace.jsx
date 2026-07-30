import { useState, useEffect, useCallback } from 'react'
import { Loader2, FileText, Copy, Download, Check, Wand2, Sparkles, CheckSquare, Square, AlertTriangle } from 'lucide-react'
import ProposalDocView from './ProposalDocView'
import { docToMarkdown } from '../../lib/proposalSpec'

// Content Studio "Eval doc / Proposal" workspace. Pull the account's call transcripts (deselect any),
// generate a FRESH structured doc, view it + version history, and iterate via feedback (systemic edits
// route to the global prompt on approval; deal-specific notes save as account context). Every apply =
// a fresh regenerate from the transcripts — never a patch of the prior doc.
export default function ProposalWorkspace({ accountId, accountName }) {
  const [calls, setCalls] = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [loadingCalls, setLoadingCalls] = useState(true)
  const [proposal, setProposal] = useState(null)
  const [messages, setMessages] = useState([])
  const [viewVersion, setViewVersion] = useState('current')
  const [generating, setGenerating] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingInstruction, setPendingInstruction] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  // Load the account's calls + any existing proposal + thread.
  useEffect(() => {
    if (!accountId) return
    let alive = true
    setLoadingCalls(true); setProposal(null); setMessages([]); setViewVersion('current'); setPendingInstruction(null); setError(null)
    Promise.all([
      fetch(`/api/gong/account-calls?accountId=${accountId}`).then(r => r.json()).catch(() => ({ calls: [] })),
      fetch(`/api/accounts/proposal?accountId=${accountId}`).then(r => r.json()).catch(() => ({})),
    ]).then(([callsRes, propRes]) => {
      if (!alive) return
      const cs = (callsRes.calls || callsRes.data?.calls || [])
      setCalls(cs)
      // Default: all calls with a stored transcript selected.
      setSelected(new Set(cs.filter(c => c.transcriptText && !c.pending).map(c => c.id)))
      if (propRes.proposal) setProposal(propRes.proposal)
      setMessages(propRes.messages || [])
      setLoadingCalls(false)
    })
    return () => { alive = false }
  }, [accountId])

  const toggle = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectableIds = calls.filter(c => c.transcriptText && !c.pending).map(c => c.id)
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selected.has(id))

  const generate = useCallback(async () => {
    const callIds = [...selected]
    if (callIds.length === 0) { setError('Select at least one call with a transcript.'); return }
    setGenerating(true); setError(null)
    try {
      const res = await fetch('/api/accounts/proposal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'generate', accountId, callIds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setProposal(data.proposal); setViewVersion('current')
      const st = await fetch(`/api/accounts/proposal?accountId=${accountId}`).then(r => r.json()).catch(() => ({}))
      setMessages(st.messages || [])
    } catch (e) { setError(e.message) } finally { setGenerating(false) }
  }, [accountId, selected])

  const sendFeedback = async () => {
    const msg = feedback.trim()
    if (!msg) return
    setBusy(true); setError(null); setFeedback('')
    try {
      const res = await fetch('/api/accounts/proposal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'feedback', accountId, message: msg }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Feedback failed')
      setMessages(m => [...m, { role: 'user', content: msg }])
      if (data.scope === 'systemic') {
        setPendingInstruction(data.instructionEdit)
      } else {
        setMessages(m => [...m, { role: 'system', content: `Saved as deal context: ${data.contextNote}` }])
        await generate() // deal-specific → fresh regenerate with the new context
      }
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const applyInstruction = async () => {
    setBusy(true); setError(null)
    try {
      await fetch('/api/accounts/proposal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'apply_instruction', instructionEdit: pendingInstruction }),
      })
      setMessages(m => [...m, { role: 'system', content: `Added to global instructions: ${pendingInstruction}` }])
      setPendingInstruction(null)
      await generate()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const shownDoc = viewVersion === 'current'
    ? proposal?.content
    : (proposal?.versions || []).find(v => v.version === viewVersion)?.content
  const markdown = shownDoc ? docToMarkdown(shownDoc, accountName) : ''

  const copyMd = () => { navigator.clipboard.writeText(markdown); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  const downloadMd = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = `${(accountName || 'account').replace(/\s+/g, '_')}_Eval_Doc_v${shownDoc?.versionLog?.[0]?.version || proposal?.version || 1}.md`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const missingTranscripts = calls.filter(c => !c.transcriptText || c.pending).length

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      {/* Left: transcript picker + generate */}
      <div className="lg:col-span-2 space-y-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-500 uppercase">Transcripts ({selected.size}/{selectableIds.length})</label>
            {selectableIds.length > 0 && (
              <button onClick={() => setSelected(allSelected ? new Set() : new Set(selectableIds))} className="text-xs text-coral-600 hover:underline">
                {allSelected ? 'Clear all' : 'Select all'}
              </button>
            )}
          </div>
          {loadingCalls ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading calls…</div>
          ) : calls.length === 0 ? (
            <p className="text-sm text-gray-400 py-3">No analyzed calls linked to this account yet.</p>
          ) : (
            <div className="space-y-1 max-h-[420px] overflow-y-auto">
              {calls.map(c => {
                const usable = c.transcriptText && !c.pending
                const on = selected.has(c.id)
                return (
                  <button key={c.id} onClick={() => usable && toggle(c.id)} disabled={!usable}
                    className={`w-full flex items-start gap-2 text-left px-2 py-1.5 rounded-lg ${usable ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}`}>
                    {usable ? (on ? <CheckSquare className="w-4 h-4 text-coral-600 mt-0.5 shrink-0" /> : <Square className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" />) : <Square className="w-4 h-4 text-gray-200 mt-0.5 shrink-0" />}
                    <span className="min-w-0">
                      <span className="block text-sm text-gray-800 truncate">{c.title || 'Untitled call'}</span>
                      <span className="block text-xs text-gray-400">{String(c.date || '').slice(0, 10)}{c.repName ? ` · ${c.repName}` : ''}{!usable ? ' · no transcript' : ''}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
          {missingTranscripts > 0 && <p className="text-[11px] text-gray-400 mt-2">{missingTranscripts} call{missingTranscripts === 1 ? '' : 's'} without a stored transcript can't be included.</p>}
          <button onClick={generate} disabled={generating || selected.size === 0}
            className="mt-3 w-full bg-coral-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-coral-700 disabled:opacity-40 flex items-center justify-center gap-2">
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4" /> {proposal ? 'Regenerate from transcripts' : 'Generate eval doc'}</>}
          </button>
          <p className="text-[11px] text-gray-400 mt-1.5">Every run is a fresh build from the selected transcripts. The prior version is kept.</p>
        </div>

        {/* Feedback / chat */}
        {proposal && (
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <label className="text-xs font-semibold text-gray-500 uppercase">Refine</label>
            <div className="mt-2 space-y-1.5 max-h-[180px] overflow-y-auto">
              {messages.slice(-8).map((m, i) => (
                <div key={i} className={`text-xs rounded-lg px-2 py-1.5 ${m.role === 'user' ? 'bg-coral-50 text-coral-800' : m.role === 'system' ? 'bg-gray-50 text-gray-500 italic' : 'bg-blue-50 text-blue-800'}`}>{m.content}</div>
              ))}
            </div>
            {pendingInstruction && (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
                <p className="text-xs text-amber-800">This looks like a rule for <b>every</b> future doc. Add to the global instructions?</p>
                <p className="text-xs text-gray-700 italic my-1">"{pendingInstruction}"</p>
                <div className="flex gap-2">
                  <button onClick={applyInstruction} disabled={busy} className="text-xs bg-amber-600 text-white rounded px-2 py-1 disabled:opacity-40">Approve + regenerate</button>
                  <button onClick={() => setPendingInstruction(null)} className="text-xs border rounded px-2 py-1 text-gray-500">Discard</button>
                </div>
              </div>
            )}
            <div className="mt-2 flex gap-2">
              <input value={feedback} onChange={e => setFeedback(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFeedback() } }}
                placeholder='e.g. "invoicing is their #1 pain" or "always order by pain intensity"' disabled={busy || generating}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-coral-200" />
              <button onClick={sendFeedback} disabled={busy || generating || !feedback.trim()} className="px-3 bg-gray-800 text-white rounded-lg text-sm disabled:opacity-40 flex items-center gap-1">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right: the doc */}
      <div className="lg:col-span-3">
        <div className="bg-white rounded-xl border border-gray-100 p-5 min-h-[480px]">
          <div className="flex items-center justify-between mb-3 gap-2">
            <h2 className="font-semibold text-gray-900 truncate flex items-center gap-2"><FileText className="w-4 h-4 text-coral-500" /> Eval Doc{accountName ? ` · ${accountName}` : ''}</h2>
            {proposal && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {(proposal.versions || []).length > 0 && (
                  <select value={viewVersion} onChange={e => setViewVersion(e.target.value === 'current' ? 'current' : Number(e.target.value))}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600">
                    <option value="current">v{proposal.version} (latest)</option>
                    {[...(proposal.versions || [])].reverse().map(v => <option key={v.version} value={v.version}>v{v.version}</option>)}
                  </select>
                )}
                <button onClick={copyMd} className="text-xs flex items-center gap-1 px-2 py-1 border rounded-lg text-gray-600 hover:bg-gray-50">{copied ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}</button>
                <button onClick={downloadMd} className="text-xs flex items-center gap-1 px-2 py-1 border rounded-lg text-gray-600 hover:bg-gray-50"><Download className="w-3.5 h-3.5" /> .md</button>
              </div>
            )}
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> {error}</div>}

          {generating && !shownDoc && <div className="flex items-center justify-center text-gray-400 text-sm gap-2 py-16"><Loader2 className="w-5 h-5 animate-spin" /> Building the eval doc from the transcripts…</div>}
          {!shownDoc && !generating && <div className="flex items-center justify-center text-gray-400 text-sm py-16 text-center px-6">Select the calls to include and hit Generate. The full eval doc — deck-ready copy, ROI, quotes, and your internal working section — builds from the transcripts.</div>}
          {shownDoc && <ProposalDocView doc={shownDoc} />}
        </div>
      </div>
    </div>
  )
}
