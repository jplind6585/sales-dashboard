/**
 * Utility functions for merging account data
 * Extracted for testability
 */

import { generateId } from './storage';

/**
 * Safely convert a value to lowercase string
 */
export const safeToLowerCase = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).toLowerCase();
};

/**
 * Merge arrays while avoiding duplicates (case-insensitive string comparison)
 */
export const mergeArrays = (arr1 = [], arr2 = []) => {
  const combined = [...arr1];
  arr2.forEach(item => {
    const itemStr = safeToLowerCase(item);
    if (itemStr && !combined.some(existing => safeToLowerCase(existing) === itemStr)) {
      combined.push(item);
    }
  });
  return combined;
};

/**
 * Calculate confidence level based on amount of data
 */
export const calculateConfidence = (existing, newArea) => {
  const totalItems =
    (existing?.currentState?.length || 0) + (newArea?.currentState?.length || 0) +
    (existing?.opportunities?.length || 0) + (newArea?.opportunities?.length || 0);

  if (totalItems === 0) return 'none';
  if (totalItems <= 2) return 'low';
  if (totalItems <= 5) return 'medium';
  return 'high';
};

/**
 * Merge bullet points with source tracking
 * Handles both old format (strings) and new format (objects with sourceCalls)
 */
const mergeBullets = (existingBullets = [], newBullets = [], transcriptId) => {
  const merged = [...existingBullets];
  const currentDate = new Date().toISOString();

  newBullets.forEach(newBullet => {
    // Handle both string format (from Claude analysis) and object format (from storage)
    const bulletText = typeof newBullet === 'string' ? newBullet : newBullet?.bullet || newBullet;
    if (!bulletText) return;

    const bulletTextLower = safeToLowerCase(bulletText);
    const existingIndex = merged.findIndex(existing => {
      const existingText = typeof existing === 'string' ? existing : existing?.bullet || '';
      return safeToLowerCase(existingText) === bulletTextLower;
    });

    if (existingIndex >= 0) {
      // Bullet already exists - add this transcript as a source
      const existingBullet = merged[existingIndex];

      // Convert old string format to new object format if needed
      if (typeof existingBullet === 'string') {
        merged[existingIndex] = {
          bullet: existingBullet,
          sourceCalls: transcriptId ? [transcriptId] : [],
          addedDate: currentDate
        };
      } else if (transcriptId && !existingBullet.sourceCalls?.includes(transcriptId)) {
        // Add new source call if not already present
        merged[existingIndex] = {
          ...existingBullet,
          sourceCalls: [...(existingBullet.sourceCalls || []), transcriptId]
        };
      }
    } else {
      // New bullet - add it with source tracking
      merged.push({
        bullet: bulletText,
        sourceCalls: transcriptId ? [transcriptId] : [],
        addedDate: currentDate
      });
    }
  });

  return merged;
};

/**
 * Merge new insights into existing business areas with progressive refinement
 * Tracks source calls, detects conflicts, and preserves priority from analysis
 */
export const mergeBusinessAreas = (existing, newData, transcriptId = null) => {
  const merged = { ...existing };

  Object.keys(newData || {}).forEach(areaId => {
    const newArea = newData[areaId];
    const existingArea = merged[areaId] || {
      currentState: [],
      opportunities: [],
      quotes: [],
      priority: null,
      irrelevant: false,
      irrelevantReason: null,
      conflicts: []
    };

    // Merge bullets with source tracking
    const mergedCurrentState = mergeBullets(
      existingArea.currentState,
      newArea?.currentState,
      transcriptId
    );
    const mergedOpportunities = mergeBullets(
      existingArea.opportunities,
      newArea?.opportunities,
      transcriptId
    );

    // Determine priority - prefer explicit new priority, then existing, then null
    let finalPriority = existingArea.priority;
    if (newArea?.priority !== undefined && newArea?.priority !== null) {
      // New call has a priority determination
      if (existingArea.priority && existingArea.priority !== newArea.priority) {
        // Conflict detected - different priorities assigned
        // Take the higher priority (high > medium > low)
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const existingLevel = priorityOrder[existingArea.priority] || 0;
        const newLevel = priorityOrder[newArea.priority] || 0;
        finalPriority = newLevel > existingLevel ? newArea.priority : existingArea.priority;
      } else {
        finalPriority = newArea.priority;
      }
    }

    merged[areaId] = {
      currentState: mergedCurrentState,
      opportunities: mergedOpportunities,
      quotes: mergeArrays(existingArea.quotes, newArea?.quotes), // Keep quotes as simple strings
      confidence: calculateConfidence(existingArea, newArea),
      priority: finalPriority,
      irrelevant: existingArea.irrelevant || false, // Preserve irrelevant flag
      irrelevantReason: existingArea.irrelevantReason || null,
      conflicts: existingArea.conflicts || [], // Preserve conflicts
      lastUpdated: new Date().toISOString(),
    };
  });

  return merged;
};

/**
 * Merge stakeholders, updating existing or adding new
 */
export const mergeStakeholders = (existing = [], newStakeholders = [], idGenerator = generateId) => {
  const merged = [...(existing || [])];

  (newStakeholders || []).forEach(newPerson => {
    if (!newPerson?.name) return; // Skip if no name

    const existingIndex = merged.findIndex(
      p => p?.name && safeToLowerCase(p.name) === safeToLowerCase(newPerson.name)
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
        id: idGenerator(),
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
export const mergeMetrics = (existing = {}, newMetrics = {}, newContext = {}) => {
  const merged = { ...existing };

  Object.keys(newMetrics || {}).forEach(key => {
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
export const mergeGaps = (existing = [], newGaps = [], idGenerator = generateId) => {
  const merged = [...(existing || [])];

  (newGaps || []).forEach(gap => {
    // Handle both string format (old) and object format (new)
    const question = typeof gap === 'string' ? gap : gap?.question;
    const category = typeof gap === 'string' ? 'business' : (gap?.category || 'business');

    if (!question) return; // Skip if no question

    const questionLower = safeToLowerCase(question);
    if (!merged.some(g => g.question && safeToLowerCase(g.question) === questionLower)) {
      merged.push({
        id: idGenerator(),
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
 * Safely check if a topic matches a keyword (handles objects and strings)
 */
export const topicMatches = (topics, keyword) => {
  if (!Array.isArray(topics)) return false;
  return topics.some(t => {
    const topicStr = typeof t === 'string' ? t : (t?.name || t?.label || '');
    return safeToLowerCase(topicStr).includes(keyword);
  });
};
