import { useRouter } from 'next/router'
import { ArrowLeft, PhoneCall, Rocket } from 'lucide-react'
import UserMenu from '../../components/auth/UserMenu'
import { useAuthStore } from '../../stores/useAuthStore'

const REPORTS = [
  {
    id: 'call-intelligence',
    name: 'Call Intelligence',
    description: 'Analyze Intro and Demo calls from the last 6 months. Spot objection patterns, talk ratios, competitor mentions, and win/loss signals — with an AI chat to ask your own questions.',
    icon: PhoneCall,
    href: '/modules/sales-reports/call-intelligence',
    color: 'from-green-500 to-emerald-600',
    available: false,
    status: 'in-progress',
    tags: ['Gong', '6 months', 'Intro & Demo'],
  },
]

function ReportCard({ report }) {
  const router = useRouter()
  const Icon = report.icon

  const getStatusBadge = () => {
    switch (report.status) {
      case 'live':
        return { text: 'Live', className: 'bg-red-500 text-white', icon: '●' }
      case 'in-progress':
        return { text: 'In Progress', className: 'bg-amber-500 text-white', icon: '◐' }
      default:
        return { text: 'Coming Soon', className: 'bg-gray-200 text-gray-600', icon: '○' }
    }
  }

  const badge = getStatusBadge()

  return (
    <button
      onClick={() => report.available && router.push(report.href)}
      disabled={!report.available}
      className={`relative group overflow-hidden rounded-2xl p-8 text-left transition-all duration-300 w-full ${
        report.available
          ? 'bg-white hover:shadow-2xl hover:-translate-y-1 cursor-pointer border-2 border-gray-100 hover:border-green-200'
          : 'bg-gray-50 border-2 border-gray-200 cursor-not-allowed opacity-70'
      }`}
    >
      {report.available && (
        <div className={`absolute inset-0 bg-gradient-to-br ${report.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
      )}

      <div className="absolute top-4 right-4">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full ${badge.className}`}>
          <span className="text-[10px]">{badge.icon}</span>
          {badge.text}
        </span>
      </div>

      <div className={`relative inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br ${report.color} mb-6 ${
        report.available ? 'group-hover:scale-110' : ''
      } transition-transform duration-300`}>
        <Icon className="w-8 h-8 text-white" />
      </div>

      <div className="relative">
        <h3 className={`text-xl font-bold mb-2 transition-colors ${
          report.available ? 'text-gray-900 group-hover:text-green-600' : 'text-gray-700'
        }`}>
          {report.name}
        </h3>
        <p className="text-gray-600 text-sm leading-relaxed mb-4">
          {report.description}
        </p>

        {report.tags && (
          <div className="flex flex-wrap gap-2">
            {report.tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full font-medium">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {report.available && (
        <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <Rocket className="w-5 h-5 text-green-500" />
        </div>
      )}
    </button>
  )
}

export default function SalesReports() {
  const router = useRouter()
  const { user } = useAuthStore()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/modules')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Sales Reports</h1>
                <p className="text-sm text-gray-500 mt-0.5">Analytics and intelligence for the sales team</p>
              </div>
            </div>
            {user && <UserMenu />}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Reports</h2>
          <p className="text-gray-500 text-sm">Select a report to view</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {REPORTS.map(report => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      </div>
    </div>
  )
}
