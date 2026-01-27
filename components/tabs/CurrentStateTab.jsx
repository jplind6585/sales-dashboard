import { ChevronDown, ChevronRight, Quote, AlertTriangle, Minus, X } from 'lucide-react';
import { useState, useMemo } from 'react';
import { BUSINESS_AREAS } from '../../lib/constants';

const PriorityBadge = ({ priority, irrelevant }) => {
  if (irrelevant) {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-500 line-through">
        N/A
      </span>
    );
  }

  const colors = {
    high: 'bg-red-100 text-red-700 border border-red-200',
    medium: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
    low: 'bg-blue-100 text-blue-700 border border-blue-200',
    none: 'bg-gray-100 text-gray-600',
  };

  const labels = {
    high: 'High Priority',
    medium: 'Medium',
    low: 'Low',
    none: 'Not Set',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[priority] || colors.none}`}>
      {labels[priority] || labels.none}
    </span>
  );
};

const ConfidenceBadge = ({ confidence }) => {
  const colors = {
    none: 'bg-gray-100 text-gray-600',
    low: 'bg-red-100 text-red-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-green-100 text-green-700',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[confidence] || colors.none}`}>
      {confidence || 'none'}
    </span>
  );
};

const BusinessAreaCard = ({ area, data, isIrrelevant }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasData = data?.currentState?.length > 0 || data?.opportunities?.length > 0;
  const priority = data?.priority || 'none';

  const cardClasses = isIrrelevant
    ? 'border rounded-lg border-gray-200 bg-gray-50 opacity-60'
    : hasData
    ? 'border rounded-lg border-blue-200 bg-blue-50/30'
    : 'border rounded-lg border-gray-200';

  return (
    <div className={cardClasses}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50/50"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
          <div>
            <div className={`font-medium ${isIrrelevant ? 'line-through text-gray-400' : ''}`}>
              {area.label}
            </div>
            <div className="text-xs text-gray-500">{area.description}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasData && !isIrrelevant && (
            <span className="text-xs text-gray-500">
              {(data?.currentState?.length || 0) + (data?.opportunities?.length || 0)} insights
            </span>
          )}
          <PriorityBadge priority={priority} irrelevant={isIrrelevant} />
          {!isIrrelevant && <ConfidenceBadge confidence={data?.confidence} />}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {isIrrelevant && data?.irrelevantReason && (
            <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-100 p-2 rounded">
              <X className="w-4 h-4" />
              <span>Marked as not applicable: {data.irrelevantReason}</span>
            </div>
          )}

          {/* Current State */}
          {data?.currentState?.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">Current State</div>
              <ul className="space-y-1">
                {data.currentState.map((item, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Opportunities */}
          {data?.opportunities?.length > 0 && (
            <div>
              <div className="text-sm font-medium text-amber-700 mb-1">Opportunities / Pain Points</div>
              <ul className="space-y-1">
                {data.opportunities.map((item, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-amber-500 mt-1">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Quotes */}
          {data?.quotes?.length > 0 && (
            <div>
              <div className="text-sm font-medium text-purple-700 mb-1 flex items-center gap-1">
                <Quote className="w-3 h-3" />
                Direct Quotes
              </div>
              <ul className="space-y-1">
                {data.quotes.map((quote, i) => (
                  <li key={i} className="text-sm text-gray-600 italic border-l-2 border-purple-300 pl-2">
                    "{quote}"
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!hasData && !isIrrelevant && (
            <div className="text-sm text-gray-400 italic">
              No information captured yet for this area.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CurrentStateTab = ({ account }) => {
  const businessAreas = account?.businessAreas || {};

  // Sort and categorize areas
  const sortedAreas = useMemo(() => {
    const priorityOrder = { high: 0, medium: 1, low: 2, none: 3 };

    // Separate irrelevant from active areas
    const activeAreas = [];
    const irrelevantAreas = [];

    BUSINESS_AREAS.forEach(area => {
      const data = businessAreas[area.id];
      if (data?.irrelevant) {
        irrelevantAreas.push({ area, data, isIrrelevant: true });
      } else {
        activeAreas.push({ area, data, isIrrelevant: false });
      }
    });

    // Sort active areas by priority (high → medium → low → none), then by data presence
    activeAreas.sort((a, b) => {
      const priorityA = a.data?.priority || 'none';
      const priorityB = b.data?.priority || 'none';
      const orderA = priorityOrder[priorityA];
      const orderB = priorityOrder[priorityB];

      if (orderA !== orderB) return orderA - orderB;

      // Within same priority, areas with data come first
      const hasDataA = a.data?.currentState?.length > 0 || a.data?.opportunities?.length > 0;
      const hasDataB = b.data?.currentState?.length > 0 || b.data?.opportunities?.length > 0;
      if (hasDataA && !hasDataB) return -1;
      if (!hasDataA && hasDataB) return 1;

      return 0;
    });

    return { activeAreas, irrelevantAreas };
  }, [businessAreas]);

  // Count stats
  const areasWithData = BUSINESS_AREAS.filter(area => {
    const data = businessAreas[area.id];
    return (data?.currentState?.length > 0 || data?.opportunities?.length > 0) && !data?.irrelevant;
  }).length;

  const highPriorityCount = BUSINESS_AREAS.filter(area => {
    const data = businessAreas[area.id];
    return data?.priority === 'high' && !data?.irrelevant;
  }).length;

  const irrelevantCount = sortedAreas.irrelevantAreas.length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600">
          {areasWithData} of {BUSINESS_AREAS.length - irrelevantCount} active areas have data
          {highPriorityCount > 0 && (
            <span className="ml-2 text-red-600 font-medium">
              ({highPriorityCount} high priority)
            </span>
          )}
        </div>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-red-500" /> High
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span> Medium
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span> Low
          </span>
          <span className="flex items-center gap-1">
            <Minus className="w-3 h-3 text-gray-400" /> None
          </span>
        </div>
      </div>

      {/* Tip */}
      <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded flex items-center gap-2">
        <span className="text-blue-500">Tip:</span>
        Use the AI assistant to set priorities or mark areas as not applicable (e.g., "Mark CM Fees as high priority" or "CM Fees is not relevant for this account")
      </div>

      {/* Active Business Area Cards (sorted by priority) */}
      <div className="space-y-2">
        {sortedAreas.activeAreas.map(({ area, data, isIrrelevant }) => (
          <BusinessAreaCard
            key={area.id}
            area={area}
            data={data}
            isIrrelevant={isIrrelevant}
          />
        ))}
      </div>

      {/* Irrelevant Areas Section */}
      {sortedAreas.irrelevantAreas.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-2 text-gray-500">
            <X className="w-4 h-4" />
            <span className="text-sm font-medium">Not Applicable ({irrelevantCount})</span>
          </div>
          <div className="space-y-2">
            {sortedAreas.irrelevantAreas.map(({ area, data, isIrrelevant }) => (
              <BusinessAreaCard
                key={area.id}
                area={area}
                data={data}
                isIrrelevant={isIrrelevant}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CurrentStateTab;
