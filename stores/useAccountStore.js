import { create } from 'zustand'
import * as accountsDb from '../lib/db/accounts'
import * as transcriptsDb from '../lib/db/transcripts'
import * as stakeholdersDb from '../lib/db/stakeholders'
import * as gapsDb from '../lib/db/gaps'
import * as notesDb from '../lib/db/notes'

export const useAccountStore = create((set, get) => ({
  // State
  accounts: [],
  selectedAccountId: null,
  isLoading: false,
  isSaving: false,
  error: null,
  lastFetched: null,

  // Computed
  getSelectedAccount: () => {
    const { accounts, selectedAccountId } = get()
    return accounts.find(a => a.id === selectedAccountId) || null
  },

  // Account Actions
  fetchAccounts: async (userId) => {
    set({ isLoading: true, error: null })
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
      const { account, error } = await accountsDb.updateAccount(accountId, updates)
      if (error) throw error
      set(state => ({
        accounts: state.accounts.map(a => a.id === accountId ? { ...a, ...account } : a),
        isSaving: false
      }))
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
          return {
            ...a,
            transcripts: [...(a.transcripts || []), transcript]
          }
        }),
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
          return {
            ...a,
            transcripts: (a.transcripts || []).filter(t => t.id !== transcriptId)
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

  // Stakeholder Actions
  addStakeholder: async (accountId, stakeholderData) => {
    set({ isSaving: true, error: null })
    try {
      const { stakeholder, error } = await stakeholdersDb.addStakeholder(accountId, stakeholderData)
      if (error) throw error

      set(state => ({
        accounts: state.accounts.map(a => {
          if (a.id !== accountId) return a
          return {
            ...a,
            stakeholders: [...(a.stakeholders || []), stakeholder]
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
          return {
            ...a,
            stakeholders: (a.stakeholders || []).filter(s => s.id !== stakeholderId)
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

  // Information Gap Actions
  addGap: async (accountId, gapData) => {
    set({ isSaving: true, error: null })
    try {
      const { gap, error } = await gapsDb.addGap(accountId, gapData)
      if (error) throw error

      set(state => ({
        accounts: state.accounts.map(a => {
          if (a.id !== accountId) return a
          return {
            ...a,
            informationGaps: [...(a.informationGaps || []), gap]
          }
        }),
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
          return {
            ...a,
            informationGaps: (a.informationGaps || []).map(g =>
              g.id === gapId ? { ...g, ...gap } : g
            )
          }
        }),
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
          return {
            ...a,
            notes: [...(a.notes || []), note]
          }
        }),
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
          return {
            ...a,
            notes: (a.notes || []).filter(n => n.id !== noteId)
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
    isLoading: false,
    isSaving: false,
    error: null,
    lastFetched: null
  }),

  // Clear error
  clearError: () => set({ error: null }),
}))
