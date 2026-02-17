import { useState, useEffect } from 'react'
import { Upload, X, AlertCircle, CheckCircle2 } from 'lucide-react'
import {
  needsMigration,
  getMigrationSummary,
  migrateToSupabase,
  clearLocalStorage,
  markMigrationComplete,
  skipMigration,
  isMigrationComplete
} from '../../lib/migrateLocalStorage'
import { useAuthStore } from '../../stores/useAuthStore'
import { useAccountStore } from '../../stores/useAccountStore'

export default function MigrationPrompt() {
  const { user } = useAuthStore()
  const store = useAccountStore()
  const [showPrompt, setShowPrompt] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, stage: '' })
  const [result, setResult] = useState(null)
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    // Check if migration is needed
    if (user && needsMigration() && !isMigrationComplete()) {
      setSummary(getMigrationSummary())
      setShowPrompt(true)
    }
  }, [user])

  const handleMigrate = async () => {
    setIsMigrating(true)
    setProgress({ current: 0, total: summary?.totalItems || 0, stage: 'starting' })

    const { success, error, migrated } = await migrateToSupabase(user.id, (prog) => {
      setProgress(prog)
    })

    setResult({ success, error, migrated })
    setIsMigrating(false)

    if (success) {
      // Clear localStorage and mark complete
      clearLocalStorage()
      markMigrationComplete()

      // Refresh accounts from Supabase
      await store.fetchAccounts(user.id)
    }
  }

  const handleSkip = () => {
    skipMigration()
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
  }

  if (!showPrompt) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        {!result ? (
          <>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Upload className="h-6 w-6 text-blue-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Migrate Your Data</h2>
              </div>
              {!isMigrating && (
                <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            <p className="text-gray-600 mb-4">
              We found existing data saved in your browser. Would you like to migrate it to your account for secure cloud storage?
            </p>

            {summary && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Data to migrate:</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>{summary.accountCount} account{summary.accountCount !== 1 ? 's' : ''}</li>
                  <li>{summary.transcriptCount} transcript{summary.transcriptCount !== 1 ? 's' : ''}</li>
                  <li>{summary.stakeholderCount} stakeholder{summary.stakeholderCount !== 1 ? 's' : ''}</li>
                  <li>{summary.gapCount} information gap{summary.gapCount !== 1 ? 's' : ''}</li>
                  <li>{summary.noteCount} note{summary.noteCount !== 1 ? 's' : ''}</li>
                </ul>
              </div>
            )}

            {isMigrating ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm text-gray-600">
                    Migrating {progress.stage}... ({progress.current}/{progress.total})
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={handleMigrate}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Migrate Data
                </button>
                <button
                  onClick={handleSkip}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Skip
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {result.success ? (
                  <>
                    <div className="p-2 bg-green-100 rounded-lg">
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900">Migration Complete</h2>
                  </>
                ) : (
                  <>
                    <div className="p-2 bg-red-100 rounded-lg">
                      <AlertCircle className="h-6 w-6 text-red-600" />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900">Migration Failed</h2>
                  </>
                )}
              </div>
            </div>

            {result.success ? (
              <>
                <p className="text-gray-600 mb-4">
                  Your data has been successfully migrated to your account.
                </p>
                <div className="bg-green-50 rounded-lg p-4 mb-4">
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>{result.migrated.accounts} account{result.migrated.accounts !== 1 ? 's' : ''} migrated</li>
                    <li>{result.migrated.transcripts} transcript{result.migrated.transcripts !== 1 ? 's' : ''} migrated</li>
                    <li>{result.migrated.stakeholders} stakeholder{result.migrated.stakeholders !== 1 ? 's' : ''} migrated</li>
                    <li>{result.migrated.gaps} information gap{result.migrated.gaps !== 1 ? 's' : ''} migrated</li>
                    <li>{result.migrated.notes} note{result.migrated.notes !== 1 ? 's' : ''} migrated</li>
                  </ul>
                </div>
              </>
            ) : (
              <p className="text-red-600 mb-4">
                {result.error || 'An error occurred during migration.'}
              </p>
            )}

            {result.migrated?.errors?.length > 0 && (
              <div className="bg-yellow-50 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-medium text-yellow-700 mb-2">Some items could not be migrated:</h3>
                <ul className="text-xs text-yellow-600 space-y-1 max-h-32 overflow-y-auto">
                  {result.migrated.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {result.migrated.errors.length > 5 && (
                    <li>...and {result.migrated.errors.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}

            <button
              onClick={handleDismiss}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  )
}
