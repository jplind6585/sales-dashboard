import { testDriveConnection, ensureFolderStructure } from '../../lib/googleDrive'

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Test basic connection
    const connectionTest = await testDriveConnection()

    if (!connectionTest.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to connect to Google Drive',
        details: connectionTest.error,
      })
    }

    // Test folder structure creation
    const folderTest = await ensureFolderStructure()

    if (!folderTest.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create folder structure',
        details: folderTest.error,
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Google Drive connection successful',
      rootFolder: connectionTest.folder,
      folders: {
        root: folderTest.rootFolderId,
        templates: folderTest.templatesFolderId,
        generatedContent: folderTest.generatedFolderId,
        archive: folderTest.archiveFolderId,
        companyLogos: folderTest.logosFolderId,
      },
    })
  } catch (error) {
    console.error('Error testing Drive connection:', error)
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    })
  }
}
