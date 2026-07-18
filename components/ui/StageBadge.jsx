import { stageBadgeClass, stageLabel } from '../../lib/constants';

// The one stage badge — every surface renders stages identically (PLATFORM_REVIEW §5.4).
export default function StageBadge({ stage, className = '' }) {
  return (
    <span className={`inline-block text-xs font-medium rounded px-1.5 py-0.5 ${stageBadgeClass(stage)} ${className}`}>
      {stageLabel(stage)}
    </span>
  );
}
