import { loadFromStorage, removeFromStorage, STORAGE_KEYS } from './storage'
import { getSupabase } from './supabase'
import * as accountsDb from './db/accounts'
import * as transcriptsDb from './db/transcripts'
import * as stakeholdersDb from './db/stakeholders'
import * as gapsDb from './db/gaps'
import * as notesDb from './db/notes'

/**
 * Check if there's localStorage data that needs migration
 * @returns {boolean} True if migration is needed
 */
export function needsMigration() {
  if (typeof window === 'undefined') return false

  const accounts = loadFromStorage(STORAGE_KEYS.ACCOUNTS)
  return accounts && accounts.length > 0
}

/**
 * Get a summary of localStorage data for migration preview
 * @returns {Object} Summary of data to migrate
 */
export function getMigrationSummary() {
  const accounts = loadFromStorage(STORAGE_KEYS.ACCOUNTS) || []

  let totalTranscripts = 0
  let totalStakeholders = 0
  let totalGaps = 0
  let totalNotes = 0

  accounts.forEach(account => {
    totalTranscripts += (account.transcripts || []).length
    totalStakeholders += (account.stakeholders || []).length
    totalGaps += (account.informationGaps || []).length
    totalNotes += (account.notes || []).length
  })

  return {
    accountCount: accounts.length,
    transcriptCount: totalTranscripts,
    stakeholderCount: totalStakeholders,
    gapCount: totalGaps,
    noteCount: totalNotes,
    totalItems: accounts.length + totalTranscripts + totalStakeholders + totalGaps + totalNotes
  }
}

/**
 * Migrate data from localStorage to Supabase
 * @param {string} userId - The authenticated user's ID
 * @param {Function} onProgress - Callback for progress updates
 * @returns {Promise<{success: boolean, error?: string, migrated: Object}>}
 */
export async function migrateToSupabase(userId, onProgress = () => {}) {
  if (!userId) {
    return { success: false, error: 'User ID is required', migrated: {} }
  }

  const localAccounts = loadFromStorage(STORAGE_KEYS.ACCOUNTS) || []

  if (localAccounts.length === 0) {
    return { success: true, migrated: { accounts: 0 } }
  }

  const migrated = {
    accounts: 0,
    transcripts: 0,
    stakeholders: 0,
    gaps: 0,
    notes: 0,
    errors: []
  }

  const totalItems = getMigrationSummary().totalItems
  let processedItems = 0

  try {
    for (const localAccount of localAccounts) {
      // Create account in Supabase
      const { account: newAccount, error: accountError } = await accountsDb.createAccount(userId, {
        name: localAccount.name,
        url: localAccount.url,
        stage: localAccount.stage,
        vertical: localAccount.vertical,
        ownershipType: localAccount.ownershipType,
        businessAreas: localAccount.businessAreas || {},
        meddicc: localAccount.meddicc || {},
        metrics: localAccount.metrics || {}
      })

      if (accountError) {
        migrated.errors.push(`Failed to create account "${localAccount.name}": ${accountError.message}`)
        continue
      }

      migrated.accounts++
      processedItems++
      onProgress({ current: processedItems, total: totalItems, stage: 'accounts', item: localAccount.name })

      // Migrate transcripts
      for (const transcript of (localAccount.transcripts || [])) {
        const { error: transcriptError } = await transcriptsDb.addTranscript(newAccount.id, {
          text: transcript.text,
          date: transcript.date,
          callType: transcript.callType,
          attendees: transcript.attendees,
          summary: transcript.summary,
          rawAnalysis: transcript.rawAnalysis,
          source: transcript.source,
          gongCallId: transcript.gongCallId,
          gongUrl: transcript.gongUrl
        })

        if (transcriptError) {
          migrated.errors.push(`Failed to migrate transcript: ${transcriptError.message}`)
        } else {
          migrated.transcripts++
        }
        processedItems++
        onProgress({ current: processedItems, total: totalItems, stage: 'transcripts' })
      }

      // Migrate stakeholders
      for (const stakeholder of (localAccount.stakeholders || [])) {
        const { error: stakeholderError } = await stakeholdersDb.addStakeholder(newAccount.id, {
          name: stakeholder.name,
          title: stakeholder.title,
          department: stakeholder.department,
          role: stakeholder.role,
          notes: stakeholder.notes
        })

        if (stakeholderError) {
          migrated.errors.push(`Failed to migrate stakeholder "${stakeholder.name}": ${stakeholderError.message}`)
        } else {
          migrated.stakeholders++
        }
        processedItems++
        onProgress({ current: processedItems, total: totalItems, stage: 'stakeholders' })
      }

      // Migrate information gaps
      for (const gap of (localAccount.informationGaps || [])) {
        const { gap: newGap, error: gapError } = await gapsDb.addGap(newAccount.id, {
          question: gap.question,
          category: gap.category,
          meddiccCategory: gap.meddiccCategory,
          status: gap.status || 'open'
        })

        if (gapError) {
          migrated.errors.push(`Failed to migrate gap: ${gapError.message}`)
        } else {
          // If gap was resolved, update it
          if (gap.status === 'resolved' && gap.resolution) {
            await gapsDb.resolveGap(newGap.id, gap.resolution)
          }
          migrated.gaps++
        }
        processedItems++
        onProgress({ current: processedItems, total: totalItems, stage: 'gaps' })
      }

      // Migrate notes
      for (const note of (localAccount.notes || [])) {
        const { error: noteError } = await notesDb.addNote(newAccount.id, {
          category: note.category,
          content: note.content
        })

        if (noteError) {
          migrated.errors.push(`Failed to migrate note: ${noteError.message}`)
        } else {
          migrated.notes++
        }
        processedItems++
        onProgress({ current: processedItems, total: totalItems, stage: 'notes' })
      }
    }

    return { success: true, migrated }
  } catch (error) {
    return { success: false, error: error.message, migrated }
  }
}

/**
 * Clear localStorage after successful migration
 */
export function clearLocalStorage() {
  removeFromStorage(STORAGE_KEYS.ACCOUNTS)
}

/**
 * Mark migration as completed (stores a flag in localStorage)
 */
export function markMigrationComplete() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('supabase_migration_complete', 'true')
  }
}

/**
 * Check if migration has been completed
 * @returns {boolean}
 */
export function isMigrationComplete() {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('supabase_migration_complete') === 'true'
}

/**
 * Skip migration (mark as complete without migrating)
 */
export function skipMigration() {
  markMigrationComplete()
}
