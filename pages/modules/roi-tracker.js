import { useState, useEffect } from 'react'
import { Plus, TrendingUp, X } from 'lucide-react'
import AppShell from '../../components/layout/AppShell'
import { SkeletonRows } from '../../components/ui/Skeleton'
import EmptyState from '../../components/ui/EmptyState'
import Select from '../../components/ui/Select'
import { fmtUsd } from '../../lib/metrics'

const TYPES = [['hire_sdr', 'Hire an SDR'], ['conference', 'Conference'], ['paid_ad', 'Paid ad'], ['tool', 'Tool / software'], ['other', 'Other']]

// ROI tracker (PLATFORM_REVIEW ROI-tracker scope). Records initiatives + cost and attributes
// pipeline/revenue since the start date. Attribution is time-window (rough) — labeled as such.
export default function RoiTracker() {
  const [items, setItems] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'hire_sdr', cost: '', cost_period: 'annual', started_on: '', owner_name: '', expected_outcome: '' })

  const load = () => fetch('/api/initiatives').then((r) => r.json()).then((j) => setItems(j.initiatives || [])).catch(() => setItems([]))
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.name) return
    setSaving(true)
    try {
      const res = await fetch('/api/initiatives', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) throw new Error('save failed')
      setShowForm(false); setForm({ name: '', type: 'hire_sdr', cost: '', cost_period: 'annual', started_on: '', owner_name: '', expected_outcome: '' }); setItems(null); load()
    } finally { setSaving(false) }
  }

  return (
    <AppShell
      title="ROI Tracker"
      subtitle="What each investment is returning — pipeline, revenue, payback"
      actions={
        <button onClick={() => setShowForm((s) => !s)} className="text-xs flex items-center gap-1 px-3 py-1.5 bg-coral-600 text-white rounded-lg hover:bg-coral-700">
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} {showForm ? 'Cancel' : 'New initiative'}
        </button>
      }
    >
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">
        {showForm && (
          <div className="bg-white rounded-card border border-hairline p-4 space-y-3">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Initiative name (e.g. Hire SDR — Jordan, or NMHC 2026)" className="w-full text-sm border border-hairline rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-coral-200" />
            <div className="flex flex-wrap gap-2">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
              <input value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="Cost $" type="number" className="text-sm border border-hairline rounded-lg px-3 py-1.5 w-32 focus:outline-none focus:ring-2 focus:ring-coral-200" />
              <Select value={form.cost_period} onChange={(e) => setForm({ ...form, cost_period: e.target.value })}><option value="one_time">one-time</option><option value="monthly">/ month</option><option value="annual">/ year</option></Select>
              <input value={form.started_on} onChange={(e) => setForm({ ...form, started_on: e.target.value })} type="date" className="text-sm border border-hairline rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-coral-200" />
              {form.type === 'hire_sdr' && <input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} placeholder="Rep name (to attribute their deals)" className="text-sm border border-hairline rounded-lg px-3 py-1.5 flex-1 min-w-[160px] focus:outline-none focus:ring-2 focus:ring-coral-200" />}
            </div>
            <input value={form.expected_outcome} onChange={(e) => setForm({ ...form, expected_outcome: e.target.value })} placeholder="Expected outcome (optional)" className="w-full text-sm border border-hairline rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-coral-200" />
            <button onClick={save} disabled={saving || !form.name} className="text-sm px-4 py-1.5 bg-coral-600 text-white rounded-lg hover:bg-coral-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save initiative'}</button>
          </div>
        )}

        {!items ? <SkeletonRows rows={3} /> : items.length === 0 ? (
          <EmptyState icon={TrendingUp} title="No initiatives yet" subtitle="Add an SDR hire, a conference, a paid ad, or a tool to track what it's returning." action={<button onClick={() => setShowForm(true)} className="text-sm px-4 py-1.5 bg-coral-600 text-white rounded-lg">Add your first</button>} />
        ) : (
          <div className="space-y-3">
            {items.map((it) => (
              <div key={it.id} className="bg-white rounded-card border border-hairline p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-sm font-semibold text-ink">{it.name}</span>
                    <span className="text-xs text-slate-400 ml-2 capitalize">{(it.type || '').replace(/_/g, ' ')}</span>
                  </div>
                  {it.roi != null && <span className={`text-sm font-display ${it.roi >= 1 ? 'text-success' : 'text-slate-500'}`}>{it.roi}× ROI</span>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                  <div><div className="text-[10px] uppercase text-slate-400">Spent to date</div><div className="text-sm font-medium text-ink">{fmtUsd(it.spentToDate)}</div></div>
                  <div><div className="text-[10px] uppercase text-slate-400">Pipeline influenced</div><div className="text-sm font-medium text-coral-600">{fmtUsd(it.pipelineInfluenced)}</div></div>
                  <div><div className="text-[10px] uppercase text-slate-400">Revenue ({it.wonCount} won)</div><div className="text-sm font-medium text-success">{fmtUsd(it.revenueAttributed)}</div></div>
                  <div><div className="text-[10px] uppercase text-slate-400">CAC</div><div className="text-sm font-medium text-ink">{it.cac != null ? fmtUsd(it.cac) : '—'}</div></div>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">Attribution: {it.attribution}. Time-window estimate — refine as you tag deals.</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
