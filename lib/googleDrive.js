import { google } from 'googleapis'

/**
 * Initialize Google Drive API client with service account
 * Uses server-side service account for automated content generation
 */
function getGoogleDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive',
    ],
  })

  return google.drive({ version: 'v3', auth })
}

/**
 * Get Google Docs API client
 */
function getGoogleDocsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive',
    ],
  })

  return google.docs({ version: 'v1', auth })
}

/**
 * Get Google Slides API client
 */
function getGoogleSlidesClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: [
      'https://www.googleapis.com/auth/presentations',
      'https://www.googleapis.com/auth/drive',
    ],
  })

  return google.slides({ version: 'v1', auth })
}

/**
 * Create folder structure in Google Drive if it doesn't exist
 * Creates: Banner Sales Dashboard Content/[Templates, Generated Content, Archive, Company Logos]
 */
export async function ensureFolderStructure() {
  const drive = getGoogleDriveClient()
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID

  try {
    // Helper function to get or create a folder
    const getOrCreateFolder = async (folderName, parentId) => {
      const search = await drive.files.list({
        q: `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      })

      if (search.data.files.length > 0) {
        return search.data.files[0].id
      }

      const folder = await drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId],
        },
        fields: 'id',
        supportsAllDrives: true,
      })

      return folder.data.id
    }

    // Create main folders
    const templatesFolderId = await getOrCreateFolder('Templates', rootFolderId)
    const generatedFolderId = await getOrCreateFolder('Generated Content', rootFolderId)
    const archiveFolderId = await getOrCreateFolder('Archive', rootFolderId)
    const logosFolderId = await getOrCreateFolder('Company Logos', rootFolderId)

    return {
      success: true,
      rootFolderId,
      templatesFolderId,
      generatedFolderId,
      archiveFolderId,
      logosFolderId,
    }
  } catch (error) {
    console.error('Error ensuring folder structure:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Get or create a client-specific folder
 * @param {string} clientName - Name of the client
 * @returns {Promise<{folderId: string, success: boolean, error?: string}>}
 */
export async function getOrCreateClientFolder(clientName) {
  const drive = getGoogleDriveClient()

  try {
    const structure = await ensureFolderStructure()
    if (!structure.success) {
      return { success: false, error: structure.error }
    }

    const generatedFolderId = structure.generatedFolderId

    // Check if client folder already exists
    const folderSearch = await drive.files.list({
      q: `name='${clientName}' and '${generatedFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    if (folderSearch.data.files.length > 0) {
      return {
        success: true,
        folderId: folderSearch.data.files[0].id,
      }
    }

    // Create client folder
    const clientFolder = await drive.files.create({
      requestBody: {
        name: clientName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [generatedFolderId],
      },
      fields: 'id',
      supportsAllDrives: true,
    })

    return {
      success: true,
      folderId: clientFolder.data.id,
    }
  } catch (error) {
    console.error('Error getting/creating client folder:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Create a Google Doc from template content
 * @param {string} title - Document title
 * @param {string} content - Document content (HTML or plain text)
 * @param {string} folderId - Folder to save in
 * @returns {Promise<{fileId: string, fileUrl: string, success: boolean, error?: string}>}
 */
export async function createGoogleDoc(title, content, folderId) {
  const drive = getGoogleDriveClient()
  const docs = getGoogleDocsClient()

  try {
    // Create empty doc
    const doc = await docs.documents.create({
      requestBody: {
        title,
      },
    })

    const documentId = doc.data.documentId

    // Move to folder and make editable
    await drive.files.update({
      fileId: documentId,
      addParents: folderId,
      removeParents: 'root',
      supportsAllDrives: true,
      requestBody: {
        // Make it editable by anyone with the link (or adjust as needed)
      },
    })

    // Insert content
    if (content) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: {
                  index: 1,
                },
                text: content,
              },
            },
          ],
        },
      })
    }

    const fileUrl = `https://docs.google.com/document/d/${documentId}/edit`

    return {
      success: true,
      fileId: documentId,
      fileUrl,
    }
  } catch (error) {
    console.error('Error creating Google Doc:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Create a Google Slides presentation from template
 * @param {string} title - Presentation title
 * @param {Array} slides - Array of slide content objects
 * @param {string} folderId - Folder to save in
 * @returns {Promise<{fileId: string, fileUrl: string, success: boolean, error?: string}>}
 */
export async function createGoogleSlides(title, slides, folderId) {
  const drive = getGoogleDriveClient()
  const slidesApi = getGoogleSlidesClient()

  try {
    // Create empty presentation
    const presentation = await slidesApi.presentations.create({
      requestBody: {
        title,
      },
    })

    const presentationId = presentation.data.presentationId

    // Move to folder
    await drive.files.update({
      fileId: presentationId,
      addParents: folderId,
      removeParents: 'root',
      supportsAllDrives: true,
    })

    // TODO: Add slide content based on template
    // This will be implemented when we build the template engine

    const fileUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`

    return {
      success: true,
      fileId: presentationId,
      fileUrl,
    }
  } catch (error) {
    console.error('Error creating Google Slides:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Share a file with specific users
 * @param {string} fileId - Google Drive file ID
 * @param {Array<string>} emails - Email addresses to share with
 * @param {string} role - 'reader', 'writer', or 'commenter'
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function shareFile(fileId, emails, role = 'writer') {
  const drive = getGoogleDriveClient()

  try {
    for (const email of emails) {
      await drive.permissions.create({
        fileId,
        requestBody: {
          type: 'user',
          role,
          emailAddress: email,
        },
        sendNotificationEmail: false,
        supportsAllDrives: true,
      })
    }

    return { success: true }
  } catch (error) {
    console.error('Error sharing file:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Make a file publicly accessible (anyone with link can view/edit)
 * @param {string} fileId - Google Drive file ID
 * @param {string} role - 'reader' or 'writer'
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function makeFilePublic(fileId, role = 'writer') {
  const drive = getGoogleDriveClient()

  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        type: 'anyone',
        role,
      },
      supportsAllDrives: true,
    })

    return { success: true }
  } catch (error) {
    console.error('Error making file public:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Test Google Drive connection
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function testDriveConnection() {
  try {
    const drive = getGoogleDriveClient()

    // Try to get info about the root folder
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID
    const response = await drive.files.get({
      fileId: rootFolderId,
      fields: 'id, name, mimeType',
      supportsAllDrives: true, // Required for Shared Drives
    })

    return {
      success: true,
      folder: response.data,
    }
  } catch (error) {
    console.error('Error testing Drive connection:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Archive a file by moving it to the Archive folder
 * Organizes by year-month (e.g., Archive/2026-02/)
 * @param {string} fileId - Google Drive file ID to archive
 * @param {string} fileName - Original file name
 * @returns {Promise<{success: boolean, archiveFolderId?: string, error?: string}>}
 */
export async function archiveFile(fileId, fileName) {
  const drive = getGoogleDriveClient()

  try {
    const structure = await ensureFolderStructure()
    if (!structure.success) {
      return { success: false, error: structure.error }
    }

    const archiveFolderId = structure.archiveFolderId

    // Create year-month subfolder (e.g., "2026-02")
    const now = new Date()
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const monthSearch = await drive.files.list({
      q: `name='${yearMonth}' and '${archiveFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    let monthFolderId
    if (monthSearch.data.files.length > 0) {
      monthFolderId = monthSearch.data.files[0].id
    } else {
      const monthFolder = await drive.files.create({
        requestBody: {
          name: yearMonth,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [archiveFolderId],
        },
        fields: 'id',
        supportsAllDrives: true,
      })
      monthFolderId = monthFolder.data.id
    }

    // Get current file metadata to find current parent
    const file = await drive.files.get({
      fileId,
      fields: 'parents',
      supportsAllDrives: true,
    })

    const previousParents = file.data.parents ? file.data.parents.join(',') : ''

    // Move file to archive folder with archived timestamp in name
    const archivedName = `${fileName} (archived ${now.toISOString().split('T')[0]})`

    await drive.files.update({
      fileId,
      addParents: monthFolderId,
      removeParents: previousParents,
      requestBody: {
        name: archivedName,
      },
      supportsAllDrives: true,
    })

    return {
      success: true,
      archiveFolderId: monthFolderId,
    }
  } catch (error) {
    console.error('Error archiving file:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Get or create a client-specific logo folder
 * @param {string} clientName - Name of the client
 * @returns {Promise<{success: boolean, folderId?: string, error?: string}>}
 */
export async function getOrCreateLogoFolder(clientName) {
  const drive = getGoogleDriveClient()

  try {
    const structure = await ensureFolderStructure()
    if (!structure.success) {
      return { success: false, error: structure.error }
    }

    const logosFolderId = structure.logosFolderId

    // Check if client logo folder exists
    const folderSearch = await drive.files.list({
      q: `name='${clientName}' and '${logosFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    if (folderSearch.data.files.length > 0) {
      return {
        success: true,
        folderId: folderSearch.data.files[0].id,
      }
    }

    // Create client logo folder
    const clientFolder = await drive.files.create({
      requestBody: {
        name: clientName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [logosFolderId],
      },
      fields: 'id',
      supportsAllDrives: true,
    })

    return {
      success: true,
      folderId: clientFolder.data.id,
    }
  } catch (error) {
    console.error('Error getting/creating logo folder:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Upload a logo file
 * @param {string} clientName - Name of the client
 * @param {string} logoType - Type of logo ('full-logo', 'icon', 'stacked', 'single-color', 'full-color')
 * @param {Buffer} fileBuffer - File data
 * @param {string} mimeType - File MIME type
 * @param {string} fileName - Original file name
 * @returns {Promise<{success: boolean, fileId?: string, fileUrl?: string, error?: string}>}
 */
export async function uploadLogo(clientName, logoType, fileBuffer, mimeType, fileName) {
  const drive = getGoogleDriveClient()

  try {
    const logoFolder = await getOrCreateLogoFolder(clientName)
    if (!logoFolder.success) {
      return { success: false, error: logoFolder.error }
    }

    // Delete existing logo of this type if it exists
    const existingSearch = await drive.files.list({
      q: `name contains '${logoType}' and '${logoFolder.folderId}' in parents and trashed=false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    for (const file of existingSearch.data.files || []) {
      await drive.files.delete({
        fileId: file.id,
        supportsAllDrives: true,
      })
    }

    // Get file extension
    const ext = fileName.split('.').pop()
    const newFileName = `${logoType}.${ext}`

    // Upload new logo
    const response = await drive.files.create({
      requestBody: {
        name: newFileName,
        parents: [logoFolder.folderId],
      },
      media: {
        mimeType,
        body: fileBuffer,
      },
      fields: 'id, name, webViewLink, webContentLink',
      supportsAllDrives: true,
    })

    // Make the file publicly accessible (anyone with link can view)
    await makeFilePublic(response.data.id, 'reader')

    return {
      success: true,
      fileId: response.data.id,
      fileUrl: response.data.webViewLink,
      directUrl: response.data.webContentLink,
    }
  } catch (error) {
    console.error('Error uploading logo:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Get all logos for a client
 * @param {string} clientName - Name of the client
 * @returns {Promise<{success: boolean, logos?: Object, error?: string}>}
 */
export async function getClientLogos(clientName) {
  const drive = getGoogleDriveClient()

  try {
    const logoFolder = await getOrCreateLogoFolder(clientName)
    if (!logoFolder.success) {
      return { success: false, error: logoFolder.error }
    }

    const filesSearch = await drive.files.list({
      q: `'${logoFolder.folderId}' in parents and trashed=false`,
      fields: 'files(id, name, webViewLink, webContentLink, mimeType)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    const logos = {}
    for (const file of filesSearch.data.files || []) {
      const logoType = file.name.split('.')[0] // e.g., 'full-logo', 'icon', etc.
      logos[logoType] = {
        fileId: file.id,
        fileName: file.name,
        viewUrl: file.webViewLink,
        directUrl: file.webContentLink,
        mimeType: file.mimeType,
      }
    }

    return {
      success: true,
      logos,
    }
  } catch (error) {
    console.error('Error getting client logos:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Clean up old archived files (delete files older than specified months with no recent access)
 * @param {number} monthsOld - Delete archived files older than this many months (default: 12)
 * @returns {Promise<{success: boolean, deletedCount?: number, error?: string}>}
 */
export async function cleanupOldArchives(monthsOld = 12) {
  const drive = getGoogleDriveClient()

  try {
    const structure = await ensureFolderStructure()
    if (!structure.success) {
      return { success: false, error: structure.error }
    }

    const archiveFolderId = structure.archiveFolderId
    const cutoffDate = new Date()
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsOld)

    // Get all files in archive older than cutoff date
    const filesSearch = await drive.files.list({
      q: `'${archiveFolderId}' in parents and modifiedTime < '${cutoffDate.toISOString()}' and trashed=false`,
      fields: 'files(id, name, modifiedTime, viewedByMeTime)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    let deletedCount = 0
    for (const file of filesSearch.data.files || []) {
      // Check if file was accessed recently
      const lastViewed = file.viewedByMeTime ? new Date(file.viewedByMeTime) : new Date(file.modifiedTime)

      if (lastViewed < cutoffDate) {
        await drive.files.delete({
          fileId: file.id,
          supportsAllDrives: true,
        })
        deletedCount++
      }
    }

    return {
      success: true,
      deletedCount,
    }
  } catch (error) {
    console.error('Error cleaning up archives:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}
