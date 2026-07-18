import { useState, useEffect } from 'react';
import { Phone, GitBranch, CheckCircle2, StickyNote, Send } from 'lucide-react';
import { SkeletonRows } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';

// Unified account activity timeline (PLATFORM_REVIEW §1.3).
const ICON = { call: Phone, stage_change: GitBranch, task: CheckCircle2, task_done: CheckCircle2, note: StickyNote, touch: Send };
const COLOR = { call: 'text-coral-600', stage_change: 'text-navy', task: 'text-slate-400', task_done: 'text-success', note: 'text-slate-400', touch: 'text-coral-500' };
const fmt = (ts) => (ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

export default function TimelineTab({ account }) {
  const [events, setEvents] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!account?.id) return;
    let cancelled = false;
    setEvents(null); setErr(null);
    fetch(`/api/accounts/timeline?accountId=${account.id}`)
      .then((r) => r.json())
      .then((j) => { if (cancelled) return; if (j.success === false) throw new Error(j.error); setEvents(j.events || []); })
      .catch((e) => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; };
  }, [account?.id]);

  if (err) return <div className="p-4 text-sm text-danger">Could not load timeline: {err}</div>;
  if (!events) return <div className="p-4"><SkeletonRows rows={6} /></div>;
  if (!events.length) return <div className="p-4"><EmptyState icon={Phone} title="No activity yet" subtitle="Calls, stage changes, tasks, notes, and outreach touches will appear here as they happen." /></div>;

  return (
    <div className="p-4">
      <div className="relative pl-5">
        <div className="absolute left-1.5 top-1 bottom-1 w-px bg-hairline" />
        <div className="space-y-4">
          {events.map((e, i) => {
            const Icon = ICON[e.type] || StickyNote;
            return (
              <div key={i} className="relative">
                <div className="absolute -left-[18px] top-1 w-3 h-3 rounded-full bg-white border-2 border-hairline" />
                <div className="flex items-start gap-2">
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${COLOR[e.type] || 'text-slate-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-ink truncate">{e.title}</span>
                      <span className="text-xs text-slate-400 shrink-0">{fmt(e.ts)}</span>
                    </div>
                    {e.detail && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{e.detail}</p>}
                    {e.actor && <p className="text-[11px] text-slate-400 mt-0.5">{e.actor}</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
