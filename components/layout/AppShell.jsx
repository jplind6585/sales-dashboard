import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Search, Sun, Moon } from 'lucide-react'
import UserMenu from '../auth/UserMenu'
import { GROUPS, MODULES } from '../../lib/moduleRegistry'
import { isAdmin, isManager } from '../../lib/roles'

// The one app frame — a persistent left rail (grouped from the single nav registry) + a slim top
// bar — that every module renders inside, so navigation is identical everywhere. Pass title/subtitle
// for the top bar; pass `actions` for any page-specific top-bar controls. The global ⌘K palette and
// assistant are mounted in _app; the search pill here just opens the palette.
const COLLAPSE_KEY = 'appshell_collapsed'

// Panel-toggle glyph with a directional chevron — collapse (‹) / expand (›). Reads as shrinking the
// rail in place, not opening a menu.
function PanelToggle({ collapsed }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
      <path d={collapsed ? 'M12.5 9.5 15 12l-2.5 2.5' : 'M15 9.5 12.5 12l2.5 2.5'} />
    </svg>
  )
}

export default function AppShell({ title, subtitle, actions, children }) {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [role, setRole] = useState('rep')
  const [dark, setDark] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1')
      const cached = localStorage.getItem('cached_role'); if (cached) setRole(cached)
    } catch {}
  }, [])
  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => { const r = d.profile?.role || 'rep'; setRole(r); try { localStorage.setItem('cached_role', r) } catch {} }).catch(() => {})
  }, [])
  const toggle = () => setCollapsed(c => { const n = !c; try { localStorage.setItem(COLLAPSE_KEY, n ? '1' : '0') } catch {}; return n })
  useEffect(() => { try { setDark(document.documentElement.classList.contains('dark')) } catch {} }, [])
  const toggleTheme = () => setDark(d => { const n = !d; try { document.documentElement.classList.toggle('dark', n); localStorage.setItem('theme', n ? 'dark' : 'light') } catch {}; return n })

  const path = router.pathname
  // minRole-gated items (e.g. admin-only Users) are hidden unless the viewer qualifies.
  const canSee = (m) => !m.minRole || (m.minRole === 'admin' ? isAdmin(role) : m.minRole === 'manager' ? isManager(role) : true)
  const groups = GROUPS
    .map(g => ({ group: g, items: MODULES.filter(m => m.group === g && m.nav && m.key !== 'settings' && canSee(m)) }))
    .filter(s => s.items.length)
  const settings = MODULES.find(m => m.key === 'settings')

  const NavItem = ({ m }) => {
    const active = path === m.href
    const Icon = m.icon
    return (
      <button
        onClick={() => router.push(m.href)}
        title={m.label}
        className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-[13.5px] font-medium relative transition-colors ${collapsed ? 'justify-center' : ''} ${active ? 'bg-coral-50 text-coral-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
      >
        {active && <span className="absolute -left-2.5 top-2 bottom-2 w-[3px] bg-coral-500 rounded-r-full" />}
        <Icon className="w-[17px] h-[17px] shrink-0" />
        {!collapsed && <span className="truncate">{m.label}</span>}
      </button>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className={`${collapsed ? 'w-16' : 'w-[236px]'} flex-shrink-0 bg-white flex flex-col sticky top-0 h-screen transition-[width] duration-150`}>
        <div className={`flex items-center h-[57px] flex-shrink-0 ${collapsed ? 'justify-center px-2' : 'px-4'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {collapsed
            ? <img src="/brand/Banner_Logo_Square.png" alt="Banner" className="w-7 h-7 object-contain" />
            : <img src="/brand/Banner_Logo_Full.png" alt="Banner" className="h-[22px] w-auto object-contain" />}
        </div>
        <nav className="flex-1 overflow-y-auto px-2.5 pb-3">
          {groups.map(sec => (
            <div key={sec.group}>
              {!collapsed
                ? <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2.5 pt-3.5 pb-1">{sec.group}</div>
                : <div className="h-3" />}
              {sec.items.map(m => <NavItem key={m.key} m={m} />)}
            </div>
          ))}
        </nav>
        {settings && (
          <div className="border-t border-slate-100 px-2.5 py-2 flex-shrink-0">
            <NavItem m={settings} />
          </div>
        )}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-[57px] flex-shrink-0 bg-white/85 backdrop-blur border-b border-slate-200 sticky top-0 z-20 flex items-center gap-3 px-5">
          <button onClick={toggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 grid place-items-center flex-shrink-0">
            <PanelToggle collapsed={collapsed} />
          </button>
          <div className="flex flex-col leading-tight min-w-0">
            {title && <h1 className="text-base font-semibold text-slate-900 tracking-tight truncate">{title}</h1>}
            {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
          </div>
          <div className="flex-1" />
          {actions}
          <button onClick={() => window.dispatchEvent(new Event('cmdk:open'))} title="Search (⌘K)"
            className="hidden sm:flex items-center gap-2 h-8 px-3 bg-gray-50 border border-slate-200 rounded-lg text-slate-400 text-[13px] hover:border-coral-400 transition-colors">
            <Search className="w-3.5 h-3.5" />
            <span>Search…</span>
            <kbd className="text-[10px] font-semibold text-slate-500 border border-slate-200 rounded px-1.5 py-0.5 bg-white">⌘K</kbd>
          </button>
          <button onClick={toggleTheme} title={dark ? 'Switch to light' : 'Switch to dark'} aria-label="Toggle theme"
            className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 grid place-items-center flex-shrink-0">
            {dark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>
          <UserMenu />
        </header>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  )
}
