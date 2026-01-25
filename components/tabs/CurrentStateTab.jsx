import { ChevronDown, ChevronRight, Quote } from 'lucide-react';
import { useState } from 'react';
import { BUSINESS_AREAS } from '../../lib/constants';

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

const BusinessAreaCard = ({ area, data }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasData = data?.currentState?.length > 0 || data?.opportunities?.length > 0;

  return (
    <div className={`border rounded-lg ${hasData ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'}`}>
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
            <div className="font-medium">{area.label}</div>
            <div className="text-xs text-gray-500">{area.description}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasData && (
            <span className="text-xs text-gray-500">
              {(data?.currentState?.length || 0) + (data?.opportunities?.length || 0)} insights
            </span>
          )}
          <ConfidenceBadge confidence={data?.confidence} />
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
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

          {!hasData && (
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

  // Count areas with data
  const areasWithData = BUSINESS_AREAS.filter(area => {
    const data = businessAreas[area.id];
    return data?.currentState?.length > 0 || data?.opportunities?.length > 0;
  }).length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600">
          {areasWithData} of {BUSINESS_AREAS.length} areas have data
        </div>
        <div className="flex gap-2 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span> High
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span> Medium
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span> Low
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-300"></span> None
          </span>
        </div>
      </div>

      {/* Business Area Cards */}
      <div className="space-y-2">
        {BUSINESS_AREAS.map(area => (
          <BusinessAreaCard
            key={area.id}
            area={area}
            data={businessAreas[area.id]}
          />
        ))}
      </div>
    </div>
  );
};

export default CurrentStateTab;
