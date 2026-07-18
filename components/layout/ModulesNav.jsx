import { useState, useEffect, useRef } from 'react'
import { LayoutGrid, ChevronDown, ChevronUp } from 'lucide-react'
import { modulesByGroup } from '../../lib/moduleRegistry'

// Single-sourced module dropdown — renders from lib/moduleRegistry so nav can't drift from the
// grids (PLATFORM_REVIEW §1.10/§3.4).
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
  const groups = modulesByGroup()

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:text-ink hover:bg-slate-100 rounded-lg transition-colors"
      >
        <LayoutGrid className="w-4 h-4" />
        Modules
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-hairline rounded-xl shadow-lg py-1.5 w-64 z-20 max-h-[70vh] overflow-y-auto">
          {groups.map((g) => (
            <div key={g.group}>
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{g.group}</div>
              {g.items.map((m) => (
                <button
                  key={m.href}
                  onClick={() => { router.push(m.href); setOpen(false) }}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left transition-colors ${
                    current === m.href ? 'bg-coral-50 text-coral-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <m.icon className={`w-4 h-4 ${current === m.href ? 'text-coral-600' : m.color}`} />
                  {m.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
