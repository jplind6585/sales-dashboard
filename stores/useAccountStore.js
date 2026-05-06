import { create } from 'zustand'
import * as accountsDb from '../lib/db/accounts'
import * as transcriptsDb from '../lib/db/transcripts'
import * as stakeholdersDb from '../lib/db/stakeholders'
import * as gapsDb from '../lib/db/gaps'
import * as notesDb from '../lib/db/notes'
import { createTasks, getStageChangeTasks } from '../lib/db/tasks'

export const useAccountStore = create((set, get) => ({
  // State
  accounts: [],
  selectedAccountId: null,
  accountDetails: {}, // id → full account detail (loaded on select)
  userId: null,
  isLoading: false,
  isSaving: false,
  error: null,
  lastFetched: null,

  // Computed
  getSelectedAccount: () => {
    const { accounts, selectedAccountId, accountDetails } = get()
    if (!selectedAccountId) return null
    return accountDetails[selectedAccountId] || accounts.find(a => a.id === selectedAccountId) || null
  },

  // Account Actions
  fetchAccounts: async (userId) => {
    set({ isLoading: true, error: null, userId })
    try {
      const { accounts, error } = await accountsDb.getAccounts(userId)
      if (error) throw error
      set({ accounts: accounts || [], isLoading: false, lastFetched: new Date() })
      return { accounts }
    } catch (error) {
      set({ error: error.message, isLoading: false })
      return { error }
    }
  },

  fetchAccountDetail: async (accountId) => {
    const { accountDetails } = get()
    if (accountDetails[accountId]) return { account: accountDetails[accountId] }
    try {
      const { account, error } = await accountsDb.getAccountDetail(accountId)
      if (error) throw error
      set(state => ({ accountDetails: { ...state.accountDetails, [accountId]: account } }))
      return { account }
    } catch (error) {
      return { error }
    }
  },

  createAccount: async (userId, data) => {
    set({ isSaving: true, error: null })
    try {
      const { account, error } = await accountsDb.createAccount(userId, data)
      if (error) throw error
      set(state => ({
        accounts: [...state.accounts, account],
        selectedAccountId: account.id,
        isSaving: false
      }))
      return { account }
    } catch (error) {
      set({ error: error.message, isSaving: false })
      return { error }
    }
  },

  updateAccount: async (accountId, updates) => {
    set({ isSaving: true, error: null })
    try {
      // Detect stage change before updating
      const { accounts, userId } = get()
      const previousStage = accounts.find(a => a.id === accountId)?.stage
      const newStage = updates.stage

      const { account, error } = await accountsDb.updateAccount(accountId, updates)
      if (error) throw error

      set(state => ({
        accounts: state.accounts.map(a => a.id === accountId ? { ...a, ...account } : a),
        accountDetails: state.accountDetails[accountId]
          ? { ...state.accountDetails, [accountId]: { ...state.accountDetails[accountId], ...account } }
          : state.accountDetails,
        isSaving: false
      }))

      // Fire stage-change task checklist (non-fatal, runs after state is updated)
      if (newStage && newStage !== previousStage && userId && process.env.NEXT_PUBLIC_USE_SUPABASE !== 'false') {
        const taskItems = getStageChangeTasks(newStage, accountId, userId)
        if (taskItems.length > 0) {
          createTasks(userId, taskItems).catch(err =>
            console.error('Stage-change task creation failed:', err)
          )
        }

        // Fire Slack notification to account's channel
        const updatedAccount = get().accounts.find(a => a.id === accountId)
        fetch('/api/slack/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'stage_change',
            accountName: updatedAccount?.name || 'Unknown Account',
            slackChannel: updatedAccount?.slackChannel || null,
            fromStage: previousStage,
            toStage: newStage,
          }),
        }).catch(() => {}) // non-fatal
      }

      return { account }
    } catch (error) {
      set({ error: error.message, isSaving: false })
      return { error }
    }
  },

  deleteAccount: async (accountId) => {
    set({ isSaving: true, error: null })
    try {
      const { error } = await accountsDb.deleteAccount(accountId)
      if (error) throw error
      set(state => ({
        accounts: state.accounts.filter(a => a.id !== accountId),
        selectedAccountId: state.selectedAccountId === accountId ? null : state.selectedAccountId,
        isSaving: false
      }))
      return { success: true }
    } catch (error) {
      set({ error: error.message, isSaving: false })
      return { error }
    }
  },

  selectAccount: (accountId) => {
    set({ selectedAccountId: accountId })
  },

  // Transcript Actions
  addTranscript: async (accountId, transcriptData) => {
    set({ isSaving: true, error: null })
    try {
      const { transcript, error } = await transcriptsDb.addTranscript(accountId, transcriptData)
      if (error) throw error

      // Update local state
      set(state => ({
        accounts: state.accounts.map(a => {
          if (a.id !== accountId) return a
          return { ...a, transcripts: [...(a.transcripts || []), transcript] }
        }),
        accountDetails: state.accountDetails[accountId]
          ? { ...state.accountDetails, [accountId]: { ...state.accountDetails[accountId], transcripts: [...(state.accountDetails[accountId].transcripts || []), transcript] } }
          : state.accountDetails,
        isSaving: false
      }))
      return { transcript }
    } catch (error) {
      set({ error: error.message, isSaving: false })
      return { error }
    }
  },

  deleteTranscript: async (accountId, transcriptId) => {
    set({ isSaving: true, error: null })
    try {
      const { error } = await transcriptsDb.deleteTranscript(transcriptId)
      if (error) throw error

      set(state => ({
        accounts: state.accounts.map(a => {
          if (a.id !== accountId) return a
          return { ...a, transcripts: (a.transcripts || []).filter(t => t.id !== transcriptId) }
        }),
        accountDetails: state.accountDetails[accountId]
          ? { ...state.accountDetails, [accountId]: { ...state.accountDetails[accountId], transcripts: (state.accountDetails[accountId].transcripts || []).filter(t => t.id !== transcriptId) } }
          : state.accountDetails,
        isSaving: false
      }))
      return { success: true }
    } catch (error) {
      set({ error: error.message, isSaving: false })
      return { error }
    }
  },

  // Stakeholder Actions
  addStakeholder: async (accountId, stakeholderData) => {
    set({ isSaving: true, error: null })
    try {
      const { stakeholder, error } = await stakeholdersDb.addStakeholder(accountId, stakeholderData)
      if (error) throw error

      set(state => ({
        accounts: state.accounts.map(a => {
          if (a.id !== accountId) return a
          return { ...a, stakeholders: [...(a.stakeholders || []), stakeholder] }
        }),
        accountDetails: state.accountDetails[accountId]
          ? { ...state.accountDetails, [accountId]: { ...state.accountDetails[accountId], stakeholders: [...(state.accountDetails[accountId].stakeholders || []), stakeholder] } }
          : state.accountDetails,
        isSaving: false
      }))
      return { stakeholder }
    } catch (error) {
      set({ error: error.message, isSaving: false })
      return { error }
    }
  },

  updateStakeholder: async (accountId, stakeholderId, updates) => {
    set({ isSaving: true, error: null })
    try {
      const { stakeholder, error } = await stakeholdersDb.updateStakeholder(stakeholderId, updates)
      if (error) throw error

      set(state => ({
        accounts: state.accounts.map(a => {
          if (a.id !== accountId) return a
          return {
            ...a,
            stakeholders: (a.stakeholders || []).map(s =>
              s.id === stakeholderId ? { ...s, ...stakeholder } : s
            )
          }
        }),
        isSaving: false
      }))
      return { stakeholder }
    } catch (error) {
      set({ error: error.message, isSaving: false })
      return { error }
    }
  },

  deleteStakeholder: async (accountId, stakeholderId) => {
    set({ isSaving: true, error: null })
    try {
      const { error } = await stakeholdersDb.deleteStakeholder(stakeholderId)
      if (error) throw error

      set(state => ({
        accounts: state.accounts.map(a => {
          if (a.id !== accountId) return a
          return { ...a, stakeholders: (a.stakeholders || []).filter(s => s.id !== stakeholderId) }
        }),
        accountDetails: state.accountDetails[accountId]
          ? { ...state.accountDetails, [accountId]: { ...state.accountDetails[accountId], stakeholders: (state.accountDetails[accountId].stakeholders || []).filter(s => s.id !== stakeholderId) } }
          : state.accountDetails,
        isSaving: false
      }))
      return { success: true }
    } catch (error) {
      set({ error: error.message, isSaving: false })
      return { error }
    }
  },

  // Information Gap Actions
  addGap: async (accountId, gapData) => {
    set({ isSaving: true, error: null })
    try {
      const { gap, error } = await gapsDb.addGap(accountId, gapData)
      if (error) throw error

      set(state => ({
        accounts: state.accounts.map(a => {
          if (a.id !== accountId) return a
          return { ...a, informationGaps: [...(a.informationGaps || []), gap] }
        }),
        accountDetails: state.accountDetails[accountId]
          ? { ...state.accountDetails, [accountId]: { ...state.accountDetails[accountId], informationGaps: [...(state.accountDetails[accountId].informationGaps || []), gap] } }
          : state.accountDetails,
        isSaving: false
      }))
      return { gap }
    } catch (error) {
      set({ error: error.message, isSaving: false })
      return { error }
    }
  },

  resolveGap: async (accountId, gapId, resolution) => {
    set({ isSaving: true, error: null })
    try {
      const { gap, error } = await gapsDb.resolveGap(gapId, resolution)
      if (error) throw error

      set(state => ({
        accounts: state.accounts.map(a => {
          if (a.id !== accountId) return a
          return { ...a, informationGaps: (a.informationGaps || []).map(g => g.id === gapId ? { ...g, ...gap } : g) }
        }),
        accountDetails: state.accountDetails[accountId]
          ? { ...state.accountDetails, [accountId]: { ...state.accountDetails[accountId], informationGaps: (state.accountDetails[accountId].informationGaps || []).map(g => g.id === gapId ? { ...g, ...gap } : g) } }
          : state.accountDetails,
        isSaving: false
      }))
      return { gap }
    } catch (error) {
      set({ error: error.message, isSaving: false })
      return { error }
    }
  },

  // Note Actions
  addNote: async (accountId, noteData) => {
    set({ isSaving: true, error: null })
    try {
      const { note, error } = await notesDb.addNote(accountId, noteData)
      if (error) throw error

      set(state => ({
        accounts: state.accounts.map(a => {
          if (a.id !== accountId) return a
          return { ...a, notes: [...(a.notes || []), note] }
        }),
        accountDetails: state.accountDetails[accountId]
          ? { ...state.accountDetails, [accountId]: { ...state.accountDetails[accountId], notes: [...(state.accountDetails[accountId].notes || []), note] } }
          : state.accountDetails,
        isSaving: false
      }))
      return { note }
    } catch (error) {
      set({ error: error.message, isSaving: false })
      return { error }
    }
  },

  deleteNote: async (accountId, noteId) => {
    set({ isSaving: true, error: null })
    try {
      const { error } = await notesDb.deleteNote(noteId)
      if (error) throw error

      set(state => ({
        accounts: state.accounts.map(a => {
          if (a.id !== accountId) return a
          return { ...a, notes: (a.notes || []).filter(n => n.id !== noteId) }
        }),
        accountDetails: state.accountDetails[accountId]
          ? { ...state.accountDetails, [accountId]: { ...state.accountDetails[accountId], notes: (state.accountDetails[accountId].notes || []).filter(n => n.id !== noteId) } }
          : state.accountDetails,
        isSaving: false
      }))
      return { success: true }
    } catch (error) {
      set({ error: error.message, isSaving: false })
      return { error }
    }
  },

  // Bulk update for merging analysis results
  updateAccountWithAnalysis: async (accountId, analysisData) => {
    set({ isSaving: true, error: null })
    try {
      // Update the main account fields (businessAreas, meddicc, metrics)
      const accountUpdates = {}
      if (analysisData.businessAreas) accountUpdates.business_areas = analysisData.businessAreas
      if (analysisData.meddicc) accountUpdates.meddicc = analysisData.meddicc
      if (analysisData.metrics) accountUpdates.metrics = analysisData.metrics

      if (Object.keys(accountUpdates).length > 0) {
        const { error } = await accountsDb.updateAccount(accountId, accountUpdates)
        if (error) throw error
      }

      // Add new stakeholders
      const newStakeholders = []
      if (analysisData.stakeholders?.length > 0) {
        for (const s of analysisData.stakeholders) {
          const { stakeholder, error } = await stakeholdersDb.addStakeholder(accountId, s)
          if (!error) newStakeholders.push(stakeholder)
        }
      }

      // Add new gaps
      const newGaps = []
      if (analysisData.informationGaps?.length > 0) {
        for (const g of analysisData.informationGaps) {
          const { gap, error } = await gapsDb.addGap(accountId, g)
          if (!error) newGaps.push(gap)
        }
      }

      // Update local state
      set(state => ({
        accounts: state.accounts.map(a => {
          if (a.id !== accountId) return a
          return {
            ...a,
            ...(analysisData.businessAreas && { businessAreas: analysisData.businessAreas }),
            ...(analysisData.meddicc && { meddicc: analysisData.meddicc }),
            ...(analysisData.metrics && { metrics: analysisData.metrics }),
            stakeholders: [...(a.stakeholders || []), ...newStakeholders],
            informationGaps: [...(a.informationGaps || []), ...newGaps]
          }
        }),
        isSaving: false
      }))

      return { success: true }
    } catch (error) {
      set({ error: error.message, isSaving: false })
      return { error }
    }
  },

  // Reset store
  reset: () => set({
    accounts: [],
    selectedAccountId: null,
    accountDetails: {},
    userId: null,
    isLoading: false,
    isSaving: false,
    error: null,
    lastFetched: null
  }),

  // Clear error
  clearError: () => set({ error: null }),
}))
