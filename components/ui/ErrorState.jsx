import { AlertTriangle, RefreshCw } from 'lucide-react';

// Standard error state with retry (PLATFORM_REVIEW §3.9). Distinct from EmptyState — this one
// legitimately uses the warning treatment; neutral prompts must NOT.
export default function ErrorState({ message = 'Something went wrong.', onRetry, className = '' }) {
  return (
    <div className={`bg-danger/5 border border-danger/20 rounded-card p-4 flex items-center justify-between gap-3 ${className}`}>
      <div className="flex items-center gap-2 text-sm text-danger">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>{message}</span>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="text-xs flex items-center gap-1 px-2.5 py-1.5 border border-hairline bg-white rounded-lg text-ink hover:bg-slate-50 shrink-0">
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      )}
    </div>
  );
}
