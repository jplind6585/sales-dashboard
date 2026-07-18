import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft, Trophy, AlertOctagon, ExternalLink, MessageSquare } from 'lucide-react'
import UserMenu from '../../components/auth/UserMenu'
import ModulesNav from '../../components/layout/ModulesNav'
import { SkeletonRows } from '../../components/ui/Skeleton'
import EmptyState from '../../components/ui/EmptyState'
import { fmtUsd } from '../../lib/metrics'

// Coaching Lab (PLATFORM_REVIEW §7.2 best-call library + §8.4 disqualification-discipline queue).
export default function CoachingLab() {
  const router = useRouter()
  const [best, setBest] = useState(null)
  const [dq, setDq] = useState(null)
  const [rebuttals, setRebuttals] = useState(null)

  useEffect(() => {
    fetch('/api/gong/best-calls').then((r) => r.json()).then((j) => setBest(j.calls || [])).catch(() => setBest([]))
    fetch('/api/pipeline/dq-queue').then((r) => r.json()).then((j) => setDq(j.deals || [])).catch(() => setDq([]))
    fetch('/api/gong/rebuttals').then((r) => r.json()).then((j) => setRebuttals(j.rebuttals || [])).catch(() => setRebuttals([]))
  }, [])

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-white border-b border-hairline sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"><ArrowLeft className="w-4 h-4" /></button>
            <div>
              <h1 className="text-lg font-semibold text-ink font-display">Coaching Lab</h1>
              <p className="text-xs text-slate-400">Learn from the best calls · deals that need an advance-or-kill call</p>
            </div>
            <ModulesNav router={router} />
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-8">
        {/* Best calls */}
        <section>
          <h2 className="text-sm font-semibold text-ink flex items-center gap-2 mb-3"><Trophy className="w-4 h-4 text-coral-500" /> Best calls to learn from</h2>
          {!best ? <SkeletonRows rows={4} /> : best.length === 0 ? (
            <EmptyState icon={Trophy} title="No standout calls yet" subtitle="High-scoring calls (strong discovery, pain depth, and a secured next step) will surface here as calls are analyzed." />
          ) : (
            <div className="space-y-2">
              {best.map((c) => (
                <div key={c.gongCallId} className="bg-white rounded-card border border-hairline p-4 flex items-start gap-3">
                  <div className="flex flex-col items-center w-12 shrink-0">
                    <span className="font-display text-lg text-coral-600">{c.composite}</span>
                    <span className="text-[10px] text-slate-400 uppercase">score</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button onClick={() => c.accountId && router.push(`/modules/account-pipeline?account=${c.accountId}`)} className="text-sm font-medium text-ink hover:text-coral-600 truncate">{c.title}</button>
                      {c.rep && <span className="text-xs text-slate-400">· {c.rep}</span>}
                    </div>
                    {c.why && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{c.why}</p>}
                    <div className="flex gap-3 mt-1 text-[11px] text-slate-400">
                      <span>Discovery {c.discovery}/10</span><span>Pain {c.pain}/10</span><span>Champion {c.champion}/10</span>
                    </div>
                  </div>
                  {c.gongUrl && <a href={c.gongUrl} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-coral-600 shrink-0"><ExternalLink className="w-4 h-4" /></a>}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Disqualification discipline */}
        <section>
          <h2 className="text-sm font-semibold text-ink flex items-center gap-2 mb-3"><AlertOctagon className="w-4 h-4 text-coral-500" /> Advance or kill <span className="text-xs font-normal text-slate-400">({dq?.length || 0})</span></h2>
          {!dq ? <SkeletonRows rows={4} /> : dq.length === 0 ? (
            <EmptyState icon={AlertOctagon} title="Nothing limping along" subtitle="Active deals with a soft-close signal or 30+ days of silence will show here so they get an explicit decision." />
          ) : (
            <div className="space-y-2">
              {dq.map((d) => (
                <div key={d.id} className="bg-white rounded-card border border-hairline p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button onClick={() => router.push(`/modules/account-pipeline?account=${d.id}`)} className="text-sm font-medium text-ink hover:text-coral-600 truncate">{d.name}</button>
                      <span className="text-xs bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">{d.stageLabel}</span>
                      {d.dqSignal && <span className="text-xs bg-coral-50 text-coral-700 rounded-full px-2 py-0.5">soft close</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{d.reason}{d.owner ? ` · ${d.owner}` : ''}</p>
                  </div>
                  {d.dealValue ? <span className="text-xs text-slate-400 shrink-0">{fmtUsd(d.dealValue)}</span> : null}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Objection & rebuttal library */}
        <section>
          <h2 className="text-sm font-semibold text-ink flex items-center gap-2 mb-3"><MessageSquare className="w-4 h-4 text-coral-500" /> Objection playbook <span className="text-xs font-normal text-slate-400">from real calls</span></h2>
          {!rebuttals ? <SkeletonRows rows={3} /> : rebuttals.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No objections logged yet" subtitle="As calls are analyzed, the objections reps hear — and how they were answered — will collect here by theme." />
          ) : (
            <div className="space-y-2">
              {rebuttals.map((r) => (
                <div key={r.category} className="bg-white rounded-card border border-hairline p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-ink capitalize">{r.category}</span>
                    <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">{r.count}×</span>
                  </div>
                  {r.examples.length === 0 ? (
                    <p className="text-xs text-slate-400">Seen {r.count}× — no captured response yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {r.examples.map((e, i) => (
                        <div key={i} className="text-xs border-l-2 border-coral-200 pl-3">
                          <p className="text-slate-600">“{e.objection}”</p>
                          <p className="text-slate-500 mt-0.5"><span className="text-coral-600 font-medium">Handled:</span> {e.response}{e.rep ? ` — ${e.rep}` : ''}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
