import { useState } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react';
import { ErrorDetails } from './ErrorBoundary';

let _errorCounter = 0;
function nextErrorId() {
  _errorCounter++;
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `ERR-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${_errorCounter}`;
}

// Drop-in component for API call failure states.
// Usage:
//   const [apiErr, setApiErr] = useState(null)
//   ...catch { setApiErr({ message: e.message, source: 'my-api-call' }) }
//   {apiErr && <ApiError error={apiErr} onRetry={load} />}
export default function ApiError({ error, onRetry, compact = false }) {
  const [errorId] = useState(() => nextErrorId());

  if (!error) return null;

  const message = typeof error === 'string' ? error : error?.message || error?.error || 'Request failed';
  const source = error?.source || error?.endpoint || null;
  const status = error?.status || null;

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
        <AlertTriangle size={14} className="shrink-0" />
        <span className="flex-1">{message}</span>
        {status && <span className="text-xs text-red-400 font-mono">HTTP {status}</span>}
        {onRetry && (
          <button onClick={onRetry} className="text-xs underline text-red-600 hover:text-red-800 shrink-0">
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-white p-5 w-full">
      <div className="flex items-start gap-3 mb-3">
        <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold text-gray-900 text-sm">
            {status ? `Error ${status}` : 'Something went wrong'}
          </div>
          <div className="text-sm text-gray-500 mt-0.5">
            {message}
          </div>
          <p className="text-xs text-gray-400 mt-1">Take a screenshot and send to James.</p>
        </div>
      </div>

      <ErrorDetails
        errorId={errorId}
        message={`${status ? `HTTP ${status}: ` : ''}${message}`}
        source={source}
      />

      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
        >
          <RefreshCw size={14} />
          Try again
        </button>
      )}
    </div>
  );
}
