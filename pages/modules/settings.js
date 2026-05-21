import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft, Save, CheckCircle2, ShieldCheck, UserPlus, Mail } from 'lucide-react'
import { getUserSettings, saveUserSettings } from '../../lib/userSettings'

const ROLE_OPTIONS = [
  { value: 'ae', label: 'AE' },
  { value: 'sdr', label: 'SDR' },
  { value: 'manager', label: 'Manager' },
]

export default function SettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const isAdmin = profile?.role === 'admin'

  // Email sig
  const [emailSignature, setEmailSignature] = useState('')
  const [autoAppend, setAutoAppend] = useState(true)
  const [sigSaving, setSigSaving] = useState(false)
  const [sigSaved, setSigSaved] = useState(false)

  // Slack
  const [slackUserId, setSlackUserId] = useState('')
  const [slackSaving, setSlackSaving] = useState(false)
  const [slackSaved, setSlackSaved] = useState(false)

  // Team (admin only)
  const [teamMembers, setTeamMembers] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('ae')
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteResult, setInviteResult] = useState(null)

  useEffect(() => {
    const settings = getUserSettings()
    setEmailSignature(settings.emailSignature || '')
    setAutoAppend(settings.emailPreferences?.autoAppendSignature !== false)

    fetch('/api/me')
      .then(r => r.json())
      .then(d => {
        if (d.profile) setProfile(d.profile)
        if (d.profile?.slack_user_id) setSlackUserId(d.profile.slack_user_id)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/users')
      .then(r => r.json())
      .then(d => setTeamMembers(d.users || d || []))
      .catch(() => {})
  }, [isAdmin])

  const handleSigSave = async () => {
    setSigSaving(true)
    saveUserSettings({ emailSignature, emailPreferences: { autoAppendSignature: autoAppend } })
    setSigSaved(true)
    setTimeout(() => setSigSaved(false), 3000)
    setSigSaving(false)
  }

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

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviteSending(true)
    setInviteResult(null)
    try {
      const r = await fetch('/api/admin/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const d = await r.json()
      if (r.ok) {
        setInviteResult({ ok: true, msg: `Invite sent to ${inviteEmail}` })
        setInviteEmail('')
      } else {
        setInviteResult({ ok: false, msg: d.error || 'Invite failed' })
      }
    } catch (e) {
      setInviteResult({ ok: false, msg: e.message })
    } finally {
      setInviteSending(false)
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    try {
      await fetch('/api/admin/update-user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, rep_type: newRole }),
      })
      setTeamMembers(prev => prev.map(u => u.id === userId ? { ...u, rep_type: newRole } : u))
    } catch {}
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => router.push('/modules')} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </button>
          <h1 className="text-base font-semibold text-gray-900">Settings</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">

        {/* ── Email Signature ── */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Email Signature</h2>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoAppend}
                  onChange={e => setAutoAppend(e.target.checked)}
                  className="w-3.5 h-3.5 rounded"
                />
                Auto-append to emails
              </label>
              <button
                onClick={handleSigSave}
                disabled={sigSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {sigSaved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                {sigSaved ? 'Saved' : 'Save'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <textarea
              value={emailSignature}
              onChange={e => setEmailSignature(e.target.value)}
              placeholder={'Best regards,\nJames Lindberg\nBanner\njames@withbanner.com'}
              rows={5}
              className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
            <div className="bg-gray-50 rounded-lg border px-3 py-2 text-sm text-gray-500 min-h-[100px]">
              {emailSignature
                ? <span className="text-gray-800 whitespace-pre-line">{emailSignature}</span>
                : <span className="text-gray-400 text-xs">Preview will appear here</span>
              }
            </div>
          </div>
        </div>

        {/* ── Slack ── */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">Slack Member ID</h2>
              <p className="text-xs text-gray-500 mb-3">
                In Slack: click your profile photo → ••• → <strong>Copy member ID</strong>. Looks like <code className="bg-gray-100 px-1 rounded">U01234ABCDE</code>
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={slackUserId}
                  onChange={e => setSlackUserId(e.target.value)}
                  placeholder="U01234ABCDE"
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                />
                <button
                  onClick={handleSlackSave}
                  disabled={slackSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {slackSaved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                  {slackSaved ? 'Saved' : 'Save'}
                </button>
                {slackSaved && <span className="text-xs text-green-600">Daily digests will DM you.</span>}
              </div>
            </div>
          </div>
        </div>

        {/* ── Data Quality ── */}
        <div className="bg-white rounded-xl border p-5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Data Quality</h2>
            <p className="text-xs text-gray-500 mt-0.5">Unmatched calls, duplicate accounts, missing HubSpot links</p>
          </div>
          <button
            onClick={() => router.push('/modules/data-quality')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-700 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Open Queue
          </button>
        </div>

        {/* ── Team Management (admin only) ── */}
        {isAdmin && (
          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Team</h2>

            {/* Invite */}
            <div className="flex items-end gap-2 mb-5 pb-5 border-b border-gray-100">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleInvite()}
                  placeholder="name@withbanner.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ROLE_OPTIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleInvite}
                disabled={inviteSending || !inviteEmail.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                <Mail className="w-3.5 h-3.5" />
                {inviteSending ? 'Sending…' : 'Send invite'}
              </button>
            </div>
            {inviteResult && (
              <p className={`text-xs mb-4 ${inviteResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                {inviteResult.msg}
              </p>
            )}

            {/* User list */}
            {teamMembers.length > 0 && (
              <div className="space-y-2">
                {teamMembers.map(u => (
                  <div key={u.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{u.full_name || u.name || '—'}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{u.role}</span>
                      <select
                        value={u.rep_type || ''}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700"
                      >
                        <option value="">— type —</option>
                        {ROLE_OPTIONS.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
