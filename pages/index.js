import { useState, useEffect } from 'react';
import { Building2, Upload, Users, AlertCircle, FileText, X } from 'lucide-react';

const NewAccountModal = ({ accountName, setAccountName, companyUrl, setCompanyUrl, onClose, onCreate }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-lg p-6 max-w-md w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">New Account</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Account Name</label>
          <input
            type="text"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            className="w-full border rounded p-2"
            placeholder="Acme Corp"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Company URL</label>
          <input
            type="text"
            value={companyUrl}
            onChange={(e) => setCompanyUrl(e.target.value)}
            className="w-full border rounded p-2"
            placeholder="https://acmecorp.com"
          />
        </div>
      </div>
      <div className="flex gap-2 mt-6">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={onCreate}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Create
        </button>
      </div>
    </div>
  </div>
);

const NewTranscriptModal = ({ transcriptText, setTranscriptText, transcriptDate, setTranscriptDate, onClose, onAdd, isProcessing }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Add Transcript</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Call Date</label>
          <input
            type="date"
            value={transcriptDate}
            onChange={(e) => setTranscriptDate(e.target.value)}
            className="w-full border rounded p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Transcript</label>
          <textarea
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            rows={10}
            className="w-full border rounded p-2 font-mono text-sm"
            placeholder="Paste call transcript here..."
          />
        </div>
      </div>
      <div className="flex gap-2 mt-6">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={onAdd}
          disabled={isProcessing}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {isProcessing ? 'Processing...' : 'Add & Process'}
        </button>
      </div>
    </div>
  </div>
);

const NewStakeholderModal = ({ stakeholderName, setStakeholderName, stakeholderTitle, setStakeholderTitle, stakeholderDept, setStakeholderDept, stakeholderRole, setStakeholderRole, onClose, onAdd }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-lg p-6 max-w-md w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Add Stakeholder</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text"
            value={stakeholderName}
            onChange={(e) => setStakeholderName(e.target.value)}
            className="w-full border rounded p-2"
            placeholder="John Smith"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            value={stakeholderTitle}
            onChange={(e) => setStakeholderTitle(e.target.value)}
            className="w-full border rounded p-2"
            placeholder="VP of Operations"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Department</label>
          <input
            type="text"
            value={stakeholderDept}
            onChange={(e) => setStakeholderDept(e.target.value)}
            className="w-full border rounded p-2"
            placeholder="Operations"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Role</label>
          <select
            value={stakeholderRole}
            onChange={(e) => setStakeholderRole(e.target.value)}
            className="w-full border rounded p-2"
          >
            <option value="Champion">Champion</option>
            <option value="Executive Sponsor">Executive Sponsor</option>
            <option value="Influencer">Influencer</option>
            <option value="Neutral">Neutral</option>
            <option value="Blocker">Blocker</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 mt-6">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={onAdd}
          className="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Add Stakeholder
        </button>
      </div>
    </div>
  </div>
);

const ManualNoteModal = ({ manualNote, setManualNote, onClose, onAdd }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-lg p-6 max-w-md w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Add Manual Note</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Note</label>
          <textarea
            value={manualNote}
            onChange={(e) => setManualNote(e.target.value)}
            rows={4}
            className="w-full border rounded p-2"
            placeholder="e.g., John Smalley is the champion"
          />
        </div>
        <p className="text-xs text-gray-500">
          Examples: "Terri is the champion", "Budget is $500K", "They don't do CM fees"
        </p>
      </div>
      <div className="flex gap-2 mt-6">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={onAdd}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Add Note
        </button>
      </div>
    </div>
  </div>
);

