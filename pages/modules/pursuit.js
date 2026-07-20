import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus,
  Phone,
  Mail,
  Linkedin,
  Calendar,
  Mic,
  X,
  ChevronDown,
  Building2,
  Users,
  MoreHorizontal,
  Target,
  CheckCircle2,
  Clock,
  Zap,
} from 'lucide-react';
import AppShell from '../../components/layout/AppShell';

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const ACCOUNTS_KEY = 'pursuit_accounts';
const TOUCHES_TODAY_KEY = 'sdr_touches_today';
const TOUCHES_ALL_KEY = 'pursuit_touches_all';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function computeCoverage(accountId, allTouches) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const recent = allTouches.filter(
    (t) => t.accountId === accountId && t.touchedAt >= thirtyDaysAgo
  );
  return Math.min(Math.round((recent.length / 8) * 100), 100);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((d - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff < 0 && diff >= -6) return `${Math.abs(diff)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// next touch type cycling: call → email → linkedin → call
function nextTouchType(lastType) {
  const cycle = ['call', 'email', 'linkedin'];
  const idx = cycle.indexOf(lastType);
  if (idx === -1) return 'call';
  return cycle[(idx + 1) % cycle.length];
}

// Outcome options per touch type
const OUTCOME_OPTIONS = {
  call: [
    { value: 'connected', label: 'Connected' },
    { value: 'voicemail', label: 'Voicemail' },
    { value: 'no_answer', label: 'No Answer' },
    { value: 'not_interested', label: 'Not Interested' },
    { value: 'meeting_booked', label: 'Meeting Booked' },
  ],
  email: [
    { value: 'replied', label: 'Replied' },
    { value: 'no_answer', label: 'No Reply' },
    { value: 'other', label: 'Opened Only' },
  ],
  linkedin: [
    { value: 'replied', label: 'Replied' },
    { value: 'no_answer', label: 'No Response' },
    { value: 'connected', label: 'Connection Accepted' },
  ],
  meeting: [
    { value: 'connected', label: 'Completed' },
    { value: 'no_answer', label: 'No Show' },
    { value: 'other', label: 'Rescheduled' },
  ],
  voicemail: [
    { value: 'voicemail', label: 'Left Voicemail' },
    { value: 'no_answer', label: 'No Answer' },
  ],
};

const TOUCH_TYPES = [
  { value: 'call', label: 'Call', Icon: Phone },
  { value: 'email', label: 'Email', Icon: Mail },
  { value: 'linkedin', label: 'LinkedIn', Icon: Linkedin },
  { value: 'meeting', label: 'Meeting', Icon: Calendar },
  { value: 'voicemail', label: 'Voicemail', Icon: Mic },
];

const VERTICALS = ['CRE', 'Asset Management', 'Property Management', 'REIT', 'Other'];

function coverageColor(score) {
  if (score >= 70) return 'bg-green-500';
  if (score >= 30) return 'bg-yellow-400';
  return 'bg-red-400';
}

function coverageTextColor(score) {
  if (score >= 70) return 'text-green-700';
  if (score >= 30) return 'text-yellow-700';
  return 'text-red-600';
}

function TouchTypeIcon({ type, className = 'w-4 h-4' }) {
  const found = TOUCH_TYPES.find((t) => t.value === type);
  if (!found) return null;
  const Icon = found.Icon;
  return <Icon className={className} />;
}

// ─── Add Account Modal ────────────────────────────────────────────────────────

function AddAccountModal({ onClose, onAdd, existingAccounts }) {
  const [name, setName] = useState('');
  const [rank, setRank] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [vertical, setVertical] = useState('');
  const [saving, setSaving] = useState(false);

  const nextRank = existingAccounts.length > 0
    ? Math.max(...existingAccounts.map((a) => a.rank)) + 1
    : 1;

  useEffect(() => {
    setRank(String(nextRank));
  }, []);

  const handleSave = () => {
    if (!name.trim()) return;
    setSaving(true);
    const rankNum = parseInt(rank, 10) || nextRank;
    onAdd({
      id: Date.now().toString(),
      name: name.trim(),
      rank: rankNum,
      hypothesis: hypothesis.trim(),
      vertical: vertical || '',
      hubspotAccountId: '',
      addedAt: new Date().toISOString(),
      lastTouched: null,
      nextTouchType: 'call',
      touchCount30d: 0,
      coverageScore: 0,
      isActive: true,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add Account</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account name <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="e.g. Brookfield Asset Management"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rank</label>
            <input
              type="number"
              min="1"
              max="50"
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vertical</label>
            <select
              value={vertical}
              onChange={(e) => setVertical(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select vertical…</option>
              {VERTICALS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Why we should win this
            </label>
            <textarea
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="What's the ICP fit? Who's the champion? What pain are we solving?"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Account
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Log Touch Modal ──────────────────────────────────────────────────────────

function LogTouchModal({ account, onClose, onSave }) {
  const [touchType, setTouchType] = useState(account?.nextTouchType || 'call');
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset outcome when touch type changes
  useEffect(() => {
    setOutcome('');
  }, [touchType]);

  const outcomeOptions = OUTCOME_OPTIONS[touchType] || [];

  const handleSave = () => {
    if (!outcome) return;
    setSaving(true);
    const touch = {
      id: Date.now().toString(),
      accountId: account.id,
      accountName: account.name,
      touchType,
      outcome,
      notes: notes.trim(),
      touchedAt: new Date().toISOString(),
    };
    onSave(touch);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Log Touch</h2>
            <p className="text-sm text-gray-500 mt-0.5">{account.name}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Touch type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Touch type</label>
            <div className="flex flex-wrap gap-2">
              {TOUCH_TYPES.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => setTouchType(value)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    touchType === value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Outcome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Outcome <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {outcomeOptions.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setOutcome(value)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    outcome === value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-200 text-gray-600 hover:border-blue-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What happened? Any next steps?"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!outcome || saving}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Log Touch'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Hypothesis Modal ────────────────────────────────────────────────────

function EditHypothesisModal({ account, onClose, onSave }) {
  const [name, setName] = useState(account.name);
  const [hypothesis, setHypothesis] = useState(account.hypothesis || '');
  const [vertical, setVertical] = useState(account.vertical || '');

  const handleSave = () => {
    onSave({ name: name.trim() || account.name, hypothesis: hypothesis.trim(), vertical });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Edit Account</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account name</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vertical</label>
            <select
              value={vertical}
              onChange={(e) => setVertical(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select vertical…</option>
              {VERTICALS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Why we should win this</label>
            <textarea
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="ICP fit, champion, pain being solved…"
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Row Ellipsis Menu ────────────────────────────────────────────────────────

function RowMenu({ account, onEdit, onRemove }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-44 z-20">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onEdit(account);
            }}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Edit hypothesis
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onRemove(account.id);
            }}
            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            Remove from list
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({ account, allTouches, onClose, onLogTouch, onUpdateAccount }) {
  const [editingHypothesis, setEditingHypothesis] = useState(false);
  const [hypothesisText, setHypothesisText] = useState(account.hypothesis || '');
  const [showLogTouch, setShowLogTouch] = useState(false);

  const accountTouches = allTouches
    .filter((t) => t.accountId === account.id)
    .sort((a, b) => (a.touchedAt > b.touchedAt ? -1 : 1));

  const OUTCOME_LABELS = {
    connected: 'Connected',
    voicemail: 'Voicemail',
    no_answer: 'No Answer',
    replied: 'Replied',
    meeting_booked: 'Meeting Booked',
    not_interested: 'Not Interested',
    other: 'Other',
  };

  const OUTCOME_COLORS = {
    connected: 'bg-green-100 text-green-700',
    replied: 'bg-green-100 text-green-700',
    meeting_booked: 'bg-blue-100 text-blue-700',
    voicemail: 'bg-yellow-100 text-yellow-700',
    no_answer: 'bg-gray-100 text-gray-600',
    not_interested: 'bg-red-100 text-red-700',
    other: 'bg-gray-100 text-gray-600',
  };

  const handleHypothesisSave = () => {
    onUpdateAccount(account.id, { hypothesis: hypothesisText.trim() });
    setEditingHypothesis(false);
  };

  const score = account.coverageScore || 0;
  const scoreColor = score >= 70 ? '#22c55e' : score >= 30 ? '#eab308' : '#ef4444';

  // Simple arc progress: full circle at 100%
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-30" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white border-l border-gray-200 shadow-2xl z-40 flex flex-col overflow-hidden">
        {/* Panel header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 leading-snug">{account.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              {account.vertical && (
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100">
                  {account.vertical}
                </span>
              )}
              <span className="text-xs text-gray-400">Rank #{account.rank}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-700 flex-shrink-0 ml-3"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Coverage score arc */}
          <div className="flex items-center gap-6 px-5 py-5 border-b border-gray-100">
            <div className="relative flex-shrink-0">
              <svg width="100" height="100" className="-rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke="#f3f4f6"
                  strokeWidth="10"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="10"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-gray-900">{score}</span>
                <span className="text-xs text-gray-400">/ 100</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Coverage Score</p>
              <p className="text-xs text-gray-500 mt-0.5">{account.touchCount30d} touches in last 30 days</p>
              <p className="text-xs text-gray-400 mt-0.5">Target: 8 per 30 days</p>
              {account.lastTouched && (
                <p className="text-xs text-gray-500 mt-1">
                  Last: {formatDate(account.lastTouched)}
                </p>
              )}
            </div>
          </div>

          {/* Hypothesis */}
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">Why we should win this</p>
              {!editingHypothesis && (
                <button
                  onClick={() => setEditingHypothesis(true)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Edit
                </button>
              )}
            </div>
            {editingHypothesis ? (
              <div>
                <textarea
                  autoFocus
                  value={hypothesisText}
                  onChange={(e) => setHypothesisText(e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="ICP fit, champion, pain being solved…"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setEditingHypothesis(false)}
                    className="px-3 py-1 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleHypothesisSave}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600 leading-relaxed">
                {account.hypothesis || (
                  <span className="text-gray-400 italic">No hypothesis yet — click Edit to add one.</span>
                )}
              </p>
            )}
          </div>

          {/* Log Touch button */}
          <div className="px-5 py-4 border-b border-gray-100">
            <button
              onClick={() => setShowLogTouch(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Log Touch
            </button>
          </div>

          {/* Touch history */}
          <div className="px-5 py-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">
              Touch History{' '}
              <span className="text-gray-400 font-normal">({accountTouches.length})</span>
            </p>

            {accountTouches.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No touches logged yet.</p>
            ) : (
              <div className="space-y-3">
                {accountTouches.map((touch) => (
                  <div
                    key={touch.id}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100"
                  >
                    <div className="flex-shrink-0 mt-0.5 text-gray-500">
                      <TouchTypeIcon type={touch.touchType} className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-700 capitalize">
                          {touch.touchType}
                        </span>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {formatDate(touch.touchedAt)}
                        </span>
                      </div>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          OUTCOME_COLORS[touch.outcome] || 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {OUTCOME_LABELS[touch.outcome] || touch.outcome}
                      </span>
                      {touch.notes && (
                        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{touch.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showLogTouch && (
        <LogTouchModal
          account={account}
          onClose={() => setShowLogTouch(false)}
          onSave={(touch) => {
            onLogTouch(touch);
            setShowLogTouch(false);
          }}
        />
      )}
    </>
  );
}

// ─── Account Row ──────────────────────────────────────────────────────────────

function AccountRow({ account, onRowClick, onLogTouch, onEdit, onRemove, onRankChange }) {
  const [editingRank, setEditingRank] = useState(false);
  const [rankVal, setRankVal] = useState(String(account.rank));

  const score = account.coverageScore || 0;
  const lastTouchedType = account.lastTouchedType || null;

  const NEXT_TOUCH_COLORS = {
    call: 'bg-blue-100 text-blue-700',
    email: 'bg-purple-100 text-purple-700',
    linkedin: 'bg-indigo-100 text-indigo-700',
    meeting: 'bg-green-100 text-green-700',
    voicemail: 'bg-yellow-100 text-yellow-700',
  };

  const handleRankBlur = () => {
    const parsed = parseInt(rankVal, 10);
    if (!isNaN(parsed) && parsed > 0) {
      onRankChange(account.id, parsed);
    } else {
      setRankVal(String(account.rank));
    }
    setEditingRank(false);
  };

  return (
    <tr
      className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors cursor-pointer"
      onClick={() => onRowClick(account)}
    >
      {/* Rank */}
      <td className="py-3 pl-4 pr-2 w-12" onClick={(e) => e.stopPropagation()}>
        {editingRank ? (
          <input
            autoFocus
            type="number"
            value={rankVal}
            onChange={(e) => setRankVal(e.target.value)}
            onBlur={handleRankBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRankBlur();
              if (e.key === 'Escape') {
                setRankVal(String(account.rank));
                setEditingRank(false);
              }
            }}
            className="w-10 text-center border border-blue-400 rounded px-1 py-0.5 text-sm focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setEditingRank(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-sm font-semibold text-gray-500"
            title="Click to change rank"
          >
            {account.rank}
          </button>
        )}
      </td>

      {/* Account name */}
      <td className="py-3 px-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">{account.name}</p>
          {account.vertical && (
            <p className="text-xs text-gray-400 mt-0.5">{account.vertical}</p>
          )}
        </div>
      </td>

      {/* Coverage score */}
      <td className="py-3 px-2 w-32">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${coverageColor(score)}`}
              style={{ width: `${score}%` }}
            />
          </div>
          <span className={`text-xs font-semibold w-8 text-right ${coverageTextColor(score)}`}>
            {score}%
          </span>
        </div>
      </td>

      {/* Last touch */}
      <td className="py-3 px-2 w-28">
        <div className="flex items-center gap-1.5 text-gray-500">
          {account.lastTouched ? (
            <>
              {lastTouchedType && (
                <TouchTypeIcon type={lastTouchedType} className="w-3.5 h-3.5 flex-shrink-0" />
              )}
              <span className="text-xs">{formatDate(account.lastTouched)}</span>
            </>
          ) : (
            <span className="text-xs text-gray-300">Never</span>
          )}
        </div>
      </td>

      {/* Next touch */}
      <td className="py-3 px-2 w-28">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
            NEXT_TOUCH_COLORS[account.nextTouchType] || 'bg-gray-100 text-gray-600'
          }`}
        >
          <TouchTypeIcon type={account.nextTouchType} className="w-3 h-3" />
          {TOUCH_TYPES.find((t) => t.value === account.nextTouchType)?.label || 'Call'}
        </span>
      </td>

      {/* 30d touches */}
      <td className="py-3 px-2 w-16 text-center">
        <span className="text-sm font-semibold text-gray-700">{account.touchCount30d}</span>
        <span className="text-xs text-gray-400">/8</span>
      </td>

      {/* Actions */}
      <td className="py-3 pl-2 pr-4 w-28" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLogTouch(account);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Log
          </button>
          <RowMenu account={account} onEdit={onEdit} onRemove={onRemove} />
        </div>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PursuitPage() {
  const [accounts, setAccounts] = useState([]);
  const [allTouches, setAllTouches] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [logTouchAccount, setLogTouchAccount] = useState(null);
  const [editAccount, setEditAccount] = useState(null);
  const [detailAccount, setDetailAccount] = useState(null);

  // Load from localStorage on mount
  useEffect(() => {
    const storedAccounts = loadLS(ACCOUNTS_KEY, []);
    const storedTouches = loadLS(TOUCHES_ALL_KEY, []);

    // Recompute coverage scores on mount
    const recomputed = storedAccounts.map((a) => ({
      ...a,
      coverageScore: computeCoverage(a.id, storedTouches),
      touchCount30d: (() => {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        return storedTouches.filter(
          (t) => t.accountId === a.id && t.touchedAt >= thirtyDaysAgo
        ).length;
      })(),
    }));

    setAccounts(recomputed.sort((a, b) => a.rank - b.rank));
    setAllTouches(storedTouches);
  }, []);

  // Persist accounts to localStorage whenever they change
  const persistAccounts = useCallback((accs) => {
    saveLS(ACCOUNTS_KEY, accs);
  }, []);

  // Persist touches
  const persistTouches = useCallback((touches) => {
    saveLS(TOUCHES_ALL_KEY, touches);
    // Also update sdr_touches_today
    const today = todayISO();
    const todayTouches = touches.filter((t) => t.touchedAt.slice(0, 10) === today);
    saveLS(TOUCHES_TODAY_KEY, todayTouches);
  }, []);

  // Stats
  const activeAccounts = accounts.filter((a) => a.isActive);
  const avgCoverage =
    activeAccounts.length > 0
      ? Math.round(activeAccounts.reduce((s, a) => s + a.coverageScore, 0) / activeAccounts.length)
      : 0;

  const today = todayISO();
  const touchesToday = allTouches.filter((t) => t.touchedAt.slice(0, 10) === today).length;
  const meetingsBooked = allTouches.filter((t) => t.outcome === 'meeting_booked').length;

  // Add account
  const handleAddAccount = (newAccount) => {
    const updated = [...accounts, newAccount].sort((a, b) => a.rank - b.rank);
    setAccounts(updated);
    persistAccounts(updated);
  };

  // Log touch
  const handleLogTouch = useCallback(
    (touch) => {
      const updatedTouches = [touch, ...allTouches];
      setAllTouches(updatedTouches);
      persistTouches(updatedTouches);

      // Update account metadata
      setAccounts((prev) => {
        const updated = prev.map((a) => {
          if (a.id !== touch.accountId) return a;
          const newScore = computeCoverage(a.id, updatedTouches);
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const count30d = updatedTouches.filter(
            (t) => t.accountId === a.id && t.touchedAt >= thirtyDaysAgo
          ).length;
          return {
            ...a,
            lastTouched: touch.touchedAt,
            lastTouchedType: touch.touchType,
            nextTouchType: nextTouchType(touch.touchType),
            touchCount30d: count30d,
            coverageScore: newScore,
          };
        });
        persistAccounts(updated);
        return updated;
      });

      // Update detail panel account if open
      if (detailAccount && detailAccount.id === touch.accountId) {
        setDetailAccount((prev) => {
          if (!prev) return prev;
          const updatedAll = [touch, ...allTouches];
          const newScore = computeCoverage(prev.id, updatedAll);
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const count30d = updatedAll.filter(
            (t) => t.accountId === prev.id && t.touchedAt >= thirtyDaysAgo
          ).length;
          return {
            ...prev,
            lastTouched: touch.touchedAt,
            lastTouchedType: touch.touchType,
            nextTouchType: nextTouchType(touch.touchType),
            touchCount30d: count30d,
            coverageScore: newScore,
          };
        });
      }
    },
    [allTouches, detailAccount, persistAccounts, persistTouches]
  );

  // Update account fields
  const handleUpdateAccount = useCallback(
    (accountId, fields) => {
      setAccounts((prev) => {
        const updated = prev.map((a) => (a.id === accountId ? { ...a, ...fields } : a));
        persistAccounts(updated);
        return updated;
      });
      if (detailAccount && detailAccount.id === accountId) {
        setDetailAccount((prev) => (prev ? { ...prev, ...fields } : prev));
      }
    },
    [detailAccount, persistAccounts]
  );

  // Edit account (from modal)
  const handleEditSave = useCallback(
    (accountId, fields) => {
      handleUpdateAccount(accountId, fields);
    },
    [handleUpdateAccount]
  );

  // Remove account
  const handleRemove = useCallback(
    (accountId) => {
      setAccounts((prev) => {
        const updated = prev.filter((a) => a.id !== accountId);
        persistAccounts(updated);
        return updated;
      });
      if (detailAccount && detailAccount.id === accountId) {
        setDetailAccount(null);
      }
    },
    [detailAccount, persistAccounts]
  );

  // Change rank
  const handleRankChange = useCallback(
    (accountId, newRank) => {
      setAccounts((prev) => {
        const updated = prev
          .map((a) => (a.id === accountId ? { ...a, rank: newRank } : a))
          .sort((a, b) => a.rank - b.rank);
        persistAccounts(updated);
        return updated;
      });
    },
    [persistAccounts]
  );

  const sortedAccounts = [...accounts].sort((a, b) => a.rank - b.rank);

  return (
    <AppShell
      title="Account Pursuit"
      subtitle="Top 50 named accounts"
      actions={
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Account
        </button>
      }
    >
      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-3xl font-bold text-gray-900">{activeAccounts.length}</p>
            <p className="text-xs text-gray-500 mt-1">Total accounts</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p
              className={`text-3xl font-bold ${
                avgCoverage >= 70
                  ? 'text-green-600'
                  : avgCoverage >= 30
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }`}
            >
              {avgCoverage}%
            </p>
            <p className="text-xs text-gray-500 mt-1">Avg coverage score</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-3xl font-bold text-blue-600">{touchesToday}</p>
            <p className="text-xs text-gray-500 mt-1">Touches today</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-3xl font-bold text-green-600">{meetingsBooked}</p>
            <p className="text-xs text-gray-500 mt-1">Meetings booked</p>
          </div>
        </div>

        {/* Empty state */}
        {sortedAccounts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 py-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
              <Target className="w-8 h-8 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Start building your pursuit list</h2>
            <p className="text-sm text-gray-500 mb-6 max-w-xs">
              Add your top named accounts and track coverage across calls, emails, LinkedIn, and meetings.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add your first account
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="py-3 pl-4 pr-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">
                    #
                  </th>
                  <th className="py-3 px-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="py-3 px-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">
                    Coverage
                  </th>
                  <th className="py-3 px-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">
                    Last Touch
                  </th>
                  <th className="py-3 px-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">
                    Next Touch
                  </th>
                  <th className="py-3 px-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">
                    30d
                  </th>
                  <th className="py-3 pl-2 pr-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedAccounts.map((account) => (
                  <AccountRow
                    key={account.id}
                    account={account}
                    onRowClick={(a) => setDetailAccount(a)}
                    onLogTouch={(a) => setLogTouchAccount(a)}
                    onEdit={(a) => setEditAccount(a)}
                    onRemove={handleRemove}
                    onRankChange={handleRankChange}
                  />
                ))}
              </tbody>
            </table>

            {/* Table footer */}
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {sortedAccounts.length} account{sortedAccounts.length !== 1 ? 's' : ''}
                {sortedAccounts.length < 50 ? ` · ${50 - sortedAccounts.length} slots remaining` : ' · List full'}
              </p>
              <p className="text-xs text-gray-400">Click rank number to reorder · Click row to view details</p>
            </div>
          </div>
        )}
      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <AddAccountModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddAccount}
          existingAccounts={accounts}
        />
      )}

      {/* Log Touch Modal (from table row) */}
      {logTouchAccount && (
        <LogTouchModal
          account={logTouchAccount}
          onClose={() => setLogTouchAccount(null)}
          onSave={(touch) => {
            handleLogTouch(touch);
            setLogTouchAccount(null);
          }}
        />
      )}

      {/* Edit Hypothesis Modal */}
      {editAccount && (
        <EditHypothesisModal
          account={editAccount}
          onClose={() => setEditAccount(null)}
          onSave={(fields) => {
            handleEditSave(editAccount.id, fields);
            setEditAccount(null);
          }}
        />
      )}

      {/* Detail Panel */}
      {detailAccount && (
        <DetailPanel
          account={detailAccount}
          allTouches={allTouches}
          onClose={() => setDetailAccount(null)}
          onLogTouch={handleLogTouch}
          onUpdateAccount={handleUpdateAccount}
        />
      )}
    </AppShell>
  );
}
