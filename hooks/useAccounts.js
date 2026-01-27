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

// Wrapper to pass generateId to merge functions
const mergeStakeholders = (existing, newStakeholders) =>
  mergeStakeholdersUtil(existing, newStakeholders, generateId);

const mergeGaps = (existing, newGaps) =>
  mergeGapsUtil(existing, newGaps, generateId);

/**
 * Custom hook for account management with localStorage persistence
 */
export const useAccounts = () => {
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

        default:
          console.warn('Unknown action type:', action.type);
      }
    });

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
    updateAccountField
  };
};
