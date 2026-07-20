import { useState, useEffect } from 'react'
import AppShell from '../../components/layout/AppShell'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { ROLES, ROLE_LABELS, REP_TYPES, REP_TYPE_LABELS, isAdmin } from '../../lib/roles'

// Admin-only: assign roles (rep / manager / admin) and rep type (AE / SDR) across the team.
// Reps who haven't logged in yet appear (from Gong) but can't be edited until they have a profile.
export default function UsersAdmin() {
  const [me, setMe] = useState(null)
  const [users, setUsers] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState(null)

  const loadUsers = () => fetch('/api/users').then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => setUsers([]))
  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => setMe(d.profile || null)).catch(() => setMe(null))
    loadUsers()
  }, [])

  const admin = isAdmin(me)

  const patch = async (u, changes) => {
    setSavingId(u.id); setError(null)
    setUsers(list => list.map(x => x.id === u.id ? { ...x, ...changes } : x)) // optimistic
    try {
      const res = await fetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, ...changes }) })
      const j = await res.json()
      if (!res.ok || j.ok === false) throw new Error(j.error || 'Save failed')
    } catch (e) { setError(e.message); loadUsers() }
    finally { setSavingId(null) }
  }

  return (
    <AppShell title="Users & Roles" subtitle="Assign roles and rep type across the team">
      <div className="max-w-4xl mx-auto px-6 py-6">
        {me && !admin ? (
          <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-800">Admins only</p>
            <p className="text-sm text-gray-500 mt-1">Ask an admin to change roles. You can set your own rep type in Settings.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-2 border-b border-red-100">{error}</div>}
            {!users ? (
              <div className="p-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                      <th className="text-left font-semibold px-4 py-2.5">Name</th>
                      <th className="text-left font-semibold px-4 py-2.5">Role</th>
                      <th className="text-left font-semibold px-4 py-2.5">Type</th>
                      <th className="text-left font-semibold px-4 py-2.5">Last active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {users.map(u => (
                      <tr key={u.id || u.email} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-800">{u.full_name || u.email}</div>
                          <div className="text-xs text-gray-400">{u.email}{!u.id && ' · not signed in yet'}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          {u.id ? (
                            <select value={u.role || 'rep'} disabled={savingId === u.id} onChange={e => patch(u, { role: e.target.value })}
                              className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white disabled:opacity-50">
                              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                            </select>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {u.id ? (
                            <select value={u.rep_type || ''} disabled={savingId === u.id} onChange={e => patch(u, { rep_type: e.target.value || null })}
                              className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white disabled:opacity-50">
                              <option value="">—</option>
                              {REP_TYPES.map(t => <option key={t} value={t}>{REP_TYPE_LABELS[t]}</option>)}
                            </select>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs">{u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
