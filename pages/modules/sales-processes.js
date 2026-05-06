import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  ArrowLeft, Save, CheckCircle, AlertCircle, RefreshCw,
  Plus, ChevronDown, ChevronRight, Trash2, ToggleLeft, ToggleRight, GitBranch
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import UserMenu from '../../components/auth/UserMenu';

const SECTIONS = [
  { id: 'icp_definition', label: 'ICP Definition', description: 'Who we sell to, who we don\'t, and how to score fit.', color: 'blue' },
  { id: 'discovery_framework', label: 'Discovery Framework', description: 'What must be uncovered on every call. Drives discovery scoring in Call Intelligence.', color: 'green' },
  { id: 'stage_exit_criteria', label: 'Stage Exit Criteria', description: 'What must be true before advancing an account to the next stage.', color: 'purple' },
  { id: 'disqualification_signals', label: 'Disqualification Signals', description: 'Hard stops, soft stops, and the language that signals a deal is limping.', color: 'red' },
  { id: 'coaching_priorities', label: 'Coaching Priorities', description: 'What to coach on first. Ranked by revenue impact. Drives all rep coaching output.', color: 'orange' },
  { id: 'qualification_framework', label: 'Qualification Framework', description: 'The scoring guide for ICP fit (1-10) and discovery quality (1-10).', color: 'teal' },
  { id: 'winning_tactics', label: 'Winning Tactics', description: 'Proven plays from the field. What works, and when to use it.', color: 'emerald' },
  { id: 'competitor_playbook', label: 'Competitor Playbook', description: 'How to handle Smartsheet, Procore, Northspyre, and others.', color: 'yellow' },
];

const COLOR_MAP = {
  blue: 'border-blue-200 bg-blue-50', green: 'border-green-200 bg-green-50',
  purple: 'border-purple-200 bg-purple-50', red: 'border-red-200 bg-red-50',
  orange: 'border-orange-200 bg-orange-50', teal: 'border-teal-200 bg-teal-50',
  emerald: 'border-emerald-200 bg-emerald-50', yellow: 'border-yellow-200 bg-yellow-50',
};
const DOT_MAP = {
  blue: 'bg-blue-500', green: 'bg-green-500', purple: 'bg-purple-500', red: 'bg-red-500',
  orange: 'bg-orange-500', teal: 'bg-teal-500', emerald: 'bg-emerald-500', yellow: 'bg-yellow-500',
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

  useEffect(() => { fetchConfig(); fetchPlaybooks(); }, []);

  async function fetchConfig() {
    setConfigLoading(true);
    try {
      const res = await fetch('/api/sales-process');
      const data = await res.json();
      if (data.success && data.config) { setConfig(data.config); setDraft(data.config); }
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
                    <textarea
                      value={draft[activeS.id] || ''}
                      onChange={e => handleChange(activeS.id, e.target.value)}
                      className="w-full h-[calc(100vh-400px)] font-mono text-sm border border-gray-200 rounded-xl p-5 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none bg-white text-gray-800 leading-relaxed"
                      placeholder={`Enter ${activeS.label.toLowerCase()} here…`}
                      spellCheck={false}
                    />
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-xs text-gray-400">Markdown supported. The AI reads this exactly as written — be specific and direct.</p>
                      <button
                        onClick={handleSave}
                        disabled={!dirty || saving}
                        className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-40"
                      >
                        {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
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
