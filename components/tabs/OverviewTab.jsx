import { MessageCircle } from 'lucide-react';
import { KEY_METRICS, BUSINESS_AREAS } from '../../lib/constants';

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

const OverviewTab = ({ account, onOpenAssistant }) => {
  const metrics = account?.metrics || {};
  const businessAreas = account?.businessAreas || {};

  // Count areas with data
  const areasWithData = BUSINESS_AREAS.filter(area => {
    const data = businessAreas[area.id];
    return data?.currentState?.length > 0 || data?.opportunities?.length > 0;
  }).length;

  // Count open gaps
  const openGaps = (account?.informationGaps || []).filter(g => g.status !== 'resolved').length;

  return (
    <div className="space-y-6">
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

      {/* Key Metrics */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-3">Key Metrics</h3>
        <div className="grid grid-cols-2 gap-4">
          {KEY_METRICS.map(metric => {
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

      <div className="flex justify-end pt-4">
        <button
          onClick={onOpenAssistant}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <MessageCircle className="w-4 h-4" />
          Ask / Update
        </button>
      </div>
    </div>
  );
};

export default OverviewTab;
