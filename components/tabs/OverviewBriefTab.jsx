// The mode-aware Overview brief (Account View §6). Renders an AI-written brief: where it stands, watch
// risks, knowledge (know / missing), prepared moves. On load error it falls back to the legacy Overview
// so replacing the default tab can never strand the rep.
import { useState, useEffect } from 'react';
import { AlertTriangle, Sparkles, Loader2, Eye, ArrowRight, CheckCircle2, HelpCircle } from 'lucide-react';
import OverviewTab from './OverviewTab';

const MODE_LABEL = { post_call: 'Post-call', pre_call: 'Pre-call', nurture: 'Nurture', working: 'Working' };

export default function OverviewBriefTab({ account, onUpdateAccount }) {
  const [brief, setBrief] = useState(null);
  const [mode, setMode] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | error

  useEffect(() => {
    if (!account?.id) return;
    let cancelled = false;
    setState('loading');
    fetch('/api/accounts/brief', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: account.id }) })
      .then((r) => r.json())
      .then((d) => { if (cancelled) return; if (d.brief) { setBrief(d.brief); setMode(d.mode); setState('ready'); } else setState('error'); })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, [account?.id]);

  // Fall back to the legacy Overview if the brief can't be produced. Nothing is lost.
  if (state === 'error') return <OverviewTab account={account} onUpdateAccount={onUpdateAccount} />;
  if (state === 'loading') {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-10 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Writing the brief for {account?.name}…
      </div>
    );
  }

  const momentumBroken = !!account?.momentumBrokenAt;

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Header */}
      <div className="flex items-center flex-wrap gap-2">
        <h2 className="text-lg font-bold text-gray-900">{account?.name}</h2>
        {mode && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{MODE_LABEL[mode] || mode}</span>}
        {account?.stage && <span className="text-xs text-gray-400">{String(account.stage).replace(/_/g, ' ')}</span>}
        {account?.dealValue ? <span className="text-xs text-gray-400">${Number(account.dealValue).toLocaleString()}</span> : null}
      </div>

      {momentumBroken && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>Momentum broken. No next event and activity has gone quiet. Lead with a re-engagement move.</span>
        </div>
      )}

      {brief?.headline && <p className="text-sm text-gray-500">{brief.headline}</p>}

      {/* Where it stands */}
      {brief?.whereItStands && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-bold tracking-wide text-gray-400 uppercase mb-2">Where it stands</p>
          <p className="text-sm text-gray-800 leading-relaxed">{brief.whereItStands}</p>
        </div>
      )}

      {/* Watch */}
      {brief?.watch?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-bold tracking-wide text-gray-400 uppercase mb-2">Watch</p>
          <div className="space-y-2">
            {brief.watch.map((w, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-700"><span className="text-gray-900">{w.risk}.</span> <span className="text-gray-500">{w.move}</span></p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Knowledge */}
      {((brief?.knowledge?.know?.length || 0) + (brief?.knowledge?.missing?.length || 0)) > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-bold tracking-wide text-gray-400 uppercase mb-2">What we know</p>
            {(brief.knowledge.know || []).map((k, i) => (
              <p key={i} className="text-sm text-gray-700 flex items-start gap-1.5 py-0.5"><CheckCircle2 className="w-3.5 h-3.5 text-success mt-0.5 flex-shrink-0" />{k}</p>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-bold tracking-wide text-gray-400 uppercase mb-2">What we're missing</p>
            {(brief.knowledge.missing || []).map((m, i) => (
              <p key={i} className="text-sm text-gray-700 flex items-start gap-1.5 py-0.5"><HelpCircle className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />{m}</p>
            ))}
          </div>
        </div>
      )}

      {/* Prepared moves */}
      {brief?.moves?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <p className="text-xs font-bold tracking-wide text-gray-400 uppercase">Prepared moves</p>
          </div>
          <div className="space-y-2">
            {brief.moves.slice(0, 3).map((m, i) => (
              <div key={i} className="flex items-start justify-between gap-3 py-1.5 border-b border-gray-50 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{m.title}</p>
                  {m.rationale && <p className="text-xs text-gray-400 mt-0.5">{m.rationale}</p>}
                </div>
                <button className="flex-shrink-0 inline-flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1 hover:bg-indigo-100">
                  <Eye className="w-3 h-3" /> Review
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-gray-300">AI brief. Facts trace to this account's calls, stakeholders, and open gaps.</p>
    </div>
  );
}
