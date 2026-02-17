import { getSupabase } from '../supabase'

/**
 * Get all content templates
 * @param {string} type - Optional filter by type ('1-pager', 'sales-deck', 'integration-guide')
 * @returns {Promise<{templates: Array|null, error: Error|null}>}
 */
export async function getContentTemplates(type = null) {
  const supabase = getSupabase()

  let query = supabase
    .from('content_templates')
    .select('*')
    .eq('is_active', true)
    .order('type', { ascending: true })
    .order('version', { ascending: true })

  if (type) {
    query = query.eq('type', type)
  }

  const { data: templates, error } = await query

  if (error) {
    return { templates: null, error }
  }

  return { templates: templates.map(transformTemplateFromDb), error: null }
}

/**
 * Get all generated content for an account
 * @param {string} accountId
 * @returns {Promise<{content: Array|null, error: Error|null}>}
 */
export async function getGeneratedContentByAccount(accountId) {
  const supabase = getSupabase()

  const { data: content, error } = await supabase
    .from('generated_content')
    .select(`
      *,
      content_templates (*)
    `)
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })

  if (error) {
    return { content: null, error }
  }

  return { content: content.map(transformContentFromDb), error: null }
}

/**
 * Get all generated content for a user
 * @param {string} userId
 * @returns {Promise<{content: Array|null, error: Error|null}>}
 */
