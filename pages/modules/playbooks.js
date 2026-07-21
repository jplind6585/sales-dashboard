import { useState, useEffect } from 'react'
import AppShell from '../../components/layout/AppShell'
import { Plus, Trash2, GripVertical, Save, CheckCircle2, PhoneOutgoing, PhoneIncoming, Layers } from 'lucide-react'

const PRIORITY_OPTS = [{ v: 1, l: 'High' }, { v: 2, l: 'Med' }, { v: 3, l: 'Low' }]

// One editable playbook card. Pre-call timings are "hours before the meeting"; post-call are
// "hours after the call". We store the sign; the editor shows a plain positive number + a label.
function PlaybookCard({ pb, canEdit, onSaved }) {
  const isPre = pb.trigger === 'pre_call'
  const isPost = pb.trigger === 'post_call'
  const timed = isPre || isPost
  const [name, setName] = useState(pb.name)
  const [active, setActive] = useState(pb.active !== false)
  const [steps, setSteps] = useState((pb.steps || []).map(s => ({
    title: s.title || '',
    priority: s.priority || 2,
    hours: Math.abs(Number(s.due_offset_hours) || 0),
  })))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const update = (i, patch) => setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s))
  const addStep = () => setSteps(prev => [...prev, { title: '', priority: 2, hours: isPre ? 24 : 2 }])
  const removeStep = (i) => setSteps(prev => prev.filter((_, idx) => idx !== i))

  const save = async () => {
    setSaving(true); setSaved(false)
    try {
      const payload = {
        id: pb.id,
        name,
        active,
        steps: steps.filter(s => s.title.trim()).map(s => ({
          title: s.title.trim(),
          priority: Number(s.priority) || 2,
          due_offset_hours: isPre ? -Math.abs(Number(s.hours) || 0) : Math.abs(Number(s.hours) || 0),
        })),
      }
      const r = await fetch('/api/playbooks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Save failed') }
      setSaved(true); setTimeout(() => setSaved(false), 2500)
      onSaved?.()
    } catch (e) { window.alert(e.message) }
    finally { setSaving(false) }
  }

  const Icon = isPre ? PhoneOutgoing : isPost ? PhoneIncoming : Layers
  const tint = isPre ? 'text-blue-600' : isPost ? 'text-emerald-600' : 'text-gray-500'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${tint}`} />
        {canEdit && timed
          ? <input value={name} onChange={e => setName(e.target.value)} className="text-sm font-semibold text-gray-900 border-b border-transparent hover:border-gray-200 focus:border-coral-400 outline-none" />
          : <span className="text-sm font-semibold text-gray-900">{pb.name}</span>}
        {!timed && <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">stage: {pb.stage_trigger || pb.trigger}</span>}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-gray-500">
          <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} disabled={!canEdit} />
          Active
        </label>
      </div>
      {pb.description && <p className="text-xs text-gray-400 mb-3">{pb.description}</p>}

      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
            {canEdit ? (
              <input value={s.title} onChange={e => update(i, { title: e.target.value })} placeholder="Checklist item…"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-coral-300" />
            ) : (
              <span className="flex-1 text-sm text-gray-700">{s.title}</span>
            )}
            <select value={s.priority} onChange={e => update(i, { priority: Number(e.target.value) })} disabled={!canEdit}
              className="text-xs border border-gray-200 rounded-lg px-1.5 py-1.5 text-gray-600 bg-white">
              {PRIORITY_OPTS.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
            </select>
            {timed && (
              <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
                <input type="number" min="0" value={s.hours} onChange={e => update(i, { hours: e.target.value })} disabled={!canEdit}
                  className="w-14 text-xs border border-gray-200 rounded-lg px-1.5 py-1.5 text-right" />
                <span className="whitespace-nowrap">h {isPre ? 'before' : 'after'}</span>
              </div>
            )}
            {canEdit && <button onClick={() => removeStep(i)} className="text-gray-300 hover:text-red-500 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>}
          </div>
        ))}
        {!steps.length && <p className="text-xs text-gray-400 py-2">No steps yet.</p>}
      </div>

      {canEdit && (
        <div className="flex items-center gap-3 mt-4">
          <button onClick={addStep} className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-coral-600"><Plus className="w-3.5 h-3.5" /> Add step</button>
          <button onClick={save} disabled={saving} className="ml-auto flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-coral-500 text-white rounded-lg hover:bg-coral-600 disabled:opacity-50">
            {saved ? <><CheckCircle2 className="w-3.5 h-3.5" /> Saved</> : <><Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save'}</>}
          </button>
        </div>
      )}
    </div>
  )
}

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [canEdit, setCanEdit] = useState(false)

  const load = () => fetch('/api/playbooks').then(r => r.json()).then(d => setPlaybooks(d.playbooks || [])).catch(() => {}).finally(() => setLoading(false))
  useEffect(() => {
    load()
    fetch('/api/me').then(r => r.json()).then(d => setCanEdit(['manager', 'admin'].includes(d.profile?.role))).catch(() => {})
  }, [])

  const pre = playbooks.filter(p => p.trigger === 'pre_call')
  const post = playbooks.filter(p => p.trigger === 'post_call')
  const other = playbooks.filter(p => !['pre_call', 'post_call'].includes(p.trigger))

  return (
    <AppShell title="Playbooks" subtitle="What the app auto-adds before & after your calls">
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        <p className="text-sm text-gray-500">
          These checklists auto-create as tasks — <span className="font-medium text-gray-700">before</span> each external meeting and{' '}
          <span className="font-medium text-gray-700">after</span> each analyzed call. {canEdit ? 'Edit the steps, timing, and priority below.' : 'Ask an admin to edit these.'}
        </p>

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <>
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Before the call</h2>
              <div className="space-y-3">{pre.length ? pre.map(pb => <PlaybookCard key={pb.id} pb={pb} canEdit={canEdit} onSaved={load} />) : <p className="text-sm text-gray-400">No pre-call playbook.</p>}</div>
            </div>
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">After the call</h2>
              <div className="space-y-3">{post.length ? post.map(pb => <PlaybookCard key={pb.id} pb={pb} canEdit={canEdit} onSaved={load} />) : <p className="text-sm text-gray-400">No post-call playbook.</p>}</div>
            </div>
            {other.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Stage-triggered</h2>
                <div className="space-y-3">{other.map(pb => <PlaybookCard key={pb.id} pb={pb} canEdit={canEdit} onSaved={load} />)}</div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
