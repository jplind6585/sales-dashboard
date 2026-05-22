import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft, RefreshCw, Upload, CheckCircle, AlertCircle } from 'lucide-react'
import UserMenu from '../../../components/auth/UserMenu'
import { useAuthStore } from '../../../stores/useAuthStore'
import ModulesNav from '../../../components/layout/ModulesNav'

const PERIODS = [
  { label: '7 days', value: '7' },
  { label: '30 days', value: '30' },
  { label: '90 days', value: '90' },
]

function parseCSV(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
  if (!lines.length) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const row = {}
    headers.forEach((h, i) => { row[h] = values[i] || '' })
    return row
  })
}

function findColumn(row, candidates) {
  for (const key of candidates) {
    const match = Object.keys(row).find(k => k.toLowerCase().includes(key.toLowerCase()))
    if (match) return row[match]
  }
  return null
}

export default function ActivityLeaderboard() {
  const router = useRouter()
  const profile = useAuthStore(s => s.profile)
  const isAdmin = profile?.role === 'manager'
  const [period, setPeriod] = useState('30')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [weekOf, setWeekOf] = useState(new Date().toISOString().split('T')[0])
  const fileRef = useRef(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/activity-leaderboard?days=${period}`)
      const json = await res.json()
      setData(json)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [period])

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadResult(null)

    try {
      const text = await file.text()
      const rows = parseCSV(text)

      if (!rows.length) {
        setUploadResult({ error: 'No data found in CSV' })
        return
      }

      // Normalize rows to expected shape
      const normalized = rows.map(r => ({
        rep_name: findColumn(r, ['rep', 'name', 'agent', 'user']),
        total_calls: parseInt(findColumn(r, ['total', 'calls', 'dials']) || 0, 10),
        connected_calls: parseInt(findColumn(r, ['connect', 'answered', 'picked']) || 0, 10),
      })).filter(r => r.rep_name)

      const res = await fetch('/api/activity-leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: normalized, weekOf }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Upload failed')
      setUploadResult({ success: true, count: json.inserted })
      load()
    } catch (err) {
      setUploadResult({ error: err.message })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const { leaderboard = [], hasOremData, latestOremUpload } = data || {}

  const maxGong = Math.max(...leaderboard.map(r => r.gongCalls), 1)
  const maxOrem = Math.max(...leaderboard.map(r => r.oremTotalCalls), 1)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <ModulesNav router={router} />
            <div>
              <h1 className="text-base font-semibold text-gray-900">Activity Leaderboard</h1>
              <p className="text-xs text-gray-400">Gong + Orem call activity per rep</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {PERIODS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${period === p.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button onClick={load} disabled={loading} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <UserMenu profile={profile} />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Admin CSV upload */}
        {isAdmin && (
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Upload Orem Report</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Upload the weekly CSV from Orem's admin panel. Expected columns: Rep/Name, Total Calls, Connected/Answers.
                  {latestOremUpload && ` Last upload: ${new Date(latestOremUpload).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Week of</label>
                  <input
                    type="date"
                    value={weekOf}
                    onChange={e => setWeekOf(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">CSV file</label>
                  <label className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg cursor-pointer transition-colors ${uploading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                    <Upload className="w-4 h-4" />
                    {uploading ? 'Uploading…' : 'Choose CSV'}
                    <input ref={fileRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" disabled={uploading} />
                  </label>
                </div>
              </div>
            </div>
            {uploadResult && (
              <div className={`mt-3 flex items-center gap-2 text-sm ${uploadResult.error ? 'text-red-600' : 'text-green-600'}`}>
                {uploadResult.error ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                {uploadResult.error ? uploadResult.error : `Uploaded ${uploadResult.count} rep records for week of ${weekOf}`}
              </div>
            )}
          </div>
        )}

        {loading && !data && (
          <div className="text-center py-16 text-sm text-gray-400">Loading leaderboard…</div>
        )}

        {leaderboard.length > 0 && (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rep</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Gong Calls</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Avg Length</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Next-Step %</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Discovery</th>
                  {hasOremData && <>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Orem Dials</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Connect %</th>
                  </>}
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((rep, i) => (
                  <tr key={rep.email} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-400 font-medium">{i + 1}</td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900">{rep.name}</div>
                      {rep.repType && <div className="text-xs text-gray-400 uppercase">{rep.repType}</div>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(rep.gongCalls / maxGong) * 100}%` }} />
                        </div>
                        <span className="font-medium text-gray-800">{rep.gongCalls}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-600">{rep.avgCallMinutes > 0 ? `${rep.avgCallMinutes}m` : '—'}</td>
                    <td className="px-3 py-3">
                      <span className={`font-medium ${rep.nextStepRate >= 70 ? 'text-green-600' : rep.nextStepRate >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                        {rep.gongCalls > 0 ? `${rep.nextStepRate}%` : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`font-medium ${rep.avgDiscoveryScore >= 7 ? 'text-green-600' : rep.avgDiscoveryScore >= 5 ? 'text-amber-600' : 'text-red-500'}`}>
                        {rep.avgDiscoveryScore != null ? `${rep.avgDiscoveryScore}/10` : '—'}
                      </span>
                    </td>
                    {hasOremData && <>
                      <td className="px-3 py-3">
                        {rep.oremTotalCalls > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-purple-400 rounded-full" style={{ width: `${(rep.oremTotalCalls / maxOrem) * 100}%` }} />
                            </div>
                            <span className="text-gray-700">{rep.oremTotalCalls}</span>
                          </div>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        {rep.oremConnectRate != null ? (
                          <span className={`font-medium ${rep.oremConnectRate >= 20 ? 'text-green-600' : rep.oremConnectRate >= 10 ? 'text-amber-600' : 'text-red-500'}`}>
                            {rep.oremConnectRate}%
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    </>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && leaderboard.length === 0 && (
          <div className="text-center py-16 text-sm text-gray-400">
            No activity data for this period. Gong calls are pulled from analyzed calls. Upload an Orem CSV to add phone activity.
          </div>
        )}
      </main>
    </div>
  )
}
