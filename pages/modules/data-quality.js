import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import {
  ArrowLeft, RefreshCw, Link2, GitMerge, AlertCircle, CheckCircle,
  Search, ChevronRight, X, Plus, Tag, Globe, Undo2, Zap,
} from 'lucide-react'
import UserMenu from '../../components/auth/UserMenu'
import { useAuthStore } from '../../stores/useAuthStore'

const TABS = [
  { id: 'unmatched', label: 'Unmatched Calls' },
  { id: 'duplicates', label: 'Potential Duplicates' },
  { id: 'hubspot', label: 'Missing HubSpot' },
  { id: 'aliases', label: 'Alias Suggestions' },
  { id: 'history', label: 'Merge History' },
]

function Badge({ children, color = 'gray' }) {
  const colors = {
    gray: 'bg-gray-100 text-gray-600', red: 'bg-red-100 text-red-700',
    yellow: 'bg-yellow-100 text-yellow-700', green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700', purple: 'bg-purple-100 text-purple-700',
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[color]}`}>{children}</span>
}

function ConfidenceBadge({ score }) {
  const color = score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red'
  return <Badge color={color}>{score}% match</Badge>
}

// ── Merge modal ────────────────────────────────────────────────────────────────
function MergeModal({ pair, accounts, onClose, onMerge }) {
  const [canonicalId, setCanonicalId] = useState(pair?.a?.id || '')
  const [merging, setMerging] = useState(false)

  if (!pair) return null
  const absorbed = canonicalId === pair.a.id ? pair.b : pair.a
  const canonical = canonicalId === pair.a.id ? pair.a : pair.b

  async function doMerge() {
    setMerging(true)
    try { await onMerge(canonicalId, absorbed.id) } finally { setMerging(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-gray-700" />
            <h2 className="text-lg font-bold text-gray-900">Merge Accounts</h2>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>

        <p className="text-sm text-gray-500 mb-4">Choose which account is the <strong>canonical</strong> record. The other will be absorbed into it — all calls, tasks, stakeholders, and notes will be moved over. This can be undone from Merge History.</p>

        <div className="space-y-2 mb-6">
          {[pair.a, pair.b].map(acct => (
            <label key={acct.id} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${canonicalId === acct.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <input type="radio" name="canonical" value={acct.id} checked={canonicalId === acct.id} onChange={() => setCanonicalId(acct.id)} className="accent-gray-900" />
              <div>
                <p className="font-semibold text-gray-900">{acct.name}</p>
                <p className="text-xs text-gray-400">{acct.stage?.replace(/_/g, ' ')}</p>
              </div>
              {canonicalId === acct.id && <span className="ml-auto text-xs font-semibold text-gray-700 bg-gray-200 px-2 py-0.5 rounded">Keep as canonical</span>}
            </label>
          ))}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5 text-sm text-amber-800">
          <strong>"{absorbed.name}"</strong> will be absorbed into <strong>"{canonical.name}"</strong>. Its name will be added as an alias.
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={doMerge} disabled={merging} className="flex-1 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2">
            {merging ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <GitMerge className="w-3.5 h-3.5" />}
            {merging ? 'Merging…' : 'Merge'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Alias editor inline ────────────────────────────────────────────────────────
function AliasEditor({ accountId, accountName, initialAliases, initialDomains, onSave }) {
  const [aliases, setAliases] = useState(initialAliases || [])
  const [domains, setDomains] = useState(initialDomains || [])
  const [newAlias, setNewAlias] = useState('')
  const [newDomain, setNewDomain] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const r = await fetch('/api/admin/update-aliases', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, aliases, emailDomains: domains }),
      })
      const d = await r.json()
      if (d.success) onSave(d.account)
    } finally { setSaving(false) }
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
      <p className="text-sm font-semibold text-gray-700">{accountName}</p>

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1"><Tag className="w-3 h-3" /> Aliases (alternate names)</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {aliases.map((a, i) => (
            <span key={i} className="flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
              {a}
              <button onClick={() => setAliases(prev => prev.filter((_, j) => j !== i))}><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newAlias} onChange={e => setNewAlias(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newAlias.trim()) { setAliases(p => [...p, newAlias.trim()]); setNewAlias('') }}}
            placeholder="Add alias…" className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400" />
          <button onClick={() => { if (newAlias.trim()) { setAliases(p => [...p, newAlias.trim()]); setNewAlias('') }}}
            className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300"><Plus className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1"><Globe className="w-3 h-3" /> Email domains</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {domains.map((d, i) => (
            <span key={i} className="flex items-center gap-1 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
              @{d}
              <button onClick={() => setDomains(prev => prev.filter((_, j) => j !== i))}><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newDomain} onChange={e => setNewDomain(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newDomain.trim()) { setDomains(p => [...p, newDomain.trim().replace(/^@/, '')]); setNewDomain('') }}}
            placeholder="company.com" className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400" />
          <button onClick={() => { if (newDomain.trim()) { setDomains(p => [...p, newDomain.trim().replace(/^@/, '')]); setNewDomain('') }}}
            className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300"><Plus className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <button onClick={save} disabled={saving} className="w-full py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2">
        {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function DataQuality() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState('unmatched')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [toast, setToast] = useState(null)
  const [mergeModal, setMergeModal] = useState(null)
  const [editingAlias, setEditingAlias] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [linkTarget, setLinkTarget] = useState({}) // callId → accountId select state

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function load() {
    setLoading(true)
    try {
      const [qr, ar] = await Promise.all([
        fetch('/api/admin/data-quality').then(r => r.json()),
        fetch('/api/pipeline-overview').then(r => r.json()),
      ])
      if (qr.success) setData(qr)
      if (ar.repSummaries) {
        // Build flat account list from pipeline overview isn't ideal — fetch accounts directly
        const acctRes = await fetch('/api/admin/data-quality')
        // We'll use a separate accounts endpoint if needed; for now store from data-quality
      }
    } catch (e) { showToast(e.message, 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function linkCall(gongCallId, accountId) {
    if (!accountId) return
    setActionLoading(gongCallId)
    try {
      const r = await fetch('/api/admin/link-call', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gongCallId, accountId }),
      })
      const d = await r.json()
      if (d.success) {
        showToast('Call linked to account')
        setData(prev => ({ ...prev, unmatchedCalls: prev.unmatchedCalls.filter(c => c.gongCallId !== gongCallId), counts: { ...prev.counts, unmatched: prev.counts.unmatched - 1 } }))
      } else showToast(d.error, 'error')
    } finally { setActionLoading(null) }
  }

  async function autoLink() {
    setActionLoading('autolink')
    try {
      const r = await fetch('/api/admin/link-call', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoLink: true }),
      })
      const d = await r.json()
      if (d.success) { showToast(`Auto-linked ${d.linked} of ${d.total} unmatched calls`); await load() }
      else showToast(d.error, 'error')
    } finally { setActionLoading(null) }
  }

  async function mergeAccounts(canonicalId, absorbedId) {
    try {
      const r = await fetch('/api/admin/merge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canonicalId, absorbedId }),
      })
      const d = await r.json()
      if (d.success) {
        showToast(`Merged "${d.absorbed}" into "${d.canonical}"`)
        setMergeModal(null)
        await load()
      } else showToast(d.error, 'error')
    } catch (e) { showToast(e.message, 'error') }
  }

  async function unmerge(id) {
    if (!confirm('Reverse this merge? The absorbed account will be restored.')) return
    setActionLoading(id)
    try {
      const r = await fetch('/api/admin/merge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unmergeId: id }),
      })
      const d = await r.json()
      if (d.success) { showToast(`Unmerged — "${d.restoredAccount}" restored`); await load() }
      else showToast(d.error, 'error')
    } finally { setActionLoading(null) }
  }

  async function acceptAliasSuggestion(accountId, alias) {
    setActionLoading(`alias-${accountId}-${alias}`)
    try {
      const acct = data?.aliasSuggestions?.find(s => s.accountId === accountId)
      const r = await fetch('/api/admin/update-aliases', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, aliases: [alias] }),
      })
      const d = await r.json()
      if (d.success) {
        showToast(`Added "${alias}" as alias`)
        setData(prev => ({ ...prev, aliasSuggestions: prev.aliasSuggestions.filter(s => !(s.accountId === accountId && s.alias === alias)) }))
      } else showToast(d.error, 'error')
    } finally { setActionLoading(null) }
  }

  const counts = data?.counts || {}

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'}`}>
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {mergeModal && (
        <MergeModal pair={mergeModal} accounts={[]} onClose={() => setMergeModal(null)} onMerge={mergeAccounts} />
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm shrink-0">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/modules/settings')} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Data Quality</h1>
              <p className="text-xs text-gray-400 mt-0.5">Account deduplication, call matching, and alias management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            {user && <UserMenu />}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 shrink-0">
        <div className="max-w-6xl mx-auto px-6 flex gap-0">
          {TABS.map(tab => {
            const count = tab.id === 'unmatched' ? counts.unmatched : tab.id === 'duplicates' ? counts.duplicates : tab.id === 'hubspot' ? counts.missingHubspot : tab.id === 'aliases' ? counts.aliasSuggestions : (data?.mergeLog?.length || 0)
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === tab.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {tab.label}
                {count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${tab.id === 'history' ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-700'}`}>{count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 flex-1 w-full">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        )}

        {!loading && (
          <>
            {/* ── Unmatched Calls ── */}
            {activeTab === 'unmatched' && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Unmatched Calls</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Analyzed calls with no account linked. Link them to keep the account view complete.</p>
                  </div>
                  <button onClick={autoLink} disabled={actionLoading === 'autolink'}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
                    <Zap className={`w-3.5 h-3.5 ${actionLoading === 'autolink' ? 'animate-pulse' : ''}`} />
                    {actionLoading === 'autolink' ? 'Auto-linking…' : 'Auto-Link All'}
                  </button>
                </div>
                {data?.unmatchedCalls?.length === 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
                    <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                    <p className="text-green-800 font-medium">All analyzed calls are linked to accounts</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.unmatchedCalls.map(call => (
                      <div key={call.gongCallId} className="bg-white border border-gray-200 rounded-xl p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{call.title}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {call.repName && `${call.repName} · `}
                              {call.date ? new Date(call.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                            </p>
                            {call.summary && <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{call.summary}</p>}
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            {call.suggestedAccount && (
                              <div className="flex items-center gap-2">
                                <ConfidenceBadge score={call.suggestedAccount.score} />
                                <span className="text-xs text-gray-500">{call.suggestedAccount.name}</span>
                              </div>
                            )}
                            <select
                              value={linkTarget[call.gongCallId] || (call.suggestedAccount?.id || '')}
                              onChange={e => setLinkTarget(p => ({ ...p, [call.gongCallId]: e.target.value }))}
                              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400 max-w-[200px]"
                            >
                              <option value="">Select account…</option>
                              {data?.aliasSuggestions && []}
                              {/* We don't have a full account list here — use suggested or let admin type */}
                              {call.suggestedAccount && <option value={call.suggestedAccount.id}>{call.suggestedAccount.name}</option>}
                            </select>
                            <button
                              onClick={() => linkCall(call.gongCallId, linkTarget[call.gongCallId] || call.suggestedAccount?.id)}
                              disabled={actionLoading === call.gongCallId || (!linkTarget[call.gongCallId] && !call.suggestedAccount)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40"
                            >
                              <Link2 className="w-3 h-3" />
                              {actionLoading === call.gongCallId ? 'Linking…' : 'Link'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Potential Duplicates ── */}
            {activeTab === 'duplicates' && (
              <div>
                <div className="mb-5">
                  <h2 className="text-base font-bold text-gray-900">Potential Duplicates</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Account pairs with similar names. Review and merge if they represent the same company.</p>
                </div>
                {data?.duplicatePairs?.length === 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
                    <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                    <p className="text-green-800 font-medium">No potential duplicates detected</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.duplicatePairs.map((pair, i) => (
                      <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                        <div className="flex-1 grid grid-cols-2 gap-3">
                          {[pair.a, pair.b].map(acct => (
                            <div key={acct.id} className="bg-gray-50 rounded-lg p-3">
                              <p className="text-sm font-semibold text-gray-900">{acct.name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{acct.stage?.replace(/_/g, ' ')}</p>
                            </div>
                          ))}
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-2">
                          <ConfidenceBadge score={pair.score} />
                          <button
                            onClick={() => setMergeModal(pair)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800"
                          >
                            <GitMerge className="w-3.5 h-3.5" /> Merge
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Missing HubSpot ── */}
            {activeTab === 'hubspot' && (
              <div>
                <div className="mb-5">
                  <h2 className="text-base font-bold text-gray-900">Missing HubSpot Link</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Active pipeline accounts with no HubSpot deal attached. Run Sync HubSpot from Pipeline Overview to fix, or check if the deal name is too different from the account name.</p>
                </div>
                {data?.missingHubspot?.length === 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
                    <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                    <p className="text-green-800 font-medium">All active accounts have HubSpot deals linked</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.missingHubspot.map(acct => (
                      <div key={acct.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{acct.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{acct.stage?.replace(/_/g, ' ')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setEditingAlias(editingAlias === acct.id ? null : acct.id) }}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
                          >
                            <Tag className="w-3 h-3" /> Add Alias
                          </button>
                          <button
                            onClick={() => router.push(`/modules/account-pipeline?account=${acct.id}`)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
                          >
                            <ChevronRight className="w-3 h-3" /> Open Account
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Alias Suggestions ── */}
            {activeTab === 'aliases' && (
              <div>
                <div className="mb-5">
                  <h2 className="text-base font-bold text-gray-900">Alias Suggestions</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Alternate names seen in call titles that could be added as aliases to improve future auto-matching.</p>
                </div>
                {data?.aliasSuggestions?.length === 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
                    <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                    <p className="text-green-800 font-medium">No alias suggestions right now</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.aliasSuggestions.map((s, i) => (
                      <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold text-gray-900">{s.accountName}</p>
                            <ChevronRight className="w-3 h-3 text-gray-300" />
                            <span className="text-sm text-blue-700 font-medium">"{s.alias}"</span>
                          </div>
                          <p className="text-xs text-gray-400">Seen in: {s.seenIn} {s.count > 1 ? `· ${s.count}x` : ''}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => acceptAliasSuggestion(s.accountId, s.alias)}
                            disabled={actionLoading === `alias-${s.accountId}-${s.alias}`}
                            className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
                          >
                            <Plus className="w-3 h-3" /> Add Alias
                          </button>
                          <button
                            onClick={() => setData(prev => ({ ...prev, aliasSuggestions: prev.aliasSuggestions.filter((_, j) => j !== i) }))}
                            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Merge History ── */}
            {activeTab === 'history' && (
              <div>
                <div className="mb-5">
                  <h2 className="text-base font-bold text-gray-900">Merge History</h2>
                  <p className="text-sm text-gray-500 mt-0.5">All account merges. Use "Undo" to reverse a merge and restore the absorbed account with all its data.</p>
                </div>
                {data?.mergeLog?.length === 0 ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">No merges yet</div>
                ) : (
                  <div className="space-y-2">
                    {data.mergeLog.map(log => (
                      <div key={log.id} className={`bg-white border rounded-xl p-4 ${log.reversed_at ? 'opacity-50 border-gray-100' : 'border-gray-200'}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <GitMerge className="w-4 h-4 text-gray-400" />
                              <p className="text-sm font-semibold text-gray-900">
                                "{log.absorbed_account_name}" → "{log.canonical_account_id}"
                              </p>
                              {log.reversed_at && <Badge color="yellow">Reversed</Badge>}
                            </div>
                            <p className="text-xs text-gray-400">
                              {new Date(log.merged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              {log.merged_by ? ` · ${log.merged_by}` : ''}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {[
                                log.calls_reassigned && `${log.calls_reassigned} calls`,
                                log.tasks_reassigned && `${log.tasks_reassigned} tasks`,
                                log.stakeholders_reassigned && `${log.stakeholders_reassigned} stakeholders`,
                                log.notes_reassigned && `${log.notes_reassigned} notes`,
                              ].filter(Boolean).join(' · ')} moved
                            </p>
                          </div>
                          {!log.reversed_at && (
                            <button
                              onClick={() => unmerge(log.id)}
                              disabled={actionLoading === log.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 disabled:opacity-50 shrink-0"
                            >
                              <Undo2 className="w-3 h-3" />
                              {actionLoading === log.id ? 'Reversing…' : 'Undo Merge'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
