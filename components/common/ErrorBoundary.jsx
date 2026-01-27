import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Error Boundary component that catches JavaScript errors in child components
 * and displays a fallback UI instead of crashing the whole app.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Could send to error reporting service here
    // e.g., Sentry.captureException(error, { extra: errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className={`flex flex-col items-center justify-center p-6 ${this.props.className || ''}`}>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md w-full text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              {this.props.title || 'Something went wrong'}
            </h3>
            <p className="text-sm text-red-600 mb-4">
              {this.props.message || 'An error occurred while loading this section.'}
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left mb-4">
                <summary className="text-xs text-red-500 cursor-pointer hover:text-red-700">
                  Technical details
                </summary>
                <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-auto max-h-32">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Lightweight error boundary for individual components/sections
 */
export const SectionErrorBoundary = ({ children, name }) => (
  <ErrorBoundary
    title={`Error in ${name || 'this section'}`}
    message="This section encountered an error. Other parts of the app should still work."
    className="min-h-[200px]"
  >
    {children}
  </ErrorBoundary>
);

/**
 * Error boundary specifically for API-driven components
 */
export const ApiErrorBoundary = ({ children }) => (
  <ErrorBoundary
    title="Data Loading Error"
    message="Failed to load data. Please check your connection and try again."
    className="min-h-[150px]"
  >
    {children}
  </ErrorBoundary>
);

export default ErrorBoundary;
