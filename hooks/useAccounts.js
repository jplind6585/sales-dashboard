import { useState, useEffect, useCallback } from 'react';
import { loadFromStorage, saveToStorage, generateId, STORAGE_KEYS } from '../lib/storage';
import { parseCommand, executeActions } from '../lib/commandParser';
import { createEmptyBusinessAreaState, createEmptyMeddiccState } from '../lib/constants';
import {
  mergeBusinessAreas,
  mergeStakeholders as mergeStakeholdersUtil,
  mergeMetrics,
  mergeGaps as mergeGapsUtil,
  safeToLowerCase
} from '../lib/mergeUtils';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../stores/useAuthStore';
import { useAccountStore } from '../stores/useAccountStore';
import * as accountsDb from '../lib/db/accounts';
import * as transcriptsDb from '../lib/db/transcripts';
import * as stakeholdersDb from '../lib/db/stakeholders';
import * as gapsDb from '../lib/db/gaps';
import * as notesDb from '../lib/db/notes';

// Wrapper to pass generateId to merge functions
const mergeStakeholders = (existing, newStakeholders) =>
  mergeStakeholdersUtil(existing, newStakeholders, generateId);

const mergeGaps = (existing, newGaps) =>
  mergeGapsUtil(existing, newGaps, generateId);

/**
 * Determine if we should use Supabase or localStorage
 */
function useSupabaseMode() {
  const useSupabase = isSupabaseConfigured() &&
    process.env.NEXT_PUBLIC_USE_SUPABASE !== 'false';
  return useSupabase;
}

/**
 * Custom hook for account management
 * Uses Supabase when configured, falls back to localStorage
 */
export const useAccounts = () => {
  const useSupabase = useSupabaseMode();

  if (useSupabase) {
    return useAccountsSupabase();
  } else {
    return useAccountsLocalStorage();
  }
};

/**
 * Supabase-backed implementation
 */
