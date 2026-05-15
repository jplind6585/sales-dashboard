import { Component, useState } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react';

function parseBrowser(ua) {
  if (!ua) return 'Unknown';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome/')) return 'Chrome';
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari';
  return 'Other';
}

function parseOS(ua) {
  if (!ua) return 'Unknown';
  if (ua.includes('Mac OS X')) return 'macOS';
  if (ua.includes('Windows NT')) return 'Windows';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  if (ua.includes('Android')) return 'Android';
  return 'Other';
}

function ErrorId() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `ERR-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export function ErrorDetails({ errorId, message, stack, source }) {
  const [copied, setCopied] = useState(false);

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const url = typeof window !== 'undefined' ? window.location.pathname : '';
  const ts = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  const browser = `${parseBrowser(ua)} on ${parseOS(ua)}`;

  const report = [
    `Error ID: ${errorId}`,
    `Time: ${ts}`,
    `Page: ${url}`,
    `Browser: ${browser}`,
    source ? `Source: ${source}` : null,
    ``,
    `Error: ${message || 'Unknown error'}`,
    stack ? `\nStack:\n${stack}` : null,
  ].filter(Boolean).join('\n');

  const copy = () => {
    navigator.clipboard?.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 text-left overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-red-100 border-b border-red-200">
        <span className="text-xs font-mono font-semibold text-red-700">{errorId}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800 font-medium transition-colors"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy report'}
        </button>
      </div>
      <div className="px-4 py-3 space-y-1 text-xs font-mono text-red-800">
        <div><span className="text-red-500">time</span>    {ts}</div>
        <div><span className="text-red-500">page</span>    {url}</div>
        <div><span className="text-red-500">browser</span> {browser}</div>
        {source && <div><span className="text-red-500">source</span>  {source}</div>}
        {message && (
          <div className="pt-1 border-t border-red-200 mt-2">
            <span className="text-red-500">error</span>{'   '}{message}
          </div>
        )}
      </div>
      {stack && (
        <details className="border-t border-red-200">
          <summary className="px-4 py-2 text-xs text-red-500 cursor-pointer hover:bg-red-100 select-none">
            Stack trace (click to expand)
          </summary>
          <pre className="px-4 py-3 text-xs text-red-700 overflow-auto max-h-40 whitespace-pre-wrap bg-red-50">
            {stack}
          </pre>
        </details>
      )}
    </div>
  );
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, errorId: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error, errorId: ErrorId() };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, errorId: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const { error, errorInfo, errorId } = this.state;
      const isFullPage = this.props.fullPage !== false;

      return (
        <div className={`flex flex-col items-center justify-center p-8 ${isFullPage ? 'min-h-screen bg-gray-50' : ''} ${this.props.className || ''}`}>
          <div className="bg-white border border-red-200 rounded-xl shadow-sm p-6 w-full max-w-lg">
            <div className="flex items-start gap-3 mb-1">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  {this.props.title || 'Something went wrong'}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {this.props.message || 'Take a screenshot of this page and send it to James.'}
                </p>
              </div>
            </div>

            <ErrorDetails
              errorId={errorId || 'ERR-UNKNOWN'}
              message={error?.message || error?.toString()}
              stack={errorInfo?.componentStack}
              source={this.props.source}
            />

            <button
              onClick={this.handleRetry}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const SectionErrorBoundary = ({ children, name }) => (
  <ErrorBoundary
    title={`Error in ${name || 'this section'}`}
    message="Take a screenshot and send to James."
    source={name}
    fullPage={false}
    className="min-h-[200px]"
  >
    {children}
  </ErrorBoundary>
);

export const ApiErrorBoundary = ({ children, name }) => (
  <ErrorBoundary
    title="Failed to load data"
    message="Take a screenshot and send to James."
    source={name || 'API'}
    fullPage={false}
    className="min-h-[150px]"
  >
    {children}
  </ErrorBoundary>
);

export default ErrorBoundary;
