import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { Building2, AlertCircle, Sparkles, Search, Filter, X, ChevronDown, Flame, Archive, Eye, EyeOff, RefreshCw, CheckCircle, MessageSquare, Check } from 'lucide-react';

// Hooks
import { useAccounts } from '../../hooks/useAccounts';
import { useAccountStore } from '../../stores/useAccountStore';

// Layout shell
import AppShell from '../../components/layout/AppShell';

// Constants
import { TABS, STAGE_LABELS, STAGE_COLORS, ALL_STAGE_ORDER, ACTIVE_STAGE_ORDER, INACTIVE_STAGE_IDS, CLOSED_STAGE_IDS } from '../../lib/constants';

// Layout components
import AISidebar from '../../components/layout/AISidebar';
import ErrorBoundary, { SectionErrorBoundary } from '../../components/common/ErrorBoundary';

// Modal components
import NewAccountModal from '../../components/modals/NewAccountModal';
import NewTranscriptModal from '../../components/modals/NewTranscriptModal';
import NewStakeholderModal from '../../components/modals/NewStakeholderModal';
import DemoBriefModal from '../../components/modals/DemoBriefModal';

// Tab components
import OverviewTab from '../../components/tabs/OverviewTab';
import TranscriptsTab from '../../components/tabs/TranscriptsTab';
import CurrentStateTab from '../../components/tabs/CurrentStateTab';
import StakeholdersTab from '../../components/tabs/StakeholdersTab';
import InformationGapsTab from '../../components/tabs/InformationGapsTab';
import ContentTab from '../../components/tabs/ContentTab';
import TimelineTab from '../../components/tabs/TimelineTab';
import ChatTab from '../../components/tabs/ChatTab';

const INACTIVE_STAGES = new Set([...INACTIVE_STAGE_IDS, 'won', 'lost'])
const CLOSED_STAGES = new Set([...CLOSED_STAGE_IDS, 'won', 'lost'])

// ─── Journey Tab ──────────────────────────────────────────────────────────────