export default function Home() {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [showNewTranscript, setShowNewTranscript] = useState(false);
  const [showNewStakeholder, setShowNewStakeholder] = useState(false);
  const [showManualNote, setShowManualNote] = useState(false);
  const [manualNote, setManualNote] = useState('');
  
  const [accountName, setAccountName] = useState('');
  const [companyUrl, setCompanyUrl] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [transcriptDate, setTranscriptDate] = useState('');
  const [stakeholderName, setStakeholderName] = useState('');
  const [stakeholderTitle, setStakeholderTitle] = useState('');
  const [stakeholderDept, setStakeholderDept] = useState('');
  const [stakeholderRole, setStakeholderRole] = useState('Neutral');
  const [isProcessing, setIsProcessing] = useState(false);

  const loadFromStorage = (key) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      return null;
    }
  };

  const saveToStorage = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  useEffect(() => {
    const saved = loadFromStorage('accounts');
    if (saved) setAccounts(saved);
  }, []);

  const generateId = () => {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const createAccount = () => {
    if (!accountName.trim()) return;

    const newAccount = {
      id: generateId(),
      name: accountName,
      url: companyUrl,
      transcripts: [],
      stakeholders: [],
      informationGaps: [],
      notes: [],
      createdAt: new Date().toISOString()
    };
    
    const updated = [...accounts, newAccount];
    setAccounts(updated);
    saveToStorage('accounts', updated);
    setSelectedAccount(newAccount);
    closeAccountModal();
  };

  const closeAccountModal = () => {
    setShowNewAccount(false);
    setAccountName('');
    setCompanyUrl('');
  };

  const closeTranscriptModal = () => {
    setShowNewTranscript(false);
    setTranscriptText('');
    setTranscriptDate('');
  };

  const closeStakeholderModal = () => {
    setShowNewStakeholder(false);
    setStakeholderName('');
    setStakeholderTitle('');
    setStakeholderDept('');
    setStakeholderRole('Neutral');
  };

  const closeNoteModal = () => {
    setShowManualNote(false);
    setManualNote('');
  };

  const parseCommand = (input) => {
    const lowerInput = input.toLowerCase().trim();
    const actions = [];

    // Stakeholder role updates - these should NOT create notes
    if (lowerInput.includes('is the champion') || lowerInput.includes('is a champion') || lowerInput.includes('is champion')) {
      const nameMatch = input.match(/^(.+?)\s+is\s+(?:the\s+|a\s+)?champion/i);
      if (nameMatch) {
        actions.push({
          type: 'update_stakeholder_role',
          name: nameMatch[1].trim(),
          role: 'Champion',
          message: `Updated ${nameMatch[1].trim()} to Champion`
        });
        return actions;
      }
    }

    if (lowerInput.includes('is the executive sponsor') || lowerInput.includes('is an executive sponsor') || lowerInput.includes('is executive sponsor')) {
      const nameMatch = input.match(/^(.+?)\s+is\s+(?:the\s+|an?\s+)?executive sponsor/i);
      if (nameMatch) {
        actions.push({
          type: 'update_stakeholder_role',
          name: nameMatch[1].trim(),
          role: 'Executive Sponsor',
          message: `Updated ${nameMatch[1].trim()} to Executive Sponsor`
        });
        return actions;
      }
    }

    if (lowerInput.includes('is a blocker') || lowerInput.includes('is the blocker') || lowerInput.includes('is blocker')) {
      const nameMatch = input.match(/^(.+?)\s+is\s+(?:the\s+|a\s+)?blocker/i);
      if (nameMatch) {
        actions.push({
          type: 'update_stakeholder_role',
          name: nameMatch[1].trim(),
          role: 'Blocker',
          message: `Updated ${nameMatch[1].trim()} to Blocker`
        });
        return actions;
      }
    }

    if (lowerInput.includes('is an influencer') || lowerInput.includes('is the influencer') || lowerInput.includes('is influencer')) {
      const nameMatch = input.match(/^(.+?)\s+is\s+(?:the\s+|an?\s+)?influencer/i);
      if (nameMatch) {
        actions.push({
          type: 'update_stakeholder_role',
          name: nameMatch[1].trim(),
          role: 'Influencer',
          message: `Updated ${nameMatch[1].trim()} to Influencer`
        });
        return actions;
      }
    }

    // Budget mentions
    if (lowerInput.includes('budget')) {
      const budgetMatch = input.match(/budget\s+(?:is\s+)?(\$[\d,]+(?:\.\d{2})?|\d+k?)/i);
      if (budgetMatch) {
        actions.push({
          type: 'note',
          category: 'Budget',
          content: input,
          message: `Added budget note: ${budgetMatch[1]}`
        });
        return actions;
      }
    }

    // CM fees or other fees
    if (lowerInput.includes('cm fee') || lowerInput.includes('cm fees') || lowerInput.includes('construction management')) {
      actions.push({
        type: 'note',
        category: 'Fees',
        content: input,
        message: 'Added note about fees'
      });
      return actions;
    }

    // Timeline mentions
    if (lowerInput.includes('timeline') || lowerInput.includes('go live') || lowerInput.includes('launch date')) {
      actions.push({
        type: 'note',
        category: 'Timeline',
        content: input,
        message: 'Added timeline note'
      });
      return actions;
    }

    // General note for everything else
    actions.push({
      type: 'note',
      category: 'General',
      content: input,
      message: 'Added general note'
    });

    return actions;
  };

  const executeActions = (actions) => {
    if (!selectedAccount) return;

    const updatedAccounts = [...accounts];
    const accountIndex = updatedAccounts.findIndex(a => a.id === selectedAccount.id);
    
    if (accountIndex === -1) return;

    let updateMade = false;

    actions.forEach(action => {
      if (action.type === 'update_stakeholder_role') {
        const stakeholder = updatedAccounts[accountIndex].stakeholders?.find(
          s => s.name.toLowerCase().trim() === action.name.toLowerCase().trim()
        );
        if (stakeholder) {
          stakeholder.role = action.role;
          updateMade = true;
          alert(`✓ Updated ${stakeholder.name} to ${action.role}`);
        } else {
          alert(`⚠ Stakeholder "${action.name}" not found. Please add them first or check the spelling.`);
        }
      } else if (action.type === 'note') {
        if (!updatedAccounts[accountIndex].notes) {
          updatedAccounts[accountIndex].notes = [];
        }
        updatedAccounts[accountIndex].notes.push({
          id: generateId(),
          category: action.category,
          content: action.content,
          timestamp: new Date().toISOString()
        });
        updateMade = true;
      }
    });

    if (updateMade) {
      setAccounts(updatedAccounts);
      setSelectedAccount(updatedAccounts[accountIndex]);
      saveToStorage('accounts', updatedAccounts);
    }
  };

  const handleManualNote = () => {
    if (!manualNote.trim() || !selectedAccount) return;
    
    const actions = parseCommand(manualNote);
    
    if (actions.length > 0) {
      executeActions(actions);
    }

    closeNoteModal();
  };

  const addTranscript = async () => {
    if (!transcriptText.trim() || !selectedAccount) return;
    
    setIsProcessing(true);
    
    try {
      // TODO: This API call should go through a backend proxy to avoid CORS issues
      // and to keep the API key secure. Replace with your backend endpoint.
      const response = await fetch('/api/analyze-transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: transcriptText
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      const analysis = data.content?.[0]?.text || 'Analysis unavailable';

      const newTranscript = {
        id: generateId(),
        text: transcriptText,
        date: transcriptDate || new Date().toISOString().split('T')[0],
        analysis: analysis,
        addedAt: new Date().toISOString()
      };
      
      const updatedAccounts = accounts.map(acc => 
        acc.id === selectedAccount.id 
          ? { ...acc, transcripts: [...(acc.transcripts || []), newTranscript] }
          : acc
      );
      
      setAccounts(updatedAccounts);
      saveToStorage('accounts', updatedAccounts);
      setSelectedAccount(updatedAccounts.find(a => a.id === selectedAccount.id));
      closeTranscriptModal();
    } catch (error) {
      alert(`Error processing transcript: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const addStakeholder = () => {
    if (!stakeholderName.trim() || !selectedAccount) return;
    
    const newStakeholder = {
      id: generateId(),
      name: stakeholderName,
      title: stakeholderTitle,
      department: stakeholderDept,
      role: stakeholderRole,
      addedAt: new Date().toISOString()
    };
    
    const updatedAccounts = accounts.map(acc => 
      acc.id === selectedAccount.id 
        ? { ...acc, stakeholders: [...(acc.stakeholders || []), newStakeholder] }
        : acc
    );
    
    setAccounts(updatedAccounts);
    saveToStorage('accounts', updatedAccounts);
    setSelectedAccount(updatedAccounts.find(a => a.id === selectedAccount.id));
    closeStakeholderModal();
  };

  const OverviewTab = ({ account }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Transcripts</div>
          <div className="text-2xl font-bold">{account.transcripts?.length || 0}</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Stakeholders</div>
          <div className="text-2xl font-bold">{account.stakeholders?.length || 0}</div>
        </div>
        <div className="bg-amber-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Info Gaps</div>
          <div className="text-2xl font-bold">{account.informationGaps?.length || 0}</div>
        </div>
      </div>
      
      {account.notes && account.notes.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Recent Notes</h3>
          <div className="space-y-2">
            {account.notes.slice(-5).reverse().map(note => (
              <div key={note.id} className="text-sm">
                <span className="font-medium text-gray-600">{note.category}:</span> {note.content}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end pt-4">
        <button
          onClick={() => setShowManualNote(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          <FileText className="w-4 h-4" />
          Quick Note
        </button>
      </div>
    </div>
  );

  const TranscriptsTab = ({ account }) => (
    <div className="space-y-4">
      {account.transcripts && account.transcripts.length > 0 ? (
        <>
          {account.transcripts.map(t => (
            <div key={t.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="font-medium">{t.date}</div>
              </div>
              <div className="text-sm text-gray-600 whitespace-pre-wrap">{t.analysis || t.text.substring(0, 200) + '...'}</div>
            </div>
          ))}
          <div className="flex justify-end pt-4">
            <button
              onClick={() => setShowNewTranscript(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              <Upload className="w-4 h-4" />
              Add Transcript
            </button>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <div className="text-gray-500 mb-4">No transcripts yet.</div>
          <button
            onClick={() => setShowNewTranscript(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 mx-auto"
          >
            <Upload className="w-4 h-4" />
            Add Transcript
          </button>
        </div>
      )}
    </div>
  );

  const StakeholdersTab = ({ account }) => (
    <div className="space-y-4">
      {account.stakeholders && account.stakeholders.length > 0 ? (
        <>
          {account.stakeholders.map(s => (
            <div key={s.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-sm text-gray-600">{s.title}</div>
                  <div className="text-sm text-gray-500">{s.department}</div>
                </div>
                <span className={`px-3 py-1 rounded text-sm ${
                  s.role === 'Champion' ? 'bg-green-100 text-green-800' :
                  s.role === 'Executive Sponsor' ? 'bg-blue-100 text-blue-800' :
                  s.role === 'Blocker' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {s.role}
                </span>
              </div>
            </div>
          ))}
          <div className="flex justify-end pt-4">
            <button
              onClick={() => setShowNewStakeholder(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              <Users className="w-4 h-4" />
              Add Stakeholder
            </button>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <div className="text-gray-500 mb-4">No stakeholders yet.</div>
          <button
            onClick={() => setShowNewStakeholder(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 mx-auto"
          >
            <Users className="w-4 h-4" />
            Add Stakeholder
          </button>
        </div>
      )}
    </div>
  );

  const InformationGapsTab = ({ account }) => (
    <div className="space-y-4">
      {account.informationGaps && account.informationGaps.length > 0 ? (
        account.informationGaps.map(gap => (
          <div key={gap.id} className="border-l-4 border-amber-500 bg-amber-50 p-4 rounded">
            <div className="font-medium">{gap.category}</div>
            <div className="text-sm text-gray-600">{gap.description}</div>
          </div>
        ))
      ) : (
        <div className="text-center py-8 text-gray-500">
          No information gaps identified yet.
        </div>
      )}
    </div>
  );

  const ContentTab = () => (
    <div className="space-y-4">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Business Case Generation</h3>
        <p className="text-sm text-gray-600 mb-4">
          Generate business case content based on all transcripts and stakeholder information.
        </p>
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Generate Business Case
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
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

        <div className="grid grid-cols-4 gap-6">
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
                <div className="border-b p-6">
                  <div className="mb-4">
                    <h2 className="text-2xl font-bold">{selectedAccount.name}</h2>
                    {selectedAccount.url && (
                      <a href={selectedAccount.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                        {selectedAccount.url}
                      </a>
                    )}
                  </div>

                  <div className="flex gap-4 border-b">
                    <button
                      onClick={() => setActiveTab('overview')}
                      className={`py-3 px-2 border-b-2 transition-colors ${
                        activeTab === 'overview'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent hover:text-gray-700'
                      }`}
                    >
                      Overview
                    </button>
                    <button
                      onClick={() => setActiveTab('transcripts')}
                      className={`py-3 px-2 border-b-2 transition-colors ${
                        activeTab === 'transcripts'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent hover:text-gray-700'
                      }`}
                    >
                      Transcripts
                    </button>
                    <button
                      onClick={() => setActiveTab('stakeholders')}
                      className={`py-3 px-2 border-b-2 transition-colors ${
                        activeTab === 'stakeholders'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent hover:text-gray-700'
                      }`}
                    >
                      Stakeholders
                    </button>
                    <button
                      onClick={() => setActiveTab('gaps')}
                      className={`py-3 px-2 border-b-2 transition-colors ${
                        activeTab === 'gaps'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent hover:text-gray-700'
                      }`}
                    >
                      Information Gaps
                    </button>
                    <button
                      onClick={() => setActiveTab('content')}
                      className={`py-3 px-2 border-b-2 transition-colors ${
                        activeTab === 'content'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent hover:text-gray-700'
                      }`}
                    >
                      Content
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {activeTab === 'overview' && <OverviewTab account={selectedAccount} />}
                  {activeTab === 'transcripts' && <TranscriptsTab account={selectedAccount} />}
                  {activeTab === 'stakeholders' && <StakeholdersTab account={selectedAccount} />}
                  {activeTab === 'gaps' && <InformationGapsTab account={selectedAccount} />}
                  {activeTab === 'content' && <ContentTab />}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showNewAccount && (
        <NewAccountModal
          accountName={accountName}
          setAccountName={setAccountName}
          companyUrl={companyUrl}
          setCompanyUrl={setCompanyUrl}
          onClose={closeAccountModal}
          onCreate={createAccount}
        />
      )}
      {showNewTranscript && (
        <NewTranscriptModal
          transcriptText={transcriptText}
          setTranscriptText={setTranscriptText}
          transcriptDate={transcriptDate}
          setTranscriptDate={setTranscriptDate}
          onClose={closeTranscriptModal}
          onAdd={addTranscript}
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
          onAdd={addStakeholder}
        />
      )}
      {showManualNote && (
        <ManualNoteModal
          manualNote={manualNote}
          setManualNote={setManualNote}
          onClose={closeNoteModal}
          onAdd={handleManualNote}
        />
      )}
    </div>
  );
}