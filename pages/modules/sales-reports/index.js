import { useRouter } from 'next/router'
import { PhoneCall, BarChart2, ShieldAlert, LayoutDashboard, ClipboardList, LineChart, Database, Target } from 'lucide-react'
import AppShell from '../../../components/layout/AppShell'

// Calm, single-accent cards (BRAND_GUIDE.md). No rainbow gradients, no red "Live" pill on every
// card (§5.7 — red misuse + zero information since they're all live).
const REPORTS = [
  { id: 'command-center', name: 'Command Center', icon: Target, href: '/modules/sales-reports/command-center', description: "Live goal tracking against your revenue target, a feed of what the team is doing and what prospects are saying, and an AI read on what's working and what to do this week.", tags: ['Goal', 'Live feed', 'AI analysis'] },
  { id: 'ceo-dashboard', name: 'CEO Dashboard', icon: LineChart, href: '/modules/sales-reports/ceo-dashboard', description: 'Open + weighted pipeline in dollars, quarter forecast, win rate by close date, top deals to watch, and win/loss insights. The one view that tells you if the business is on track.', tags: ['Pipeline $', 'Forecast', 'Win/Loss'] },
  { id: 'team-dashboard', name: 'Team Dashboard', icon: LayoutDashboard, href: '/modules/sales-reports/team-dashboard', description: 'The full sales org. Pipeline by stage, rep scorecards with AI-scored call quality, at-risk deals, top objections and buying signals across all Gong calls, and multi-year lead funnel.', tags: ['Gong', 'Pipeline', 'Multi-year'] },
  { id: 'call-intelligence', name: 'Call Intelligence', icon: PhoneCall, href: '/modules/sales-reports/call-intelligence', description: 'Every analyzed call: objection patterns, talk ratios, competitor mentions, ICP and discovery scores, and win/loss signals — with an AI chat to ask your own questions.', tags: ['Gong', 'ICP', 'Objections'] },
  { id: 'lead-intelligence', name: 'Lead Intelligence', icon: BarChart2, href: '/modules/sales-reports/lead-intelligence', description: 'Full-funnel lead analytics from the master tracking sheet. Who books the most, which sources convert, show rates by SDR, win rates by vertical, and open pipeline by rep.', tags: ['Sheets', 'SDR + AE', 'Funnel'] },
  { id: 'data-validation', name: 'Data Validation', icon: ShieldAlert, href: '/modules/sales-reports/data-validation', description: 'Admin queue for uncertain data — unmatched leads, duplicate accounts, multi-year companies, missing fields, and low-confidence HubSpot links. Keeps reporting clean.', tags: ['Admin', 'Data Quality'] },
  { id: 'hubspot-audit', name: 'HubSpot Audit Log', icon: ClipboardList, href: '/modules/sales-reports/hubspot-audit', description: 'Every write the dashboard makes to HubSpot — notes, stage syncs, deal updates, contact creates. What was sent, when, by whom, and whether it succeeded.', tags: ['HubSpot', 'Audit'] },
  { id: 'call-registry', name: 'Call Registry', icon: Database, href: '/modules/sales-reports/call-registry', description: 'Every Gong call in one table — date, rep, account, stage, analysis status, transcript, discovery and ICP scores. Filter by rep, status, or date. Source of truth for coverage.', tags: ['Gong', 'All calls'] },
]

function ReportCard({ report }) {
  const router = useRouter()
  const Icon = report.icon
  return (
    <button
      onClick={() => router.push(report.href)}
      className="group text-left w-full bg-white rounded-card border border-hairline p-6 transition-all hover:shadow-md hover:border-coral-200"
    >
      <div className="w-11 h-11 rounded-xl bg-coral-50 flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-coral-600" />
      </div>
      <h3 className="text-base font-semibold text-ink group-hover:text-coral-600 transition-colors mb-1">{report.name}</h3>
      <p className="text-sm text-slate-500 leading-relaxed mb-4">{report.description}</p>
      <div className="flex flex-wrap gap-1.5">
        {report.tags.map((tag) => (
          <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-full font-medium">{tag}</span>
        ))}
      </div>
    </button>
  )
}

export default function SalesReports() {
  return (
    <AppShell title="Sales Reports" subtitle="Analytics and intelligence for the sales team">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {REPORTS.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      </div>
    </AppShell>
  )
}
