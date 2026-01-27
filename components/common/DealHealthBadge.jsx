import { calculateDealHealth, getHealthScoreColor, getHealthScoreBg } from '../../lib/constants';

const DealHealthBadge = ({ account, size = 'md' }) => {
  const score = calculateDealHealth(account);
  const colorClass = getHealthScoreColor(score);
  const bgClass = getHealthScoreBg(score);

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-lg',
    lg: 'w-16 h-16 text-2xl',
  };

  return (
    <div
      className={`${sizeClasses[size]} ${bgClass} rounded-full flex items-center justify-center font-bold ${colorClass}`}
      title={`Deal Health: ${score}/100`}
    >
      {score}
    </div>
  );
};

export const DealHealthBar = ({ account }) => {
  const score = calculateDealHealth(account);
  const colorClass = getHealthScoreColor(score);

  const getBarColor = (score) => {
    if (score >= 70) return 'bg-green-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-700">Deal Health</span>
        <span className={`text-sm font-bold ${colorClass}`}>{score}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${getBarColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
};

export const DealHealthDetail = ({ account }) => {
  const stakeholders = account?.stakeholders || [];
  const hasChampion = stakeholders.some(s => s.role === 'Champion');
  const hasEB = stakeholders.some(s => s.role === 'Economic Buyer');
  const gaps = account?.informationGaps || [];
  const resolvedGaps = gaps.filter(g => g.status === 'resolved').length;
  const totalGaps = gaps.length;
  const metrics = account?.metrics || {};
  const capturedMetrics = Object.values(metrics).filter(m => m?.value != null).length;

  const lastTranscript = account?.transcripts?.[account.transcripts.length - 1];
  const daysSinceActivity = lastTranscript
    ? Math.floor((Date.now() - new Date(lastTranscript.addedAt)) / (1000 * 60 * 60 * 24))
    : null;

  const factors = [
    {
      label: 'Champion',
      status: hasChampion,
      detail: hasChampion ? 'Identified' : 'Not identified',
    },
    {
      label: 'Economic Buyer',
      status: hasEB,
      detail: hasEB ? 'Identified' : 'Not identified',
    },
    {
      label: 'Gaps Resolved',
      status: totalGaps > 0 ? resolvedGaps / totalGaps >= 0.5 : null,
      detail: totalGaps > 0 ? `${resolvedGaps}/${totalGaps}` : 'None tracked',
    },
    {
      label: 'Key Metrics',
      status: capturedMetrics >= 3,
      detail: `${capturedMetrics} captured`,
    },
    {
      label: 'Recent Activity',
      status: daysSinceActivity !== null ? daysSinceActivity <= 14 : false,
      detail: daysSinceActivity !== null ? `${daysSinceActivity} days ago` : 'No calls',
    },
  ];

  return (
    <div className="space-y-2">
      {factors.map((factor, i) => (
        <div key={i} className="flex items-center justify-between text-sm">
          <span className="text-gray-600">{factor.label}</span>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">{factor.detail}</span>
            <span
              className={`w-2 h-2 rounded-full ${
                factor.status === true
                  ? 'bg-green-500'
                  : factor.status === false
                  ? 'bg-red-500'
                  : 'bg-gray-300'
              }`}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default DealHealthBadge;
