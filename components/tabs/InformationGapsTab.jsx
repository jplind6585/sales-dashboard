import { useState } from 'react';
import { CheckCircle, Circle, AlertCircle, Building2, Target, ChevronDown, ChevronRight, HelpCircle, MessageSquare } from 'lucide-react';
import { MEDDICC } from '../../lib/constants';

// Why each gap category matters and suggested discovery questions
const GAP_INSIGHTS = {
  metrics: {
    why: "Without quantifiable metrics, you can't build a compelling ROI case or justify the investment to economic buyers.",
    questions: [
      "What metrics do you use to measure success in your CapEx program?",
      "How much are you currently spending annually on construction/renovations?",
      "What would a 10% improvement in project costs mean for your business?",
    ]
  },
  economic_buyer: {
    why: "Deals stall without access to the person who controls the budget. They need to be convinced of the business value.",
    questions: [
      "Who ultimately signs off on investments of this size?",
      "Who controls the budget for construction and capital improvements?",
      "Is there a specific approval process for software investments?",
    ]
  },
  decision_criteria: {
    why: "Understanding their formal and informal criteria lets you position against competition and address concerns proactively.",
    questions: [
      "What factors are most important in your evaluation?",
      "Are there must-have features vs nice-to-haves?",
      "What would make this a clear 'yes' for your team?",
    ]
  },
  decision_process: {
    why: "Knowing the timeline and steps prevents surprises and helps you plan resources and forecast accurately.",
    questions: [
      "What does your typical buying process look like for software?",
      "Who needs to be involved in the final decision?",
      "What's a realistic timeline for making a decision?",
    ]
  },
  identify_pain: {
    why: "Pain is the #1 driver of change. Without clear pain, there's no urgency and status quo wins.",
    questions: [
      "What's the biggest challenge you're facing with your current process?",
      "What happens when projects go over budget or timeline?",
      "What keeps you up at night about your CapEx program?",
    ]
  },
  champion: {
    why: "Champions sell internally when you're not in the room. Without one, deals die in committee.",
    questions: [
      "Who on your team is most excited about solving this problem?",
      "Who would benefit most from this solution?",
      "Is there someone who could help us navigate your organization?",
    ]
  },
  competition: {
    why: "Knowing the competitive landscape helps you differentiate and avoid being outsold on features or price.",
    questions: [
      "Are you evaluating other solutions?",
      "What alternatives are you considering, including doing nothing?",
      "Have you worked with similar vendors in the past?",
    ]
  },
  business: {
    why: "Understanding their business processes deeply enables you to tailor the solution and build a stronger business case.",
    questions: [
      "Can you walk me through how this process works today?",
      "Who's involved at each step?",
      "Where do things typically slow down or break?",
    ]
  }
};

