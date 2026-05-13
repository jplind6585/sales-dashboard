import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  ArrowLeft, Save, CheckCircle, AlertCircle, RefreshCw,
  Plus, ChevronDown, ChevronRight, Trash2, ToggleLeft, ToggleRight, GitBranch
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import UserMenu from '../../components/auth/UserMenu';

const DEFAULT_REENGAGEMENT_PLAYBOOK = {
  framework: "Based on Jeb Blount's Fanatical Prospecting (pattern-interrupt re-engagement), The Challenger Sale multi-threaded re-entry (Dixon & Adamson, 2011), and Gong's 2023 research showing multi-channel + specific pain reference + social proof produces 3x response rate vs generic outreach.",
  core_principles: [
    "Never re-engage a single contact — multi-thread across champion, exec sponsor, and promoters",
    "Reference something specific from the last real conversation — no generic 'just checking in'",
    "Intel first, executive entry second — don't go to the exec sponsor cold",
    "Detractors are neutralized through your champion or exec sponsor, never contacted directly",
    "The Information Room is a credibility asset, not a pitch deck — it shows you've done the work",
  ],
  role_definitions: {
    champion: "Has helped navigate us internally — facilitated introductions, shared internal context, advocated for the project. Behavioral, not just a title.",
    exec_sponsor: "SVP level and above, or VP with P&L ownership. Economic authority. Goal: outcome-focused conversation, not a demo.",
    promoter: "Engaged, positive sentiment, asks good questions. Not yet a champion but a potential one.",
    detractor: "Raised repeated objections, went quiet, or expressed concern about the project. Strategy: neutralize via champion — understand their objection and address it before it surfaces again.",
  },
  stages: [
    {
      number: 1,
      name: "Intel Gathering",
      days: "1–3",
      contacts: ["champion", "promoter"],
      objective: "Re-establish contact. Confirm the pain is still live. Understand what changed since you last spoke.",
      guidance: "Low-ask outreach. Reference something specific — a pain point, a commitment they made, something they said. Don't ask for a meeting on the first touch. Ask one question.",
      touches: [
        {
          day: 1,
          channel: "LinkedIn DM",
          purpose: "Pattern interrupt — unexpected, personal, specific",
          template: "{{name}} — it's been a while. I was looking back at our last conversation and saw you mentioned {{specific_pain_or_challenge}}. Has that gotten better or worse for you since we spoke?",
        },
        {
          day: 3,
          channel: "Email",
          purpose: "Value-add — new insight or case study relevant to their stated pain",
          template: "Subject: Quick question about {{pain_area}}\n\n{{name}} — I've been working with a few {{vertical}} companies recently and kept thinking about the challenge you mentioned around {{specific_pain}}. One of them just solved it in a way that might be useful for you. Worth a 10-minute call this week?",
        },
      ],
    },
    {
      number: 2,
      name: "Executive Entry",
      days: "4–7",
      contacts: ["exec_sponsor"],
      objective: "Reach the exec sponsor armed with Stage 1 intel. Peer-level, outcome-focused, short. One question. No product talk.",
      guidance: "Use what your champion told you in Stage 1 to frame the exec entry. The exec sponsor doesn't need context — they need to know you understand their business outcome.",
      touches: [
        {
          day: 4,
          channel: "Email",
          purpose: "Executive-level re-entry — business outcome framing",
          template: "Subject: {{business_outcome}} for {{company}}\n\n{{exec_name}} — {{champion_name}} and I reconnected recently about {{pain_area}}. Given your focus on {{exec_priority}}, I thought it was worth reaching out directly. One question: is {{pain_area}} still a priority for {{company}} this {{quarter_year}}?",
        },
        {
          day: 6,
          channel: "Phone",
          purpose: "Direct call — 2 minutes, one question",
          template: "Opening: '{{exec_name}}, this is {{rep_name}} from Banner. I'll keep this short — I work with {{champion_name}} and wanted your perspective on something directly. Is this a good 2 minutes?' If yes: 'We've been working with a few {{vertical}} companies on {{pain_area}} — the results have been significant. Is that still a priority for you this year?'",
        },
      ],
    },
    {
      number: 3,
      name: "Multi-Channel Push",
      days: "8–14",
      contacts: ["champion", "exec_sponsor", "promoter"],
      objective: "Full push across all contacts with credibility assets. Information Room + reference accounts + call track.",
      guidance: "This is where the Information Room comes in. Don't send it cold — reference it in context of their specific pain. Cite similar companies by name.",
      touches: [
        {
          day: 8,
          channel: "Phone",
          purpose: "Champion call — specific objection response + what changed",
          template: "Opening: '{{name}}, I know we haven't spoken in a while — I wanted to reconnect specifically about {{objection_they_raised}}. Since we last spoke, we've worked with {{reference_account}} who had the exact same concern. Here's what happened...' Ask: 'Does that change how you'd think about moving forward?'",
        },
        {
          day: 10,
          channel: "Email",
          purpose: "Information Room delivery",
          template: "Subject: How {{reference_account}} handled {{pain}}\n\n{{name}} — I put together a quick information room for {{company}}. It covers {{topic_1}}, {{topic_2}}, and includes how {{reference_account}} approached the same challenge. {{dock_url_or_build_note}} Worth 5 minutes if {{pain}} is still on your radar.",
        },
      ],
    },
    {
      number: 4,
      name: "Decision or Breakup",
      days: "14+",
      contacts: ["most_responsive_contact"],
      objective: "Force a decision. Re-engage or close the loop cleanly. Silence is not an answer.",
      guidance: "Loss framing activates loss aversion — the research shows 'should I close your file?' outperforms 'are you still interested?' by 2:1 (Blount). Keep it short. One sentence of context, one question, easy CTA.",
      touches: [
        {
          day: 14,
          channel: "Email",
          purpose: "Breakup — loss framing + easy re-engage CTA",
          template: "Subject: Should I close your file?\n\n{{name}} — I've reached out a few times since we last connected. I don't want to keep bothering you if the timing isn't right for {{company}}. Should I close your file and circle back in {{timeframe}}? Or if {{pain}} is still a priority, I'm happy to pick up where we left off — just say the word.",
        },
      ],
    },
  ],
  detractor_strategy: "Do not contact detractors directly. Use your champion and exec sponsor conversations to surface and address their objection before it blocks the deal. If the detractor is the economic buyer, use exec sponsor entry to go around them with a business outcome conversation.",
  information_room_guide: "The Information Room is a credibility asset. When no Dock URL is stored for the account, generate a build brief: (1) Opening — what you heard from them + what has changed in their space since you last spoke, (2) The problem Banner solves for companies like theirs, (3) Reference case study — a similar company by vertical and ownership type, (4) How it works — 3 differentiators tied to their stated pain points, (5) Social proof — relevant customer references by industry. Keep it short enough to read in 5 minutes.",
};

