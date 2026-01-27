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
 * Merge new insights into existing business areas (cumulative, not overwrite)
 */
export const mergeBusinessAreas = (existing, newData) => {
  const merged = { ...existing };

  Object.keys(newData || {}).forEach(areaId => {
    const newArea = newData[areaId];
    const existingArea = merged[areaId] || { currentState: [], opportunities: [], quotes: [] };

    merged[areaId] = {
      currentState: mergeArrays(existingArea.currentState, newArea?.currentState),
      opportunities: mergeArrays(existingArea.opportunities, newArea?.opportunities),
      quotes: mergeArrays(existingArea.quotes, newArea?.quotes),
      confidence: calculateConfidence(existingArea, newArea),
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
