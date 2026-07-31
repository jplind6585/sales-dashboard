import { useState } from 'react'
import { useRouter } from 'next/router'
import { Search, Loader2, Sparkles, Plus, Linkedin, Check, Target, Users } from 'lucide-react'
import AppShell from '../../components/layout/AppShell'
import EmptyState from '../../components/ui/EmptyState'
import PursuitPage from './pursuit'

// Combined SDR home: "Named Accounts" (the pursuit tracker) + "Find New" (Apollo search). Merges the
// former Account Pursuit + Prospecting modules into one nav entry.
export default function Prospecting() {
  const router = useRouter()
  const [tab, setTab] = useState('named') // 'named' | 'find'

  // Find New (Apollo) state
  const [titles, setTitles] = useState('')
  const [domains, setDomains] = useState('')
  const [keywords, setKeywords] = useState('')
  const [people, setPeople] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [enriched, setEnriched] = useState({}) // id -> person
  const [busy, setBusy] = useState({}) // id -> 'enrich'|'import'
  const [added, setAdded] = useState({})

  const search = async () => {
    setLoading(true); setError(null); setPeople(null); setEnriched({}); setAdded({})
    try {
      const res = await fetch('/api/apollo/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titles: titles.split(',').map(s => s.trim()).filter(Boolean), domains: domains.split(',').map(s => s.trim()).filter(Boolean), keywords: keywords.trim() || undefined }),
      })
      const j = await res.json()
      if (!res.ok || j.success === false) throw new Error(j.error || 'Search failed')
      setPeople(j.people || [])
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  const reveal = async (p) => {
    setBusy(b => ({ ...b, [p.id]: 'enrich' }))
    try {
      const res = await fetch('/api/apollo/enrich', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: p.firstName, lastName: p.lastName, organizationName: p.org, domain: p.domain, linkedinUrl: p.linkedin }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Enrich failed')
      setEnriched(e => ({ ...e, [p.id]: j.matched ? j.person : { notFound: true } }))
    } catch (e) { setError(e.message) } finally { setBusy(b => ({ ...b, [p.id]: null })) }
  }

  const addToPipeline = async (p) => {
    setBusy(b => ({ ...b, [p.id]: 'import' }))
    try {
      const en = enriched[p.id] || {}
      const res = await fetch('/api/apollo/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: p.org, contactName: p.name, title: p.title, email: en.email || null, linkedin: p.linkedin }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Import failed')
      setAdded(a => ({ ...a, [p.id]: j.accountId }))
    } catch (e) { setError(e.message) } finally { setBusy(b => ({ ...b, [p.id]: null })) }
  }

  const TabBtn = ({ id, icon: Icon, label }) => (
    <button onClick={() => setTab(id)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  )

  return (
    <AppShell title="Prospecting" subtitle="Track named accounts and find new contacts">
      <div className="max-w-7xl mx-auto px-6 pt-4">
        <div className="inline-flex bg-gray-100 rounded-lg p-1">
          <TabBtn id="named" icon={Target} label="Named Accounts" />
          <TabBtn id="find" icon={Users} label="Find New" />
        </div>
      </div>

      {tab === 'named' ? (
        <PursuitPage embedded />
      ) : (
        <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
          <p className="text-xs text-slate-500">Search Apollo, review, reveal a contact, add to pipeline — nothing is auto-sent.</p>
          <div className="bg-white rounded-card border border-hairline p-4 space-y-3">
            <div className="grid sm:grid-cols-3 gap-2">
              <input value={titles} onChange={e => setTitles(e.target.value)} placeholder="Titles (VP Construction, Head of CapEx)" className="text-sm border border-hairline rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-coral-200" />
              <input value={domains} onChange={e => setDomains(e.target.value)} placeholder="Company domains (greystar.com)" className="text-sm border border-hairline rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-coral-200" />
              <input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="Keywords (multifamily)" className="text-sm border border-hairline rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-coral-200" />
            </div>
            <button onClick={search} disabled={loading} className="text-sm flex items-center gap-1.5 px-4 py-2 bg-coral-600 text-white rounded-lg hover:bg-coral-700 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search Apollo
            </button>
          </div>

          {error && <div className="bg-danger/5 border border-danger/20 text-danger rounded-lg p-3 text-sm">{error}</div>}

          {people && !people.length && !loading && <EmptyState icon={Search} title="No matches" subtitle="Try broader titles or a different domain." />}

          {people && people.length > 0 && (
            <div className="space-y-2">
              {people.map(p => {
                const en = enriched[p.id]
                return (
                  <div key={p.id} className="bg-white rounded-card border border-hairline p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-ink">{p.name}</span>
                          {p.linkedin && <a href={p.linkedin} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-coral-600"><Linkedin className="w-3.5 h-3.5" /></a>}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{p.title}{p.org ? ` · ${p.org}` : ''}</p>
                        {en && !en.notFound && <p className="text-xs text-ink mt-1">{en.email || 'no email found'}{en.phone ? ` · ${en.phone}` : ''}</p>}
                        {en?.notFound && <p className="text-xs text-slate-400 mt-1">No contact match.</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!en && <button onClick={() => reveal(p)} disabled={busy[p.id]} className="text-xs flex items-center gap-1 px-2.5 py-1.5 border border-hairline rounded-lg text-coral-600 hover:bg-coral-50 disabled:opacity-50">{busy[p.id] === 'enrich' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Reveal</button>}
                        {added[p.id] ? (
                          <button onClick={() => router.push(`/modules/account-pipeline?account=${added[p.id]}`)} className="text-xs flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700"><Check className="w-3.5 h-3.5" /> In pipeline</button>
                        ) : (
                          <button onClick={() => addToPipeline(p)} disabled={busy[p.id]} className="text-xs flex items-center gap-1 px-2.5 py-1.5 border border-hairline rounded-lg text-ink hover:bg-slate-50 disabled:opacity-50">{busy[p.id] === 'import' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add</button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </AppShell>
  )
}
