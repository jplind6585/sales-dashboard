/**
 * Save email edits to learn from user preferences
 * Stores original vs edited versions to improve future email generation
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const EMAIL_EDITS_FILE = join(process.cwd(), 'data', 'email_edits.json');

// Ensure data directory exists
const ensureDataDir = () => {
  const dataDir = join(process.cwd(), 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
};

// Load existing edits
const loadEdits = () => {
  ensureDataDir();
  if (!existsSync(EMAIL_EDITS_FILE)) {
    return [];
  }
  try {
    const data = readFileSync(EMAIL_EDITS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading email edits:', err);
    return [];
  }
};

// Save edits
const saveEdits = (edits) => {
  ensureDataDir();
  try {
    writeFileSync(EMAIL_EDITS_FILE, JSON.stringify(edits, null, 2));
  } catch (err) {
    console.error('Error saving email edits:', err);
  }
};

// Analyze differences between original and edited versions
const analyzeDiff = (original, edited) => {
  const patterns = [];

  // Subject line changes
  const origSubject = original.match(/Subject:\s*(.+?)(\n|$)/)?.[1] || '';
  const editSubject = edited.match(/Subject:\s*(.+?)(\n|$)/)?.[1] || '';
  if (origSubject !== editSubject) {
    patterns.push({
      type: 'subject_change',
      from: origSubject,
      to: editSubject
    });
  }

  // Greeting changes
  const origGreeting = original.match(/^(Hi .+?,)/m)?.[1] || '';
  const editGreeting = edited.match(/^(Hi .+?,)/m)?.[1] || '';
  if (origGreeting !== editGreeting) {
    patterns.push({
      type: 'greeting_change',
      from: origGreeting,
      to: editGreeting
    });
  }

  // Sign-off changes
  const origSignoff = original.match(/(Best regards,|Sincerely,|Thanks,|Cheers,)?\s*James\s*$/)?.[0] || 'James';
  const editSignoff = edited.match(/(Best regards,|Sincerely,|Thanks,|Cheers,)?\s*James\s*$/)?.[0] || 'James';
  if (origSignoff !== editSignoff) {
    patterns.push({
      type: 'signoff_change',
      from: origSignoff,
      to: editSignoff
    });
  }

  // Overall tone/length change
  const origLength = original.length;
  const editLength = edited.length;
  const lengthDiff = ((editLength - origLength) / origLength) * 100;

  if (Math.abs(lengthDiff) > 20) {
    patterns.push({
      type: 'length_change',
      percentChange: Math.round(lengthDiff),
      direction: lengthDiff > 0 ? 'longer' : 'shorter'
    });
  }

  return patterns;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { original, edited, transcriptId, accountId, accountName, callType, timestamp } = req.body;

  if (!original || !edited) {
    return res.status(400).json({ error: 'Original and edited content required' });
  }

  try {
    const edits = loadEdits();

    // Analyze the differences
    const patterns = analyzeDiff(original, edited);

    // Create edit record
    const editRecord = {
      id: `edit_${Date.now()}`,
      transcriptId,
      accountId,
      accountName,
      callType,
      timestamp,
      original,
      edited,
      patterns,
      characterCount: {
        original: original.length,
        edited: edited.length,
        diff: edited.length - original.length
      }
    };

    // Add to edits (keep last 100)
    edits.push(editRecord);
    if (edits.length > 100) {
      edits.shift(); // Remove oldest
    }

    saveEdits(edits);

    return res.status(200).json({
      success: true,
      message: 'Email edit saved for learning',
      patternsDetected: patterns.length
    });
  } catch (error) {
    console.error('Error saving email edit:', error);
    return res.status(500).json({
      error: 'Failed to save email edit'
    });
  }
}
