import { useRouter } from 'next/router'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import UserMenu from '../../components/auth/UserMenu'

const MODULES = [
  {
    title: 'Tasks',
    href: '/modules/tasks',
    description: 'Your daily task list and AI-powered action items',
  },
  {
    title: 'Today',
    href: '/modules/today',
    description: 'Role-aware daily focus view',
  },
  {
    title: 'Account Pipeline',
    href: '/modules/account-pipeline',
    description: 'Track and manage all active deals',
  },
  {
    title: 'Pipeline Overview',
    href: '/modules/pipeline-overview',
    description: 'Manager view: confidence scores, rep breakdown, stale deals',
  },
  {
    title: 'Outbound Engine',
    href: '/modules/outbound-engine',
    description: 'Prospecting company research and contact management',
  },
  {
    title: 'Account Pursuit',
    href: '/modules/pursuit',
    description: 'SDR top-50 named account tracking and touch logging',
  },
  {
    title: 'Bottleneck Tracker',
    href: '/modules/bottleneck',
    description: 'Stage conversion rates, drop-off analysis, stall alerts',
  },
  {
    title: 'Rep Coaching',
    href: '/modules/coaching',
    description: 'Call quality metrics and AI coaching cards per rep',
  },
  {
    title: 'Sales Processes',
    href: '/modules/sales-processes',
    description: 'Edit ICP definition, discovery framework, stage exit criteria',
  },
  {
    title: 'Data Quality',
    href: '/modules/data-quality',
    description: 'Low-confidence account links, duplicate detection, data cleanup',
  },
  {
    title: 'Sales Reports',
    href: '/modules/sales-reports',
    description: 'Team dashboard, call intelligence, lead analytics',
  },
]

export default function ModulesIndex() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/modules/tasks')}
              className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Modules</h1>
              <p className="text-sm text-gray-500">All tools in one place</p>
            </div>
          </div>
          <UserMenu />
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map(mod => (
            <button
              key={mod.href}
              onClick={() => router.push(mod.href)}
              className="bg-white rounded-xl shadow-sm border p-5 text-left hover:shadow-md hover:border-blue-200 transition-all group"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-semibold text-gray-900 group-hover:text-blue-600">
                  {mod.title}
                </h2>
                <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-blue-400 flex-shrink-0 mt-0.5" />
              </div>
              <p className="text-sm text-gray-500 mt-1 leading-snug">{mod.description}</p>
              <span className="inline-block mt-3 text-xs font-medium text-blue-600 group-hover:text-blue-700">
                Open →
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