function JourneyTab({ account }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!account?.id) return
    fetch(`/api/accounts/stage-history?accountId=${account.id}`)
      .then(r => r.json())
      .then(d => setHistory(d.history || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [account?.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray-400">
        Loading journey…
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-gray-400">
        No stage history recorded yet.
      </div>
    )
  }

  const totalDays = history.reduce((sum, h) => sum + (h.days_in_prior_stage || 0), 0)

  return (
    <div className="p-6 space-y-1">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Stage Journey</h3>
        {totalDays > 0 && (
          <span className="text-xs text-gray-400">{totalDays} days total tracked</span>
        )}
      </div>

      <div className="relative">
        {/* Vertical connector */}
        <div className="absolute left-[15px] top-6 bottom-6 w-px bg-gray-200" />

        <div className="space-y-0">
          {history.map((step, i) => {
            const isLast = i === history.length - 1
            const fromLabel = STAGE_LABELS[step.from_stage] || step.from_stage || '—'
            const toLabel = STAGE_LABELS[step.to_stage] || step.to_stage || '—'
            const isWon = step.to_stage === 'closed_won' || step.to_stage === 'won'
            const isLost = step.to_stage === 'closed_lost' || step.to_stage === 'lost'
            const dotColor = isWon ? 'bg-green-500' : isLost ? 'bg-red-400' : 'bg-blue-500'

            return (
              <div key={step.id} className="flex items-start gap-4 py-3">
                <div className={`w-[30px] flex-shrink-0 flex items-center justify-center pt-0.5`}>
                  <div className={`w-3 h-3 rounded-full border-2 border-white shadow ${dotColor} z-10`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{toLabel}</span>
                    {step.days_in_prior_stage != null && (
                      <span className="text-xs text-gray-400">after {step.days_in_prior_stage}d in {fromLabel}</span>
                    )}
                    {isLast && !isWon && !isLost && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">current</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">
                      {step.changed_at ? new Date(step.changed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                    </span>
                    {step.changed_by_name && (
                      <span className="text-xs text-gray-400">· {step.changed_by_name}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── CS Handover Tab ──────────────────────────────────────────────────────────

function CSHandoverTab({ account }) {
  const [brief, setBrief] = useState(null)
  const [loading, setLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef(null)

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const generate = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/accounts/cs-handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: account.id }),
      })
      const data = await res.json()
      if (data.brief) setBrief(data.brief)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  const sendChat = async () => {
    const msg = chatInput.trim()
    if (!msg || chatLoading) return
    const updated = [...chatMessages, { role: 'user', content: msg }]
    setChatMessages(updated)
    setChatInput('')
    setChatLoading(true)
    try {
      const res = await fetch('/api/accounts/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: account.id, messages: updated }),
      })
      const data = await res.json()
      if (data.message) setChatMessages(prev => [...prev, { role: 'assistant', content: data.message }])
    } catch { /* silent */ }
    finally { setChatLoading(false) }
  }

  if (!brief) {
    return (
      <div className="p-6">
        <div className="max-w-lg mx-auto text-center py-12">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Deal Closed — Great work!</h3>
          <p className="text-sm text-gray-500 mb-6">
            Generate a CS handover brief from all calls, commitments, and deal context so your CS team can hit the ground running.
          </p>
          <button
            onClick={generate}
            disabled={loading}
            className="px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Generating…' : 'Generate Handover Brief'}
          </button>
        </div>
      </div>
    )
  }

  const Section = ({ title, children }) => (
    <div className="bg-white border rounded-xl overflow-hidden mb-4">
      <div className="px-4 py-2.5 border-b bg-gray-50">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{title}</span>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  )

  const List = ({ items }) => (
    <ul className="space-y-1.5">
      {(items || []).map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
          <span className="text-gray-400 mt-0.5">•</span>{item}
        </li>
      ))}
    </ul>
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold text-gray-900">CS Handover Brief</h3>
          <p className="text-xs text-gray-400 mt-0.5">Generated from {brief.callCount} analyzed calls · {brief.generatedAt ? new Date(brief.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</p>
        </div>
        <button onClick={generate} disabled={loading} className="text-xs text-gray-400 hover:text-gray-600">
          {loading ? 'Regenerating…' : 'Regenerate'}
        </button>
      </div>

      <Section title="What was sold">
        <p className="text-sm text-gray-700">{brief.what_was_sold}</p>
      </Section>

      <Section title="Key contacts">
        <List items={brief.key_contacts} />
      </Section>

      {brief.integrations_promised?.length > 0 && (
        <Section title="Integrations & commitments">
          <List items={brief.integrations_promised} />
        </Section>
      )}

      {brief.implementation_timeline && (
        <Section title="Implementation timeline">
          <p className="text-sm text-gray-700">{brief.implementation_timeline}</p>
        </Section>
      )}

      {brief.known_risks?.length > 0 && (
        <Section title="Risks & watch-outs for CS">
          <List items={brief.known_risks} />
        </Section>
      )}

      {brief.open_questions?.length > 0 && (
        <Section title="Open questions to resolve">
          <List items={brief.open_questions} />
        </Section>
      )}

      {brief.tone_notes && (
        <Section title="Relationship notes">
          <p className="text-sm text-gray-600 italic">{brief.tone_notes}</p>
        </Section>
      )}

      {/* Follow-up chat */}
      <div className="mt-6 bg-white border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b bg-gray-50">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Ask about the deal</span>
        </div>
        <div className="p-4">
          {chatMessages.length > 0 && (
            <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                    m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 px-3 py-2 rounded-xl text-sm text-gray-400">…</div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="e.g. What integration did we promise? What's the timeline?"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={sendChat}
              disabled={chatLoading || !chatInput.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Ask
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CompetitorTags({ account, onSave }) {
  const [c1, setC1] = useState(account?.competitor1 || '')
  const [c2, setC2] = useState(account?.competitor2 || '')

  useEffect(() => {
    setC1(account?.competitor1 || '')
    setC2(account?.competitor2 || '')
  }, [account?.id, account?.competitor1, account?.competitor2])

  const save1 = () => onSave({ competitor1: c1.trim() || null })
  const save2 = () => onSave({ competitor2: c2.trim() || null })

  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <span className="text-xs text-gray-400 font-medium">vs.</span>
      <div className="flex items-center gap-0.5 bg-gray-100 rounded-full px-2 py-0.5 border border-gray-200">
        <input
          type="text"
          value={c1}
          onChange={e => setC1(e.target.value)}
          onBlur={save1}
          onKeyDown={e => e.key === 'Enter' && e.target.blur()}
          placeholder="Competitor 1"
          className="text-xs bg-transparent outline-none text-gray-700 placeholder-gray-400 w-24"
        />
        {c1 && (
          <button onClick={() => { setC1(''); onSave({ competitor1: null }) }} className="text-gray-400 hover:text-gray-600 ml-0.5">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-0.5 bg-gray-100 rounded-full px-2 py-0.5 border border-gray-200">
        <input
          type="text"
          value={c2}
          onChange={e => setC2(e.target.value)}
          onBlur={save2}
          onKeyDown={e => e.key === 'Enter' && e.target.blur()}
          placeholder="Competitor 2"
          className="text-xs bg-transparent outline-none text-gray-700 placeholder-gray-400 w-24"
        />
        {c2 && (
          <button onClick={() => { setC2(''); onSave({ competitor2: null }) }} className="text-gray-400 hover:text-gray-600 ml-0.5">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}

export default function Home() {
  const router = useRouter();
  const store = useAccountStore();

  // Account state from custom hook
  const {
    accounts,
    selectedAccount,
    setSelectedAccount,
    isProcessing,
    createAccount,
    addTranscript,
    addGongTranscript,
    addStakeholder,
    applyAssistantActions,
    updateAccountField,
    deleteAccount,
    fetchAccountDetail,
  } = useAccounts();

  // UI state
  const [activeTab, setActiveTab] = useState('overview');
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [showNewTranscript, setShowNewTranscript] = useState(false);
  const [showNewStakeholder, setShowNewStakeholder] = useState(false);
  const [showAISidebar, setShowAISidebar] = useState(false);
  const [showDemoBrief, setShowDemoBrief] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Sidebar filter state
  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [myOwnerName, setMyOwnerName] = useState('');
  const [filterCompetitor, setFilterCompetitor] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [sortBy, setSortBy] = useState('az'); // az | last_call | call_count | cold
  const [callStats, setCallStats] = useState({});

  // Campaign builder state
  const [campaignMode, setCampaignMode] = useState(false)
  const [selectedForCampaign, setSelectedForCampaign] = useState(new Set())
  const [showCampaignModal, setShowCampaignModal] = useState(false)
  const [campaignStep, setCampaignStep] = useState(1)
  const [campaignStakeholders, setCampaignStakeholders] = useState({})
  const [loadingStakeholders, setLoadingStakeholders] = useState(false)
  const [campaignAssignee, setCampaignAssignee] = useState(null)
  const [teamMembers, setTeamMembers] = useState([])
  const [buildingCampaign, setBuildingCampaign] = useState(false)
  const [campaignResult, setCampaignResult] = useState(null)

  // Reengagement state
  const [reengageLoading, setReengageLoading] = useState(false);
  const [reengageBrief, setReengageBrief] = useState(null);
  const [showReengage, setShowReengage] = useState(false);

  // Quick note state
  const [showQuickNote, setShowQuickNote] = useState(false);
  const [quickNoteText, setQuickNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const quickNoteRef = useRef(null);

  // Memory count badge
  const [memoryCount, setMemoryCount] = useState(0);

  // Risk score state (optimistic updates after rescore)
  const [rescoring, setRescoring] = useState(false);
  const [rescoreResult, setRescoreResult] = useState(null);

  const handleRescore = useCallback(async () => {
    if (!selectedAccount?.id || rescoring) return;
    setRescoring(true);
    try {
      const r = await fetch(`/api/accounts/${selectedAccount.id}/rescore`, { method: 'POST' });
      const d = await r.json();
      if (d.risk_score != null) {
        setRescoreResult({ riskScore: d.risk_score, riskFactors: d.risk_factors });
      }
    } catch { /* silent */ }
    finally { setRescoring(false); }
  }, [selectedAccount?.id, rescoring]);

  useEffect(() => {
    setRescoreResult(null);
  }, [selectedAccount?.id]);

  useEffect(() => {
    if (!selectedAccount?.id) { setMemoryCount(0); return; }
    fetch(`/api/accounts/${selectedAccount.id}/memory`)
      .then(r => r.json())
      .then(d => setMemoryCount(Array.isArray(d.memories) ? d.memories.length : 0))
      .catch(() => setMemoryCount(0));
  }, [selectedAccount?.id]);

  // Form state
  const [accountName, setAccountName] = useState('');
  const [companyUrl, setCompanyUrl] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [stakeholderName, setStakeholderName] = useState('');
  const [stakeholderTitle, setStakeholderTitle] = useState('');
  const [stakeholderDept, setStakeholderDept] = useState('');
  const [stakeholderRole, setStakeholderRole] = useState('Neutral');

  // Auto-select account from query param (e.g. when navigating from Outbound Engine)
  useEffect(() => {
    const { account: accountId } = router.query;
    if (accountId && accounts.length > 0) {
      const target = accounts.find(a => a.id === accountId);
      if (target) handleSelectAccount(target);
    }
  }, [router.query, accounts]);

  // Load current user profile to default owner filter to "my accounts"
  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then(d => {
        if (d.profile?.full_name) {
          setMyOwnerName(d.profile.full_name)
          setFilterOwner(d.profile.full_name)
        }
      })
      .catch(() => {})
  }, [])

  // Load call stats for sort/filter (once on mount)
  useEffect(() => {
    fetch('/api/accounts/call-stats')
      .then(r => r.json())
      .then(d => { if (d.stats) setCallStats(d.stats) })
      .catch(() => {})
  }, [])

  // Derive unique owners for filter dropdown
  const uniqueOwners = useMemo(() => {
    const names = [...new Set(accounts.map(a => a.ownerName).filter(Boolean))].sort()
    return names
  }, [accounts])

  // Derive unique competitors for filter dropdown
  const uniqueCompetitors = useMemo(() => {
    const names = new Set()
    accounts.forEach(a => {
      if (a.competitor1) names.add(a.competitor1)
      if (a.competitor2) names.add(a.competitor2)
    })
    return [...names].sort()
  }, [accounts])

  // Derive unique stages in pipeline order
  const uniqueStages = useMemo(() => {
    const present = new Set(accounts.map(a => a.stage).filter(Boolean))
    return ALL_STAGE_ORDER.filter(s => present.has(s))
  }, [accounts])

  // Filter + search + sort accounts
  const filteredAccounts = useMemo(() => {
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000

    const filtered = accounts.filter(a => {
      if (!filterStage) {
        if (CLOSED_STAGES.has(a.stage)) return false
        if (INACTIVE_STAGES.has(a.stage)) return false
      } else if (filterStage === '__inactive') {
        if (!INACTIVE_STAGES.has(a.stage)) return false
      } else if (filterStage === '__closed') {
        if (!CLOSED_STAGES.has(a.stage)) return false
      } else {
        if (a.stage !== filterStage) return false
      }
      if (filterOwner && a.ownerName !== filterOwner) return false
      if (filterCompetitor && a.competitor1 !== filterCompetitor && a.competitor2 !== filterCompetitor) return false

      // Cold filter
      if (sortBy === 'cold') {
        const stats = callStats[a.id]
        const daysSince = stats?.lastCallDate
          ? Math.floor((now - new Date(stats.lastCallDate).getTime()) / dayMs)
          : null
        if (daysSince !== null && daysSince < 30) return false
      }

      if (search) {
        const q = search.toLowerCase()
        return a.name?.toLowerCase().includes(q) || a.ownerName?.toLowerCase().includes(q) || a.stage?.toLowerCase().includes(q)
      }
      return true
    })

    // Sort
    if (sortBy === 'last_call') {
      filtered.sort((a, b) => {
        const aDate = callStats[a.id]?.lastCallDate
        const bDate = callStats[b.id]?.lastCallDate
        if (!aDate && !bDate) return a.name.localeCompare(b.name)
        if (!aDate) return 1
        if (!bDate) return -1
        return new Date(bDate) - new Date(aDate) // most recent first
      })
    } else if (sortBy === 'call_count') {
      filtered.sort((a, b) => {
        const aCount = callStats[a.id]?.callCount || 0
        const bCount = callStats[b.id]?.callCount || 0
        return bCount - aCount
      })
    } else if (sortBy === 'cold') {
      // Sort coldest (longest without contact) first
      filtered.sort((a, b) => {
        const aDate = callStats[a.id]?.lastCallDate
        const bDate = callStats[b.id]?.lastCallDate
        if (!aDate && !bDate) return a.name.localeCompare(b.name)
        if (!aDate) return -1 // never called = coldest = first
        if (!bDate) return 1
        return new Date(aDate) - new Date(bDate) // oldest contact first
      })
    } else if (sortBy === 'stage') {
      filtered.sort((a, b) => {
        const aIdx = ALL_STAGE_ORDER.indexOf(a.stage)
        const bIdx = ALL_STAGE_ORDER.indexOf(b.stage)
        return aIdx - bIdx
      })
    }
    // Default 'az': already in name order from API

    return filtered
  }, [accounts, search, filterStage, filterOwner, sortBy, callStats])

  const activeCount = filteredAccounts.length
  const hasFilters = search || filterStage || filterOwner || filterCompetitor || sortBy !== 'az'

  // Select account + load detail
  const handleSelectAccount = useCallback(async (account) => {
    setSelectedAccount(account)
    setActiveTab('overview')
    setDetailLoading(true)
    try {
      await store.fetchAccountDetail(account.id)
    } finally {
      setDetailLoading(false)
    }
  }, [setSelectedAccount, store])

  // Modal handlers
  const closeAccountModal = () => {
    setShowNewAccount(false);
    setAccountName('');
    setCompanyUrl('');
  };

  const closeTranscriptModal = () => {
    setShowNewTranscript(false);
    setTranscriptText('');
  };

  const closeStakeholderModal = () => {
    setShowNewStakeholder(false);
    setStakeholderName('');
    setStakeholderTitle('');
    setStakeholderDept('');
    setStakeholderRole('Neutral');
  };

  // Action handlers
  const handleCreateAccount = () => {
    createAccount(accountName, companyUrl);
    closeAccountModal();
  };

  const handleAddTranscript = async () => {
    const success = await addTranscript(transcriptText);
    if (success) closeTranscriptModal();
  };

  const handleAddStakeholder = () => {
    const success = addStakeholder(stakeholderName, stakeholderTitle, stakeholderDept, stakeholderRole);
    if (success) closeStakeholderModal();
  };

  // Bulk add stakeholders (from HubSpot import)
  const handleBulkAddStakeholders = useCallback(async (contacts) => {
    if (!selectedAccount) return
    for (const contact of contacts) {
      await store.addStakeholder(selectedAccount.id, {
        name: contact.name,
        title: contact.title || null,
        department: contact.department || null,
        role: 'Unknown',
        notes: contact.email ? `Email: ${contact.email}` : '',
        email: contact.email || null,
        hubspot_contact_id: contact.hubspotContactId || null,
      })
    }
  }, [selectedAccount, store])

  // Load team members when campaign modal opens
  useEffect(() => {
    if (showCampaignModal && teamMembers.length === 0) {
      fetch('/api/users').then(r => r.json()).then(d => {
        if (d.users) setTeamMembers(d.users)
      }).catch(() => {})
    }
  }, [showCampaignModal])

  async function loadCampaignStakeholders(accountIds) {
    setLoadingStakeholders(true)
    const results = {}
    for (const id of accountIds) {
      try {
        const res = await fetch('/api/accounts/reengage-stakeholders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId: id }),
        })
        const data = await res.json()
        if (data.success) results[id] = { stakeholders: data.stakeholders, gongSummary: data.gongSummary, accountName: data.accountName }
      } catch { results[id] = { stakeholders: [], gongSummary: null, accountName: '' } }
    }
    setCampaignStakeholders(results)
    setLoadingStakeholders(false)
  }

  async function buildCampaign() {
    if (!campaignAssignee) return
    setBuildingCampaign(true)
    const campaignId = crypto.randomUUID()
    try {
      const accountsPayload = [...selectedForCampaign].map(id => {
        const account = accounts.find(a => a.id === id)
        const stData = campaignStakeholders[id] || {}
        return {
          id,
          name: account?.name || '',
          dockUrl: account?.dock_url || null,
          stakeholders: (stData.stakeholders || []).map(s => ({
            id: s.id, name: s.name, title: s.title, email: s.email,
            role: s.confirmedRole || s.suggestedRole,
          })),
        }
      })
      const res = await fetch('/api/accounts/reengage-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accounts: accountsPayload,
          assigneeId: campaignAssignee.id,
          assigneeEmail: campaignAssignee.email,
          campaignId,
        }),
      })
      const data = await res.json()
      if (data.success) setCampaignResult(data)
    } catch { /* silent */ }
    finally { setBuildingCampaign(false) }
  }

  // Reengagement handler
  const handleReengage = useCallback(async () => {
    if (!selectedAccount) return
    setReengageLoading(true)
    try {
      const r = await fetch('/api/accounts/reengagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: selectedAccount.id }),
      })
      const d = await r.json()
      if (d.success) {
        setReengageBrief(d.brief)
        setShowReengage(true)
      }
    } finally {
      setReengageLoading(false)
    }
  }, [selectedAccount])

  useEffect(() => {
    if (showQuickNote && quickNoteRef.current) quickNoteRef.current.focus()
  }, [showQuickNote])

  useEffect(() => {
    setShowQuickNote(false)
    setQuickNoteText('')
    setNoteSaved(false)
  }, [selectedAccount?.id])

  const handleSaveQuickNote = async () => {
    if (!quickNoteText.trim() || !selectedAccount) return
    setSavingNote(true)
    try {
      await store.addNote(selectedAccount.id, { content: quickNoteText.trim(), category: 'General' })
      setNoteSaved(true)
      setQuickNoteText('')
      setTimeout(() => { setNoteSaved(false); setShowQuickNote(false) }, 1200)
    } catch {
      /* silent */
    } finally {
      setSavingNote(false)
    }
  }

  // Render tab content
  const renderTabContent = () => {
    if (detailLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading account detail...</span>
          </div>
        </div>
      )
    }

    switch (activeTab) {
      case 'overview':
        return <OverviewTab account={selectedAccount} onUpdateAccount={updateAccountField} />;
      case 'timeline':
        return <TimelineTab account={selectedAccount} />;
      case 'transcripts':
        return <TranscriptsTab account={selectedAccount} onOpenTranscriptModal={() => setShowNewTranscript(true)} />;
      case 'current_state':
        return <CurrentStateTab account={selectedAccount} />;
      case 'stakeholders':
        return (
          <StakeholdersTab
            account={selectedAccount}
            onOpenStakeholderModal={() => setShowNewStakeholder(true)}
            onBulkAddStakeholders={handleBulkAddStakeholders}
          />
        );
      case 'gaps':
        return <InformationGapsTab account={selectedAccount} />;
      case 'content':
        return <ContentTab account={selectedAccount} />;
      case 'chat':
        return <ChatTab account={selectedAccount} />;
      case 'journey':
        return <JourneyTab account={selectedAccount} />;
      case 'cs_handover':
        return <CSHandoverTab account={selectedAccount} />;
      default:
        return null;
    }
  };


  return (
    <AppShell
      title="Account Management"
      actions={
        <button
          onClick={() => setShowNewAccount(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          <Building2 className="w-4 h-4" />
          New Account
        </button>
      }
    >
      <div className="max-w-7xl mx-auto p-6">
        {/* Main content grid */}
        <div className="grid grid-cols-4 gap-6">
          {/* Sidebar - Account list */}
          <div className="col-span-1 bg-white rounded-lg shadow flex flex-col" style={{ maxHeight: 'calc(100vh - 140px)' }}>
            {/* Sidebar header */}
            <div className="p-4 border-b flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900">
                  Accounts
                  <span className="ml-2 text-xs font-normal bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{activeCount}</span>
                </h2>
                {hasFilters && (
                  <button
                    onClick={() => { setSearch(''); setFilterStage(''); setFilterOwner(''); setFilterCompetitor(''); setSortBy('az') }}
                    className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>

              {/* Search */}
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search accounts..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* My / All toggle */}
              {myOwnerName && (
                <div className="flex bg-gray-100 rounded-md p-0.5 mb-1">
                  <button
                    onClick={() => setFilterOwner(myOwnerName)}
                    className={`flex-1 text-xs py-1 rounded transition-colors ${filterOwner === myOwnerName ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    My accounts
                  </button>
                  <button
                    onClick={() => setFilterOwner('')}
                    className={`flex-1 text-xs py-1 rounded transition-colors ${filterOwner === '' ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    All
                  </button>
                </div>
              )}

              {/* Filter row */}
              <div className="flex gap-1.5">
                <select
                  value={filterStage}
                  onChange={e => setFilterStage(e.target.value)}
                  className="flex-1 text-xs border border-gray-200 rounded px-1.5 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="">Active deals</option>
                  <optgroup label="Active">
                    <option value="active_pursuit">Active Pursuit</option>
                    <option value="qualifying">Qualifying</option>
                    <option value="intro_scheduled">Intro Scheduled</option>
                    <option value="demo">Demo</option>
                    <option value="solution_validation">Solution Validation</option>
                    <option value="proposal">Proposal</option>
                    <option value="legal">Legal</option>
                  </optgroup>
                  <optgroup label="Inactive">
                    <option value="__inactive">All Inactive</option>
                    <option value="inactive_sdr_follow_up">↳ SDR Follow Up</option>
                    <option value="inactive_ae_follow_up">↳ AE Follow Up</option>
                  </optgroup>
                  <optgroup label="Closed">
                    <option value="__closed">All Closed</option>
                    <option value="closed_won">↳ Closed Won</option>
                    <option value="closed_lost">↳ Closed Lost</option>
                  </optgroup>
                </select>
                {uniqueOwners.length > 1 && filterOwner === '' && (
                  <select
                    value={filterOwner}
                    onChange={e => setFilterOwner(e.target.value)}
                    className="flex-1 text-xs border border-gray-200 rounded px-1.5 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="">All owners</option>
                    {uniqueOwners.map(o => (
                      <option key={o} value={o}>{o.split(' ')[0]}</option>
                    ))}
                  </select>
                )}
              </div>
              {uniqueCompetitors.length > 0 && (
                <div className="mt-1.5">
                  <select
                    value={filterCompetitor}
                    onChange={e => setFilterCompetitor(e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="">All competitors</option>
                    {uniqueCompetitors.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="mt-1.5">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="az">Sort: A–Z</option>
                  <option value="last_call">Sort: Last contacted</option>
                  <option value="call_count">Sort: Most conversations</option>
                  <option value="cold">Filter: Cold 30+ days</option>
                  <option value="stage">Sort: Stage</option>
                </select>
              </div>
            </div>

            {/* Account list */}
            <div className="overflow-y-auto flex-1 p-2">
              {filteredAccounts.length === 0 ? (
                <div className="text-center py-8 px-3">
                  <p className="text-sm text-gray-500">
                    {accounts.length === 0 ? 'No accounts yet.' : `No accounts match${search ? ` "${search}"` : ''}.`}
                  </p>
                  {(search || filterStage || filterOwner !== myOwnerName) && (
                    <button
                      onClick={() => { setSearch(''); setFilterStage(''); setFilterOwner(myOwnerName) }}
                      className="mt-2 text-xs text-blue-600 hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredAccounts.map(account => {
                    const stageColor = STAGE_COLORS[account.stage] || 'bg-gray-100 text-gray-600'
                    const stageLabel = STAGE_LABELS[account.stage] || account.stage || '—'
                    return (
                      <button
                        key={account.id}
                        onClick={() => {
                          if (campaignMode && (account.stage === 'inactive_sdr_follow_up' || account.stage === 'inactive_ae_follow_up')) {
                            setSelectedForCampaign(prev => {
                              const next = new Set(prev)
                              if (next.has(account.id)) next.delete(account.id); else next.add(account.id)
                              return next
                            })
                          } else {
                            handleSelectAccount(account)
                          }
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-md transition-colors ${
                          selectedForCampaign.has(account.id)
                            ? 'bg-indigo-50 border border-indigo-200'
                            : selectedAccount?.id === account.id
                              ? 'bg-blue-50 border border-blue-200'
                              : 'hover:bg-gray-50 border border-transparent'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {campaignMode && (account.stage === 'inactive_sdr_follow_up' || account.stage === 'inactive_ae_follow_up') && (
                            <input type="checkbox" className="mt-0.5 accent-indigo-600 shrink-0" checked={selectedForCampaign.has(account.id)} onChange={() => {}} />
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-sm text-gray-900 leading-tight line-clamp-2 block">{account.name}</span>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${stageColor}`}>{stageLabel}</span>
                              {account.ownerName && (
                                <span className="text-xs text-gray-400 truncate max-w-[80px]">{account.ownerName.split(' ')[0]}</span>
                              )}
                              {(sortBy === 'last_call' || sortBy === 'cold' || sortBy === 'call_count') && callStats[account.id] && (
                                <span className="text-xs text-gray-400">
                                  {sortBy === 'call_count'
                                    ? `${callStats[account.id].callCount} calls`
                                    : callStats[account.id].lastCallDate
                                    ? `${Math.floor((Date.now() - new Date(callStats[account.id].lastCallDate).getTime()) / (24 * 60 * 60 * 1000))}d ago`
                                    : 'never'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Campaign trigger (shown when viewing inactive accounts) */}
            <div className="p-3 border-t flex-shrink-0 space-y-2">
              {(filterStage === '__inactive' || filterStage === 'inactive_sdr_follow_up' || filterStage === 'inactive_ae_follow_up') && (
                <button
                  onClick={() => { setCampaignMode(m => !m); setSelectedForCampaign(new Set()) }}
                  className={`flex items-center gap-2 text-xs font-medium transition-colors ${campaignMode ? 'text-indigo-700' : 'text-indigo-500 hover:text-indigo-700'}`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {campaignMode ? 'Cancel selection' : 'Bulk reengage'}
                </button>
              )}
              {campaignMode && selectedForCampaign.size > 0 && (
                <button
                  onClick={() => {
                    setShowCampaignModal(true)
                    setCampaignStep(1)
                    loadCampaignStakeholders([...selectedForCampaign])
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700"
                >
                  Build Campaign ({selectedForCampaign.size})
                </button>
              )}
            </div>
          </div>

          {/* Main content - Account details */}
          <div className="col-span-3 bg-white rounded-lg shadow">
            {!selectedAccount ? (
              <div className="flex items-center justify-center h-96 text-gray-500">
                <div className="text-center">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>Select an account to view details</p>
                </div>
              </div>
            ) : (
              <div>
                {/* Account header and tabs */}
                <div className="border-b p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 min-w-0 mr-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-2xl font-bold">{selectedAccount.name}</h2>
                        {selectedAccount.stage && (
                          <span className={`text-xs px-2 py-1 rounded font-medium ${STAGE_COLORS[selectedAccount.stage] || 'bg-gray-100 text-gray-600'}`}>
                            {STAGE_LABELS[selectedAccount.stage] || selectedAccount.stage}
                          </span>
                        )}
                        {/* Risk chip — shown when score is known */}
                        {(() => {
                          const score = rescoreResult?.riskScore ?? selectedAccount.riskScore;
                          const factors = rescoreResult?.riskFactors ?? selectedAccount.riskFactors;
                          if (score == null) return null;
                          let dotColor, chipClass;
                          if (score >= 60) { dotColor = '#ef4444'; chipClass = 'text-red-700'; }
                          else if (score >= 30) { dotColor = '#f59e0b'; chipClass = 'text-amber-700'; }
                          else { dotColor = '#22c55e'; chipClass = 'text-green-700'; }
                          const tooltip = Array.isArray(factors) && factors.length ? factors.join('\n') : undefined;
                          return (
                            <span className={`flex items-center gap-1 text-xs font-semibold ${chipClass}`} title={tooltip} style={{ cursor: 'default' }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: dotColor, display: 'inline-block', flexShrink: 0 }} />
                              Risk {score}
                              <button
                                onClick={handleRescore}
                                disabled={rescoring}
                                title="Rescore this account"
                                style={{ marginLeft: 2, cursor: 'pointer', color: 'inherit', opacity: rescoring ? 0.5 : 0.7, fontSize: 13, lineHeight: 1, background: 'none', border: 'none', padding: 0 }}
                              >
                                {rescoring ? '…' : '↻'}
                              </button>
                            </span>
                          );
                        })()}
                        {memoryCount > 0 && (
                          <span
                            className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full cursor-pointer hover:bg-gray-200 transition-colors"
                            onClick={() => setActiveTab('overview')}
                            title="View saved insights"
                          >
                            📌 {memoryCount} insight{memoryCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {selectedAccount.url && (
                          <a href={selectedAccount.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                            {selectedAccount.url}
                          </a>
                        )}
                        {selectedAccount.ownerName && (
                          <span className="text-sm text-gray-500">Owner: {selectedAccount.ownerName}</span>
                        )}
                        {selectedAccount.dealValue && (
                          <span className="text-sm text-gray-500">${selectedAccount.dealValue.toLocaleString()}</span>
                        )}
                        {/* Account health: call recency + depth */}
                        {callStats[selectedAccount.id] && (() => {
                          const stats = callStats[selectedAccount.id]
                          const daysSince = stats.lastCallDate
                            ? Math.floor((Date.now() - new Date(stats.lastCallDate).getTime()) / (24 * 60 * 60 * 1000))
                            : null
                          const isWarm = daysSince != null && daysSince <= 14
                          const isCold = daysSince === null || daysSince > 30
                          const dotColor = isWarm ? 'bg-green-500' : isCold ? 'bg-red-400' : 'bg-amber-400'
                          const label = daysSince != null
                            ? `${daysSince}d since last call`
                            : 'Never called'
                          return (
                            <div className="flex items-center gap-2">
                              <span className={`inline-block w-2 h-2 rounded-full ${dotColor} flex-shrink-0`} />
                              <span className="text-xs text-gray-500">
                                {label} · {stats.callCount} call{stats.callCount !== 1 ? 's' : ''}
                              </span>
                            </div>
                          )
                        })()}
                      </div>
                      {/* Competitor tags */}
                      <CompetitorTags account={selectedAccount} onSave={updateAccountField} />
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Quick note button */}
                      <button
                        onClick={() => setShowQuickNote(v => !v)}
                        className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm transition-all ${showQuickNote ? 'bg-gray-100 border-gray-300 text-gray-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}
                        title="Quick note"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Note
                      </button>
                      {/* Reengagement button */}
                      <button
                        onClick={handleReengage}
                        disabled={reengageLoading}
                        className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 text-sm transition-all disabled:opacity-50"
                      >
                        {reengageLoading ? (
                          <span className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Flame className="w-4 h-4" />
                        )}
                        Reengage
                      </button>
                      {['demo', 'solution_validation', 'proposal'].includes(selectedAccount?.stage) && (
                        <button
                          onClick={() => setShowDemoBrief(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-all text-sm"
                        >
                          <Sparkles className="w-4 h-4" />
                          Demo Brief
                        </button>
                      )}
                      <button
                        onClick={() => setShowAISidebar(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 shadow-sm transition-all"
                      >
                        <Sparkles className="w-4 h-4" />
                        AI Assistant
                      </button>
                    </div>
                  </div>

                  {/* Quick note inline editor */}
                  {showQuickNote && (
                    <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                      <textarea
                        ref={quickNoteRef}
                        value={quickNoteText}
                        onChange={e => setQuickNoteText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveQuickNote() }}
                        placeholder="Add a quick note..."
                        rows={2}
                        className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-400"
                        disabled={savingNote}
                      />
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400">⌘+Enter to save</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setShowQuickNote(false); setQuickNoteText('') }} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">Cancel</button>
                          <button
                            onClick={handleSaveQuickNote}
                            disabled={!quickNoteText.trim() || savingNote}
                            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            {noteSaved ? <><Check className="w-3 h-3" /> Saved</> : savingNote ? 'Saving…' : 'Save note'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab navigation */}
                  <div className="flex gap-4 border-b">
                    {TABS.filter(tab => !tab.closedWonOnly || selectedAccount?.stage === 'closed_won').map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`py-3 px-2 border-b-2 transition-colors text-sm ${
                          activeTab === tab.id
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent hover:text-gray-700'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab content */}
                <div className="p-6">
                  <SectionErrorBoundary name={TABS.find(t => t.id === activeTab)?.label || 'Tab'}>
                    {renderTabContent()}
                  </SectionErrorBoundary>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showNewAccount && (
        <NewAccountModal
          accountName={accountName}
          setAccountName={setAccountName}
          companyUrl={companyUrl}
          setCompanyUrl={setCompanyUrl}
          onClose={closeAccountModal}
          onCreate={handleCreateAccount}
        />
      )}
      {showNewTranscript && (
        <NewTranscriptModal
          transcriptText={transcriptText}
          setTranscriptText={setTranscriptText}
          onClose={closeTranscriptModal}
          onAdd={handleAddTranscript}
          onAddGongTranscript={async (gongCall) => {
            const success = await addGongTranscript(gongCall);
            if (success) closeTranscriptModal();
          }}
          isProcessing={isProcessing}
        />
      )}
      {showNewStakeholder && (
        <NewStakeholderModal
          stakeholderName={stakeholderName}
          setStakeholderName={setStakeholderName}
          stakeholderTitle={stakeholderTitle}
          setStakeholderTitle={setStakeholderTitle}
          stakeholderDept={stakeholderDept}
          setStakeholderDept={setStakeholderDept}
          stakeholderRole={stakeholderRole}
          setStakeholderRole={setStakeholderRole}
          onClose={closeStakeholderModal}
          onAdd={handleAddStakeholder}
        />
      )}

      {showDemoBrief && selectedAccount && (
        <DemoBriefModal
          account={selectedAccount}
          onClose={() => setShowDemoBrief(false)}
        />
      )}

      {/* Reengagement Modal */}
      {showReengage && reengageBrief && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Reengagement Brief</h2>
                <p className="text-sm text-gray-500 mt-0.5">{selectedAccount?.name}</p>
              </div>
              <button onClick={() => setShowReengage(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {reengageBrief.why_reengage && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Why Reengage</div>
                  <p className="text-sm text-gray-800">{reengageBrief.why_reengage}</p>
                </div>
              )}

              {reengageBrief.cold_email && (
                <div>
                  <div className="text-sm font-semibold text-gray-700 mb-2">Cold Email</div>
                  <div className="bg-gray-50 border rounded-lg p-4 space-y-2">
                    <div className="text-xs text-gray-500">Subject: <span className="text-gray-800 font-medium">{reengageBrief.cold_email.subject}</span></div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">{reengageBrief.cold_email.body}</div>
                  </div>
                </div>
              )}

              {reengageBrief.cold_call_script && (
                <div>
                  <div className="text-sm font-semibold text-gray-700 mb-2">Call Script</div>
                  <div className="bg-gray-50 border rounded-lg p-4 space-y-3">
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Opener</div>
                      <p className="text-sm text-gray-700">{reengageBrief.cold_call_script.opener}</p>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Pain Hook</div>
                      <p className="text-sm text-gray-700">{reengageBrief.cold_call_script.pain_hook}</p>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Ask</div>
                      <p className="text-sm text-gray-700">{reengageBrief.cold_call_script.ask}</p>
                    </div>
                  </div>
                </div>
              )}

              {reengageBrief.talking_points?.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-gray-700 mb-2">Talking Points</div>
                  <ul className="space-y-1.5">
                    {reengageBrief.talking_points.map((pt, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-700">
                        <span className="text-blue-500 mt-0.5 flex-shrink-0">•</span>
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Campaign Builder Modal */}
      {showCampaignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { if (!buildingCampaign) setShowCampaignModal(false) }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Reengagement Campaign</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {campaignResult ? 'Campaign created' : `${selectedForCampaign.size} account${selectedForCampaign.size !== 1 ? 's' : ''} selected · Step ${campaignStep} of 3`}
                </p>
              </div>
              {!buildingCampaign && !campaignResult && (
                <button onClick={() => setShowCampaignModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">

              {/* Step 1: Review accounts */}
              {campaignStep === 1 && !campaignResult && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">Review the accounts selected for this campaign. These will each receive a personalized 4-stage reengagement plan.</p>
                  <div className="space-y-2">
                    {[...selectedForCampaign].map(id => {
                      const account = accounts.find(a => a.id === id)
                      return (
                        <div key={id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{account?.name}</p>
                            <p className="text-xs text-gray-400">{STAGE_LABELS[account?.stage] || account?.stage}</p>
                          </div>
                          <button onClick={() => setSelectedForCampaign(prev => { const n = new Set(prev); n.delete(id); return n })}
                            className="text-gray-300 hover:text-red-400 p-1">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  {loadingStakeholders && (
                    <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                      <RefreshCw className="w-4 h-4 animate-spin" /> Loading stakeholder data…
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Stakeholder review */}
              {campaignStep === 2 && !campaignResult && (
                <div className="space-y-5">
                  <p className="text-sm text-gray-600">Review the AI-suggested stakeholder roles. These drive who gets contacted and how. Change any that are wrong — the plan updates automatically.</p>
                  {[...selectedForCampaign].map(accountId => {
                    const stData = campaignStakeholders[accountId] || {}
                    const accountName = stData.accountName || accounts.find(a => a.id === accountId)?.name || accountId
                    return (
                      <div key={accountId} className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                          <p className="text-sm font-semibold text-gray-800">{accountName}</p>
                          {stData.gongSummary?.lastCallDate && (
                            <p className="text-xs text-gray-400 mt-0.5">Last call: {new Date(stData.gongSummary.lastCallDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {stData.gongSummary.callCount} calls total</p>
                          )}
                          {stData.gongSummary?.topPainPoints?.length > 0 && (
                            <p className="text-xs text-indigo-600 mt-0.5">Pain points: {stData.gongSummary.topPainPoints.slice(0, 3).join(' · ')}</p>
                          )}
                        </div>
                        {stData.stakeholders?.length === 0 && (
                          <p className="text-xs text-amber-600 px-4 py-3">No stakeholders on file — add contacts in the account's Stakeholders tab before generating.</p>
                        )}
                        {stData.stakeholders?.map((s, i) => (
                          <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{s.name}</p>
                              <p className="text-xs text-gray-400">{s.title}</p>
                              {s.rationale && <p className="text-xs text-gray-400 italic mt-0.5">{s.rationale}</p>}
                            </div>
                            <select
                              value={s.confirmedRole || s.suggestedRole}
                              onChange={e => {
                                setCampaignStakeholders(prev => ({
                                  ...prev,
                                  [accountId]: {
                                    ...prev[accountId],
                                    stakeholders: prev[accountId].stakeholders.map((st, idx) =>
                                      idx === i ? { ...st, confirmedRole: e.target.value } : st
                                    )
                                  }
                                }))
                              }}
                              className={`text-xs px-2 py-1 rounded border font-medium focus:outline-none focus:ring-1 focus:ring-indigo-400 ${
                                (s.confirmedRole || s.suggestedRole) === 'champion' ? 'bg-green-100 text-green-700 border-green-200' :
                                (s.confirmedRole || s.suggestedRole) === 'exec_sponsor' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                (s.confirmedRole || s.suggestedRole) === 'promoter' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                (s.confirmedRole || s.suggestedRole) === 'detractor' ? 'bg-red-100 text-red-700 border-red-200' :
                                'bg-gray-100 text-gray-600 border-gray-200'
                              }`}
                            >
                              <option value="champion">Champion</option>
                              <option value="exec_sponsor">Exec Sponsor</option>
                              <option value="promoter">Promoter</option>
                              <option value="detractor">Detractor</option>
                              <option value="unknown">Unknown</option>
                            </select>
                            <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                              s.confidence === 'high' ? 'bg-green-50 text-green-600' :
                              s.confidence === 'medium' ? 'bg-amber-50 text-amber-600' :
                              'bg-gray-50 text-gray-400'
                            }`}>{s.confidence}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Step 3: Assign + Build */}
              {campaignStep === 3 && !campaignResult && (
                <div className="space-y-5">
                  <div>
                    <p className="text-sm font-medium text-gray-800 mb-2">Assign campaign to</p>
                    <select
                      value={campaignAssignee?.id || ''}
                      onChange={e => {
                        const member = teamMembers.find(m => m.id === e.target.value)
                        setCampaignAssignee(member ? { id: member.id, name: member.full_name || member.email, email: member.email } : null)
                      }}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="">Select a rep…</option>
                      {teamMembers.map(m => (
                        <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
                      ))}
                    </select>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-indigo-800 mb-2">What gets created</p>
                    <ul className="space-y-1.5 text-xs text-indigo-700">
                      <li>• 4 tasks per account (Stage 1–4), sequenced across 14 days</li>
                      <li>• Each task contains specific outreach by stakeholder role</li>
                      <li>• Tasks appear in the rep's Campaigns tab with pace tracking</li>
                      <li>• Information Room brief included (or URL if stored on account)</li>
                    </ul>
                  </div>
                  {buildingCampaign && (
                    <div className="flex items-center gap-3 text-sm text-gray-600 py-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                      Generating personalized plans… this takes ~20 seconds per account
                    </div>
                  )}
                </div>
              )}

              {/* Result */}
              {campaignResult && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-green-800">Campaign created</p>
                      <p className="text-xs text-green-600">{campaignResult.totalTasksCreated} tasks created across {campaignResult.plans?.length} accounts · assigned to {campaignAssignee?.name}</p>
                    </div>
                  </div>
                  {campaignResult.plans?.map((plan, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm font-medium text-gray-900">{plan.accountName}</p>
                      <span className="text-xs text-green-600 font-medium">{plan.tasksCreated} tasks</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {!campaignResult && (
              <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
                <button
                  onClick={() => { if (campaignStep > 1) setCampaignStep(s => s - 1) }}
                  disabled={campaignStep === 1 || buildingCampaign}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40"
                >
                  Back
                </button>
                {campaignStep < 3 ? (
                  <button
                    onClick={() => setCampaignStep(s => s + 1)}
                    disabled={loadingStakeholders || selectedForCampaign.size === 0}
                    className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={buildCampaign}
                    disabled={!campaignAssignee || buildingCampaign}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50"
                  >
                    {buildingCampaign ? <><RefreshCw className="w-4 h-4 animate-spin" />Generating…</> : <><Sparkles className="w-4 h-4" />Build Campaign</>}
                  </button>
                )}
              </div>
            )}
            {campaignResult && (
              <div className="px-6 py-4 border-t bg-gray-50">
                <button onClick={() => { setShowCampaignModal(false); setCampaignResult(null); setCampaignMode(false); setSelectedForCampaign(new Set()); setCampaignStep(1) }}
                  className="w-full px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 font-medium">
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Sidebar - persistent assistant */}
      <ErrorBoundary
        title="AI Assistant Error"
        message="The AI assistant encountered an error. Try closing and reopening it."
      >
        <AISidebar
          isOpen={showAISidebar}
          onToggle={() => setShowAISidebar(!showAISidebar)}
          account={selectedAccount}
          activeTab={activeTab}
          onApplyActions={applyAssistantActions}
        />
      </ErrorBoundary>
    </AppShell>
  );
}
