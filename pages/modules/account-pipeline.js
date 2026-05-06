import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Building2, AlertCircle, Sparkles, ArrowLeft, Search, Filter, X, ChevronDown, Flame, Archive, Eye, EyeOff } from 'lucide-react';

// Hooks
import { useAccounts } from '../../hooks/useAccounts';
import { useAccountStore } from '../../stores/useAccountStore';

// Auth components
import UserMenu from '../../components/auth/UserMenu';

// Constants
import { TABS } from '../../lib/constants';

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
import ChatTab from '../../components/tabs/ChatTab';

const TIER_CONFIG = {
  hot: { label: 'Hot', classes: 'bg-red-100 text-red-700', icon: '🔥' },
  active: { label: 'Active', classes: 'bg-blue-100 text-blue-700', icon: '' },
  watching: { label: 'Watching', classes: 'bg-yellow-100 text-yellow-700', icon: '👁' },
  archived: { label: 'Archived', classes: 'bg-gray-100 text-gray-500', icon: '—' },
}

const STAGE_LABELS = {
  qualifying: 'Qualifying',
  intro_scheduled: 'Intro Sched.',
  active_pursuit: 'Active',
  demo: 'Demo',
  solution_validation: 'Sol. Val.',
  proposal: 'Proposal',
  legal: 'Legal',
  won: 'Won',
  lost: 'Lost',
  closed_won: 'Won',
  closed_lost: 'Lost',
}

const STAGE_COLORS = {
  qualifying: 'bg-gray-100 text-gray-600',
  intro_scheduled: 'bg-blue-100 text-blue-700',
  active_pursuit: 'bg-indigo-100 text-indigo-700',
  demo: 'bg-purple-100 text-purple-700',
  solution_validation: 'bg-orange-100 text-orange-700',
  proposal: 'bg-yellow-100 text-yellow-700',
  legal: 'bg-pink-100 text-pink-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-500',
  closed_won: 'bg-green-100 text-green-700',
  closed_lost: 'bg-red-100 text-red-500',
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
  const [filterTier, setFilterTier] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Reengagement state
  const [reengageLoading, setReengageLoading] = useState(false);
  const [reengageBrief, setReengageBrief] = useState(null);
  const [showReengage, setShowReengage] = useState(false);

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

  // Derive unique owners for filter dropdown
  const uniqueOwners = useMemo(() => {
    const names = [...new Set(accounts.map(a => a.ownerName).filter(Boolean))].sort()
    return names
  }, [accounts])

  // Derive unique stages for filter dropdown
  const uniqueStages = useMemo(() => {
    return [...new Set(accounts.map(a => a.stage).filter(Boolean))].sort()
  }, [accounts])

  // Filter + search accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter(a => {
      if (!showArchived && a.tier === 'archived') return false
      if (filterTier && a.tier !== filterTier) return false
      if (filterStage && a.stage !== filterStage) return false
      if (filterOwner && a.ownerName !== filterOwner) return false
      if (search) {
        const q = search.toLowerCase()
        return a.name?.toLowerCase().includes(q) || a.ownerName?.toLowerCase().includes(q) || a.stage?.toLowerCase().includes(q)
      }
      return true
    })
  }, [accounts, search, filterStage, filterTier, filterOwner, showArchived])

  const activeCount = useMemo(() => accounts.filter(a => a.tier !== 'archived').length, [accounts])
  const hasFilters = search || filterStage || filterTier || filterOwner

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
      default:
        return null;
    }
  };

  const tierCfg = selectedAccount ? (TIER_CONFIG[selectedAccount.tier] || TIER_CONFIG.active) : null

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/modules')}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title="Back to modules"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-3xl font-bold">Account Management</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowNewAccount(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Building2 className="w-4 h-4" />
              New Account
            </button>
            <UserMenu />
          </div>
        </div>

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
                    onClick={() => { setSearch(''); setFilterStage(''); setFilterTier(''); setFilterOwner('') }}
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

              {/* Filter row */}
              <div className="flex gap-1.5">
                <select
                  value={filterStage}
                  onChange={e => setFilterStage(e.target.value)}
                  className="flex-1 text-xs border border-gray-200 rounded px-1.5 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="">Stage</option>
                  {uniqueStages.map(s => (
                    <option key={s} value={s}>{STAGE_LABELS[s] || s}</option>
                  ))}
                </select>
                <select
                  value={filterTier}
                  onChange={e => setFilterTier(e.target.value)}
                  className="flex-1 text-xs border border-gray-200 rounded px-1.5 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="">Tier</option>
                  <option value="hot">Hot</option>
                  <option value="active">Active</option>
                  <option value="watching">Watching</option>
                  <option value="archived">Archived</option>
                </select>
                {uniqueOwners.length > 0 && (
                  <select
                    value={filterOwner}
                    onChange={e => setFilterOwner(e.target.value)}
                    className="flex-1 text-xs border border-gray-200 rounded px-1.5 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="">Owner</option>
                    {uniqueOwners.map(o => (
                      <option key={o} value={o}>{o.split(' ')[0]}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Account list */}
            <div className="overflow-y-auto flex-1 p-2">
              {filteredAccounts.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  {accounts.length === 0 ? 'No accounts yet.' : 'No matches.'}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredAccounts.map(account => {
                    const tier = TIER_CONFIG[account.tier] || TIER_CONFIG.active
                    const stageColor = STAGE_COLORS[account.stage] || 'bg-gray-100 text-gray-600'
                    const stageLabel = STAGE_LABELS[account.stage] || account.stage || '—'
                    return (
                      <button
                        key={account.id}
                        onClick={() => handleSelectAccount(account)}
                        className={`w-full text-left px-3 py-2.5 rounded-md transition-colors ${
                          selectedAccount?.id === account.id
                            ? 'bg-blue-50 border border-blue-200'
                            : 'hover:bg-gray-50 border border-transparent'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-medium text-sm text-gray-900 leading-tight line-clamp-2">{account.name}</span>
                          {tier.icon && <span className="flex-shrink-0 text-xs mt-0.5">{tier.icon}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${stageColor}`}>{stageLabel}</span>
                          {account.ownerName && (
                            <span className="text-xs text-gray-400 truncate max-w-[80px]">{account.ownerName.split(' ')[0]}</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Show archived toggle */}
            <div className="p-3 border-t flex-shrink-0">
              <button
                onClick={() => setShowArchived(v => !v)}
                className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                {showArchived ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showArchived ? 'Hide archived' : 'Show archived'}
              </button>
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
                        {/* Tier selector */}
                        <select
                          value={selectedAccount.tier || 'active'}
                          onChange={e => store.updateAccount(selectedAccount.id, { tier: e.target.value })}
                          className={`text-xs px-2 py-1 rounded border-0 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 ${tierCfg?.classes || 'bg-blue-100 text-blue-700'}`}
                        >
                          <option value="hot">🔥 Hot</option>
                          <option value="active">Active</option>
                          <option value="watching">👁 Watching</option>
                          <option value="archived">Archived</option>
                        </select>
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
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
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

                  {/* Tab navigation */}
                  <div className="flex gap-4 border-b">
                    {TABS.map(tab => (
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
    </div>
  );
}