export async function getGeneratedContentByUser(userId) {
  const supabase = getSupabase()

  const { data: content, error } = await supabase
    .from('generated_content')
    .select(`
      *,
      content_templates (*),
      accounts (id, name)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    return { content: null, error }
  }

  return { content: content.map(transformContentFromDb), error: null }
}

/**
 * Get a single piece of generated content by ID
 * @param {string} contentId
 * @returns {Promise<{content: Object|null, error: Error|null}>}
 */
export async function getGeneratedContent(contentId) {
  const supabase = getSupabase()

  const { data: content, error } = await supabase
    .from('generated_content')
    .select(`
      *,
      content_templates (*),
      accounts (id, name)
    `)
    .eq('id', contentId)
    .single()

  if (error) {
    return { content: null, error }
  }

  return { content: transformContentFromDb(content), error: null }
}

/**
 * Create a new piece of generated content
 * @param {Object} data - Content data
 * @returns {Promise<{content: Object|null, error: Error|null}>}
 */
export async function createGeneratedContent(data) {
  const supabase = getSupabase()

  const { data: content, error } = await supabase
    .from('generated_content')
    .insert({
      account_id: data.accountId,
      user_id: data.userId,
      template_id: data.templateId,
      content_type: data.contentType,
      template_version: data.templateVersion,
      title: data.title,
      drive_file_id: data.driveFileId || null,
      drive_file_url: data.driveFileUrl || null,
      drive_folder_id: data.driveFolderId || null,
      drive_file_type: data.driveFileType || null,
      data_snapshot: data.dataSnapshot || {},
      generation_metadata: data.generationMetadata || {},
      status: data.status || 'draft',
      export_status: data.exportStatus || null,
    })
    .select(`
      *,
      content_templates (*),
      accounts (id, name)
    `)
    .single()

  if (error) {
    return { content: null, error }
  }

  return { content: transformContentFromDb(content), error: null }
}

/**
 * Update generated content
 * @param {string} contentId
 * @param {Object} updates
 * @returns {Promise<{content: Object|null, error: Error|null}>}
 */
export async function updateGeneratedContent(contentId, updates) {
  const supabase = getSupabase()

  const dbUpdates = transformContentToDb(updates)

  const { data: content, error } = await supabase
    .from('generated_content')
    .update(dbUpdates)
    .eq('id', contentId)
    .select(`
      *,
      content_templates (*),
      accounts (id, name)
    `)
    .single()

  if (error) {
    return { content: null, error }
  }

  return { content: transformContentFromDb(content), error: null }
}

/**
 * Delete generated content
 * @param {string} contentId
 * @returns {Promise<{error: Error|null}>}
 */
export async function deleteGeneratedContent(contentId) {
  const supabase = getSupabase()

  const { error } = await supabase
    .from('generated_content')
    .delete()
    .eq('id', contentId)

  return { error }
}

/**
 * Update last accessed timestamp
 * @param {string} contentId
 * @returns {Promise<{error: Error|null}>}
 */
export async function updateContentAccess(contentId) {
  const supabase = getSupabase()

  const { error } = await supabase
    .from('generated_content')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', contentId)

  return { error }
}

// Transform database row to frontend format
function transformTemplateFromDb(template) {
  if (!template) return null

  return {
    id: template.id,
    name: template.name,
    type: template.type,
    version: template.version,
    description: template.description,
    category: template.category,
    isActive: template.is_active,
    metadata: template.metadata || {},
    createdAt: template.created_at,
    updatedAt: template.updated_at,
  }
}

function transformContentFromDb(content) {
  if (!content) return null

  return {
    id: content.id,
    accountId: content.account_id,
    userId: content.user_id,
    templateId: content.template_id,
    contentType: content.content_type,
    templateVersion: content.template_version,
    title: content.title,
    driveFileId: content.drive_file_id,
    driveFileUrl: content.drive_file_url,
    driveFolderId: content.drive_folder_id,
    driveFileType: content.drive_file_type,
    dataSnapshot: content.data_snapshot || {},
    generationMetadata: content.generation_metadata || {},
    status: content.status,
    exportStatus: content.export_status,
    exportError: content.export_error,
    createdAt: content.created_at,
    updatedAt: content.updated_at,
    exportedAt: content.exported_at,
    lastAccessedAt: content.last_accessed_at,
    // Related data
    template: content.content_templates ? transformTemplateFromDb(content.content_templates) : null,
    account: content.accounts ? {
      id: content.accounts.id,
      name: content.accounts.name,
    } : null,
  }
}

function transformContentToDb(content) {
  const dbContent = {}

  if (content.accountId !== undefined) dbContent.account_id = content.accountId
  if (content.userId !== undefined) dbContent.user_id = content.userId
  if (content.templateId !== undefined) dbContent.template_id = content.templateId
  if (content.contentType !== undefined) dbContent.content_type = content.contentType
  if (content.templateVersion !== undefined) dbContent.template_version = content.templateVersion
  if (content.title !== undefined) dbContent.title = content.title
  if (content.driveFileId !== undefined) dbContent.drive_file_id = content.driveFileId
  if (content.driveFileUrl !== undefined) dbContent.drive_file_url = content.driveFileUrl
  if (content.driveFolderId !== undefined) dbContent.drive_folder_id = content.driveFolderId
  if (content.driveFileType !== undefined) dbContent.drive_file_type = content.driveFileType
  if (content.dataSnapshot !== undefined) dbContent.data_snapshot = content.dataSnapshot
  if (content.generationMetadata !== undefined) dbContent.generation_metadata = content.generationMetadata
  if (content.status !== undefined) dbContent.status = content.status
  if (content.exportStatus !== undefined) dbContent.export_status = content.exportStatus
  if (content.exportError !== undefined) dbContent.export_error = content.exportError
  if (content.exportedAt !== undefined) dbContent.exported_at = content.exportedAt
  if (content.lastAccessedAt !== undefined) dbContent.last_accessed_at = content.lastAccessedAt

  return dbContent
}

/**
 * Save or update a company logo
 * @param {Object} data - Logo data
 * @returns {Promise<{logo: Object|null, error: Error|null}>}
 */
export async function saveCompanyLogo(data) {
  const supabase = getSupabase()

  // Try to update existing logo first
  const { data: existing } = await supabase
    .from('company_logos')
    .select('id')
    .eq('account_id', data.accountId)
    .eq('logo_type', data.logoType)
    .single()

  if (existing) {
    // Update existing
    const { data: logo, error } = await supabase
      .from('company_logos')
      .update({
        drive_file_id: data.driveFileId,
        drive_file_url: data.driveFileUrl,
        drive_direct_url: data.driveDirectUrl,
        file_name: data.fileName,
        mime_type: data.mimeType,
        file_size: data.fileSize,
        uploaded_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) {
      return { logo: null, error }
    }

    return { logo: transformLogoFromDb(logo), error: null }
  }

  // Create new
  const { data: logo, error } = await supabase
    .from('company_logos')
    .insert({
      account_id: data.accountId,
      company_name: data.companyName,
      logo_type: data.logoType,
      drive_file_id: data.driveFileId,
      drive_file_url: data.driveFileUrl,
      drive_direct_url: data.driveDirectUrl,
      file_name: data.fileName,
      mime_type: data.mimeType,
      file_size: data.fileSize,
    })
    .select()
    .single()

  if (error) {
    return { logo: null, error }
  }

  return { logo: transformLogoFromDb(logo), error: null }
}

/**
 * Get all logos for an account
 * @param {string} accountId
 * @returns {Promise<{logos: Array|null, error: Error|null}>}
 */
export async function getCompanyLogos(accountId) {
  const supabase = getSupabase()

  const { data: logos, error } = await supabase
    .from('company_logos')
    .select('*')
    .eq('account_id', accountId)
    .order('logo_type', { ascending: true })

  if (error) {
    return { logos: null, error }
  }

  return { logos: logos.map(transformLogoFromDb), error: null }
}

/**
 * Update last used timestamp for a logo
 * @param {string} logoId
 * @returns {Promise<{error: Error|null}>}
 */
export async function updateLogoUsage(logoId) {
  const supabase = getSupabase()

  const { error } = await supabase
    .from('company_logos')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', logoId)

  return { error }
}

/**
 * Create an archived content record
 * @param {Object} data - Archive data
 * @returns {Promise<{archived: Object|null, error: Error|null}>}
 */
export async function createArchivedContent(data) {
  const supabase = getSupabase()

  // Calculate scheduled deletion date (12 months from now)
  const scheduledDeletion = new Date()
  scheduledDeletion.setMonth(scheduledDeletion.getMonth() + 12)

  const { data: archived, error } = await supabase
    .from('archived_content')
    .insert({
      original_content_id: data.originalContentId,
      account_id: data.accountId,
      content_type: data.contentType,
      title: data.title,
      archived_reason: data.archivedReason,
      archived_from_folder: data.archivedFromFolder,
      archive_year_month: data.archiveYearMonth,
      drive_file_id: data.driveFileId,
      drive_file_url: data.driveFileUrl,
      archive_folder_id: data.archiveFolderId,
      original_created_at: data.originalCreatedAt,
      scheduled_deletion_at: scheduledDeletion.toISOString(),
    })
    .select()
    .single()

  if (error) {
    return { archived: null, error }
  }

  return { archived: transformArchivedFromDb(archived), error: null }
}

/**
 * Get archived content due for deletion
 * @returns {Promise<{archived: Array|null, error: Error|null}>}
 */
export async function getArchivedForDeletion() {
  const supabase = getSupabase()

  const now = new Date().toISOString()

  const { data: archived, error } = await supabase
    .from('archived_content')
    .select('*')
    .lt('scheduled_deletion_at', now)
    .order('scheduled_deletion_at', { ascending: true })

  if (error) {
    return { archived: null, error }
  }

  return { archived: archived.map(transformArchivedFromDb), error: null }
}

/**
 * Delete archived content record
 * @param {string} archivedId
 * @returns {Promise<{error: Error|null}>}
 */
export async function deleteArchivedContent(archivedId) {
  const supabase = getSupabase()

  const { error } = await supabase
    .from('archived_content')
    .delete()
    .eq('id', archivedId)

  return { error }
}

// Transform functions for new tables
function transformLogoFromDb(logo) {
  if (!logo) return null

  return {
    id: logo.id,
    accountId: logo.account_id,
    companyName: logo.company_name,
    logoType: logo.logo_type,
    driveFileId: logo.drive_file_id,
    driveFileUrl: logo.drive_file_url,
    driveDirectUrl: logo.drive_direct_url,
    fileName: logo.file_name,
    mimeType: logo.mime_type,
    fileSize: logo.file_size,
    uploadedAt: logo.uploaded_at,
    lastUsedAt: logo.last_used_at,
    createdAt: logo.created_at,
    updatedAt: logo.updated_at,
  }
}

function transformArchivedFromDb(archived) {
  if (!archived) return null

  return {
    id: archived.id,
    originalContentId: archived.original_content_id,
    accountId: archived.account_id,
    contentType: archived.content_type,
    title: archived.title,
    archivedReason: archived.archived_reason,
    archivedFromFolder: archived.archived_from_folder,
    archiveYearMonth: archived.archive_year_month,
    driveFileId: archived.drive_file_id,
    driveFileUrl: archived.drive_file_url,
    archiveFolderId: archived.archive_folder_id,
    lastAccessedAt: archived.last_accessed_at,
    scheduledDeletionAt: archived.scheduled_deletion_at,
    originalCreatedAt: archived.original_created_at,
    archivedAt: archived.archived_at,
    createdAt: archived.created_at,
  }
}
