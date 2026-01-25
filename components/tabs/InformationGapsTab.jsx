import { useState } from 'react';
import { CheckCircle, Circle, AlertCircle, Building2, Target } from 'lucide-react';

const GapCard = ({ gap }) => {
  const isResolved = gap.status === 'resolved';

  return (
    <div
      className={`border-l-4 p-4 rounded-r-lg ${
        isResolved
          ? 'border-green-500 bg-green-50'
          : 'border-amber-500 bg-amber-50'
      }`}
    >
      <div className="flex items-start gap-3">
        {isResolved ? (
          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
        ) : (
          <Circle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
        )}
        <div className="flex-1">
          <div className={`font-medium text-gray-800 ${isResolved ? 'line-through opacity-60' : ''}`}>
            {gap.question}
          </div>
          {gap.resolution && (
            <div className="text-sm text-green-700 mt-1">
              {gap.resolution}
            </div>
          )}
          {gap.addedAt && (
            <div className="text-xs text-gray-500 mt-1">
              {isResolved ? 'Resolved' : 'Added'} {new Date(gap.resolvedAt || gap.addedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const InformationGapsTab = ({ account, onResolveGap }) => {
  const [activeSection, setActiveSection] = useState('business');
  const gaps = account?.informationGaps || [];
  const stakeholders = account?.stakeholders || [];
  const metrics = account?.metrics || {};

  // Calculate MEDDICC status
  const hasMetrics = Object.values(metrics).some(m => m?.value != null);
  const hasEconomicBuyer = stakeholders.some(s => s.role === 'Economic Buyer');
  const hasChampion = stakeholders.some(s => s.role === 'Champion');
  const hasPainIdentified = Object.values(account?.businessAreas || {}).some(
    area => area?.opportunities?.length > 0
  );

  // Categorize gaps
  const businessGaps = gaps.filter(g => g.category !== 'sales');
  const salesGaps = gaps.filter(g => g.category === 'sales');

  const openBusinessGaps = businessGaps.filter(g => g.status !== 'resolved');
  const resolvedBusinessGaps = businessGaps.filter(g => g.status === 'resolved');
  const openSalesGaps = salesGaps.filter(g => g.status !== 'resolved');
  const resolvedSalesGaps = salesGaps.filter(g => g.status === 'resolved');

  return (
    <div className="space-y-4">
      {/* Section Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveSection('business')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
            activeSection === 'business'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Business Process
          {openBusinessGaps.length > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
              {openBusinessGaps.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveSection('sales')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
            activeSection === 'sales'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Target className="w-4 h-4" />
          Sales Process (MEDDICC)
          {openSalesGaps.length > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
              {openSalesGaps.length}
            </span>
          )}
        </button>
      </div>

      {/* Business Process Section */}
      {activeSection === 'business' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Questions about their CapEx processes that help build a better evaluation.
          </p>

          {openBusinessGaps.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 text-gray-700">Open Questions ({openBusinessGaps.length})</h3>
              <div className="space-y-3">
                {openBusinessGaps.map(gap => (
                  <GapCard key={gap.id} gap={gap} />
                ))}
              </div>
            </div>
          )}

          {resolvedBusinessGaps.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 text-gray-700">Resolved ({resolvedBusinessGaps.length})</h3>
              <div className="space-y-3">
                {resolvedBusinessGaps.map(gap => (
                  <GapCard key={gap.id} gap={gap} />
                ))}
              </div>
            </div>
          )}

          {businessGaps.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <div>No business process gaps identified yet.</div>
              <div className="text-sm mt-1">
                Add transcripts to identify gaps in your understanding of their processes.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sales Process Section */}
      {activeSection === 'sales' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            MEDDICC-related questions needed to progress the sale.
          </p>

          {/* MEDDICC Quick Status */}
          <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-lg text-sm">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${hasMetrics ? 'bg-green-500' : 'bg-gray-300'}`}></span>
              <span className={hasMetrics ? 'text-green-700' : 'text-gray-600'}>
                Metrics {hasMetrics ? '✓' : 'needed'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${hasEconomicBuyer ? 'bg-green-500' : 'bg-gray-300'}`}></span>
              <span className={hasEconomicBuyer ? 'text-green-700' : 'text-gray-600'}>
                Economic Buyer {hasEconomicBuyer ? '✓' : 'needed'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-300"></span>
              <span className="text-gray-600">Decision Criteria needed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-300"></span>
              <span className="text-gray-600">Decision Process needed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${hasPainIdentified ? 'bg-green-500' : 'bg-gray-300'}`}></span>
              <span className={hasPainIdentified ? 'text-green-700' : 'text-gray-600'}>
                Pain {hasPainIdentified ? '✓' : 'needed'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${hasChampion ? 'bg-green-500' : 'bg-gray-300'}`}></span>
              <span className={hasChampion ? 'text-green-700' : 'text-gray-600'}>
                Champion {hasChampion ? '✓' : 'needed'}
              </span>
            </div>
          </div>

          {openSalesGaps.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 text-gray-700">Open Questions ({openSalesGaps.length})</h3>
              <div className="space-y-3">
                {openSalesGaps.map(gap => (
                  <GapCard key={gap.id} gap={gap} />
                ))}
              </div>
            </div>
          )}

          {resolvedSalesGaps.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 text-gray-700">Resolved ({resolvedSalesGaps.length})</h3>
              <div className="space-y-3">
                {resolvedSalesGaps.map(gap => (
                  <GapCard key={gap.id} gap={gap} />
                ))}
              </div>
            </div>
          )}

          {salesGaps.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Target className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <div>No sales process gaps identified yet.</div>
              <div className="text-sm mt-1">
                Add transcripts to identify MEDDICC gaps.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InformationGapsTab;
