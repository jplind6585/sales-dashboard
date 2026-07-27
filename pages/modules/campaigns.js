import { useState, useEffect, useCallback, useMemo } from 'react'
import AppShell from '../../components/layout/AppShell'
import { Megaphone, Plus, X, Search, Trash2, Building2, ChevronRight } from 'lucide-react'

const TYPES = [
  { id: 'reengagement', label: 'Reengagement' },
  { id: 'vertical_push', label: 'Vertical push' },
  { id: 'event_followup', label: 'Event follow-up' },
  { id: 'expansion', label: 'Expansion' },
  { id: 'other', label: 'Other' },
]
const TYPE_LABEL = Object.fromEntries(TYPES.map(t => [t.id, t.label]))
const TYPE_COLOR = {
  reengagement: 'bg-amber-50 text-amber-700 border-amber-200',
  vertical_push: 'bg-blue-50 text-blue-700 border-blue-200',
  event_followup: 'bg-violet-50 text-violet-700 border-violet-200',
  expansion: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  other: 'bg-gray-50 text-gray-600 border-gray-200',
}
const STATUS = ['active', 'paused', 'done']
const stageLabel = (s) => (s || '').replace(/_/g, ' ')

export default function CampaignsModule() {
  const [campaigns, setCampaigns] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch('/api/campaigns').then(r => r.json()).catch(() => null)
    setCampaigns(r?.campaigns || [])
  }, [])
  useEffect(() => { load() }, [load])

  const loadDetail = useCallback(async (id) => {
    setSelectedId(id); setDetail(null)
    const r = await fetch(`/api/campaigns/${id}`).then(r => r.json()).catch(() => null)
    setDetail(r?.campaign || null)
  }, [])

  const grouped = useMemo(() => {
    const g = {}
    for (const c of campaigns || []) (g[c.type] = g[c.type] || []).push(c)
    return g
  }, [campaigns])

  return (
    <AppShell
      title="Campaigns"
      actions={
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-2 bg-coral-600 text-white rounded-lg hover:bg-coral-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      }
    >
      <div className="flex gap-4 p-4 h-full">
        {/* List */}
        <div className="w-80 flex-shrink-0 space-y-4 overflow-y-auto">
          {campaigns == null ? (
            <p className="text-sm text-gray-400 p-4">Loading…</p>
          ) : campaigns.length === 0 ? (
            <div className="text-center p-8 border border-dashed border-gray-200 rounded-xl">
              <Megaphone className="w-6 h-6 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No campaigns yet.</p>
              <button onClick={() => setShowCreate(true)} className="mt-2 text-sm text-coral-600 hover:underline">Create your first</button>
            </div>
          ) : (
            TYPES.filter(t => grouped[t.id]?.length).map(t => (
              <div key={t.id}>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-1">{t.label}</p>
                <div className="space-y-1.5">
                  {grouped[t.id].map(c => (
                    <button key={c.id} onClick={() => loadDetail(c.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-colors ${selectedId === c.id ? 'border-coral-300 bg-coral-50/40' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">{c.name}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{c.memberCount}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${c.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : c.status === 'paused' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>{c.status}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail */}
        <div className="flex-1 min-w-0">
          {!selectedId ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
              Select a campaign to see its accounts.
            </div>
          ) : !detail ? (
            <p className="text-sm text-gray-400 p-4">Loading…</p>
          ) : (
            <CampaignDetail campaign={detail} onChanged={() => { loadDetail(detail.id); load() }} onDeleted={() => { setSelectedId(null); setDetail(null); load() }} />
          )}
        </div>
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={(c) => { setShowCreate(false); load(); loadDetail(c.id) }} />}
    </AppShell>
  )
}

function CampaignDetail({ campaign, onChanged, onDeleted }) {
  const [adding, setAdding] = useState(false)
  const members = campaign.members || []

  const setStatus = async (status) => {
    await fetch(`/api/campaigns/${campaign.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    onChanged()
  }
  const removeMember = async (accountId) => {
    await fetch(`/api/campaigns/${campaign.id}?accountId=${accountId}`, { method: 'DELETE' })
    onChanged()
  }
  const del = async () => {
    if (!window.confirm(`Delete campaign "${campaign.name}"? Accounts are not deleted, just un-enrolled.`)) return
    await fetch(`/api/campaigns/${campaign.id}`, { method: 'DELETE' })
    onDeleted()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden h-full flex flex-col">
      <div className="p-4 border-b border-gray-100 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900 truncate">{campaign.name}</h2>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${TYPE_COLOR[campaign.type] || TYPE_COLOR.other}`}>{TYPE_LABEL[campaign.type] || campaign.type}</span>
          </div>
          {campaign.description && <p className="text-sm text-gray-500 mt-1">{campaign.description}</p>}
          <p className="text-xs text-gray-400 mt-1">{members.length} account{members.length === 1 ? '' : 's'}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <select value={campaign.status} onChange={e => setStatus(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600">
            {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-coral-600 text-white rounded-lg hover:bg-coral-700 text-sm"><Plus className="w-4 h-4" /> Add</button>
          <button onClick={del} title="Delete campaign" className="p-1.5 text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {members.length === 0 ? (
          <p className="text-sm text-gray-400 p-6 text-center">No accounts yet — click Add to enroll companies.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {members.map(m => (
              <li key={m.accountId} className="flex items-center justify-between gap-2 px-2 py-2.5">
                <a href={`/modules/account-pipeline?account=${m.accountId}`} className="flex items-center gap-2 min-w-0 hover:text-coral-700">
                  <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-900 truncate">{m.account?.name || 'Unknown'}</span>
                  {m.account?.stage && <span className="text-xs text-gray-400 flex-shrink-0">{stageLabel(m.account.stage)}</span>}
                </a>
                <button onClick={() => removeMember(m.accountId)} className="text-gray-300 hover:text-red-500 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {adding && <AddAccountsModal campaign={campaign} existing={new Set(members.map(m => m.accountId))} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); onChanged() }} />}
    </div>
  )
}

function CreateModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('reengagement')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const create = async () => {
    if (!name.trim()) return
    setSaving(true)
    const r = await fetch('/api/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), type, description: description.trim() || null }) }).then(r => r.json()).catch(() => null)
    setSaving(false)
    if (r?.campaign) onCreated(r.campaign)
  }
  return (
    <Modal onClose={onClose} title="New campaign">
      <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
      <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Q3 Dormant Revive" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3" />
      <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
      <select value={type} onChange={e => setType(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3">
        {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
      <label className="block text-xs font-medium text-gray-500 mb-1">Description (optional)</label>
      <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4" />
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        <button onClick={create} disabled={!name.trim() || saving} className="px-4 py-2 bg-coral-600 text-white rounded-lg text-sm disabled:opacity-50">{saving ? 'Creating…' : 'Create'}</button>
      </div>
    </Modal>
  )
}

function AddAccountsModal({ campaign, existing, onClose, onAdded }) {
  const [accounts, setAccounts] = useState([])
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState(new Set())
  const [saving, setSaving] = useState(false)
  useEffect(() => { fetch('/api/search').then(r => r.json()).then(d => setAccounts(d?.accounts || [])).catch(() => {}) }, [])
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (accounts || []).filter(a => !existing.has(a.id) && (!s || (a.name || '').toLowerCase().includes(s))).slice(0, 40)
  }, [accounts, q, existing])
  const toggle = (id) => setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const save = async () => {
    if (!picked.size) return
    setSaving(true)
    await fetch(`/api/campaigns/${campaign.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountIds: [...picked] }) })
    setSaving(false); onAdded()
  }
  return (
    <Modal onClose={onClose} title={`Add accounts to ${campaign.name}`}>
      <div className="relative mb-2">
        <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search companies…" className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm" />
      </div>
      <div className="max-h-72 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
        {filtered.map(a => (
          <button key={a.id} onClick={() => toggle(a.id)} className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left ${picked.has(a.id) ? 'bg-coral-50' : 'hover:bg-gray-50'}`}>
            <span className="text-sm text-gray-800 truncate">{a.name}</span>
            {picked.has(a.id) ? <span className="text-xs text-coral-600 font-medium">Added</span> : <span className="text-xs text-gray-400">{stageLabel(a.stage)}</span>}
          </button>
        ))}
        {filtered.length === 0 && <p className="text-sm text-gray-400 p-4 text-center">No matches.</p>}
      </div>
      <div className="flex justify-between items-center mt-4">
        <span className="text-xs text-gray-400">{picked.size} selected</span>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          <button onClick={save} disabled={!picked.size || saving} className="px-4 py-2 bg-coral-600 text-white rounded-lg text-sm disabled:opacity-50">{saving ? 'Adding…' : `Add ${picked.size || ''}`}</button>
        </div>
      </div>
    </Modal>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
