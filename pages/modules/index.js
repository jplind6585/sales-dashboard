import { useRouter } from 'next/router'
import { LayoutGrid } from 'lucide-react'
import UserMenu from '../../components/auth/UserMenu'
import ModulesNav from '../../components/layout/ModulesNav'
import { modulesByGroup } from '../../lib/moduleRegistry'

// Rendered from the single module registry, grouped, on-brand (BRAND_GUIDE.md).
export default function ModulesIndex() {
  const router = useRouter()
  const groups = modulesByGroup()

  return (
    <div className="min-h-screen bg-canvas">
      <div className="bg-white border-b border-hairline">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <ModulesNav router={router} />
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-slate-400" />
              <h1 className="text-lg font-semibold text-ink font-display">All Modules</h1>
            </div>
          </div>
          <UserMenu />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {groups.map((g) => (
          <div key={g.group}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">{g.group}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {g.items.map((mod) => {
                const Icon = mod.icon
                return (
                  <button
                    key={mod.href}
                    onClick={() => router.push(mod.href)}
                    className="bg-white rounded-card border border-hairline p-4 text-left hover:shadow-md hover:border-coral-200 transition-all group flex items-start gap-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-coral-50 flex items-center justify-center shrink-0">
                      <Icon className="text-coral-600" style={{ width: '18px', height: '18px' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink group-hover:text-coral-600 leading-tight">{mod.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug">{mod.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
