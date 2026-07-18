// Single source of truth for every module/report. Before this, nav was assembled from three
// disagreeing hardcoded lists (ModulesNav QUICK_MODULES, the /modules grid, the reports grid)
// plus a shadow pages/modules.js that collided on /modules (PLATFORM_REVIEW §2/§3). Every nav
// surface now maps over this. Fields: key,label,href,icon,group,desc; nav = show in top-nav
// dropdown; grid = show in a module grid.
import {
  Zap, CheckCircle2, FileText, Phone, Building2, TrendingUp, Send, Target,
  Users, BarChart3, BarChart2, Gauge, Database, Sliders, AlertTriangle,
  Settings, LayoutGrid, Trophy, Sparkles, ClipboardCheck, Search,
} from 'lucide-react';

export const GROUPS = ['Work', 'Pipeline', 'Intelligence', 'Reports', 'Admin'];

export const MODULES = [
  // Work
  { key: 'today', label: 'Today', href: '/modules/today', icon: Zap, group: 'Work', color: 'text-amber-500', desc: 'Role-aware daily focus', nav: true, grid: true },
  { key: 'tasks', label: 'Tasks', href: '/modules/tasks', icon: CheckCircle2, group: 'Work', color: 'text-coral-600', desc: 'Your task list + AI action items', nav: true, grid: true },
  { key: 'content', label: 'Content Studio', href: '/modules/content', icon: FileText, group: 'Work', color: 'text-coral-500', desc: 'AI-drafted follow-ups, cases, RFP answers', nav: true, grid: true },
  { key: 'call-queue', label: 'Call Queue', href: '/modules/call-queue', icon: Phone, group: 'Work', color: 'text-coral-600', desc: 'Who to reach today, ranked + drafted', nav: true, grid: true },
  // Pipeline
  { key: 'account-pipeline', label: 'Account Pipeline', href: '/modules/account-pipeline', icon: Building2, group: 'Pipeline', color: 'text-navy', desc: 'Track and manage all active deals', nav: true, grid: true },
  { key: 'pipeline-overview', label: 'Pipeline Overview', href: '/modules/pipeline-overview', icon: TrendingUp, group: 'Pipeline', color: 'text-coral-600', desc: 'Manager view: confidence, per-rep, stale', nav: true, grid: true },
  { key: 'outbound-engine', label: 'Outbound Engine', href: '/modules/outbound-engine', icon: Send, group: 'Pipeline', color: 'text-navy', desc: 'Prospecting research + contacts', nav: true, grid: true },
  { key: 'pursuit', label: 'Account Pursuit', href: '/modules/pursuit', icon: Target, group: 'Pipeline', color: 'text-coral-500', desc: 'SDR named-account tracking + touches', nav: true, grid: true },
  // Intelligence
  { key: 'coaching', label: 'Rep Coaching', href: '/modules/coaching', icon: Users, group: 'Intelligence', color: 'text-coral-600', desc: 'Call quality + AI coaching per rep', nav: true, grid: true },
  { key: 'call-intelligence', label: 'Call Intelligence', href: '/modules/sales-reports/call-intelligence', icon: Sparkles, group: 'Intelligence', color: 'text-coral-500', desc: 'Every call analyzed: ICP, discovery, objections', nav: true, grid: true },
  { key: 'bottleneck', label: 'Bottleneck Tracker', href: '/modules/bottleneck', icon: BarChart3, group: 'Intelligence', color: 'text-navy', desc: 'Stage conversion + stall alerts', nav: true, grid: true },
  { key: 'stage-analytics', label: 'Stage Analytics', href: '/modules/stage-analytics', icon: Target, group: 'Intelligence', color: 'text-coral-600', desc: 'Time-in-stage + velocity', nav: true, grid: true },
  // Reports
  { key: 'sales-reports', label: 'Sales Reports', href: '/modules/sales-reports', icon: BarChart2, group: 'Reports', color: 'text-navy', desc: 'All report dashboards', nav: true, grid: true },
  { key: 'command-center', label: 'Command Center', href: '/modules/sales-reports/command-center', icon: Gauge, group: 'Reports', color: 'text-coral-600', desc: 'Revenue/pipeline vs goal + live feed', nav: true, grid: true },
  { key: 'ceo-dashboard', label: 'CEO Dashboard', href: '/modules/sales-reports/ceo-dashboard', icon: TrendingUp, group: 'Reports', color: 'text-coral-500', desc: 'The one exec view: $ pipeline, win rate, forecast', nav: true, grid: true },
  { key: 'team-dashboard', label: 'Team Dashboard', href: '/modules/sales-reports/team-dashboard', icon: Users, group: 'Reports', color: 'text-navy', desc: 'Per-rep scorecards + pipeline', nav: true, grid: true },
  { key: 'call-registry', label: 'Call Registry', href: '/modules/sales-reports/call-registry', icon: Database, group: 'Reports', color: 'text-navy', desc: 'Every call, searchable', nav: true, grid: true },
  { key: 'activity-leaderboard', label: 'Activity Leaderboard', href: '/modules/sales-reports/activity-leaderboard', icon: Trophy, group: 'Reports', color: 'text-coral-500', desc: 'SDR/AE activity ranking', nav: true, grid: true },
  { key: 'lead-intelligence', label: 'Lead Intelligence', href: '/modules/sales-reports/lead-intelligence', icon: Search, group: 'Reports', color: 'text-navy', desc: 'Multi-year lead funnel', nav: false, grid: true },
  { key: 'data-validation', label: 'Data Validation', href: '/modules/sales-reports/data-validation', icon: ClipboardCheck, group: 'Reports', color: 'text-navy', desc: 'Lead/deal data checks', nav: false, grid: true },
  { key: 'hubspot-audit', label: 'HubSpot Audit', href: '/modules/sales-reports/hubspot-audit', icon: Database, group: 'Reports', color: 'text-navy', desc: 'Sync log', nav: false, grid: true },
  // Admin
  { key: 'sales-processes', label: 'Sales Processes', href: '/modules/sales-processes', icon: Sliders, group: 'Admin', color: 'text-coral-600', desc: 'ICP, discovery, stage-exit criteria', nav: true, grid: true },
  { key: 'data-quality', label: 'Data Quality', href: '/modules/data-quality', icon: AlertTriangle, group: 'Admin', color: 'text-amber-600', desc: 'Low-confidence links, dedup, cleanup', nav: true, grid: true },
  { key: 'settings', label: 'Settings', href: '/modules/settings', icon: Settings, group: 'Admin', color: 'text-slate-500', desc: 'Signature, Slack ID, rep type, team', nav: true, grid: true },
  { key: 'all-modules', label: 'All Modules', href: '/modules', icon: LayoutGrid, group: 'Admin', color: 'text-slate-500', desc: 'Every module', nav: true, grid: false },
];

export const navModules = () => MODULES.filter((m) => m.nav);
export const gridModules = () => MODULES.filter((m) => m.grid);
export const modulesByGroup = () =>
  GROUPS.map((g) => ({ group: g, items: MODULES.filter((m) => m.group === g && m.grid) })).filter((s) => s.items.length);
export const moduleByHref = (href) => MODULES.find((m) => m.href === href);
