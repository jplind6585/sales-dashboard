import { useState, useEffect, useRef } from 'react'
import { useRouter as useNextRouter } from 'next/router'
import {
  LayoutGrid, Zap, Building2, Send, TrendingUp, Users,
  Target, BarChart3, CheckCircle2, ChevronDown, ChevronUp, Database, Gauge, FileText,
} from 'lucide-react'

const QUICK_MODULES = [
  { label: 'Today', href: '/modules/today', icon: Zap, color: 'text-amber-500' },
  { label: 'Tasks', href: '/modules/tasks', icon: CheckCircle2, color: 'text-blue-600' },
  { label: 'Command Center', href: '/modules/sales-reports/command-center', icon: Gauge, color: 'text-rose-500' },
  { label: 'Content Studio', href: '/modules/content', icon: FileText, color: 'text-violet-600' },
  { label: 'Account Pipeline', href: '/modules/account-pipeline', icon: Building2, color: 'text-blue-700' },
  { label: 'Pipeline Overview', href: '/modules/pipeline-overview', icon: TrendingUp, color: 'text-teal-600' },
  { label: 'Rep Coaching', href: '/modules/coaching', icon: Users, color: 'text-indigo-600' },
  { label: 'Bottleneck', href: '/modules/bottleneck', icon: BarChart3, color: 'text-red-500' },
  { label: 'Stage Analytics', href: '/modules/stage-analytics', icon: Target, color: 'text-orange-500' },
  { label: 'Account Pursuit', href: '/modules/pursuit', icon: Send, color: 'text-purple-600' },
  { label: 'Call Registry', href: '/modules/sales-reports/call-registry', icon: Database, color: 'text-cyan-600' },
  { label: 'All Modules', href: '/modules', icon: LayoutGrid, color: 'text-gray-600' },
]

export default function ModulesNav({ router }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => { setOpen(false) }, [router?.pathname])

  const current = router?.pathname

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <LayoutGrid className="w-4 h-4" />
        Modules
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 w-52 z-20">
          {QUICK_MODULES.map(m => (
            <button
              key={m.href}
              onClick={() => { router.push(m.href); setOpen(false) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                current === m.href
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <m.icon className={`w-4 h-4 ${current === m.href ? 'text-blue-600' : m.color}`} />
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
