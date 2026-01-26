import { useState, useEffect, useCallback } from 'react';
import { loadFromStorage, saveToStorage, generateId, STORAGE_KEYS } from '../lib/storage';
import { parseCommand, executeActions } from '../lib/commandParser';
import { createEmptyBusinessAreaState, createEmptyMeddiccState } from '../lib/constants';

/**
 * Merge new insights into existing business areas (cumulative, not overwrite)
 */
const mergeBusinessAreas = (existing, newData) => {
  const merged = { ...existing };

  Object.keys(newData).forEach(areaId => {
    const newArea = newData[areaId];
    const existingArea = merged[areaId] || { currentState: [], opportunities: [], quotes: [] };

    // Merge arrays, avoiding duplicates (simple string comparison)
    const mergeArrays = (arr1 = [], arr2 = []) => {
      const combined = [...arr1];
      arr2.forEach(item => {
        if (!combined.some(existing => existing.toLowerCase() === item.toLowerCase())) {
          combined.push(item);
        }
      });
      return combined;
    };

    merged[areaId] = {
      currentState: mergeArrays(existingArea.currentState, newArea.currentState),
      opportunities: mergeArrays(existingArea.opportunities, newArea.opportunities),
      quotes: mergeArrays(existingArea.quotes, newArea.quotes),
      confidence: calculateConfidence(existingArea, newArea),
      lastUpdated: new Date().toISOString(),
    };
  });

  return merged;
};

/**
 * Calculate confidence level based on amount of data
 */
const calculateConfidence = (existing, newArea) => {
  const totalItems =
    (existing.currentState?.length || 0) + (newArea.currentState?.length || 0) +
    (existing.opportunities?.length || 0) + (newArea.opportunities?.length || 0);

  if (totalItems === 0) return 'none';
  if (totalItems <= 2) return 'low';
  if (totalItems <= 5) return 'medium';
  return 'high';
};

/**
 * Merge stakeholders, updating existing or adding new
 */
const mergeStakeholders = (existing = [], newStakeholders = []) => {
  const merged = [...existing];

  newStakeholders.forEach(newPerson => {
    const existingIndex = merged.findIndex(
      p => p.name.toLowerCase() === newPerson.name.toLowerCase()
    );

    if (existingIndex >= 0) {
      // Update existing stakeholder with new info (prefer non-null values)
      merged[existingIndex] = {
        ...merged[existingIndex],
        title: newPerson.title || merged[existingIndex].title,
        department: newPerson.department || merged[existingIndex].department,
        role: newPerson.role !== 'Unknown' ? newPerson.role : merged[existingIndex].role,
        notes: newPerson.notes
          ? `${merged[existingIndex].notes || ''} ${newPerson.notes}`.trim()
          : merged[existingIndex].notes,
        lastUpdated: new Date().toISOString(),
      };
    } else {
      // Add new stakeholder
      merged.push({
        id: generateId(),
        ...newPerson,
        addedAt: new Date().toISOString(),
      });
    }
  });

  return merged;
};

/**
 * Merge metrics, preferring new non-null values
 */
const mergeMetrics = (existing = {}, newMetrics = {}, newContext = {}) => {
  const merged = { ...existing };

  Object.keys(newMetrics).forEach(key => {
    if (newMetrics[key] !== null && newMetrics[key] !== undefined) {
      merged[key] = {
        value: newMetrics[key],
        context: newContext[key] || null,
        lastUpdated: new Date().toISOString(),
      };
    }
  });

  return merged;
};

/**
 * Merge information gaps
 */
const mergeGaps = (existing = [], newGaps = []) => {
  const merged = [...existing];

  newGaps.forEach(gap => {
    // Handle both string format (old) and object format (new)
    const question = typeof gap === 'string' ? gap : gap.question;
    const category = typeof gap === 'string' ? 'business' : (gap.category || 'business');

    if (!merged.some(g => g.question?.toLowerCase() === question.toLowerCase())) {
      merged.push({
        id: generateId(),
        question,
        category,
        status: 'open',
        addedAt: new Date().toISOString(),
      });
    }
  });

  return merged;
};

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
            s.name.toLowerCase() === action.name.toLowerCase()
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

  return {
    accounts,
    selectedAccount,
    setSelectedAccount,
    isProcessing,
    createAccount,
    addTranscript,
    addStakeholder,
    updateStakeholderRole,
    resolveGap,
    handleManualNote,
    applyAssistantActions
  };
};
