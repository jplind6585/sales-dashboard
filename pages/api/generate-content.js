/**
 * Generate content from templates and upload to Google Drive
 * Used by email workflow to automatically create attachments
 */

import { google } from 'googleapis';
import { getTemplateById, populateTemplate } from '../../lib/contentTemplates';

// Initialize Google Docs API
const getGoogleDocsClient = () => {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS || '{}');

  const auth = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    ['https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/drive']
  );

  return { docs: google.docs({ version: 'v1', auth }), drive: google.drive({ version: 'v3', auth }), auth };
};

/**
 * Convert markdown-style content to Google Docs format
 * This is a simplified conversion - headers, bold, bullets, etc.
 */
function convertToGoogleDocsRequests(content) {
  const requests = [];
  let currentIndex = 1; // Docs API uses 1-based indexing

  // Split content into lines
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      // Empty line - just add newline
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: '\n'
        }
      });
      currentIndex += 1;
      continue;
    }

    // Detect line type and format accordingly
    if (trimmedLine.startsWith('# ')) {
      // H1 heading
      const text = trimmedLine.substring(2) + '\n';
      const startIndex = currentIndex;
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text
        }
      });
      currentIndex += text.length;

      // Style as heading 1
      requests.push({
        updateParagraphStyle: {
          range: {
            startIndex,
            endIndex: currentIndex - 1
          },
          paragraphStyle: {
            namedStyleType: 'HEADING_1'
          },
          fields: 'namedStyleType'
        }
      });
    } else if (trimmedLine.startsWith('## ')) {
      // H2 heading
      const text = trimmedLine.substring(3) + '\n';
      const startIndex = currentIndex;
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text
        }
      });
      currentIndex += text.length;

      // Style as heading 2
      requests.push({
        updateParagraphStyle: {
          range: {
            startIndex,
            endIndex: currentIndex - 1
          },
          paragraphStyle: {
            namedStyleType: 'HEADING_2'
          },
          fields: 'namedStyleType'
        }
      });
    } else if (trimmedLine.startsWith('### ')) {
      // H3 heading
      const text = trimmedLine.substring(4) + '\n';
      const startIndex = currentIndex;
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text
        }
      });
      currentIndex += text.length;

      // Style as heading 3
      requests.push({
        updateParagraphStyle: {
          range: {
            startIndex,
            endIndex: currentIndex - 1
          },
          paragraphStyle: {
            namedStyleType: 'HEADING_3'
          },
          fields: 'namedStyleType'
        }
      });
    } else if (trimmedLine.startsWith('• ') || trimmedLine.startsWith('- ')) {
      // Bullet point
      const text = '  ' + trimmedLine.substring(2) + '\n';
      const startIndex = currentIndex;
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text
        }
      });
      currentIndex += text.length;

      // Add bullet formatting
      requests.push({
        createParagraphBullets: {
          range: {
            startIndex,
            endIndex: currentIndex - 1
          },
          bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE'
        }
      });
    } else if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
      // Bold text (standalone line)
      const text = trimmedLine.substring(2, trimmedLine.length - 2) + '\n';
      const startIndex = currentIndex;
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text
        }
      });
      currentIndex += text.length;

      // Make bold
      requests.push({
        updateTextStyle: {
          range: {
            startIndex,
            endIndex: currentIndex - 1
          },
          textStyle: {
            bold: true
          },
          fields: 'bold'
        }
      });
    } else {
      // Regular text
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: trimmedLine + '\n'
        }
      });
      currentIndex += trimmedLine.length + 1;
    }
  }

  return requests;
}

/**
 * Create Google Doc from content
 */
async function createGoogleDoc(title, content, folderId) {
  const { docs, drive } = getGoogleDocsClient();

  try {
    // Create blank document
    const createResponse = await docs.documents.create({
      requestBody: {
        title
      }
    });

    const documentId = createResponse.data.documentId;

    // Convert markdown to Google Docs formatting requests
    const requests = convertToGoogleDocsRequests(content);

    // Apply formatting
    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests
        }
      });
    }

    // Move to correct folder if specified
    if (folderId) {
      await drive.files.update({
        fileId: documentId,
        addParents: folderId,
        supportsAllDrives: true,
        fields: 'id, parents'
      });
    }

    // Get shareable link and export as PDF
    const file = await drive.files.get({
      fileId: documentId,
      fields: 'webViewLink,name',
      supportsAllDrives: true
    });

    // Export as PDF
    const pdfResponse = await drive.files.export({
      fileId: documentId,
      mimeType: 'application/pdf'
    }, {
      responseType: 'arraybuffer'
    });

    const pdfBuffer = Buffer.from(pdfResponse.data);
    const pdfBase64 = pdfBuffer.toString('base64');

    return {
      id: documentId,
      name: file.data.name,
      url: file.data.webViewLink,
      pdfData: pdfBase64,
      pdfFilename: `${file.data.name}.pdf`
    };
  } catch (error) {
    console.error('Error creating Google Doc:', error);
    throw error;
  }
}

/**
 * Get or create "Generated Content" folder
 */
async function getGeneratedContentFolder() {
  const { drive } = getGoogleDocsClient();
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  try {
    // Search for "Generated Content" folder
    const searchResponse = await drive.files.list({
      q: `name='Generated Content' and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      return searchResponse.data.files[0].id;
    }

    // Create if doesn't exist
    const createResponse = await drive.files.create({
      requestBody: {
        name: 'Generated Content',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [rootFolderId]
      },
      fields: 'id',
      supportsAllDrives: true
    });

    return createResponse.data.id;
  } catch (error) {
    console.error('Error getting/creating folder:', error);
    return rootFolderId; // Fallback to root
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { templateId, account, customData } = req.body;

  if (!templateId) {
    return res.status(400).json({ error: 'Template ID is required' });
  }

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS) {
    return res.status(500).json({ error: 'Google Drive not configured' });
  }

  try {
    // Get template
    const template = getTemplateById(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Populate template with account data
    const data = {
      account,
      ...customData
    };
    const populatedContent = populateTemplate(template, data);

    // Get folder for generated content
    const folderId = await getGeneratedContentFolder();

    // Create document title with account name and date
    const accountName = account?.name || 'Account';
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const docTitle = `${template.name} - ${accountName} (${dateStr})`;

    // Create Google Doc
    const doc = await createGoogleDoc(docTitle, populatedContent, folderId);

    return res.status(200).json({
      success: true,
      document: {
        id: doc.id,
        name: doc.name,
        url: doc.url,
        templateId: template.id,
        templateName: template.name
      }
    });
  } catch (error) {
    console.error('Error generating content:', error);
    return res.status(500).json({
      error: 'Failed to generate content',
      details: error.message
    });
  }
}
