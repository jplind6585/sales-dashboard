import { useState, useEffect } from 'react';
import { Loader2, ArrowRight, AlertTriangle, TrendingUp, Users, Target, CheckCircle, Circle, ChevronRight } from 'lucide-react';
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

const OverviewTab = ({ account, onUpdateAccount }) => {
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

  const handleFieldChange = (field, value) => {
    if (onUpdateAccount) {
      onUpdateAccount({ [field]: value });
    }
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

  return (
    <div className="space-y-6">
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
              placeholder={account?.name ? `#${account.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : '#account-channel'}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
            />
            <p className="text-xs text-gray-400 mt-1">Stage changes and task completions post here. Leave blank to auto-derive from account name.</p>
          </div>
        </div>
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

      {/* Suggested Next Actions */}
      <SuggestedActions account={account} />

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
    </div>
  );
};

export default OverviewTab;
