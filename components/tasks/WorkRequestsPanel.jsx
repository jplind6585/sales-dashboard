import { useState, useEffect } from 'react'
import { Plus, X, ChevronDown, ChevronRight, Building2 } from 'lucide-react'
import { SkeletonRows } from '../ui/Skeleton'
import EmptyState from '../ui/EmptyState'
import Select from '../ui/Select'

const ROLES = [['designer', 'Designer'], ['sales_engineer', 'Sales Engineer'], ['marketing', 'Marketing'], ['other', 'Other']]
const TYPES = [['content', 'Content'], ['custom_demo', 'Custom demo'], ['one_pager', 'One-pager'], ['other', 'Other']]
const STATUS = { open: 'bg-coral-50 text-coral-700', in_progress: 'bg-amber-50 text-amber-700', delivered: 'bg-emerald-50 text-emerald-700', cancelled: 'bg-slate-100 text-slate-400' }
const NEXT = { open: 'in_progress', in_progress: 'delivered' }

// Cross-team Work Requests — folded into the Tasks module as a sub-view. Ask design / sales
// engineering; the fulfiller gets the account context snapshot automatically. (Was /modules/work-requests.)
export default function WorkRequestsPanel() {
  const [requests, setRequests] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [form, setForm] = useState({ accountId: '', assigneeRole: 'designer', type: 'content', title: '', details: '' })

  const load = () => fetch('/api/work-requests').then((r) => r.json()).then((j) => setRequests(j.requests || [])).catch(() => setRequests([]))
  useEffect(() => {
    load()
    fetch('/api/search').then((r) => r.json()).then((j) => setAccounts(j.accounts || [])).catch(() => {})
  }, [])

  const save = async () => {
    if (!form.title) return
    setSaving(true)
    try {
      const res = await fetch('/api/work-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) throw new Error('save failed')
      setShowForm(false); setForm({ accountId: '', assigneeRole: 'designer', type: 'content', title: '', details: '' }); setRequests(null); load()
    } finally { setSaving(false) }
  }

  const advance = async (r) => {
    const status = NEXT[r.status]; if (!status) return
    await fetch('/api/work-requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, status }) })
    setRequests(null); load()
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Ask design / sales engineering — the account context comes attached.</p>
        <button onClick={() => setShowForm((s) => !s)} className="text-xs flex items-center gap-1 px-3 py-1.5 bg-coral-600 text-white rounded-lg hover:bg-coral-700">
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} {showForm ? 'Cancel' : 'New request'}
        </button>
      </div>
      {showForm && (
        <div className="bg-white rounded-card border border-hairline p-4 space-y-3">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What do you need? (e.g. Custom demo env for UDR with their unit data)" className="w-full text-sm border border-hairline rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-coral-200" />
          <div className="flex flex-wrap gap-2">
            <Select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}><option value="">— Account (attaches context) —</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
            <Select value={form.assigneeRole} onChange={(e) => setForm({ ...form, assigneeRole: e.target.value })}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
          </div>
          <textarea value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} placeholder="Details / specifics" rows={3} className="w-full text-sm border border-hairline rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-coral-200" />
          <button onClick={save} disabled={saving || !form.title} className="text-sm px-4 py-1.5 bg-coral-600 text-white rounded-lg hover:bg-coral-700 disabled:opacity-50">{saving ? 'Sending…' : 'Send request'}</button>
        </div>
      )}

      {!requests ? <SkeletonRows rows={3} /> : requests.length === 0 ? (
        <EmptyState icon={Building2} title="No requests yet" subtitle="Request content from the designer or a custom demo from the SE — they'll get the account's calls, MEDDIC, and stakeholders attached automatically." action={<button onClick={() => setShowForm(true)} className="text-sm px-4 py-1.5 bg-coral-600 text-white rounded-lg">New request</button>} />
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <div key={r.id} className="bg-white rounded-card border border-hairline p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink truncate">{r.title}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS[r.status] || 'bg-slate-100 text-slate-500'}`}>{(r.status || '').replace('_', ' ')}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {ROLES.find((x) => x[0] === r.assignee_role)?.[1] || r.assignee_role} · {TYPES.find((x) => x[0] === r.type)?.[1] || r.type}
                    {r.accounts?.name ? ` · ${r.accounts.name}` : ''}{r.requester_name ? ` · from ${r.requester_name}` : ''}
                  </p>
                  {r.details && <p className="text-xs text-slate-500 mt-1">{r.details}</p>}
                </div>
                {NEXT[r.status] && <button onClick={() => advance(r)} className="text-xs px-2.5 py-1.5 border border-hairline rounded-lg text-ink hover:bg-slate-50 shrink-0">Mark {NEXT[r.status].replace('_', ' ')}</button>}
              </div>
              {r.context_snapshot?.context && (
                <div className="mt-2">
                  <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="text-xs text-coral-600 flex items-center gap-1">
                    {expanded === r.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} Account context for the fulfiller
                  </button>
                  {expanded === r.id && <pre className="mt-2 text-[11px] text-slate-600 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap max-h-72 overflow-y-auto">{r.context_snapshot.context}</pre>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
