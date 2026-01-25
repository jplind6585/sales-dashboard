import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Plus, Upload, Users, FileText, Lightbulb, AlertCircle, Trash2 } from 'lucide-react';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function SalesDashboard() {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [stakeholders, setStakeholders] = useState([]);
  const [transcripts, setTranscripts] = useState([]);
  const [businessCase, setBusinessCase] = useState(null);
  const [infoGaps, setInfoGaps] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);

  // Modals
  const [showNewAccountModal, setShowNewAccountModal] = useState(false);
  const [showNewStakeholderModal, setShowNewStakeholderModal] = useState(false);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);

  // Form states
  const [newAccount, setNewAccount] = useState({
    account_name: '',
    industry: '',
    company_size: '',
    annual_revenue: ''
  });

  const [newStakeholder, setNewStakeholder] = useState({
    name: '',
    title: '',
    role: '',
    influence_level: 'Medium',
    engagement_level: 'Medium'
  });

  const [transcriptText, setTranscriptText] = useState('');

  // Load accounts on mount
  useEffect(() => {
    loadAccounts();
  }, []);

  // Load account data when selected
  useEffect(() => {
    if (selectedAccount) {
      loadAccountData(selectedAccount.id);
    }
  }, [selectedAccount]);

  const loadAccounts = async () => {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setAccounts(data);
    }
  };

  const loadAccountData = async (accountId) => {
    setLoading(true);
    
    // Load stakeholders
    const { data: stakeholderData } = await supabase
      .from('stakeholders')
      .select('*')
      .eq('account_id', accountId);
    setStakeholders(stakeholderData || []);

    // Load transcripts
    const { data: transcriptData } = await supabase
      .from('transcripts')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });
    setTranscripts(transcriptData || []);

    // Load business case
    const { data: bcData } = await supabase
      .from('business_cases')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(1);
    setBusinessCase(bcData?.[0] || null);

    // Load info gaps
    const { data: gapData } = await supabase
      .from('info_gaps')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });
    setInfoGaps(gapData || []);

    setLoading(false);
  };

  const createAccount = async () => {
    if (!newAccount.account_name) return;

    const { data, error } = await supabase
      .from('accounts')
      .insert([newAccount])
      .select()
      .single();

    if (!error && data) {
      setAccounts([data, ...accounts]);
      setSelectedAccount(data);
      setNewAccount({ account_name: '', industry: '', company_size: '', annual_revenue: '' });
      setShowNewAccountModal(false);
    }
  };

  const createStakeholder = async () => {
    if (!newStakeholder.name || !selectedAccount) return;

    const { data, error } = await supabase
      .from('stakeholders')
      .insert([{ ...newStakeholder, account_id: selectedAccount.id }])
      .select()
      .single();

    if (!error && data) {
      setStakeholders([...stakeholders, data]);
      setNewStakeholder({ name: '', title: '', role: '', influence_level: 'Medium', engagement_level: 'Medium' });
      setShowNewStakeholderModal(false);
    }
  };

  const parseAndSaveTranscript = async () => {
    if (!transcriptText || !selectedAccount) return;

    setLoading(true);

    // Basic parsing - extract stakeholder mentions and key points
    const lines = transcriptText.split('\n');
    const participants = [];
    const keyInsights = [];

    lines.forEach(line => {
      // Simple parsing logic
      if (line.includes(':')) {
        const name = line.split(':')[0].trim();
        if (name && !participants.includes(name)) {
          participants.push(name);
        }
      }
      if (line.toLowerCase().includes('important') || line.toLowerCase().includes('key')) {
        keyInsights.push(line);
      }
    });

    const { data, error } = await supabase
      .from('transcripts')
      .insert([{
        account_id: selectedAccount.id,
        title: `Call Transcript - ${new Date().toLocaleDateString()}`,
        content: transcriptText,
        call_date: new Date().toISOString(),
        participants,
        key_insights: keyInsights.slice(0, 5)
      }])
      .select()
      .single();

    if (!error && data) {
      setTranscripts([data, ...transcripts]);
      setTranscriptText('');
      setShowTranscriptModal(false);
      
      // Identify info gaps
      await identifyInfoGaps();
    }

    setLoading(false);
  };

  const generateBusinessCase = async () => {
    if (!selectedAccount) return;
    setLoading(true);

    const content = `# Business Case for ${selectedAccount.account_name}

## Executive Summary
Based on our engagement with ${selectedAccount.account_name}, we have identified significant opportunities to deliver value through our solution.

## Current Situation
- Industry: ${selectedAccount.industry || 'Not specified'}
- Company Size: ${selectedAccount.company_size || 'Not specified'}
- Annual Revenue: ${selectedAccount.annual_revenue || 'Not specified'}

## Key Stakeholders
${stakeholders.map(s => `- ${s.name} (${s.title}) - ${s.influence_level} influence`).join('\n')}

## Value Proposition
Our solution addresses the critical challenges identified through ${transcripts.length} discovery calls with key stakeholders.

## Identified Pain Points
${selectedAccount.pain_points?.join('\n- ') || 'To be determined through additional discovery'}

## Next Steps
1. Schedule executive presentation
2. Develop detailed ROI analysis
3. Prepare pilot program proposal
4. Identify technical requirements

## Expected Outcomes
- Improved operational efficiency
- Cost reduction opportunities
- Enhanced decision-making capabilities`;

    const { data, error } = await supabase
      .from('business_cases')
      .insert([{
        account_id: selectedAccount.id,
        content,
        generated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (!error && data) {
      setBusinessCase(data);
    }

    setLoading(false);
  };

  const identifyInfoGaps = async () => {
    if (!selectedAccount) return;

    const gaps = [
      { category: 'Technical', question: 'What is the current tech stack?', priority: 'High' },
      { category: 'Business', question: 'What are the key KPIs for success?', priority: 'High' },
      { category: 'Decision Process', question: 'What is the approval process?', priority: 'Medium' },
      { category: 'Budget', question: 'What is the allocated budget?', priority: 'High' },
      { category: 'Timeline', question: 'What is the desired implementation timeline?', priority: 'Medium' }
    ];

    const toInsert = gaps.map(gap => ({
      account_id: selectedAccount.id,
      ...gap,
      status: 'open'
    }));

    const { data } = await supabase
      .from('info_gaps')
      .insert(toInsert)
      .select();

    if (data) {
      setInfoGaps([...infoGaps, ...data]);
    }
  };

  const deleteAccount = async (accountId) => {
    if (!confirm('Are you sure you want to delete this account?')) return;

    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', accountId);

    if (!error) {
      setAccounts(accounts.filter(a => a.id !== accountId));
      if (selectedAccount?.id === accountId) {
        setSelectedAccount(null);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Sales Account Dashboard</h1>
          <p className="text-sm text-gray-600">Powered by Supabase</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar - Account List */}
          <div className="col-span-3 bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Accounts</h2>
              <button
                onClick={() => setShowNewAccountModal(true)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              {accounts.map(account => (
                <div
                  key={account.id}
                  onClick={() => setSelectedAccount(account)}
                  className={`p-3 rounded cursor-pointer ${
                    selectedAccount?.id === account.id
                      ? 'bg-blue-50 border-blue-300 border'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="font-medium">{account.account_name}</div>
                  <div className="text-xs text-gray-500">{account.industry}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="col-span-9">
            {selectedAccount ? (
              <>
                {/* Account Header */}
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-bold">{selectedAccount.account_name}</h2>
                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        {selectedAccount.industry && <div>Industry: {selectedAccount.industry}</div>}
                        {selectedAccount.company_size && <div>Size: {selectedAccount.company_size}</div>}
                        {selectedAccount.annual_revenue && <div>Revenue: {selectedAccount.annual_revenue}</div>}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteAccount(selectedAccount.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-lg shadow">
                  <div className="border-b px-6">
                    <div className="flex space-x-8">
                      {['overview', 'stakeholders', 'transcripts', 'business-case', 'info-gaps'].map(tab => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={`py-4 border-b-2 font-medium text-sm ${
                            activeTab === tab
                              ? 'border-blue-500 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          {tab.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-6">
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-blue-50 p-4 rounded-lg">
                            <Users className="w-8 h-8 text-blue-600 mb-2" />
                            <div className="text-2xl font-bold">{stakeholders.length}</div>
                            <div className="text-sm text-gray-600">Stakeholders</div>
                          </div>
                          <div className="bg-green-50 p-4 rounded-lg">
                            <FileText className="w-8 h-8 text-green-600 mb-2" />
                            <div className="text-2xl font-bold">{transcripts.length}</div>
                            <div className="text-sm text-gray-600">Transcripts</div>
                          </div>
                          <div className="bg-orange-50 p-4 rounded-lg">
                            <AlertCircle className="w-8 h-8 text-orange-600 mb-2" />
                            <div className="text-2xl font-bold">{infoGaps.filter(g => g.status === 'open').length}</div>
                            <div className="text-sm text-gray-600">Open Info Gaps</div>
                          </div>
                        </div>

                        <div className="flex space-x-4">
                          <button
                            onClick={() => setShowTranscriptModal(true)}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Transcript
                          </button>
                          <button
                            onClick={() => setShowNewStakeholderModal(true)}
                            className="flex items-center px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Stakeholder
                          </button>
                          <button
                            onClick={generateBusinessCase}
                            disabled={loading}
                            className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
                          >
                            <Lightbulb className="w-4 h-4 mr-2" />
                            Generate Business Case
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Stakeholders Tab */}
                    {activeTab === 'stakeholders' && (
                      <div>
                        <div className="flex justify-between mb-4">
                          <h3 className="text-lg font-semibold">Stakeholders</h3>
                          <button
                            onClick={() => setShowNewStakeholderModal(true)}
                            className="flex items-center px-3 py-1 bg-blue-600 text-white rounded text-sm"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add
                          </button>
                        </div>
                        <div className="space-y-3">
                          {stakeholders.map(stakeholder => (
                            <div key={stakeholder.id} className="border rounded-lg p-4">
                              <div className="flex justify-between">
                                <div>
                                  <div className="font-semibold">{stakeholder.name}</div>
                                  <div className="text-sm text-gray-600">{stakeholder.title}</div>
                                  <div className="text-sm text-gray-500">{stakeholder.role}</div>
                                </div>
                                <div className="text-right text-sm">
                                  <div className="text-gray-600">Influence: {stakeholder.influence_level}</div>
                                  <div className="text-gray-600">Engagement: {stakeholder.engagement_level}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Transcripts Tab */}
                    {activeTab === 'transcripts' && (
                      <div>
                        <div className="flex justify-between mb-4">
                          <h3 className="text-lg font-semibold">Call Transcripts</h3>
                          <button
                            onClick={() => setShowTranscriptModal(true)}
                            className="flex items-center px-3 py-1 bg-blue-600 text-white rounded text-sm"
                          >
                            <Upload className="w-4 h-4 mr-1" />
                            Upload
                          </button>
                        </div>
                        <div className="space-y-3">
                          {transcripts.map(transcript => (
                            <div key={transcript.id} className="border rounded-lg p-4">
                              <div className="font-semibold mb-2">{transcript.title}</div>
                              <div className="text-sm text-gray-600 mb-2">
                                {new Date(transcript.call_date).toLocaleDateString()}
                              </div>
                              <div className="text-sm bg-gray-50 p-3 rounded max-h-32 overflow-y-auto">
                                {transcript.content.substring(0, 200)}...
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Business Case Tab */}
                    {activeTab === 'business-case' && (
                      <div>
                        <div className="flex justify-between mb-4">
                          <h3 className="text-lg font-semibold">Business Case</h3>
                          <button
                            onClick={generateBusinessCase}
                            disabled={loading}
                            className="flex items-center px-3 py-1 bg-green-600 text-white rounded text-sm disabled:bg-gray-400"
                          >
                            <Lightbulb className="w-4 h-4 mr-1" />
                            {businessCase ? 'Regenerate' : 'Generate'}
                          </button>
                        </div>
                        {businessCase ? (
                          <div className="prose max-w-none">
                            <pre className="whitespace-pre-wrap bg-gray-50 p-4 rounded text-sm">
                              {businessCase.content}
                            </pre>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            No business case generated yet. Click "Generate" to create one.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Info Gaps Tab */}
                    {activeTab === 'info-gaps' && (
                      <div>
                        <div className="flex justify-between mb-4">
                          <h3 className="text-lg font-semibold">Information Gaps</h3>
                          <button
                            onClick={identifyInfoGaps}
                            disabled={loading}
                            className="flex items-center px-3 py-1 bg-orange-600 text-white rounded text-sm"
                          >
                            <AlertCircle className="w-4 h-4 mr-1" />
                            Identify Gaps
                          </button>
                        </div>
                        <div className="space-y-3">
                          {infoGaps.map(gap => (
                            <div key={gap.id} className="border rounded-lg p-4 flex justify-between items-start">
                              <div>
                                <div className="text-sm text-gray-500">{gap.category}</div>
                                <div className="font-medium">{gap.question}</div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className={`text-xs px-2 py-1 rounded ${
                                  gap.priority === 'High' ? 'bg-red-100 text-red-700' :
                                  gap.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {gap.priority}
                                </span>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  gap.status === 'open' ? 'bg-orange-100 text-orange-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {gap.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Account Selected</h3>
                <p className="text-gray-500">Select an account from the sidebar or create a new one</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Account Modal */}
      {showNewAccountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">New Account</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Account Name *</label>
                <input
                  type="text"
                  value={newAccount.account_name}
                  onChange={(e) => setNewAccount({...newAccount, account_name: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Industry</label>
                <input
                  type="text"
                  value={newAccount.industry}
                  onChange={(e) => setNewAccount({...newAccount, industry: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Company Size</label>
                <input
                  type="text"
                  value={newAccount.company_size}
                  onChange={(e) => setNewAccount({...newAccount, company_size: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Annual Revenue</label>
                <input
                  type="text"
                  value={newAccount.annual_revenue}
                  onChange={(e) => setNewAccount({...newAccount, annual_revenue: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowNewAccountModal(false)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createAccount}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Stakeholder Modal */}
      {showNewStakeholderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">New Stakeholder</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={newStakeholder.name}
                  onChange={(e) => setNewStakeholder({...newStakeholder, name: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={newStakeholder.title}
                  onChange={(e) => setNewStakeholder({...newStakeholder, title: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <input
                  type="text"
                  value={newStakeholder.role}
                  onChange={(e) => setNewStakeholder({...newStakeholder, role: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Influence Level</label>
                <select
                  value={newStakeholder.influence_level}
                  onChange={(e) => setNewStakeholder({...newStakeholder, influence_level: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Engagement Level</label>
                <select
                  value={newStakeholder.engagement_level}
                  onChange={(e) => setNewStakeholder({...newStakeholder, engagement_level: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowNewStakeholderModal(false)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createStakeholder}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transcript Upload Modal */}
      {showTranscriptModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Upload Call Transcript</h3>
            <textarea
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="Paste your call transcript here..."
              className="w-full border rounded px-3 py-2 h-64"
            />
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowTranscriptModal(false)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={parseAndSaveTranscript}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? 'Processing...' : 'Upload & Parse'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
