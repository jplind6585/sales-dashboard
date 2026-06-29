import { useState, useEffect, useCallback } from 'react';
import { loadFromStorage, saveToStorage, generateId, STORAGE_KEYS } from '../lib/storage';
import { createEmptyBusinessAreaState, createEmptyMeddiccState } from '../lib/constants';
import {
  mergeBusinessAreas,
  mergeStakeholders as mergeStakeholdersUtil,
  mergeMetrics,
  mergeGaps as mergeGapsUtil,
  safeToLowerCase
} from '../lib/mergeUtils';
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
/**
 * Custom hook for account management. Supabase-backed
 * (localStorage/offline fallback retired 2026-06).
 */
export const useAccounts = () => {
  return useAccountsSupabase();
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

  // Refresh after out-of-band writes (e.g. the global assistant moving a stage).
  useEffect(() => {
    const onRefresh = (e) => {
      const ids = e.detail?.ids || [];
      if (ids.length) store.invalidateAccounts(ids);
      if (user?.id) store.fetchAccounts(user.id);
      if (store.selectedAccountId && ids.includes(store.selectedAccountId)) store.fetchAccountDetail(store.selectedAccountId);
    };
    window.addEventListener('accounts:refresh', onRefresh);
    return () => window.removeEventListener('accounts:refresh', onRefresh);
  }, [user?.id, store]);

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
    store.selectAccount(account?.id || null)
    if (account?.id) {
      store.fetchAccountDetail(account.id)
    }
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

      // Save transcript first to get its ID
      const { transcript: savedTranscript } = await store.addTranscript(selectedAccount.id, transcriptData);

      // Merge analysis data into the account with transcript ID for source tracking
      const mergedBusinessAreas = mergeBusinessAreas(
        selectedAccount.businessAreas || createEmptyBusinessAreaState(),
        analysis.businessAreas || {},
        savedTranscript?.id || null
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

      // Save transcript first to get its ID
      const { transcript: savedTranscript } = await store.addTranscript(selectedAccount.id, transcriptData);

      // Merge analysis data with transcript ID for source tracking
      const mergedBusinessAreas = mergeBusinessAreas(
        selectedAccount.businessAreas || createEmptyBusinessAreaState(),
        analysis.businessAreas || {},
        savedTranscript?.id || null
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

          case 'delete_transcript':
            if (typeof action.transcriptIndex === 'number') {
              const updatedTranscripts = [...(selectedAccount.transcripts || [])];
              updatedTranscripts.splice(action.transcriptIndex, 1);
              await store.updateAccount(selectedAccount.id, { transcripts: updatedTranscripts });
            }
            break;

          case 'delete_stakeholder':
            const stakeholderToDelete = selectedAccount.stakeholders?.find(
              s => s?.name && action?.name && safeToLowerCase(s.name) === safeToLowerCase(action.name)
            );
            if (stakeholderToDelete) {
              await store.deleteStakeholder(selectedAccount.id, stakeholderToDelete.id);
            }
            break;

          case 'delete_gap':
            const updatedGaps = (selectedAccount.informationGaps || []).filter(g => g.id !== action.gapId);
            await store.updateAccount(selectedAccount.id, { informationGaps: updatedGaps });
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
    applyAssistantActions,
    updateAccountField,
    deleteAccount,
    fetchAccountDetail: store.fetchAccountDetail,
  };
}
