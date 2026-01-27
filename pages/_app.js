import '../styles/globals.css'
import ErrorBoundary from '../components/common/ErrorBoundary'

export default function App({ Component, pageProps }) {
  return (
    <ErrorBoundary
      title="Application Error"
      message="The application encountered an unexpected error. Please refresh the page to try again."
    >
      <Component {...pageProps} />
    </ErrorBoundary>
  )
}
