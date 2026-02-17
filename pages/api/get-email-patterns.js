/**
 * Get learned email patterns from user edits
 * Returns style preferences to apply to future email generation
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const EMAIL_EDITS_FILE = join(process.cwd(), 'data', 'email_edits.json');

// Load edits
const loadEdits = () => {
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

// Aggregate patterns from recent edits
const aggregatePatterns = (edits) => {
  if (edits.length === 0) {
    return null;
  }

  const recent = edits.slice(-20); // Last 20 edits
  const patterns = {
    subjectChanges: [],
    greetingChanges: [],
    signoffChanges: [],
    lengthPreference: null,
    examples: []
  };

  recent.forEach(edit => {
    edit.patterns?.forEach(pattern => {
      if (pattern.type === 'subject_change') {
        patterns.subjectChanges.push(pattern);
      } else if (pattern.type === 'greeting_change') {
        patterns.greetingChanges.push(pattern);
      } else if (pattern.type === 'signoff_change') {
        patterns.signoffChanges.push(pattern);
      } else if (pattern.type === 'length_change') {
        if (!patterns.lengthPreference) {
          patterns.lengthPreference = [];
        }
        patterns.lengthPreference.push(pattern.direction);
      }
    });

    // Include full examples of successful edits (last 5)
    patterns.examples.push({
      original: edit.original,
      edited: edit.edited,
      callType: edit.callType
    });
  });

  // Keep only last 5 examples
  patterns.examples = patterns.examples.slice(-5);

  // Determine overall length preference
  if (patterns.lengthPreference && patterns.lengthPreference.length > 0) {
    const shorter = patterns.lengthPreference.filter(d => d === 'shorter').length;
    const longer = patterns.lengthPreference.filter(d => d === 'longer').length;
    patterns.lengthPreference = shorter > longer ? 'shorter' : (longer > shorter ? 'longer' : 'no_preference');
  }

  return patterns;
};

// Build style guide from patterns
const buildStyleGuide = (patterns) => {
  if (!patterns) return '';

  let guide = '\n\nUSER STYLE PREFERENCES (learned from previous edits):\n';

  // Subject line preferences
  if (patterns.subjectChanges.length > 0) {
    const recent = patterns.subjectChanges.slice(-3);
    guide += '\nSubject line style:\n';
    recent.forEach(change => {
      guide += `- User changed "${change.from}" to "${change.to}"\n`;
    });
  }

  // Greeting preferences
  if (patterns.greetingChanges.length > 0) {
    const recent = patterns.greetingChanges.slice(-3);
    guide += '\nGreeting style:\n';
    recent.forEach(change => {
      guide += `- User changed "${change.from}" to "${change.to}"\n`;
    });
  }

  // Sign-off preferences
  if (patterns.signoffChanges.length > 0) {
    const recent = patterns.signoffChanges.slice(-3);
    guide += '\nSign-off style:\n';
    recent.forEach(change => {
      guide += `- User changed "${change.from}" to "${change.to}"\n`;
    });
  }

  // Length preference
  if (patterns.lengthPreference && patterns.lengthPreference !== 'no_preference') {
    guide += `\nLength: User prefers ${patterns.lengthPreference} emails\n`;
  }

  // Include examples
  if (patterns.examples.length > 0) {
    guide += '\nSuccessful email examples (user sent these):\n';
    patterns.examples.slice(-2).forEach((ex, i) => {
      guide += `\nExample ${i + 1} (${ex.callType} call):\n${ex.edited}\n`;
    });
  }

  return guide;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const edits = loadEdits();
    const patterns = aggregatePatterns(edits);
    const styleGuide = buildStyleGuide(patterns);

    return res.status(200).json({
      success: true,
      hasPatterns: !!patterns,
      totalEdits: edits.length,
      styleGuide,
      patterns
    });
  } catch (error) {
    console.error('Error getting email patterns:', error);
    return res.status(500).json({
      error: 'Failed to get email patterns'
    });
  }
}
