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
          <div className="