const SECTIONS = [
  { id: 'icp_definition', label: 'ICP Definition', description: 'Who we sell to, who we don\'t, and how to score fit.', color: 'blue' },
  { id: 'discovery_framework', label: 'Discovery Framework', description: 'What must be uncovered on every call. Drives discovery scoring in Call Intelligence.', color: 'green' },
  { id: 'stage_exit_criteria', label: 'Stage Exit Criteria', description: 'What must be true before advancing an account to the next stage.', color: 'purple' },
  { id: 'disqualification_signals', label: 'Disqualification Signals', description: 'Hard stops, soft stops, and the language that signals a deal is limping.', color: 'red' },
  { id: 'coaching_priorities', label: 'Coaching Priorities', description: 'What to coach on first. Ranked by revenue impact. Drives all rep coaching output.', color: 'orange' },
  { id: 'qualification_framework', label: 'Qualification Framework', description: 'The scoring guide for ICP fit (1-10) and discovery quality (1-10).', color: 'teal' },
  { id: 'winning_tactics', label: 'Winning Tactics', description: 'Proven plays from the field. What works, and when to use it.', color: 'emerald' },
  { id: 'competitor_playbook', label: 'Competitor Playbook', description: 'How to handle Smartsheet, Procore, Northspyre, and others.', color: 'yellow' },
  { id: 'reengagement_playbook', label: 'Reengagement Playbook', description: 'Staged outreach framework for reactivating inactive accounts. Drives the AI campaign builder.', color: 'indigo' },
];

const COLOR_MAP = {
  blue: 'border-blue-200 bg-blue-50', green: 'border-green-200 bg-green-50',
  purple: 'border-purple-200 bg-purple-50', red: 'border-red-200 bg-red-50',
  orange: 'border-orange-200 bg-orange-50', teal: 'border-teal-200 bg-teal-50',
  emerald: 'border-emerald-200 bg-emerald-50', yellow: 'border-yellow-200 bg-yellow-50',
  indigo: 'border-indigo-200 bg-indigo-50',
};
const DOT_MAP = {
  blue: 'bg-blue-500', green: 'bg-green-500', purple: 'bg-purple-500', red: 'bg-red-500',
  orange: 'bg-orange-500', teal: 'bg-teal-500', emerald: 'bg-emerald-500', yellow: 'bg-yellow-500',
  indigo: 'bg-indigo-500',
};