function useAccountsSupabase() {
  const { user } = useAuthStore();
  const store = useAccountStore();
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch accounts when user changes
  useEffect(() => {
    if (user?.id) {
      store.fetchAccounts(user.id);
    } else {
      store.reset();
    }
  }, [user?.id]);

  // Get selected account from store
  const selectedAccount = store.getSelectedAccount();

  // Create a new account
  const createAccount = useCallback(async (name, url) => {
    if (!name.trim() || !user?.id) return null;

    const { account, error } = await store.createAccount(user.id, {
      name,
      url,
      businessAreas: createEmptyBusinessAreaState(),
      meddicc: createEmptyMeddiccState(),
    });

    if (error) {
      console.error('Error creating account:', error);
      return null;
    }

    return account;
  }, [user?.id, store]);

  // Set selected account
  const setSelectedAccount = useCallback((account) => {
    store.selectAccount(account?.id || null);
  }, [store]);

  // Add a transcript and merge extracted insights
  const addTranscript = useCallback(async (text) => {
    if (!text.trim() || !selectedAccount) return false;

    setIsProcessing(true);

    try {
      // Pass existing context for cumulative analysis
      const existingContext = {
        transcripts: selectedAccount.transcripts || [],
        businessAreas: selectedAccount.businessAreas || {},
        stakeholders: selectedAccount.stakeholders || [],
        metrics: selectedAccount.metrics || {}
      };

      const response = await fetch('/api/analyze-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: text,
          existingContext
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.analysis) {
        throw new Error('Failed to parse transcript analysis');
      }

      const analysis = data.analysis;

      // Save transcript to Supabase
      const transcriptData = {
        text,
        date: analysis.callDate || new Date().toISOString().split('T')[0],
        callType: analysis.callType || 'other',
        attendees: analysis.attendees || [],
        summary: analysis.summary,
        rawAnalysis: analysis,
        source: 'manual'
      };

      await store.addTranscript(selectedAccount.id, transcriptData);

      // Merge analysis data into the account
      const mergedBusinessAreas = mergeBusinessAreas(
        selectedAccount.businessAreas || createEmptyBusinessAreaState(),
        analysis.businessAreas || {}
      );
      const mergedMetrics = mergeMetrics(
        selectedAccount.metrics || {},
        analysis.metrics || {},
        analysis.metricsContext || {}
      );
      const mergedMeddicc = {
        ...(selectedAccount.meddicc || createEmptyMeddiccState()),
        ...(analysis.meddicc || {})
      };

      // Update account with merged data
      await store.updateAccount(selectedAccount.id, {
        businessAreas: mergedBusinessAreas,
        metrics: mergedMetrics,
        meddicc: mergedMeddicc
      });

      // Add new stakeholders
      const existingNames = new Set(
        (selectedAccount.stakeholders || []).map(s => s.name?.toLowerCase())
      );
      const newStakeholders = (analysis.stakeholders || []).filter(
        s => s.name && !existingNames.has(s.name.toLowerCase())
      );
      for (const s of newStakeholders) {
        await store.addStakeholder(selectedAccount.id, s);
      }

      // Add new gaps
      const existingQuestions = new Set(
        (selectedAccount.informationGaps || []).map(g => g.question?.toLowerCase())
      );
      const newGaps = (analysis.informationGaps || []).filter(
        g => g.question && !existingQuestions.has(g.question.toLowerCase())
      );
      for (const g of newGaps) {
        await store.addGap(selectedAccount.id, g);
      }

      return true;
    } catch (error) {
      alert(`Error processing transcript: ${error.message}`);
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [selectedAccount, store]);

  // Import a transcript from Gong
  const addGongTranscript = useCallback(async (gongCall) => {
    if (!gongCall || !selectedAccount) return false;

    setIsProcessing(true);

    try {
      const existingContext = {
        transcripts: selectedAccount.transcripts || [],
        businessAreas: selectedAccount.businessAreas || {},
        stakeholders: selectedAccount.stakeholders || [],
        metrics: selectedAccount.metrics || {}
      };

      const response = await fetch('/api/analyze-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: gongCall.transcript,
          existingContext
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || errorData.message || `API error: ${response.status}`;
        throw new Error(errorMsg);
      }

      const data = await response.json();

      if (!data.success || !data.analysis) {
        throw new Error(data.error || 'Failed to parse transcript analysis');
      }

      const analysis = data.analysis;

      // Save transcript with Gong metadata
      const transcriptData = {
        text: gongCall.transcript,
        date: gongCall.date || analysis.callDate || new Date().toISOString().split('T')[0],
        callType: gongCall.callType || analysis.callType || 'other',
        attendees: gongCall.attendees || analysis.attendees || [],
        summary: analysis.summary,
        rawAnalysis: analysis,
        gongCallId: gongCall.gongCallId,
        gongUrl: gongCall.gongUrl,
        source: 'gong'
      };

      await store.addTranscript(selectedAccount.id, transcriptData);

      // Merge analysis data
      const mergedBusinessAreas = mergeBusinessAreas(
        selectedAccount.businessAreas || createEmptyBusinessAreaState(),
        analysis.businessAreas || {}
      );
      const mergedMetrics = mergeMetrics(
        selectedAccount.metrics || {},
        analysis.metrics || {},
        analysis.metricsContext || {}
      );

      await store.updateAccount(selectedAccount.id, {
        businessAreas: mergedBusinessAreas,
        metrics: mergedMetrics
      });

      // Add new stakeholders
      const existingNames = new Set(
        (selectedAccount.stakeholders || []).map(s => s.name?.toLowerCase())
      );
      const newStakeholders = (analysis.stakeholders || []).filter(
        s => s.name && !existingNames.has(s.name.toLowerCase())
      );
      for (const s of newStakeholders) {
        await store.addStakeholder(selectedAccount.id, s);
      }

      // Add new gaps
      const existingQuestions = new Set(
        (selectedAccount.informationGaps || []).map(g => g.question?.toLowerCase())
      );
      const newGaps = (analysis.informationGaps || []).filter(
        g => g.question && !existingQuestions.has(g.question.toLowerCase())
      );
      for (const g of newGaps) {
        await store.addGap(selectedAccount.id, g);
      }

      return true;
    } catch (error) {
      alert(`Error processing Gong transcript: ${error.message}`);
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [selectedAccount, store]);

  // Add a stakeholder manually
  const addStakeholder = useCallback(async (name, title, department, role) => {
    if (!name.trim() || !selectedAccount) return false;

    const { error } = await store.addStakeholder(selectedAccount.id, {
      name,
      title,
      department,
      role,
      notes: ''
    });

    return !error;
  }, [selectedAccount, store]);

  // Update a stakeholder's role
  const updateStakeholderRole = useCallback(async (stakeholderId, newRole) => {
    if (!selectedAccount) return false;

    const { error } = await store.updateStakeholder(
      selectedAccount.id,
      stakeholderId,
      { role: newRole }
    );

    return !error;
  }, [selectedAccount, store]);

  // Resolve an information gap
  const resolveGap = useCallback(async (gapId, resolution) => {
    if (!selectedAccount) return false;

    const { error } = await store.resolveGap(selectedAccount.id, gapId, resolution);
    return !error;
  }, [selectedAccount, store]);

  // Handle manual note with command parsing
  const handleManualNote = useCallback(async (noteText) => {
    if (!noteText.trim() || !selectedAccount) return false;

    const actions = parseCommand(noteText);
    if (actions.length === 0) return false;

    // Process actions and apply to Supabase
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'add_stakeholder':
            await store.addStakeholder(selectedAccount.id, {
              name: action.name,
              title: action.title,
              role: action.role || 'Unknown'
            });
            break;

          case 'update_stakeholder_role':
            const stakeholder = selectedAccount.stakeholders?.find(
              s => safeToLowerCase(s.name) === safeToLowerCase(action.name)
            );
            if (stakeholder) {
              await store.updateStakeholder(selectedAccount.id, stakeholder.id, {
                role: action.role
              });
            }
            break;

          case 'add_note':
            await store.addNote(selectedAccount.id, {
              category: action.category || 'General',
              content: action.content
            });
            break;

          case 'add_metric':
            const updatedMetrics = {
              ...selectedAccount.metrics,
              [action.metric]: {
                value: action.value,
                context: action.context,
                lastUpdated: new Date().toISOString()
              }
            };
            await store.updateAccount(selectedAccount.id, { metrics: updatedMetrics });
            break;

          default:
            console.warn('Unknown action type:', action.type);
        }
      } catch (error) {
        console.error('Error executing action:', error);
      }
    }

    return true;
  }, [selectedAccount, store]);

  // Apply actions from AI assistant
  const applyAssistantActions = useCallback(async (actions) => {
    if (!selectedAccount || !actions?.length) return false;

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'update_stakeholder_role':
            const stakeholder = selectedAccount.stakeholders?.find(
              s => s?.name && action?.name && safeToLowerCase(s.name) === safeToLowerCase(action.name)
            );
            if (stakeholder) {
              await store.updateStakeholder(selectedAccount.id, stakeholder.id, {
                role: action.newRole
              });
            }
            break;

          case 'add_metric':
            const updatedMetrics = {
              ...selectedAccount.metrics,
              [action.metric]: {
                value: action.value,
                context: action.context || 'Added via assistant',
                lastUpdated: new Date().toISOString()
              }
            };
            await store.updateAccount(selectedAccount.id, { metrics: updatedMetrics });
            break;

          case 'add_note':
            await store.addNote(selectedAccount.id, {
              category: action.category || 'General',
              content: action.content
            });
            break;

          case 'mark_area_irrelevant':
            const areasIrrelevant = {
              ...selectedAccount.businessAreas,
              [action.areaId]: {
                ...(selectedAccount.businessAreas?.[action.areaId] || {}),
                irrelevant: true,
                irrelevantReason: action.reason,
                lastUpdated: new Date().toISOString()
              }
            };
            await store.updateAccount(selectedAccount.id, { businessAreas: areasIrrelevant });
            break;

          case 'set_area_priority':
            const areasPriority = {
              ...selectedAccount.businessAreas,
              [action.areaId]: {
                ...(selectedAccount.businessAreas?.[action.areaId] || {}),
                priority: action.priority,
                lastUpdated: new Date().toISOString()
              }
            };
            await store.updateAccount(selectedAccount.id, { businessAreas: areasPriority });
            break;

          case 'unmark_area_irrelevant':
            const areasRelevant = {
              ...selectedAccount.businessAreas,
              [action.areaId]: {
                ...(selectedAccount.businessAreas?.[action.areaId] || {}),
                irrelevant: false,
                irrelevantReason: null,
                lastUpdated: new Date().toISOString()
              }
            };
            await store.updateAccount(selectedAccount.id, { businessAreas: areasRelevant });
            break;

          case 'update_stage':
            await store.updateAccount(selectedAccount.id, { stage: action.stage });
            break;

          case 'update_vertical':
            await store.updateAccount(selectedAccount.id, { vertical: action.vertical });
            break;

          case 'update_ownership':
            await store.updateAccount(selectedAccount.id, { ownershipType: action.ownership });
            break;

          case 'resolve_gap':
            await store.resolveGap(selectedAccount.id, action.gapId, action.resolution);
            break;

          case 'add_gap':
            await store.addGap(selectedAccount.id, {
              question: action.question,
              category: action.category || 'business',
              status: 'open'
            });
            break;

          case 'delete_account':
            await store.deleteAccount(selectedAccount.id);
            store.selectAccount(null);
            break;

          case 'rename_account':
            await store.updateAccount(selectedAccount.id, { name: action.newName });
            break;

          default:
            console.warn('Unknown action type:', action.type);
        }
      } catch (error) {
        console.error('Error applying action:', error);
      }
    }

    return true;
  }, [selectedAccount, store]);

  // Update specific account fields
  const updateAccountField = useCallback(async (updates) => {
    if (!selectedAccount) return false;

    const { error } = await store.updateAccount(selectedAccount.id, updates);
    return !error;
  }, [selectedAccount, store]);

  // Delete an account
  const deleteAccount = useCallback(async (accountId) => {
    const { error } = await store.deleteAccount(accountId);
    if (!error && selectedAccount?.id === accountId) {
      store.selectAccount(null);
    }
    return !error;
  }, [selectedAccount, store]);

  return {
    accounts: store.accounts,
    selectedAccount,
    setSelectedAccount,
    isProcessing: isProcessing || store.isSaving,
    createAccount,
    addTranscript,
    addGongTranscript,
    addStakeholder,
    updateStakeholderRole,
    resolveGap,
    handleManualNote,
    applyAssistantActions,
    updateAccountField,
    deleteAccount
  };
}