const GapCard = ({ gap, isExpanded, onToggle }) => {
  const isResolved = gap.status === 'resolved';
  const insights = GAP_INSIGHTS[gap.meddiccCategory] || GAP_INSIGHTS[gap.category] || GAP_INSIGHTS.business;

  return (
    <div
      className={`border-l-4 rounded-r-lg overflow-hidden ${
        isResolved
          ? 'border-green-500 bg-green-50'
          : 'border-amber-500 bg-amber-50'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full p-4 text-left hover:bg-white/30 transition-colors"
      >
        <div className="flex items-start gap-3">
          {isResolved ? (
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
          ) : (
            <Circle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className={`font-medium text-gray-800 ${isResolved ? 'line-through opacity-60' : ''}`}>
                {gap.question}
              </div>
              {!isResolved && (
                isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )
              )}
            </div>
            {gap.resolution && (
              <div className="text-sm text-green-700 mt-1">
                {gap.resolution}
              </div>
            )}
            {gap.addedAt && !isExpanded && (
              <div className="text-xs text-gray-500 mt-1">
                {isResolved ? 'Resolved' : 'Added'} {new Date(gap.resolvedAt || gap.addedAt).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && !isResolved && (
        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-amber-200/50">
          {/* Why this matters */}
          <div className="bg-white/50 rounded p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-700 mb-1">
              <AlertCircle className="w-4 h-4" />
              Why this matters
            </div>
            <p className="text-sm text-gray-600">{insights.why}</p>
          </div>

          {/* Suggested questions */}
          <div className="bg-white/50 rounded p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-700 mb-2">
              <MessageSquare className="w-4 h-4" />
              Questions to ask
            </div>
            <ul className="space-y-2">
              {insights.questions.map((q, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <HelpCircle className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
                  {q}
                </li>
              ))}
            </ul>
          </div>

          <div className="text-xs text-gray-500">
            Added {new Date(gap.addedAt).toLocaleDateString()}
          </div>
        </div>
      )}
    </div>
  );
};

const MeddiccCategorySection = ({ category, gaps, expandedGaps, onToggleGap }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const meddiccInfo = MEDDICC[category.id];
  const openGaps = gaps.filter(g => g.status !== 'resolved');
  const resolvedGaps = gaps.filter(g => g.status === 'resolved');

  if (gaps.length === 0) return null;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
          <span className="font-medium">{meddiccInfo?.label || category.label}</span>
          <span className="text-xs text-gray-500">({meddiccInfo?.description})</span>
        </div>
        <div className="flex items-center gap-2">
          {openGaps.length > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
              {openGaps.length} open
            </span>
          )}
          {resolvedGaps.length > 0 && (
            <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
              {resolvedGaps.length} resolved
            </span>
          )}
        </div>
      </button>

      {!isCollapsed && (
        <div className="p-3 space-y-2 bg-white">
          {gaps.map(gap => (
            <GapCard
              key={gap.id}
              gap={gap}
              isExpanded={expandedGaps.has(gap.id)}
              onToggle={() => onToggleGap(gap.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const InformationGapsTab = ({ account, onResolveGap }) => {
  const [activeSection, setActiveSection] = useState('business');
  const [expandedGaps, setExpandedGaps] = useState(new Set());

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
  const businessGaps = gaps.filter(g => g.category !== 'sales' && !g.meddiccCategory);
  const salesGaps = gaps.filter(g => g.category === 'sales' || g.meddiccCategory);

  // Group sales gaps by MEDDICC category
  const meddiccCategories = Object.values(MEDDICC);
  const gapsByMeddicc = {};
  meddiccCategories.forEach(cat => {
    gapsByMeddicc[cat.id] = salesGaps.filter(g => g.meddiccCategory === cat.id);
  });
  // Add uncategorized sales gaps
  const uncategorizedSalesGaps = salesGaps.filter(g => !g.meddiccCategory);

  const openBusinessGaps = businessGaps.filter(g => g.status !== 'resolved');
  const resolvedBusinessGaps = businessGaps.filter(g => g.status === 'resolved');
  const openSalesGaps = salesGaps.filter(g => g.status !== 'resolved');

  const toggleGap = (gapId) => {
    setExpandedGaps(prev => {
      const next = new Set(prev);
      if (next.has(gapId)) {
        next.delete(gapId);
      } else {
        next.add(gapId);
      }
      return next;
    });
  };

  // MEDDICC status items for the grid
  const meddiccStatus = [
    { id: 'metrics', label: 'Metrics', status: hasMetrics, detail: hasMetrics ? 'Captured' : 'Needed' },
    { id: 'economic_buyer', label: 'Economic Buyer', status: hasEconomicBuyer, detail: hasEconomicBuyer ? 'Identified' : 'Needed' },
    { id: 'decision_criteria', label: 'Decision Criteria', status: false, detail: 'Needed' },
    { id: 'decision_process', label: 'Decision Process', status: false, detail: 'Needed' },
    { id: 'identify_pain', label: 'Identify Pain', status: hasPainIdentified, detail: hasPainIdentified ? 'Identified' : 'Needed' },
    { id: 'champion', label: 'Champion', status: hasChampion, detail: hasChampion ? 'Identified' : 'Needed' },
    { id: 'competition', label: 'Competition', status: false, detail: 'Unknown' },
  ];

  return (
    <div className="space-y-4">
      {/* Tip */}
      <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded flex items-center gap-2">
        <span className="text-blue-500">Tip:</span>
        Use the AI assistant to manage gaps (e.g., "Ignore that pricing gap" or "Add a gap about their approval workflow")
      </div>

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
                  <GapCard
                    key={gap.id}
                    gap={gap}
                    isExpanded={expandedGaps.has(gap.id)}
                    onToggle={() => toggleGap(gap.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {resolvedBusinessGaps.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 text-gray-700">Resolved ({resolvedBusinessGaps.length})</h3>
              <div className="space-y-3">
                {resolvedBusinessGaps.map(gap => (
                  <GapCard
                    key={gap.id}
                    gap={gap}
                    isExpanded={false}
                    onToggle={() => {}}
                  />
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

          {/* MEDDICC Quick Status Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-gray-50 rounded-lg">
            {meddiccStatus.map(item => (
              <div
                key={item.id}
                className={`flex items-center gap-2 p-2 rounded ${
                  item.status ? 'bg-green-50' : 'bg-white'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  item.status ? 'bg-green-500' : 'bg-gray-300'
                }`}></span>
                <div className="min-w-0">
                  <div className={`text-xs font-medium truncate ${
                    item.status ? 'text-green-700' : 'text-gray-600'
                  }`}>
                    {item.label}
                  </div>
                  <div className="text-xs text-gray-500">{item.detail}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Gaps organized by MEDDICC category */}
          <div className="space-y-3">
            {meddiccCategories.map(cat => (
              <MeddiccCategorySection
                key={cat.id}
                category={cat}
                gaps={gapsByMeddicc[cat.id]}
                expandedGaps={expandedGaps}
                onToggleGap={toggleGap}
              />
            ))}

            {/* Uncategorized sales gaps */}
            {uncategorizedSalesGaps.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="p-3 bg-gray-50">
                  <span className="font-medium">Other Sales Gaps</span>
                </div>
                <div className="p-3 space-y-2 bg-white">
                  {uncategorizedSalesGaps.map(gap => (
                    <GapCard
                      key={gap.id}
                      gap={gap}
                      isExpanded={expandedGaps.has(gap.id)}
                      onToggle={() => toggleGap(gap.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

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
