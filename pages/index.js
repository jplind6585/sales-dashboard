import { useState } from 'react';
import { Building2, AlertCircle } from 'lucide-react';

// Hooks
import { useAccounts } from '../hooks/useAccounts';

// Constants
import { TABS } from '../lib/constants';

// Modal components
import NewAccountModal from '../components/modals/NewAccountModal';
import NewTranscriptModal from '../components/modals/NewTranscriptModal';
import NewStakeholderModal from '../components/modals/NewStakeholderModal';
import AssistantModal from '../components/modals/AssistantModal';

// Tab components
import OverviewTab from '../components/tabs/OverviewTab';
import TranscriptsTab from '../components/tabs/TranscriptsTab';
import CurrentStateTab from '../components/tabs/CurrentStateTab';
import StakeholdersTab from '../components/tabs/StakeholdersTab';
import InformationGapsTab from '../components/tabs/InformationGapsTab';
import ContentTab from '../components/tabs/ContentTab';

export default function Home() {
  // Account state from custom hook
  const {
    accounts,
    selectedAccount,
    setSelectedAccount,
    isProcessing,
    createAccount,
    addTranscript,
    addStakeholder,
    applyAssistantActions
  } = useAccounts();

  // UI state
  const [activeTab, setActiveTab] = useState('overview');
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [showNewTranscript, setShowNewTranscript] = useState(false);
  const [showNewStakeholder, setShowNewStakeholder] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);

  // Form state
  const [accountName, setAccountName] = useState('');
  const [companyUrl, setCompanyUrl] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [stakeholderName, setStakeholderName] = useState('');
  const [stakeholderTitle, setStakeholderTitle] = useState('');
  const [stakeholderDept, setStakeholderDept] = useState('');
  const [stakeholderRole, setStakeholderRole] = useState('Neutral');

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

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab account={selectedAccount} onOpenAssistant={() => setShowAssistant(true)} />;
      case 'transcripts':
        return <TranscriptsTab account={selectedAccount} onOpenTranscriptModal={() => setShowNewTranscript(true)} />;
      case 'current_state':
        return <CurrentStateTab account={selectedAccount} />;
      case 'stakeholders':
        return <StakeholdersTab account={selectedAccount} onOpenStakeholderModal={() => setShowNewStakeholder(true)} />;
      case 'gaps':
        return <InformationGapsTab account={selectedAccount} />;
      case 'content':
        return <ContentTab account={selectedAccount} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Sales Account Dashboard</h1>
          <button
            onClick={() => setShowNewAccount(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Building2 className="w-4 h-4" />
            New Account
          </button>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-4 gap-6">
          {/* Sidebar - Account list */}
          <div className="col-span-1 bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold mb-4">Accounts</h2>
            {accounts.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No accounts yet. Create your first account to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {accounts.map(account => (
                  <button
                    key={account.id}
                    onClick={() => setSelectedAccount(account)}
                    className={`w-full text-left p-3 rounded transition-colors ${
                      selectedAccount?.id === account.id
                        ? 'bg-blue-50 border-2 border-blue-600'
                        : 'hover:bg-gray-50 border-2 border-transparent'
                    }`}
                  >
                    <div className="font-medium">{account.name}</div>
                    <div className="text-xs text-gray-500">
                      {account.transcripts?.length || 0} transcripts
                    </div>
                  </button>
                ))}
              </div>
            )}
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
                  <div className="mb-4">
                    <h2 className="text-2xl font-bold">{selectedAccount.name}</h2>
                    {selectedAccount.url && (
                      <a href={selectedAccount.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                        {selectedAccount.url}
                      </a>
                    )}
                  </div>

                  {/* Tab navigation */}
                  <div className="flex gap-4 border-b">
                    {TABS.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`py-3 px-2 border-b-2 transition-colors ${
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
                  {renderTabContent()}
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
      {showAssistant && (
        <AssistantModal
          account={selectedAccount}
          onClose={() => setShowAssistant(false)}
          onApplyActions={applyAssistantActions}
        />
      )}
    </div>
  );
}