const ROLE_LABELS = { sdr: 'SDR', ae: 'AE', admin: 'Admin', manager: 'Manager', all: 'Everyone' };
const DUE_ANCHOR_LABELS = { trigger: 'when triggered', meeting: 'before/after meeting' };

function StepCard({ step, depth = 0 }) {
  const [open, setOpen] = useState(true);
  const isBranch = step.type === 'branch';
  const offsetLabel = step.due_offset_hours === 0
    ? 'Immediately'
    : step.due_offset_hours < 0
      ? `${Math.abs(step.due_offset_hours)}h before ${DUE_ANCHOR_LABELS[step.due_anchor] || 'meeting'}`
      : `${step.due_offset_hours}h after ${DUE_ANCHOR_LABELS[step.due_anchor] || 'trigger'}`;

  return (
    <div className={`border border-gray-200 rounded-lg bg-white ${depth > 0 ? 'ml-4' : ''}`}>
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <div className="mt-0.5 shrink-0">
          {isBranch
            ? <GitBranch className="w-4 h-4 text-purple-500" />
            : <div className="w-4 h-4 rounded-full border-2 border-gray-300" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{step.title}</p>
            {isBranch && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Branching step</span>}
            {step.condition === 'no_show' && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">If no-show</span>}
          </div>
          {!isBranch && (
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-gray-400">{offsetLabel}</span>
              {step.assignee_role && <span className="text-xs text-gray-400">· {ROLE_LABELS[step.assignee_role] || step.assignee_role}</span>}
            </div>
          )}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          {!isBranch && <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>}
          {isBranch && step.branches?.map(branch => (
            <div key={branch.value} className="mb-4 last:mb-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-full">{branch.label}</span>
              </div>
              <p className="text-xs text-gray-500 mb-2">{step.description}</p>
              <div className="space-y-2">
                {branch.steps?.map(s => <StepCard key={s.id} step={s} depth={depth + 1} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlaybookCard({ playbook, onToggle }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border rounded-xl bg-white overflow-hidden ${playbook.active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
      <div className="flex items-start justify-between p-5 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-base font-bold text-gray-900">{playbook.name}</h3>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
              {ROLE_LABELS[playbook.role] || playbook.role}
            </span>
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium font-mono">
              {playbook.trigger}
            </span>
            {!playbook.active && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>}
          </div>
          <p className="text-sm text-gray-500">{playbook.description}</p>
          <p className="text-xs text-gray-400 mt-1">{playbook.steps?.length || 0} steps · Last updated {new Date(playbook.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <button
            onClick={e => { e.stopPropagation(); onToggle(playbook); }}
            className="text-gray-400 hover:text-gray-700"
            title={playbook.active ? 'Deactivate' : 'Activate'}
          >
            {playbook.active
              ? <ToggleRight className="w-5 h-5 text-green-500" />
              : <ToggleLeft className="w-5 h-5 text-gray-400" />}
          </button>
          {expanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-3">
          {(playbook.steps || []).map(step => (
            <StepCard key={step.id} step={step} />
          ))}
          {(!playbook.steps || playbook.steps.length === 0) && (
            <p className="text-sm text-gray-400 italic">No steps defined yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

const CHANNEL_COLORS = {
  'LinkedIn DM': 'bg-blue-100 text-blue-700',
  'Email': 'bg-green-100 text-green-700',
  'Phone': 'bg-orange-100 text-orange-700',
};

function ReengagementPlaybookView({ data, onEditAsJson }) {
  if (!data || typeof data !== 'object') return null;
  const playbook = typeof data === 'string' ? (() => { try { return JSON.parse(data); } catch { return null; } })() : data;
  if (!playbook) return null;

  return (
    <div className="space-y-6">
      {/* Framework citation */}
      {playbook.framework && (
        <p className="text-xs text-gray-500 italic leading-relaxed border-l-2 border-indigo-200 pl-3">{playbook.framework}</p>
      )}

      {/* Core principles */}
      {playbook.core_principles?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Core Principles</h3>
          <ul className="space-y-1.5">
            {playbook.core_principles.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Role definitions */}
      {playbook.role_definitions && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Role Definitions</h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {Object.entries(playbook.role_definitions).map(([role, def], i, arr) => (
              <div key={role} className={`flex gap-3 p-3 text-sm ${i < arr.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <span className="font-medium text-gray-900 capitalize w-28 shrink-0">{role.replace(/_/g, ' ')}</span>
                <span className="text-gray-600">{def}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stages */}
      {playbook.stages?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Outreach Stages</h3>
          <div className="space-y-4">
            {playbook.stages.map((stage) => (
              <div key={stage.number} className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Stage header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {stage.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{stage.name}</span>
                      <span className="text-xs text-gray-400">Days {stage.days}</span>
                      <div className="flex gap-1 flex-wrap">
                        {stage.contacts?.map(c => (
                          <span key={c} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full capitalize">{c.replace(/_/g, ' ')}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stage body */}
                <div className="p-4 space-y-3">
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Objective</span>
                    <p className="text-sm text-gray-700 mt-0.5">{stage.objective}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Guidance</span>
                    <p className="text-sm text-gray-700 mt-0.5">{stage.guidance}</p>
                  </div>

                  {stage.touches?.length > 0 && (
                    <div className="space-y-3 pt-1">
                      {stage.touches.map((touch, ti) => (
                        <div key={ti} className="border border-gray-100 rounded-lg p-3 bg-white">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-gray-400">Day {touch.day}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CHANNEL_COLORS[touch.channel] || 'bg-gray-100 text-gray-600'}`}>{touch.channel}</span>
                            <span className="text-xs text-gray-500">{touch.purpose}</span>
                          </div>
                          <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-100">{touch.template}</pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detractor strategy */}
      {playbook.detractor_strategy && (
        <div className="rounded-lg bg-red-50 border border-red-100 p-4">
          <h3 className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Detractor Strategy</h3>
          <p className="text-sm text-gray-700">{playbook.detractor_strategy}</p>
        </div>
      )}

      {/* Information Room guide */}
      {playbook.information_room_guide && (
        <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-4">
          <h3 className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1">Information Room Guide</h3>
          <p className="text-sm text-gray-700">{playbook.information_room_guide}</p>
        </div>
      )}

      {/* Footer note */}
      <p className="text-xs text-gray-400 italic pt-1">This playbook drives the AI campaign builder in Account Management.</p>

      {/* Edit as JSON toggle */}
      <div className="pt-2">
        <button onClick={onEditAsJson} className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">Edit as JSON</button>
      </div>
    </div>
  );
}

export default function SalesProcesses() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState('playbooks');
  const [config, setConfig] = useState(null);
  const [draft, setDraft] = useState({});
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const [configLoading, setConfigLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [configError, setConfigError] = useState(null);

  const [playbooks, setPlaybooks] = useState([]);
  const [playbooksLoading, setPlaybooksLoading] = useState(true);
  const [reengagementJsonMode, setReengagementJsonMode] = useState(false);

  useEffect(() => { fetchConfig(); fetchPlaybooks(); }, []);

  async function fetchConfig() {
    setConfigLoading(true);
    try {
      const res = await fetch('/api/sales-process');
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
        setDraft(data.config);
        if (!data.config.reengagement_playbook) {
          fetch('/api/sales-process', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reengagement_playbook: DEFAULT_REENGAGEMENT_PLAYBOOK }),
          }).then(r => r.json()).then(d => {
            if (d.success && d.config) { setConfig(d.config); setDraft(d.config); }
          }).catch(() => {});
        }
      }
    } catch { setConfigError('Failed to load config.'); }
    finally { setConfigLoading(false); }
  }

  async function fetchPlaybooks() {
    setPlaybooksLoading(true);
    try {
      const res = await fetch('/api/playbooks');
      const data = await res.json();
      if (data.success) setPlaybooks(data.playbooks || []);
    } catch { /* silent */ }
    finally { setPlaybooksLoading(false); }
  }

  async function togglePlaybook(playbook) {
    const updated = { id: playbook.id, active: !playbook.active };
    setPlaybooks(prev => prev.map(p => p.id === playbook.id ? { ...p, active: !p.active } : p));
    await fetch('/api/playbooks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  }

  function handleChange(field, value) {
    setDraft(prev => ({ ...prev, [field]: value }));
    setDirty(true);
    setSaved(false);
  }

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    setConfigError(null);
    try {
      const res = await fetch('/api/sales-process', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Save failed');
      setConfig(data.config); setDraft(data.config); setDirty(false); setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { setConfigError(e.message); }
    finally { setSaving(false); }
  }

  const activeS = SECTIONS.find(s => s.id === activeSection);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm shrink-0">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/modules')} className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Sales Processes</h1>
                <p className="text-sm text-gray-500 mt-0.5">The playbooks and config that drive the AI across the whole platform</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {activeTab === 'config' && dirty && (
                <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Unsaved changes
                </span>
              )}
              {activeTab === 'config' && saved && (
                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Saved
                </span>
              )}
              {activeTab === 'config' && (
                <button
                  onClick={handleSave}
                  disabled={!dirty || saving}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40 text-sm font-medium"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              )}
              {user && <UserMenu />}
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 shrink-0">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-0">
            {[
              { id: 'playbooks', label: `Playbooks (${playbooks.length})` },
              { id: 'config', label: 'AI Config' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* AI Config banner */}
      {activeTab === 'config' && (
        <div className="bg-gray-900 text-white px-6 py-3 shrink-0">
          <div className="max-w-7xl mx-auto text-sm text-gray-300">
            <span className="font-semibold text-white">This document drives the AI.</span> Every call analysis, ICP score, discovery score, coaching card, and disqualification flag reads from here. Change something → it applies to all future analyses automatically.
          </div>
        </div>
      )}

      {configError && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 shrink-0">
          <div className="max-w-7xl mx-auto text-sm text-red-700">{configError}</div>
        </div>
      )}

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">

        {/* ── Playbooks tab ── */}
        {activeTab === 'playbooks' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Checklists & Playbooks</h2>
                <p className="text-sm text-gray-500 mt-0.5">When a trigger fires, these tasks are created automatically. Edit here to update every future run.</p>
              </div>
            </div>

            {playbooksLoading ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {playbooks.map(p => (
                  <PlaybookCard key={p.id} playbook={p} onToggle={togglePlaybook} />
                ))}
                {playbooks.length === 0 && (
                  <div className="text-center py-16 text-gray-400">
                    <p className="text-sm">No playbooks yet.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── AI Config tab ── */}
        {activeTab === 'config' && (
          configLoading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          ) : (
            <div className="flex gap-8 min-h-0">
              {/* Section nav */}
              <div className="w-56 shrink-0">
                <nav className="space-y-1 sticky top-8">
                  {SECTIONS.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setActiveSection(s.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2.5 ${
                        activeSection === s.id ? 'bg-gray-900 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${activeSection === s.id ? 'bg-white' : DOT_MAP[s.color]}`} />
                      {s.label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Editor */}
              <div className="flex-1 min-w-0">
                {activeS && (
                  <div>
                    <div className={`rounded-xl border p-5 mb-4 ${COLOR_MAP[activeS.color]}`}>
                      <h2 className="text-lg font-bold text-gray-900 mb-1">{activeS.label}</h2>
                      <p className="text-sm text-gray-600">{activeS.description}</p>
                    </div>

                    {activeS.id === 'reengagement_playbook' && !reengagementJsonMode ? (
                      <div className="border border-gray-200 rounded-xl p-5 bg-white">
                        <ReengagementPlaybookView
                          data={draft[activeS.id]}
                          onEditAsJson={() => setReengagementJsonMode(true)}
                        />
                      </div>
                    ) : (
                      <>
                        {activeS.id === 'reengagement_playbook' && reengagementJsonMode && (
                          <div className="flex items-center justify-between mb-2">
                            <button
                              onClick={() => setReengagementJsonMode(false)}
                              className="text-xs text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
                            >
                              Back to structured view
                            </button>
                          </div>
                        )}
                        <textarea
                          value={
                            activeS.id === 'reengagement_playbook' && typeof draft[activeS.id] === 'object'
                              ? JSON.stringify(draft[activeS.id], null, 2)
                              : (draft[activeS.id] || '')
                          }
                          onChange={e => {
                            if (activeS.id === 'reengagement_playbook') {
                              try {
                                handleChange(activeS.id, JSON.parse(e.target.value));
                              } catch {
                                handleChange(activeS.id, e.target.value);
                              }
                            } else {
                              handleChange(activeS.id, e.target.value);
                            }
                          }}
                          className="w-full h-[calc(100vh-400px)] font-mono text-sm border border-gray-200 rounded-xl p-5 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none bg-white text-gray-800 leading-relaxed"
                          placeholder={`Enter ${activeS.label.toLowerCase()} here…`}
                          spellCheck={false}
                        />
                        <div className="flex items-center justify-between mt-3">
                          <p className="text-xs text-gray-400">
                            {activeS.id === 'reengagement_playbook' ? 'JSON format. Changes apply to all future campaign builds.' : 'Markdown supported. The AI reads this exactly as written — be specific and direct.'}
                          </p>
                          <button
                            onClick={handleSave}
                            disabled={!dirty || saving}
                            className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-40"
                          >
                            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
