import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft, Save, CheckCircle2 } from 'lucide-react'
import { getUserSettings, saveUserSettings } from '../../lib/userSettings'

export default function SettingsPage() {
  const router = useRouter()
  const [emailSignature, setEmailSignature] = useState('')
  const [autoAppend, setAutoAppend] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Slack settings
  const [slackUserId, setSlackUserId] = useState('')
  const [slackSaving, setSlackSaving] = useState(false)
  const [slackSaved, setSlackSaved] = useState(false)

  // Load settings on mount
  useEffect(() => {
    const settings = getUserSettings()
    setEmailSignature(settings.emailSignature || '')
    setAutoAppend(settings.emailPreferences?.autoAppendSignature !== false)
    // Load Slack user ID from profile
    fetch('/api/me')
      .then(r => r.json())
      .then(d => { if (d.profile?.slack_user_id) setSlackUserId(d.profile.slack_user_id) })
      .catch(() => {})
  }, [])

  const handleSlackSave = async () => {
    setSlackSaving(true)
    try {
      await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slack_user_id: slackUserId.trim() || null }),
      })
      setSlackSaved(true)
      setTimeout(() => setSlackSaved(false), 3000)
    } catch {}
    finally { setSlackSaving(false) }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveSuccess(false)

    try {
      const success = saveUserSettings({
        emailSignature,
        emailPreferences: {
          autoAppendSignature: autoAppend,
        },
      })

      if (success) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/modules')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="text-sm text-gray-600">Manage your preferences and email settings</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-6">Email Settings</h2>

          {/* Email Signature */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Signature
            </label>
            <p className="text-sm text-gray-600 mb-3">
              This signature will be automatically added to all generated follow-up emails
            </p>
            <textarea
              value={emailSignature}
              onChange={(e) => setEmailSignature(e.target.value)}
              placeholder="Best regards,&#10;James Lindberg&#10;Account Executive&#10;Banner&#10;james@withbanner.com&#10;(555) 123-4567"
              rows={8}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-2">
              {emailSignature.length} / 5000 characters
            </p>
          </div>

          {/* Auto-append Toggle */}
          <div className="mb-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoAppend}
                onChange={(e) => setAutoAppend(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <div>
                <div className="text-sm font-medium text-gray-700">
                  Automatically append signature to emails
                </div>
                <div className="text-xs text-gray-500">
                  Signature will be added when you click "Send to Gmail"
                </div>
              </div>
            </label>
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : saveSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Settings
                </>
              )}
            </button>

            {saveSuccess && (
              <span className="text-sm text-green-600 font-medium">
                Settings saved successfully
              </span>
            )}
          </div>

          {/* Preview Section */}
          {emailSignature && (
            <div className="mt-8 pt-6 border-t">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Preview</h3>
              <div className="bg-gray-50 rounded-lg p-4 border">
                <div className="text-sm text-gray-600 mb-4">
                  [Email content will appear here]
                </div>
                <div className="text-sm text-gray-800 whitespace-pre-line border-t pt-4">
                  {emailSignature}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Slack Settings */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mt-6">
          <h2 className="text-lg font-semibold mb-2">Slack</h2>
          <p className="text-sm text-gray-600 mb-6">
            Connect your Slack account to receive your daily task digest as a direct message.
          </p>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Slack Member ID
            </label>
            <p className="text-sm text-gray-500 mb-2">
              Find it in Slack: click your profile photo → 3 dots (•••) → <strong>Copy member ID</strong>. Looks like <code className="bg-gray-100 px-1 rounded">U01234ABCDE</code>.
            </p>
            <input
              type="text"
              value={slackUserId}
              onChange={e => setSlackUserId(e.target.value)}
              placeholder="U01234ABCDE"
              className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSlackSave}
              disabled={slackSaving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {slackSaving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : slackSaved ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {slackSaved ? 'Saved!' : 'Save Slack ID'}
            </button>
            {slackSaved && <span className="text-sm text-green-600 font-medium">Daily digests will now DM you directly.</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
