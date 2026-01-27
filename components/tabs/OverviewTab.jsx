import { useState, useEffect } from 'react';
import { Loader2, ArrowRight, AlertTriangle, TrendingUp, Users, Target } from 'lucide-react';
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
          <div className="grid grid-cols-3 gap-4">
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
