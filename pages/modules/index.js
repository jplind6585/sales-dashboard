import { useRouter } from 'next/router'
import {
  CheckCircle2, Zap, Building2, Send, TrendingUp,
  Target, BarChart3, Users, Settings, AlertTriangle,
  BarChart2, LayoutGrid,
} from 'lucide-react'
import UserMenu from '../../components/auth/UserMenu'

const MODULES = [
  {
    title: 'Tasks',
    href: '/modules/tasks',
    description: 'Your daily task list and AI-powered action items',
    icon: CheckCircle2,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    title: 'Today',
    href: '/modules/today',
    description: 'Role-aware daily focus: morning brief, calendar, pipeline',
    icon: Zap,
    color: 'text-amber-500',
    bg: 'bg-amber-50',
  },
  {
    title: 'Account Pipeline',
    href: '/modules/account-pipeline',
    description: 'Track and manage all active deals',
    icon: Building2,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
  },
  {
    title: 'Pipeline Overview',
    href: '/modules/pipeline-overview',
    description: 'Manager view: confidence scores, rep breakdown, stale deals',
    icon: TrendingUp,
    color: 'text-teal-600',
    bg: 'bg-teal-50',
  },
  {
    title: 'Outbound Engine',
    href: '/modules/outbound-engine',
    description: 'Prospecting company research and contact management',
    icon: Send,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  {
    title: 'Account Pursuit',
    href: '/modules/pursuit',
    description: 'SDR top-50 named account tracking and touch logging',
    icon: Target,
    color: 'text-orange-500',
    bg: 'bg-orange-50',
  },
  {
    title: 'Bottleneck Tracker',
    href: '/modules/bottleneck',
    description: 'Stage conversion rates, drop-off analysis, stall alerts',
    icon: BarChart3,
    color: 'text-red-500',
    bg: 'bg-red-50',
  },
  {
    title: 'Rep Coaching',
    href: '/modules/coaching',
    description: 'Call quality metrics and AI coaching cards per rep',
    icon: Users,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
  },
  {
    title: 'Sales Processes',
    href: '/modules/sales-processes',
    description: 'Edit ICP definition, discovery framework, stage exit criteria',
    icon: Settings,
    color: 'text-gray-600',
    bg: 'bg-gray-100',
  },
  {
    title: 'Data Quality',
    href: '/modules/data-quality',
    description: 'Low-confidence account links, duplicate detection, data cleanup',
    icon: AlertTriangle,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
  },
  {
    title: 'Call Intelligence',
    href: '/modules/sales-reports/call-intelligence',
    description: 'Team dashboard, ICP scores, discovery trends, objection themes',
    icon: BarChart2,
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
]

export default function ModulesIndex() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <LayoutGrid className="w-5 h-5 text-gray-400" />
            <h1 className="text-lg font-semibold text-gray-900">All Modules</h1>
          </div>
          <UserMenu />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MODULES.map(mod => {
            const Icon = mod.icon
            return (
              <button
                key={mod.href}
                onClick={() => router.push(mod.href)}
                className="bg-white rounded-xl border border-gray-200 p-4 text-left hover:shadow-md hover:border-blue-200 transition-all group flex items-start gap-3"
              >
                <div className={`w-9 h-9 rounded-lg ${mod.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-4.5 h-4.5 ${mod.color}`} style={{ width: '18px', height: '18px' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 leading-tight">
                    {mod.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug">{mod.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