/**
 * localStorage-backed implementation (fallback/legacy mode)
 */
function useAccountsLocalStorage() {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load accounts from localStorage on mount
  useEffect(() => {
    const saved = loadFromStorage(STORAGE_KEYS.ACCOUNTS);
    if (saved) setAccounts(saved);
  }, []);

  // Create a new account with full data structure
  const createAccount = useCallback((name, url) => {
    if (!name.trim()) return null;

    const newAccount = {
      id: generateId(),
      name,
      url,
      transcripts: [],
      stakeholders: [],
      businessAreas: createEmptyBusinessAreaState(),
      meddicc: createEmptyMeddiccState(),
      metrics: {},
      informationGaps: [],
      notes: [],
      createdAt: new Date().toISOString()
    };

    const updated = [...accounts, newAccount];
    setAccounts(updated);
    saveToStorage(STORAGE_KEYS.ACCOUNTS, updated);
    setSelectedAccount(newAccount);
    return newAccount;
  }, [accounts]);

  // Update accounts in state and storage
  const updateAccounts = useCallback((updatedAccounts) => {
    setAccounts(updatedAccounts);
    saveToStorage(STORAGE_KEYS.ACCOUNTS, updatedAccounts);

    // Update selected account if it was modified
    if (selectedAccount) {
      const updated = updatedAccounts.find(a => a.id === selectedAccount.id);
      if (updated) setSelectedAccount(updated);
    }
  }, [selectedAccount]);

  // Add a transcript and merge extracted insights
  const addTranscript = useCallback(async (text) => {
    if (!text.trim() || !selectedAccount) return false;

    setIsProcessing(true);

    try {
      // Pass existing context for cumulative analysis
      const existingContext = {
        transcripts: selectedAccount.transcripts || [],
        businessAreas: selectedAccount.businessAreas || {},
        stakeholders: selectedAccount.stakeholders || [],
        metrics: selectedAccount.metrics || {}
      };

      const response = await fetch('/api/analyze-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: text,
          existingContext
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.analysis) {
        throw new Error('Failed to parse transcript analysis');
      }

      const analysis = data.analysis;

      // Create transcript record
      const newTranscript = {
        id: generateId(),
        text,
        date: analysis.callDate || new Date().toISOString().split('T')[0],
        callType: analysis.callType || 'other',
        attendees: analysis.attendees || [],
        summary: analysis.summary,
        rawAnalysis: analysis,
        addedAt: new Date().toISOString()
      };

      // Merge all extracted data into the account
      const updatedAccount = {
        ...selectedAccount,
        transcripts: [...(selectedAccount.transcripts || []), newTranscript],
        stakeholders: mergeStakeholders(
          selectedAccount.stakeholders,
          analysis.stakeholders || []
        ),
        businessAreas: mergeBusinessAreas(
          selectedAccount.businessAreas || createEmptyBusinessAreaState(),
          analysis.businessAreas || {}
        ),
        metrics: mergeMetrics(
          selectedAccount.metrics || {},
          analysis.metrics || {},
          analysis.metricsContext || {}
        ),
        informationGaps: mergeGaps(
          selectedAccount.informationGaps || [],
          analysis.informationGaps || []
        ),
      };

      const updatedAccounts = accounts.map(acc =>
        acc.id === selectedAccount.id ? updatedAccount : acc
      );

      updateAccounts(updatedAccounts);
      return true;
    } catch (error) {
      alert(`Error processing transcript: ${error.message}`);
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [accounts, selectedAccount, updateAccounts]);

  // Import a transcript from Gong (pre-formatted)
  const addGongTranscript = useCallback(async (gongCall) => {
    if (!gongCall || !selectedAccount) return false;

    setIsProcessing(true);

    try {
      // Pass existing context for cumulative analysis
      const existingContext = {
        transcripts: selectedAccount.transcripts || [],
        businessAreas: selectedAccount.businessAreas || {},
        stakeholders: selectedAccount.stakeholders || [],
        metrics: selectedAccount.metrics || {}
      };

      const response = await fetch('/api/analyze-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: gongCall.transcript,
          existingContext
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || errorData.message || `API error: ${response.status}`;
        throw new Error(errorMsg);
      }

      const data = await response.json();

      if (!data.success || !data.analysis) {
        throw new Error(data.error || 'Failed to parse transcript analysis');
      }

      const analysis = data.analysis;

      // Create transcript record with Gong metadata
      const newTranscript = {
        id: generateId(),
        text: gongCall.transcript,
        date: gongCall.date || analysis.callDate || new Date().toISOString().split('T')[0],
        callType: gongCall.callType || analysis.callType || 'other',
        attendees: gongCall.attendees || analysis.attendees || [],
        summary: analysis.summary,
        rawAnalysis: analysis,
        // Gong-specific fields
        gongCallId: gongCall.gongCallId,
        gongUrl: gongCall.gongUrl,
        source: 'gong',
        addedAt: new Date().toISOString()
      };

      // Merge all extracted data into the account
      const updatedAccount = {
        ...selectedAccount,
        transcripts: [...(selectedAccount.transcripts || []), newTranscript],
        stakeholders: mergeStakeholders(
          selectedAccount.stakeholders,
          analysis.stakeholders || []
        ),
        businessAreas: mergeBusinessAreas(
          selectedAccount.businessAreas || createEmptyBusinessAreaState(),
          analysis.businessAreas || {}
        ),
        metrics: mergeMetrics(
          selectedAccount.metrics || {},
          analysis.metrics || {},
          analysis.metricsContext || {}
        ),
        informationGaps: mergeGaps(
          selectedAccount.informationGaps || [],
          analysis.informationGaps || []
        ),
      };

      const updatedAccounts = accounts.map(acc =>
        acc.id === selectedAccount.id ? updatedAccount : acc
      );

      updateAccounts(updatedAccounts);
      return true;
    } catch (error) {
      alert(`Error processing Gong transcript: ${error.message}`);
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [accounts, selectedAccount, updateAccounts]);

  // Add a stakeholder manually
  const addStakeholder = useCallback((name, title, department, role) => {
    if (!name.trim() || !selectedAccount) return false;

    const newStakeholder = {
      id: generateId(),
      name,
      title,
      department,
      role,
      notes: '',
      addedAt: new Date().toISOString()
    };

    const updatedAccounts = accounts.map(acc =>
      acc.id === selectedAccount.id
        ? { ...acc, stakeholders: [...(acc.stakeholders || []), newStakeholder] }
        : acc
    );

    updateAccounts(updatedAccounts);
    return true;
  }, [accounts, selectedAccount, updateAccounts]);

  // Update a stakeholder's role
  const updateStakeholderRole = useCallback((stakeholderId, newRole) => {
    if (!selectedAccount) return false;

    const updatedAccounts = accounts.map(acc => {
      if (acc.id !== selectedAccount.id) return acc;

      return {
        ...acc,
        stakeholders: acc.stakeholders.map(s =>
          s.id === stakeholderId ? { ...s, role: newRole, lastUpdated: new Date().toISOString() } : s
        )
      };
    });

    updateAccounts(updatedAccounts);
    return true;
  }, [accounts, selectedAccount, updateAccounts]);

  // Resolve an information gap
  const resolveGap = useCallback((gapId, resolution) => {
    if (!selectedAccount) return false;

    const updatedAccounts = accounts.map(acc => {
      if (acc.id !== selectedAccount.id) return acc;

      return {
        ...acc,
        informationGaps: acc.informationGaps.map(g =>
          g.id === gapId
            ? { ...g, status: 'resolved', resolution, resolvedAt: new Date().toISOString() }
            : g
        )
      };
    });

    updateAccounts(updatedAccounts);
    return true;
  }, [accounts, selectedAccount, updateAccounts]);

  // Handle manual note with command parsing
  const handleManualNote = useCallback((noteText) => {
    if (!noteText.trim() || !selectedAccount) return false;

    const actions = parseCommand(noteText);
    if (actions.length === 0) return false;

    const { account: updatedAccount, messages } = executeActions(
      actions,
      selectedAccount,
      generateId
    );

    if (!updatedAccount) return false;

    messages.forEach(msg => {
      alert(msg.text);
    });

    const updatedAccounts = accounts.map(acc =>
      acc.id === selectedAccount.id ? updatedAccount : acc
    );

    updateAccounts(updatedAccounts);
    return true;
  }, [accounts, selectedAccount, updateAccounts]);

  // Apply actions from AI assistant
  const applyAssistantActions = useCallback((actions) => {
    if (!selectedAccount || !actions?.length) return false;

    let updatedAccount = { ...selectedAccount };

    actions.forEach(action => {
      switch (action.type) {
        case 'update_stakeholder_role':
          updatedAccount.stakeholders = (updatedAccount.stakeholders || []).map(s =>
            s?.name && action?.name && safeToLowerCase(s.name) === safeToLowerCase(action.name)
              ? { ...s, role: action.newRole, lastUpdated: new Date().toISOString() }
              : s
          );
          break;

        case 'add_metric':
          updatedAccount.metrics = {
            ...updatedAccount.metrics,
            [action.metric]: {
              value: action.value,
              context: action.context || 'Added via assistant',
              lastUpdated: new Date().toISOString()
            }
          };
          break;

        case 'add_note':
          updatedAccount.notes = [
            ...(updatedAccount.notes || []),
            {
              id: generateId(),
              category: action.category || 'General',
              content: action.content,
              addedAt: new Date().toISOString()
            }
          ];
          break;

        case 'mark_area_irrelevant':
          updatedAccount.businessAreas = {
            ...updatedAccount.businessAreas,
            [action.areaId]: {
              ...(updatedAccount.businessAreas?.[action.areaId] || {}),
              irrelevant: true,
              irrelevantReason: action.reason,
              lastUpdated: new Date().toISOString()
            }
          };
          break;

        case 'set_area_priority':
          updatedAccount.businessAreas = {
            ...updatedAccount.businessAreas,
            [action.areaId]: {
              ...(updatedAccount.businessAreas?.[action.areaId] || {}),
              priority: action.priority,
              lastUpdated: new Date().toISOString()
            }
          };
          break;

        case 'unmark_area_irrelevant':
          updatedAccount.businessAreas = {
            ...updatedAccount.businessAreas,
            [action.areaId]: {
              ...(updatedAccount.businessAreas?.[action.areaId] || {}),
              irrelevant: false,
              irrelevantReason: null,
              lastUpdated: new Date().toISOString()
            }
          };
          break;

        case 'update_stage':
          updatedAccount.stage = action.stage;
          break;

        case 'update_vertical':
          updatedAccount.vertical = action.vertical;
          break;

        case 'update_ownership':
          updatedAccount.ownershipType = action.ownership;
          break;

        case 'resolve_gap':
          updatedAccount.informationGaps = (updatedAccount.informationGaps || []).map(g =>
            g.id === action.gapId
              ? { ...g, status: 'resolved', resolution: action.resolution, resolvedAt: new Date().toISOString() }
              : g
          );
          break;

        case 'add_gap':
          updatedAccount.informationGaps = [
            ...(updatedAccount.informationGaps || []),
            {
              id: generateId(),
              question: action.question,
              category: action.category || 'business',
              status: 'open',
              addedAt: new Date().toISOString()
            }
          ];
          break;

        case 'delete_account':
          // Will be handled outside the loop
          break;

        case 'rename_account':
          updatedAccount.name = action.newName;
          break;

        default:
          console.warn('Unknown action type:', action.type);
      }
    });

    // Handle delete account separately
    if (actions.some(a => a.type === 'delete_account')) {
      const filteredAccounts = accounts.filter(acc => acc.id !== selectedAccount.id);
      updateAccounts(filteredAccounts);
      setSelectedAccount(null);
      return true;
    }

    const updatedAccounts = accounts.map(acc =>
      acc.id === selectedAccount.id ? updatedAccount : acc
    );

    updateAccounts(updatedAccounts);
    return true;
  }, [accounts, selectedAccount, updateAccounts]);

  // Update specific account fields (for dropdowns, etc.)
  const updateAccountField = useCallback((updates) => {
    if (!selectedAccount) return false;

    const updatedAccount = {
      ...selectedAccount,
      ...updates,
      lastUpdated: new Date().toISOString()
    };

    const updatedAccounts = accounts.map(acc =>
      acc.id === selectedAccount.id ? updatedAccount : acc
    );

    updateAccounts(updatedAccounts);
    return true;
  }, [accounts, selectedAccount, updateAccounts]);

  // Delete an account
  const deleteAccount = useCallback((accountId) => {
    const filteredAccounts = accounts.filter(acc => acc.id !== accountId);
    updateAccounts(filteredAccounts);
    if (selectedAccount?.id === accountId) {
      setSelectedAccount(null);
    }
    return true;
  }, [accounts, selectedAccount, updateAccounts]);

  return {
    accounts,
    selectedAccount,
    setSelectedAccount,
    isProcessing,
    createAccount,
    addTranscript,
    addGongTranscript,
    addStakeholder,
    updateStakeholderRole,
    resolveGap,
    handleManualNote,
    applyAssistantActions,
    updateAccountField,
    deleteAccount
  };
}
