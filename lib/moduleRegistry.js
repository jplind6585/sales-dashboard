// Single source of truth for every module/report. Before this, nav was assembled from three
// disagreeing hardcoded lists (ModulesNav QUICK_MODULES, the /modules grid, the reports grid)
// plus a shadow pages/modules.js that collided on /modules (PLATFORM_REVIEW §2/§3). Every nav
// surface now maps over this. Fields: key,label,href,icon,group,desc; nav = show in top-nav
// dropdown; grid = show in a module grid.
import {
  Zap, CheckCircle2, FileText, Phone, Building2, TrendingUp, Send, Target,
  Users, BarChart3, BarChart2, Gauge, Database, Sliders, AlertTriangle,
  Settings, LayoutGrid, Trophy, Sparkles, ClipboardCheck, Search, GraduationCap, Wrench, Megaphone,
} from 'lucide-react';

// Left nav shows Work / Pipeline / Intelligence. Admin items are nav:false and reached from the
// Settings page (kept in the 'Admin' group only so the /modules grid still lists them).
export const GROUPS = ['Work', 'Pipeline', 'Intelligence', 'Admin'];

export const MODULES = [
  // Work
  { key: 'today', label: 'Today', href: '/modules/today', icon: Zap, group: 'Work', color: 'text-amber-500', desc: 'Role-aware daily focus', nav: true, grid: true },
  { key: 'tasks', label: 'Tasks', href: '/modules/tasks', icon: CheckCircle2, group: 'Work', color: 'text-coral-600', desc: 'Your task list + AI action items', nav: true, grid: true },
  { key: 'content', label: 'Content Studio', href: '/modules/content', icon: FileText, group: 'Work', color: 'text-coral-500', desc: 'AI-drafted follow-ups, cases, RFP answers', nav: true, grid: true },
  { key: 'call-queue', label: 'Call Queue', href: '/modules/call-queue', icon: Phone, group: 'Work', color: 'text-coral-600', desc: 'Who to reach today, ranked + drafted (folding into Today)', nav: false, grid: true },
  { key: 'work-requests', label: 'Work Requests', href: '/modules/work-requests', icon: Wrench, group: 'Work', color: 'text-coral-600', desc: 'Ask design / sales engineering — now the Requests tab in Tasks', nav: false, grid: false },
  { key: 'campaigns', label: 'Campaigns', href: '/modules/campaigns', icon: Megaphone, group: 'Work', color: 'text-coral-600', desc: 'Load accounts into named reengagement / vertical / expansion campaigns', nav: true, grid: true },
  // Pipeline
  { key: 'account-pipeline', label: 'Account Pipeline', href: '/modules/account-pipeline', icon: Building2, group: 'Pipeline', color: 'text-navy', desc: 'Track and manage all active deals', nav: true, grid: true },
  { key: 'pipeline-overview', label: 'Pipeline Overview', href: '/modules/pipeline-overview', icon: TrendingUp, group: 'Pipeline', color: 'text-coral-600', desc: 'Manager view: confidence, per-rep, stale', nav: false, grid: true, minRole: 'manager' },
  { key: 'outbound-engine', label: 'Outbound Engine', href: '/modules/outbound-engine', icon: Send, group: 'Pipeline', color: 'text-navy', desc: 'Prospecting research + contacts', nav: false, grid: true },
  { key: 'prospecting', label: 'Prospecting', href: '/modules/prospecting', icon: Search, group: 'Pipeline', color: 'text-coral-600', desc: 'Named-account tracking + Apollo search to find new contacts', nav: true, grid: true },
  { key: 'pursuit', label: 'Account Pursuit', href: '/modules/pursuit', icon: Target, group: 'Pipeline', color: 'text-coral-500', desc: 'SDR named-account tracking + touches (now inside Prospecting)', nav: false, grid: false },
  // Intelligence
  { key: 'coaching', label: 'Rep Coaching', href: '/modules/coaching', icon: Users, group: 'Intelligence', color: 'text-coral-600', desc: 'Call quality + AI coaching per rep', nav: true, grid: true },
  { key: 'coaching-lab', label: 'Coaching Lab', href: '/modules/coaching-lab', icon: GraduationCap, group: 'Intelligence', color: 'text-coral-500', desc: 'Best calls to learn from + deals to advance-or-kill', nav: false, grid: true },
  { key: 'call-intelligence', label: 'Call Intelligence', href: '/modules/sales-reports/call-intelligence', icon: Sparkles, group: 'Intelligence', color: 'text-coral-500', desc: 'Every call analyzed: ICP, discovery, objections', nav: true, grid: true },
  { key: 'bottleneck', label: 'Bottleneck Tracker', href: '/modules/bottleneck', icon: BarChart3, group: 'Intelligence', color: 'text-navy', desc: 'Stage conversion + stall alerts', nav: false, grid: true, minRole: 'manager' },
  { key: 'stage-analytics', label: 'Stage Analytics', href: '/modules/stage-analytics', icon: Target, group: 'Intelligence', color: 'text-coral-600', desc: 'Time-in-stage + velocity', nav: false, grid: true },
  // Reports
  { key: 'sales-reports', label: 'Analytics', href: '/modules/sales-reports', icon: BarChart2, group: 'Intelligence', color: 'text-navy', desc: 'All report dashboards + exec view', nav: true, grid: true, minRole: 'manager' },
  { key: 'command-center', label: 'Command Center', href: '/modules/sales-reports/command-center', icon: Gauge, group: 'Intelligence', color: 'text-coral-600', desc: 'Revenue/pipeline vs goal + live feed', nav: false, grid: true },
  { key: 'ceo-dashboard', label: 'CEO Dashboard', href: '/modules/sales-reports/ceo-dashboard', icon: TrendingUp, group: 'Intelligence', color: 'text-coral-500', desc: 'The one exec view: $ pipeline, win rate, forecast', nav: false, grid: true, minRole: 'manager' },
  { key: 'roi-tracker', label: 'ROI Tracker', href: '/modules/roi-tracker', icon: TrendingUp, group: 'Intelligence', color: 'text-coral-600', desc: 'What each investment returns — pipeline, revenue, payback', nav: false, grid: true },
  { key: 'team-dashboard', label: 'Team Dashboard', href: '/modules/sales-reports/team-dashboard', icon: Users, group: 'Intelligence', color: 'text-navy', desc: 'Per-rep scorecards + pipeline', nav: false, grid: true },
  { key: 'call-registry', label: 'Call Registry', href: '/modules/sales-reports/call-registry', icon: Database, group: 'Intelligence', color: 'text-navy', desc: 'Every call, searchable', nav: false, grid: true },
  { key: 'activity-leaderboard', label: 'Activity Leaderboard', href: '/modules/sales-reports/activity-leaderboard', icon: Trophy, group: 'Intelligence', color: 'text-coral-500', desc: 'SDR/AE activity ranking', nav: false, grid: true },
  { key: 'lead-intelligence', label: 'Lead Intelligence', href: '/modules/sales-reports/lead-intelligence', icon: Search, group: 'Intelligence', color: 'text-navy', desc: 'Multi-year lead funnel', nav: false, grid: true },
  { key: 'data-validation', label: 'Data Validation', href: '/modules/sales-reports/data-validation', icon: ClipboardCheck, group: 'Intelligence', color: 'text-navy', desc: 'Lead/deal data checks', nav: false, grid: true },
  { key: 'hubspot-audit', label: 'HubSpot Audit', href: '/modules/sales-reports/hubspot-audit', icon: Database, group: 'Intelligence', color: 'text-navy', desc: 'Sync log', nav: false, grid: true },
  // Admin
  { key: 'sales-processes', label: 'Sales Processes', href: '/modules/sales-processes', icon: Sliders, group: 'Admin', color: 'text-coral-600', desc: 'ICP, discovery, stage-exit criteria', nav: false, grid: true, minRole: 'manager' },
  { key: 'playbooks', label: 'Playbooks', href: '/modules/playbooks', icon: ClipboardCheck, group: 'Admin', color: 'text-coral-500', desc: 'Pre/post-call checklists that auto-create tasks', nav: false, grid: true },
  { key: 'data-quality', label: 'Data Quality', href: '/modules/data-quality', icon: AlertTriangle, group: 'Admin', color: 'text-amber-600', desc: 'Low-confidence links, dedup, cleanup', nav: false, grid: true, minRole: 'manager' },
  { key: 'users', label: 'Users & Roles', href: '/modules/users', icon: Users, group: 'Admin', color: 'text-coral-600', desc: 'Assign roles and rep type', nav: false, grid: true, minRole: 'admin' },
  { key: 'settings', label: 'Settings', href: '/modules/settings', icon: Settings, group: 'Admin', color: 'text-slate-500', desc: 'Signature, Slack ID, rep type, team + admin', nav: true, grid: true },
  { key: 'all-modules', label: 'All Modules', href: '/modules', icon: LayoutGrid, group: 'Admin', color: 'text-slate-500', desc: 'Every module', nav: false, grid: false },
];

// Safety net: an icon that resolves to undefined (e.g. a lucide export that doesn't exist in the
// installed version) rendered as <m.icon/> throws React #130 and white-screens every nav surface
// that maps over this list (dropdown, /modules grid, ⌘K palette). Coerce any missing icon to a
// placeholder so a bad icon degrades gracefully instead of taking down the app.
const isRenderable = (c) => typeof c === 'function' || (c && typeof c === 'object'); // fn or forwardRef/memo
MODULES.forEach((m) => { if (!isRenderable(m.icon)) m.icon = LayoutGrid; });

export const navModules = () => MODULES.filter((m) => m.nav);
export const gridModules = () => MODULES.filter((m) => m.grid);
export const modulesByGroup = () =>
  GROUPS.map((g) => ({ group: g, items: MODULES.filter((m) => m.group === g && m.grid) })).filter((s) => s.items.length);
export const moduleByHref = (href) => MODULES.find((m) => m.href === href);
