import { useState, useEffect } from 'react';
import { Loader2, ArrowRight, AlertTriangle, TrendingUp, Users, Target, CheckCircle, Circle, ChevronRight, X, Sparkles, Swords, Play, ChevronDown, Clock, Hash, ExternalLink } from 'lucide-react';
import { getSupabase } from '../../lib/supabase';
import {
  VERTICALS,
  OWNERSHIP_TYPES,
  STAGES,
  BUSINESS_AREAS,
  getMetricsForAccount,
  calculateDealHealth,
  getHealthScoreColor,
  getHealthScoreBg,
} from '../../lib/constants';
import { DealHealthBar, DealHealthDetail } from '../common/DealHealthBadge';

const formatMetricValue = (metric, data) => {
  if (!data?.value) return '—';

  const value = data.value;
  if (metric.type === 'currency') {
    return typeof value === 'number'
      ? `$${value.toLocaleString()}`
      : value;
  }
  if (metric.type === 'percent') {
    return typeof value === 'number'
      ? `${value}%`
      : value;
  }
  return typeof value === 'number' ? value.toLocaleString() : value;
};

const SuggestedActions = ({ account }) => {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadActions = async () => {
    if (!account) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-next-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account })
      });

      const data = await response.json();
      if (data.actions) {
        setActions(data.actions);
      }
    } catch (err) {
      setError('Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActions();
  }, [account?.id]);

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'meddicc': return <Target className="w-4 h-4" />;
      case 'discovery': return <TrendingUp className="w-4 h-4" />;
      case 'follow_up': return <Users className="w-4 h-4" />;
      default: return <ArrowRight className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg">
        <div className="flex items-center gap-2 text-blue-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Analyzing deal for recommendations...</span>
        </div>
      </div>
    );
  }

  if (error || actions.length === 0) {
    return (
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {error || 'Add more data to get AI-powered recommendations'}
          </span>
          <button
            onClick={loadActions}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">Suggested Next Actions</h3>
        <button
          onClick={loadActions}
          className="text-xs text-blue-600 hover:text-blue-700"
        >
          Refresh
        </button>
      </div>
      <div className="space-y-2">
        {actions.map((action, i) => (
          <div
            key={i}
            className="bg-white rounded-lg p-3 shadow-sm border border-blue-100"
          >
            <div className="flex items-start gap-3">
              <div className={`p-1.5 rounded ${getPriorityColor(action.priority)}`}>
                {getCategoryIcon(action.category)}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900 text-sm">{action.action}</div>
                <div className="text-xs text-gray-500 mt-1">{action.reason}</div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityColor(action.priority)}`}>
                {action.priority}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SalesJourneyTracker = ({ account }) => {
  // Define sales journey stages
  const JOURNEY_STAGES = [
    { id: 1, name: 'Introduction', key: 'intro' },
    { id: 2, name: 'Demo', key: 'demo' },
    { id: 3, name: 'Evaluation', key: 'evaluation' },
    { id: 4, name: 'Proposal', key: 'proposal' },
    { id: 5, name: 'Legal/Contract', key: 'contract' }
  ];

  // Check qualification criteria
  const transcripts = account?.transcripts || [];
  const stakeholders = account?.stakeholders || [];

  // 1. Check if at least 1 demo completed
  const demoCount = transcripts.filter(t =>
    t.callType === 'demo' ||
    (t.summary && t.summary.toLowerCase().includes('demo'))
  ).length;
  const hasDemoCompleted = demoCount > 0;

  // 2. Check if clearly interested (multiple calls, positive next steps, or champion exists)
  const hasMultipleCalls = transcripts.length >= 2;
  const hasNextSteps = transcripts.some(t => t.rawAnalysis?.nextSteps?.length > 0);
  const hasChampion = stakeholders.some(s => s.role === 'Champion');
  const isClearlyInterested = hasMultipleCalls || hasNextSteps || hasChampion;

  // 3. Check if confirmed champion exists
  const hasConfirmedChampion = hasChampion;

  // Determine if we should show full journey
  const showFullJourney = hasDemoCompleted && isClearlyInterested && hasConfirmedChampion;

  // Determine current stage based on transcript types and account data
  const determineCurrentStage = () => {
    const latestTranscript = transcripts[transcripts.length - 1];
    if (!latestTranscript) return 1;

    // Check for proposal/contract stage
    const hasProposalDiscussion = transcripts.some(t =>
      t.callType === 'pricing' ||
      t.callType === 'negotiation' ||
      (t.summary && (t.summary.toLowerCase().includes('proposal') || t.summary.toLowerCase().includes('pricing') || t.summary.toLowerCase().includes('contract')))
    );
    if (hasProposalDiscussion) return 4;

    // Check for evaluation stage
    const hasEvaluationCall = transcripts.some(t =>
      (t.summary && (t.summary.toLowerCase().includes('evaluation') || t.summary.toLowerCase().includes('trial') || t.summary.toLowerCase().includes('technical')))
    );
    if (hasEvaluationCall && hasDemoCompleted) return 3;

    // Check for demo stage
    if (hasDemoCompleted) return 2;

    // Default to intro
    return 1;
  };

  const currentStage = determineCurrentStage();

  // Get next immediate steps
  const getImmediateNextSteps = () => {
    const steps = [];

    if (!hasDemoCompleted) {
      steps.push('Schedule product demo with key stakeholders');
    } else if (!hasConfirmedChampion) {
      steps.push('Identify and cultivate internal champion');
    } else if (currentStage === 2) {
      steps.push('Begin evaluation phase with business process review');
    } else if (currentStage === 3) {
      steps.push('Prepare proposal with pricing and implementation plan');
    }

    // Add generic next steps from latest transcript
    const latestTranscript = transcripts[transcripts.length - 1];
    if (latestTranscript?.rawAnalysis?.nextSteps) {
      steps.push(...latestTranscript.rawAnalysis.nextSteps.slice(0, 2));
    }

    return steps.slice(0, 3); // Limit to 3 steps
  };

  if (!showFullJourney) {
    // Simplified view - show only immediate next steps
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-lg border border-blue-100">
        <div className="mb-3">
          <h3 className="font-semibold text-gray-900 mb-1">Next Steps</h3>
          <p className="text-xs text-gray-600">
            Complete these milestones to unlock full sales journey tracking
          </p>
        </div>

        <div className="space-y-2 mb-4">
          {getImmediateNextSteps().map((step, i) => (
            <div key={i} className="flex items-start gap-2 bg-white p-3 rounded border border-blue-100">
              <Circle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-gray-700">{step}</span>
            </div>
          ))}
        </div>

        {/* Show what's missing */}
        <div className="border-t border-blue-200 pt-3 mt-3">
          <div className="text-xs font-medium text-gray-600 mb-2">To unlock full journey:</div>
          <div className="space-y-1 text-xs">
            <div className={`flex items-center gap-2 ${hasDemoCompleted ? 'text-green-600' : 'text-gray-500'}`}>
              {hasDemoCompleted ? <CheckCircle className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
              <span>Complete at least 1 demo</span>
            </div>
            <div className={`flex items-center gap-2 ${isClearlyInterested ? 'text-green-600' : 'text-gray-500'}`}>
              {isClearlyInterested ? <CheckCircle className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
              <span>Show clear interest (multiple calls or next steps)</span>
            </div>
            <div className={`flex items-center gap-2 ${hasConfirmedChampion ? 'text-green-600' : 'text-gray-500'}`}>
              {hasConfirmedChampion ? <CheckCircle className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
              <span>Identify a champion (add to Stakeholders tab)</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Full journey view
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-lg border border-blue-100">
      <div className="mb-4">
        <h3 className="font-semibold text-gray-900 mb-1">Sales Journey</h3>
        <p className="text-xs text-gray-600">Track your progress through the sales process</p>
      </div>

      {/* Journey Timeline */}
      <div className="relative">
        <div className="flex items-center justify-between">
          {JOURNEY_STAGES.map((stage, index) => {
            const isCompleted = stage.id < currentStage;
            const isCurrent = stage.id === currentStage;
            const isUpcoming = stage.id > currentStage;

            return (
              <div key={stage.id} className="flex-1 relative">
                <div className="flex items-center">
                  {/* Stage Circle */}
                  <div className="relative flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm z-10 transition-all ${
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isCurrent
                          ? 'bg-blue-600 text-white ring-4 ring-blue-200'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <span>{stage.id}</span>
                      )}
                    </div>
                    <div className="mt-2 text-center">
                      <div
                        className={`text-xs font-medium ${
                          isCurrent ? 'text-blue-700' : isCompleted ? 'text-green-700' : 'text-gray-500'
                        }`}
                      >
                        {stage.name}
                      </div>
                    </div>
                  </div>

                  {/* Connector Line */}
                  {index < JOURNEY_STAGES.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-2 mb-6 transition-all ${
                        isCompleted ? 'bg-green-500' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Stage Details */}
      <div className="mt-6 pt-4 border-t border-blue-200">
        <div className="bg-white p-4 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-gray-900">
              Current: {JOURNEY_STAGES[currentStage - 1]?.name}
            </span>
          </div>

          {getImmediateNextSteps().length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-600 mb-2">Focus on:</div>
              {getImmediateNextSteps().map((step, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <ChevronRight className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <span>{step}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="bg-white p-3 rounded-lg border border-blue-100">
          <div className="text-xs text-gray-600">Demos</div>
          <div className="text-lg font-bold text-blue-600">{demoCount}</div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-blue-100">
          <div className="text-xs text-gray-600">Total Calls</div>
          <div className="text-lg font-bold text-blue-600">{transcripts.length}</div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-blue-100">
          <div className="text-xs text-gray-600">Champions</div>
          <div className="text-lg font-bold text-blue-600">
            {stakeholders.filter(s => s.role === 'Champion').length}
          </div>
        </div>
      </div>
    </div>
  );
};

const PreCallBrief = ({ account }) => {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function generate() {
    if (!account?.id || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/generate-pre-call-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: account.id }),
      });
      const data = await res.json();
      if (data.brief) {
        setBrief(data);
        setOpen(true);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  return (
    <>
      <button
        onClick={generate}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-medium rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all"
      >
        <Sparkles className="w-3.5 h-3.5" />
        {loading ? 'Generating…' : 'Pre-Call Brief'}
      </button>

      {open && brief && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-start justify-between rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Pre-Call Brief</h2>
                <p className="text-sm text-gray-500">{brief.accountName} · {(brief.stage || '').replace(/_/g, ' ')}</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {brief.brief.objective && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">Objective</p>
                  <p className="text-sm font-medium text-gray-900">{brief.brief.objective}</p>
                </div>
              )}

              {brief.brief.call_focus && (
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-1">Walk Away With</p>
                  <p className="text-sm font-medium text-gray-900">{brief.brief.call_focus}</p>
                </div>
              )}

              {brief.brief.biggest_risk && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Biggest Risk</p>
                  <p className="text-sm text-gray-800">{brief.brief.biggest_risk}</p>
                </div>
              )}

              {brief.brief.key_context?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Key Context</p>
                  <ul className="space-y-1.5">
                    {brief.brief.key_context.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-indigo-400 mt-0.5">•</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {brief.brief.questions_to_ask?.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Questions to Ask</p>
                  <ol className="space-y-2">
                    {brief.brief.questions_to_ask.map((q, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-gray-400 font-medium shrink-0">{i + 1}.</span>{q}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {brief.brief.open_tasks?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Open Tasks to Address</p>
                  <ul className="space-y-1.5">
                    {brief.brief.open_tasks.map((t, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />{t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {brief.brief.tone_note && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Tone Note</p>
                  <p className="text-sm text-gray-600 italic">{brief.brief.tone_note}</p>
                </div>
              )}

              {brief.lastCallDate && (
                <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
                  Based on {brief.transcriptCount} call{brief.transcriptCount !== 1 ? 's' : ''} · Last call {new Date(brief.lastCallDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const MEMORY_TYPE_BADGE = {
  chat_insight: 'bg-blue-100 text-blue-700',
  pipeline_call: 'bg-purple-100 text-purple-700',
  manual: 'bg-gray-100 text-gray-600',
  ai_summary: 'bg-green-100 text-green-700',
}

// ─── Slack Channel Activity ───────────────────────────────────────────────────

function SlackChannelActivity({ account }) {
  const [messages, setMessages] = useState([]);
  const [channelName, setChannelName] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = () => {
    if (!account?.id || loading) return;
    setLoading(true);
    fetch(`/api/slack/channel-messages?accountId=${account.id}`)
      .then(r => r.json())
      .then(d => {
        setMessages(d.messages || []);
        setChannelName(d.channelName || null);
        if (d.error && !d.messages?.length) setError(d.error);
      })
      .catch(e => setError(e.message))
      .finally(() => { setLoading(false); setLoaded(true); });
  };

  function formatTs(ts) {
    if (!ts) return '';
    const d = new Date(parseFloat(ts) * 1000);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <details
      className="bg-white border rounded-xl overflow-hidden"
      onToggle={e => { if (e.target.open && !loaded) load(); }}
    >
      <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-gray-50 list-none select-none">
        <Hash className="w-4 h-4 text-purple-500 shrink-0" />
        <span className="text-sm font-semibold text-gray-800">Slack Channel Activity</span>
        {channelName && (
          <span className="text-xs text-gray-400 font-normal">#{channelName}</span>
        )}
        {messages.length > 0 && (
          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium ml-auto">
            {messages.length}
          </span>
        )}
      </summary>
      <div className="border-t px-4 py-3">
        {loading && (
          <div className="flex items-center gap-2 py-2 text-sm text-gray-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading channel messages…
          </div>
        )}
        {error && !loading && (
          <p className="text-xs text-gray-400 py-1">
            {error.includes('not_in_channel') || error.includes('channel_not_found')
              ? `Channel #${channelName || 'pursuit_' + account?.name?.toLowerCase().replace(/\s+/g, '')} not found or bot not invited.`
              : error}
          </p>
        )}
        {!loading && !error && messages.length === 0 && loaded && (
          <p className="text-xs text-gray-400 py-1">No messages in channel yet.</p>
        )}
        {!loading && messages.length > 0 && (
          <div className="space-y-3">
            {messages.slice(0, 15).map((m, i) => (
              <div key={m.ts || i} className="flex gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-300 mt-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-semibold text-gray-700">{m.userName}</span>
                    <span className="text-xs text-gray-400">{formatTs(m.ts)}</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed mt-0.5">
                    {m.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function memoryBadgeClass(type) {
  return MEMORY_TYPE_BADGE[type] || 'bg-gray-100 text-gray-600'
}

// ─── Win/Loss Debrief Modal ───────────────────────────────────────────────────

const LOST_REASONS = [
  'Price / budget',
  'Chose a competitor',
  'No decision / status quo',
  'Timing not right',
  'Wrong stakeholder / champion lost',
  'Product gaps',
  'Lost executive support',
]

const WON_FACTORS = [
  'Strong champion',
  'Best product fit',
  'Competitive pricing',
  'Fast time-to-value',
  'Relationship / trust',
  'Clear ROI story',
  'Sales process execution',
]

const LOST_FACTORS = [
  'Weak champion',
  'Cheaper alternative',
  'Product gaps',
  'Slow sales cycle',
  'Economic buyer not engaged',
  'No compelling event',
  'Lost to status quo',
]

function WinLossDebriefModal({ stage, accountName, existingDebrief, onSave, onCancel }) {
  const isWon = stage === 'closed_won'
  const [primaryReason, setPrimaryReason] = useState(existingDebrief?.primary_reason || '')
  const [selectedFactors, setSelectedFactors] = useState(existingDebrief?.factors || [])
  const [whatWentWell, setWhatWentWell] = useState(existingDebrief?.what_went_well || '')
  const [improve, setImprove] = useState(existingDebrief?.what_to_improve || '')
  const [notes, setNotes] = useState(existingDebrief?.notes || '')
  const [saving, setSaving] = useState(false)

  const factors = isWon ? WON_FACTORS : LOST_FACTORS

  const toggleFactor = (f) => {
    setSelectedFactors(prev =>
      prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave({
      outcome: isWon ? 'won' : 'lost',
      closed_at: new Date().toISOString(),
      primary_reason: primaryReason,
      factors: selectedFactors,
      what_went_well: whatWentWell,
      what_to_improve: improve,
      notes,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className={`px-6 py-5 rounded-t-2xl ${isWon ? 'bg-green-50 border-b border-green-100' : 'bg-red-50 border-b border-red-100'}`}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className={`text-lg font-bold ${isWon ? 'text-green-900' : 'text-red-900'}`}>
                {isWon ? 'Deal Won!' : 'Deal Lost'}
              </h2>
              <p className="text-sm text-gray-600 mt-0.5">{accountName} — capture what happened while it's fresh</p>
            </div>
            <button onClick={onCancel} className="p-1.5 hover:bg-black/5 rounded-lg text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {!isWon && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Primary reason lost</label>
              <div className="flex flex-wrap gap-2">
                {LOST_REASONS.map(r => (
                  <button
                    key={r}
                    onClick={() => setPrimaryReason(r)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      primaryReason === r ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isWon ? 'What made the difference?' : 'Key contributing factors'}
            </label>
            <div className="flex flex-wrap gap-2">
              {factors.map(f => (
                <button
                  key={f}
                  onClick={() => toggleFactor(f)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    selectedFactors.includes(f)
                      ? isWon ? 'bg-green-600 text-white border-green-600' : 'bg-gray-700 text-white border-gray-700'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {isWon ? 'What did we do particularly well?' : 'What could we have done differently?'}
            </label>
            <textarea
              value={isWon ? whatWentWell : improve}
              onChange={e => isWon ? setWhatWentWell(e.target.value) : setImprove(e.target.value)}
              rows={2}
              placeholder={isWon ? "e.g. Champion prep, demo customization..." : "e.g. Should have gotten to EB sooner..."}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {isWon ? 'CS handover notes (integrations promised, timelines, commitments)' : 'Re-engagement notes (when / how to come back)'}
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder={isWon
                ? "e.g. Promised API integration in Q3, 60-day onboarding, key contact is Sarah..."
                : "e.g. Revisit in Q4 when new budget cycle opens, stay in touch with Mark..."
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        <div className="px-6 pb-5 flex items-center justify-between">
          <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">
            Skip for now
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-5 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors ${
              isWon ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-800 hover:bg-gray-900'
            }`}
          >
            {saving ? 'Saving…' : 'Save debrief'}
          </button>
        </div>
      </div>
    </div>
  )
}

const OverviewTab = ({ account, onUpdateAccount, userEmail }) => {
  const metrics = account?.metrics || {};
  const businessAreas = account?.businessAreas || {};

  // Count areas with data
  const areasWithData = BUSINESS_AREAS.filter(area => {
    const data = businessAreas[area.id];
    return data?.currentState?.length > 0 || data?.opportunities?.length > 0;
  }).length;

  // Count open gaps
  const openGaps = (account?.informationGaps || []).filter(g => g.status !== 'resolved').length;

  // Get metrics for this account's vertical
  const accountMetrics = getMetricsForAccount(account?.vertical, account?.ownershipType);

  // Deal health
  const healthScore = calculateDealHealth(account);
  const healthColor = getHealthScoreColor(healthScore);
  const healthBg = getHealthScoreBg(healthScore);

  // Quick observation state
  const [obsText, setObsText] = useState('');
  const [obsSaved, setObsSaved] = useState(false);
  const [obsSaving, setObsSaving] = useState(false);

  // Win/loss debrief modal state
  const [debriefStage, setDebriefStage] = useState(null);

  // Account memory state
  const [accountMemories, setAccountMemories] = useState([]);
  const [memoriesLoaded, setMemoriesLoaded] = useState(false);

  const handleSaveObservation = async () => {
    if (!obsText.trim() || !account?.id) return;
    setObsSaving(true);
    try {
      const r = await fetch(`/api/accounts/${account.id}/memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'manual', content: obsText.trim(), author: userEmail }),
      });
      const d = await r.json();
      if (d.memory) setAccountMemories(prev => [d.memory, ...prev]);
      setObsText('');
      setObsSaved(true);
      setTimeout(() => setObsSaved(false), 2000);
    } catch {}
    finally { setObsSaving(false); }
  };

  const handleDeleteMemory = async (memId) => {
    try {
      await fetch(`/api/accounts/${account.id}/memory?action=delete&memoryId=${memId}`, { method: 'POST' });
      setAccountMemories(prev => prev.filter(m => m.id !== memId));
    } catch {}
  };

  const handleFieldChange = (field, value) => {
    if (!onUpdateAccount) return;
    if (field === 'stage' && (value === 'closed_won' || value === 'closed_lost')) {
      setDebriefStage(value);
      return;
    }
    onUpdateAccount({ [field]: value });
  };

  const getStageColor = (stageId) => {
    const stage = STAGES.find(s => s.id === stageId);
    switch (stage?.color) {
      case 'blue': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'purple': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'orange': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'yellow': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'green': return 'bg-green-100 text-green-800 border-green-300';
      case 'red': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const handleDebriefSave = async (debriefData) => {
    await onUpdateAccount({ stage: debriefStage, debrief: debriefData });
    setDebriefStage(null);
  };

  return (
    <div className="space-y-6">
      {debriefStage && (
        <WinLossDebriefModal
          stage={debriefStage}
          accountName={account?.name}
          existingDebrief={account?.debrief}
          onSave={handleDebriefSave}
          onCancel={() => {
            onUpdateAccount({ stage: debriefStage });
            setDebriefStage(null);
          }}
        />
      )}

      {/* Top Row: Deal Health + Stage/Vertical/Ownership */}
      <div className="grid grid-cols-3 gap-4">
        {/* Deal Health Card */}
        <div className={`p-4 rounded-lg ${healthBg}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Deal Health</span>
            <span className={`text-3xl font-bold ${healthColor}`}>{healthScore}</span>
          </div>
          <DealHealthDetail account={account} />
        </div>

        {/* Stage & Classification */}
        <div className="col-span-2 bg-gray-50 p-4 rounded-lg">
          <div className="grid grid-cols-3 gap-4 mb-3">
            {/* Stage */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
              <select
                value={account?.stage || 'qualifying'}
                onChange={(e) => handleFieldChange('stage', e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm ${getStageColor(account?.stage || 'qualifying')}`}
              >
                {STAGES.map(stage => (
                  <option key={stage.id} value={stage.id}>{stage.label}</option>
                ))}
              </select>
            </div>

            {/* Vertical */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vertical</label>
              <select
                value={account?.vertical || ''}
                onChange={(e) => handleFieldChange('vertical', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Select vertical...</option>
                {VERTICALS.map(v => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </select>
              {!account?.vertical && (
                <div className="flex items-center gap-1 mt-1 text-amber-600 text-xs">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Required for metrics</span>
                </div>
              )}
            </div>

            {/* Ownership Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ownership</label>
              <select
                value={account?.ownershipType || ''}
                onChange={(e) => handleFieldChange('ownershipType', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Select type...</option>
                {OWNERSHIP_TYPES.map(o => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
              {!account?.ownershipType && (
                <div className="flex items-center gap-1 mt-1 text-amber-600 text-xs">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Critical for business case</span>
                </div>
              )}
            </div>
          </div>

          {/* Slack Channel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slack Channel</label>
            <input
              type="text"
              value={account?.slackChannel || ''}
              onChange={(e) => handleFieldChange('slackChannel', e.target.value || null)}
              placeholder={account?.name ? `#pursuit_${account.name.toLowerCase().replace(/[^a-z0-9]/g, '')}` : '#pursuit_accountname'}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
            />
            <p className="text-xs text-gray-400 mt-1">Stage changes and task completions post here. Leave blank to auto-derive from account name.</p>
          </div>
        </div>
      </div>

      {/* Quick observation input */}
      <div className="flex items-center gap-2">
        <textarea
          value={obsText}
          onChange={e => setObsText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveObservation() }}
          placeholder="Add an observation... (champion hesitant, budget frozen Q3, etc.)"
          rows={1}
          className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          style={{ maxHeight: '80px', overflowY: 'auto' }}
          onInput={e => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
          }}
        />
        <button
          onClick={handleSaveObservation}
          disabled={!obsText.trim() || obsSaving}
          className="px-3 py-2 text-sm font-medium bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors shrink-0"
        >
          {obsSaved ? 'Saved' : obsSaving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Pre-Call Brief */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">Quick overview for your next call</p>
        <PreCallBrief account={account} />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Transcripts</div>
          <div className="text-2xl font-bold">{account?.transcripts?.length || 0}</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Stakeholders</div>
          <div className="text-2xl font-bold">{account?.stakeholders?.length || 0}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Areas Mapped</div>
          <div className="text-2xl font-bold">{areasWithData} / 16</div>
        </div>
        <div className="bg-amber-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Open Gaps</div>
          <div className="text-2xl font-bold">{openGaps}</div>
        </div>
      </div>

      {/* Mutual Action Plan (demo / solution_validation / proposal) */}
      <MutualActionPlan account={account} onUpdateAccount={onUpdateAccount} />

      {/* Deal Close Plan (proposal + legal only) */}
      <ClosePlanTracker account={account} onUpdateAccount={onUpdateAccount} />

      {/* Stage Exit Criteria */}
      <StageExitChecklist account={account} onUpdateAccount={onUpdateAccount} />

      {/* Suggested Next Actions */}
      <SuggestedActions account={account} />

      {/* Account Memory Timeline */}
      <details
        className="bg-white border rounded-xl overflow-hidden"
        onToggle={e => {
          if (e.target.open && !memoriesLoaded && account?.id) {
            setMemoriesLoaded(true);
            fetch(`/api/accounts/${account.id}/memory`)
              .then(r => r.json())
              .then(d => { if (Array.isArray(d.memories)) setAccountMemories(d.memories); })
              .catch(() => {});
          }
        }}
      >
        <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-gray-50 list-none select-none">
          <span className="text-sm font-semibold text-gray-800">Account Memory</span>
          {accountMemories.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
              {accountMemories.length}
            </span>
          )}
        </summary>
        <div className="border-t px-4 py-3">
          {accountMemories.length === 0 ? (
            <p className="text-sm text-gray-400 py-1">
              No saved insights yet. Add an observation above or save highlights from the Chat tab.
            </p>
          ) : (
            <div className="space-y-2">
              {accountMemories.slice(0, 5).map(m => (
                <div key={m.id} className="flex items-start gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${memoryBadgeClass(m.type)}`}>
                    {m.type?.replace(/_/g, ' ') || 'note'}
                  </span>
                  <span className="text-sm text-gray-700 flex-1">{m.content}</span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {m.created_at ? new Date(m.created_at).toLocaleDateString() : ''}
                  </span>
                  <button
                    onClick={() => handleDeleteMemory(m.id)}
                    className="text-gray-300 hover:text-red-400 shrink-0 leading-none"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>

      {/* Slack Channel Activity */}
      <SlackChannelActivity account={account} />

      {/* Sales Journey Tracker */}
      <SalesJourneyTracker account={account} />

      {/* Key Metrics */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-3">Key Metrics</h3>
        {!account?.vertical ? (
          <div className="text-sm text-gray-500 text-center py-4">
            Select a vertical to see relevant metrics
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {accountMetrics.map(metric => {
              const data = metrics[metric.id];
              return (
                <div key={metric.id} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                  <div>
                    <div className="text-sm font-medium">{metric.label}</div>
                    {data?.context && (
                      <div className="text-xs text-gray-500">{data.context}</div>
                    )}
                  </div>
                  <div className={`font-semibold ${data?.value ? 'text-gray-900' : 'text-gray-400'}`}>
                    {formatMetricValue(metric, data)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Notes */}
      {account?.notes && account.notes.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Recent Notes</h3>
          <div className="space-y-2">
            {account.notes.slice(-5).reverse().map(note => (
              <div key={note.id} className="text-sm">
                <span className="font-medium text-gray-600">{note.category}:</span> {note.content}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Competitor Intel */}
      <CompetitorIntel account={account} />

      {/* Stage History */}
      <StageHistory account={account} />

      {/* Run Playbook */}
      <RunPlaybook account={account} />
    </div>
  );
};

// ─── Competitor Intel ─────────────────────────────────────────────────────────

function CompetitorIntel({ account }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [expandedCompetitor, setExpandedCompetitor] = useState(null);

  useEffect(() => {
    if (!account?.id) return;
    setLoading(true);
    fetch(`/api/gong/account-competitors?accountId=${account.id}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [account?.id]);

  if (loading) return null;
  if (!data?.competitors?.length) return null;

  const competitors = data.competitors;

  const sentimentColor = (s) => {
    if (s === 'positive') return 'text-green-600 bg-green-50';
    if (s === 'negative') return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-100';
  };

  const sentimentLabel = (s) => {
    if (s === 'positive') return 'Positive for us';
    if (s === 'negative') return 'Risk';
    return 'Neutral';
  };

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold text-gray-800">
            Competitor Intel
          </span>
          <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">
            {competitors.length} mentioned
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t px-4 py-3 space-y-3">
          {competitors.map(c => (
            <div key={c.name} className="border rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedCompetitor(expandedCompetitor === c.name ? null : c.name)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">{c.name}</span>
                  <span className="text-xs text-gray-500">{c.mentions}× mentioned</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${sentimentColor(c.overallSentiment)}`}>
                    {sentimentLabel(c.overallSentiment)}
                  </span>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expandedCompetitor === c.name ? 'rotate-90' : ''}`} />
              </button>

              {expandedCompetitor === c.name && c.contexts.length > 0 && (
                <div className="px-3 py-2 space-y-2 bg-white">
                  {c.contexts.map((ctx, i) => (
                    <div key={i} className="text-sm text-gray-600 border-l-2 border-orange-200 pl-2">
                      <span className="text-xs text-gray-400 block mb-0.5">
                        {ctx.date ? new Date(ctx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                      </span>
                      {ctx.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <p className="text-xs text-gray-400">Based on {data.totalCalls} analyzed calls for this account</p>
        </div>
      )}
    </div>
  );
}

// ─── Stage History ────────────────────────────────────────────────────────────

const STAGE_LABELS_MAP = {
  active_pursuit: 'Active Pursuit',
  qualifying: 'Qualifying',
  intro_scheduled: 'Intro Sched.',
  demo: 'Demo',
  solution_validation: 'Sol. Val.',
  proposal: 'Proposal',
  legal: 'Legal',
  inactive_sdr_follow_up: 'Inactive SDR',
  inactive_ae_follow_up: 'Inactive AE',
  won: 'Won',
  lost: 'Lost',
  closed_won: 'Won',
  closed_lost: 'Lost',
}

function StageHistory({ account }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!account?.id || !expanded) return
    setLoading(true)
    const supabase = getSupabase()
    supabase
      .from('account_stage_history')
      .select('*')
      .eq('account_id', account.id)
      .order('changed_at', { ascending: false })
      .then(({ data }) => {
        setRows(data || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [account?.id, expanded])

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-800">Stage History</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t px-4 py-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-400 py-1">No stage changes recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {rows.map(row => (
                <div key={row.id} className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="font-medium text-gray-800 shrink-0">
                    {STAGE_LABELS_MAP[row.from_stage] || row.from_stage || '—'}
                  </span>
                  <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
                  <span className="font-medium text-gray-800 shrink-0">
                    {STAGE_LABELS_MAP[row.to_stage] || row.to_stage}
                  </span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-500 shrink-0">{row.changed_by_name || '—'}</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-400 shrink-0">
                    {row.changed_at ? new Date(row.changed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </span>
                  {row.days_in_prior_stage != null && (
                    <>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-400 shrink-0">{row.days_in_prior_stage}d in prior stage</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Mutual Action Plan ───────────────────────────────────────────────────────

function MutualActionPlan({ account, onUpdateAccount }) {
  const stage = account?.stage
  const showMAP = ['demo', 'solution_validation', 'proposal'].includes(stage)
  if (!showMAP) return null

  const [loading, setLoading] = useState(false)
  const [map, setMap] = useState(account?.mapData || null)

  useEffect(() => {
    if (account?.mapData) setMap(account.mapData)
  }, [account?.id])

  const generate = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/accounts/generate-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: account.id }),
      })
      const data = await res.json()
      if (data.map) {
        setMap(data.map)
        onUpdateAccount({ mapData: data.map })
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  if (!map) {
    return (
      <div className="bg-white border rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Mutual Action Plan</h3>
            <p className="text-xs text-gray-400 mt-0.5">Generate a MAP to align on next steps and close date</p>
          </div>
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {loading ? 'Generating…' : 'Generate MAP'}
          </button>
        </div>
      </div>
    )
  }

  const today = new Date()
  const addDays = (days) => {
    const d = new Date(today)
    d.setDate(d.getDate() + days)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-blue-50">
        <div>
          <span className="text-sm font-semibold text-blue-900">Mutual Action Plan</span>
          {map.target_close && (
            <span className="ml-2 text-xs text-blue-600">Target close: {map.target_close}</span>
          )}
        </div>
        <button onClick={generate} disabled={loading} className="text-xs text-blue-500 hover:text-blue-700 font-medium">
          {loading ? 'Regenerating…' : 'Regenerate'}
        </button>
      </div>

      <div className="p-4 space-y-4">
        {map.goal && (
          <p className="text-sm text-gray-700 italic border-l-2 border-blue-200 pl-3">{map.goal}</p>
        )}

        {(map.milestones || []).map((week, wi) => (
          <div key={wi}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{week.week}</p>
            <div className="space-y-1.5">
              {(week.actions || []).map((action, ai) => (
                <div key={ai} className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${action.critical ? 'border-orange-200 bg-orange-50' : 'border-gray-100 bg-gray-50'}`}>
                  <div className={`mt-0.5 text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${
                    action.owner === 'Banner' ? 'bg-blue-100 text-blue-700' :
                    action.owner === 'Prospect' ? 'bg-purple-100 text-purple-700' :
                    'bg-gray-200 text-gray-600'
                  }`}>
                    {action.owner}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-800 leading-snug">{action.action}</p>
                    {action.due_offset_days != null && (
                      <p className="text-xs text-gray-400 mt-0.5">by {addDays(action.due_offset_days)}</p>
                    )}
                  </div>
                  {action.critical && (
                    <span className="text-xs text-orange-500 font-medium shrink-0">Critical</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {map.success_criteria?.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Success criteria</p>
            <ul className="space-y-1">
              {map.success_criteria.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />{c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {map.risks?.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Risks to watch</p>
            <ul className="space-y-1">
              {map.risks.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-orange-400 mt-0.5">▲</span>{r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Deal Close Plan ─────────────────────────────────────────────────────────

const CLOSE_PLAN_FIELDS = [
  { id: 'next_call', label: 'Next scheduled call', type: 'date', placeholder: 'Date of next call' },
  { id: 'sign_by', label: 'Target signature date', type: 'date', placeholder: 'Expected close date' },
  { id: 'decision_maker', label: 'Decision-maker confirmed', type: 'text', placeholder: 'Name and title' },
  { id: 'legal_contact', label: 'Legal / procurement contact', type: 'text', placeholder: 'Name and email' },
  { id: 'blockers', label: 'Known blockers', type: 'textarea', placeholder: 'Security review, budget approval, board sign-off…' },
  { id: 'champion_status', label: 'Champion status', type: 'text', placeholder: 'Actively selling internally, went quiet, needs executive support…' },
  { id: 'competitor_status', label: 'Competitive situation', type: 'text', placeholder: 'Sole vendor, vs. Smartsheet, no competition…' },
  { id: 'next_action', label: 'Rep\'s next action', type: 'text', placeholder: 'What you\'re doing today to push this forward' },
]

function ClosePlanTracker({ account, onUpdateAccount }) {
  const stage = account?.stage
  if (stage !== 'proposal' && stage !== 'legal') return null

  const [plan, setPlan] = useState(account?.closePlan || {})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setPlan(account?.closePlan || {})
  }, [account?.id])

  const save = async () => {
    setSaving(true)
    await onUpdateAccount({ closePlan: plan })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const filledCount = CLOSE_PLAN_FIELDS.filter(f => plan[f.id]?.trim()).length

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-amber-50">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-semibold text-amber-900">Close Plan</span>
          <span className="text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full font-medium">
            {filledCount}/{CLOSE_PLAN_FIELDS.length}
          </span>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="text-xs text-amber-700 hover:text-amber-900 font-medium disabled:opacity-50"
        >
          {saved ? 'Saved' : saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <div className="p-4 space-y-3">
        {CLOSE_PLAN_FIELDS.map(field => (
          <div key={field.id}>
            <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
            {field.type === 'textarea' ? (
              <textarea
                value={plan[field.id] || ''}
                onChange={e => setPlan(prev => ({ ...prev, [field.id]: e.target.value }))}
                placeholder={field.placeholder}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            ) : (
              <input
                type={field.type}
                value={plan[field.id] || ''}
                onChange={e => setPlan(prev => ({ ...prev, [field.id]: e.target.value }))}
                placeholder={field.type === 'date' ? '' : field.placeholder}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Stage Exit Criteria ──────────────────────────────────────────────────────

const STAGE_EXIT_CRITERIA = {
  qualifying: [
    { id: 'decision_maker', label: 'Contact is a decision-maker or has a clear path to one' },
    { id: 'budget_exists', label: 'Budget exists or can be created — confirmed, not assumed' },
    { id: 'pain_identified', label: 'Specific pain or initiative identified and articulated by the prospect' },
    { id: 'timeline_confirmed', label: 'Timeline and urgency confirmed (not just "sometime this year")' },
    { id: 'no_disqualifiers', label: 'No hard disqualifiers (wrong vertical, too small, wrong structure)' },
  ],
  intro_scheduled: [
    { id: 'invite_accepted', label: 'Calendar invite sent and accepted by all attendees' },
    { id: 'objectives_shared', label: 'Meeting objectives defined and shared with prospect ahead of call' },
    { id: 'research_done', label: 'Pre-call research complete: org chart, recent news, active initiatives' },
    { id: 'attendees_confirmed', label: 'Key attendees confirmed on both sides' },
  ],
  active_pursuit: [
    { id: 'metrics_defined', label: 'Metrics: quantified business impact of solving the problem' },
    { id: 'economic_buyer_id', label: 'Economic Buyer identified by name and title' },
    { id: 'decision_criteria', label: 'Decision criteria understood — what does "winning" look like to them' },
    { id: 'decision_process', label: 'Decision process mapped: who else is involved, legal/procurement steps' },
    { id: 'pain_depth', label: 'Pain depth established: consequence of not solving is understood' },
    { id: 'champion_identified', label: 'Champion identified — someone actively selling for us internally' },
    { id: 'two_stakeholders', label: '2+ stakeholders engaged beyond the first contact' },
  ],
  demo: [
    { id: 'demo_customized', label: 'Demo customized to their specific workflows and pain points' },
    { id: 'eb_attending', label: 'Economic Buyer or Champion attending the demo' },
    { id: 'success_criteria', label: 'Success criteria defined pre-demo ("what does a great demo look like to you?")' },
    { id: 'technical_reqs', label: 'Technical and integration requirements documented' },
    { id: 'next_step_agreed', label: 'Next step explicitly agreed before the call ends' },
  ],
  solution_validation: [
    { id: 'champion_engaged', label: 'Champion actively engaged and advocates internally' },
    { id: 'eval_criteria_doc', label: 'Evaluation criteria formally documented and agreed upon' },
    { id: 'all_evaluators_id', label: 'All evaluators and influencers identified' },
    { id: 'workflows_mapped', label: 'CapEx workflows mapped to Banner capabilities — no open "can you do X?" questions' },
    { id: 'business_case_started', label: 'Business case started with Champion input' },
    { id: 'competition_known', label: 'Competitive situation known — are we the only vendor being evaluated?' },
  ],
  proposal: [
    { id: 'eb_engaged', label: 'Economic Buyer directly engaged — not just through Champion' },
    { id: 'all_dms_id', label: 'All decision-makers identified and relationship established' },
    { id: 'implementation_agreed', label: 'Implementation timeline agreed and realistic' },
    { id: 'legal_process_known', label: 'Legal and procurement process mapped with names and steps' },
    { id: 'champion_reviewed', label: 'Champion has reviewed the proposal and actively supports it' },
    { id: 'verbal_commit', label: 'Verbal commitment on scope and pricing received before sending docs' },
  ],
  legal: [
    { id: 'msa_sent', label: 'MSA/contract sent to the legal contact (not just Champion)' },
    { id: 'procurement_mapped', label: 'Procurement process fully mapped — no surprises expected' },
    { id: 'signature_timeline', label: 'Timeline to signature confirmed with a specific date' },
    { id: 'security_addressed', label: 'Security and compliance requirements addressed and documented' },
    { id: 'exec_sponsor', label: 'Executive sponsor engaged and aware of the deal closing' },
  ],
}

function StageExitChecklist({ account, onUpdateAccount }) {
  const stage = account?.stage
  const criteria = STAGE_EXIT_CRITERIA[stage]
  const [saving, setSaving] = useState(false)

  if (!criteria) return null

  const saved = account?.stageExitCriteria?.[stage] || {}
  const completedCount = criteria.filter(c => saved[c.id]).length

  const toggle = async (criterionId) => {
    const current = account?.stageExitCriteria || {}
    const stageChecks = { ...(current[stage] || {}) }
    stageChecks[criterionId] = !stageChecks[criterionId]
    const updated = { ...current, [stage]: stageChecks }
    setSaving(true)
    try {
      await onUpdateAccount({ stageExitCriteria: updated })
    } finally {
      setSaving(false)
    }
  }

  const allDone = completedCount === criteria.length
  const progressPct = Math.round((completedCount / criteria.length) * 100)

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <CheckCircle className={`w-4 h-4 ${allDone ? 'text-green-500' : 'text-gray-400'}`} />
          <span className="text-sm font-semibold text-gray-800">Stage Exit Criteria</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
            allDone ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {completedCount}/{criteria.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {saving && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
          <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${allDone ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>
      <div className="border-t px-4 py-3 space-y-2">
        {criteria.map(c => (
          <button
            key={c.id}
            onClick={() => toggle(c.id)}
            className="w-full flex items-start gap-3 text-left group"
          >
            <div className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
              saved[c.id]
                ? 'bg-blue-600 border-blue-600'
                : 'border-gray-300 group-hover:border-blue-400'
            }`}>
              {saved[c.id] && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                  <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className={`text-sm leading-5 ${saved[c.id] ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
              {c.label}
            </span>
          </button>
        ))}
        {allDone && (
          <div className="mt-2 pt-2 border-t border-green-100 flex items-center gap-1.5 text-xs text-green-600 font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            All criteria met — ready to advance stage
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Run Playbook ─────────────────────────────────────────────────────────────

function RunPlaybook({ account }) {
  const [playbooks, setPlaybooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch('/api/playbooks')
      .then(r => r.json())
      .then(d => setPlaybooks((d.playbooks || []).filter(p => p.active)))
      .catch(() => {});
  }, []);

  if (!playbooks.length || !account?.id) return null;

  const handleRun = async (playbook) => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch('/api/playbooks/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playbookId: playbook.id, accountId: account.id }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setRunning(false);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Play className="w-3.5 h-3.5" />
        Run Playbook
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border rounded-xl shadow-lg z-10 w-64 py-1.5">
          {playbooks.map(pb => (
            <button
              key={pb.id}
              onClick={() => handleRun(pb)}
              disabled={running}
              className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-gray-50 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 mt-0.5 text-blue-500 shrink-0" />
              <div>
                <div className="text-sm font-medium text-gray-800">{pb.name}</div>
                {pb.description && <div className="text-xs text-gray-500">{pb.description}</div>}
                <div className="text-xs text-gray-400">{pb.steps?.length || 0} tasks</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {result && (
        <div className={`mt-2 text-sm rounded-lg px-3 py-2 ${result.error || result.alreadyActive ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
          {result.error ? `Error: ${result.error}` : result.message}
        </div>
      )}
    </div>
  );
}

export default OverviewTab;
