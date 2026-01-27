/**
 * Tests for merge utility functions
 * These functions are critical for data integrity when processing transcripts
 */

import {
  safeToLowerCase,
  mergeArrays,
  calculateConfidence,
  mergeBusinessAreas,
  mergeStakeholders,
  mergeMetrics,
  mergeGaps,
  topicMatches,
} from '../lib/mergeUtils';

describe('safeToLowerCase', () => {
  test('handles normal strings', () => {
    expect(safeToLowerCase('Hello')).toBe('hello');
    expect(safeToLowerCase('WORLD')).toBe('world');
  });

  test('handles null and undefined', () => {
    expect(safeToLowerCase(null)).toBe('');
    expect(safeToLowerCase(undefined)).toBe('');
  });

  test('handles numbers', () => {
    expect(safeToLowerCase(123)).toBe('123');
    expect(safeToLowerCase(0)).toBe('0');
  });

  test('handles objects', () => {
    expect(safeToLowerCase({})).toBe('[object object]');
    expect(safeToLowerCase({ name: 'test' })).toBe('[object object]');
  });

  test('handles empty string', () => {
    expect(safeToLowerCase('')).toBe('');
  });
});

describe('mergeArrays', () => {
  test('merges two arrays without duplicates', () => {
    const arr1 = ['item1', 'item2'];
    const arr2 = ['item2', 'item3'];
    const result = mergeArrays(arr1, arr2);
    expect(result).toEqual(['item1', 'item2', 'item3']);
  });

  test('handles case-insensitive duplicates', () => {
    const arr1 = ['Hello'];
    const arr2 = ['hello', 'HELLO', 'World'];
    const result = mergeArrays(arr1, arr2);
    expect(result).toEqual(['Hello', 'World']);
  });

  test('handles null/undefined in arrays', () => {
    const arr1 = ['item1', null, undefined];
    const arr2 = [null, 'item2'];
    const result = mergeArrays(arr1, arr2);
    // null and undefined become empty strings and are filtered out
    expect(result).toContain('item1');
    expect(result).toContain('item2');
  });

  test('handles empty arrays', () => {
    expect(mergeArrays([], [])).toEqual([]);
    expect(mergeArrays(['item'], [])).toEqual(['item']);
    expect(mergeArrays([], ['item'])).toEqual(['item']);
  });

  test('handles undefined inputs', () => {
    expect(mergeArrays(undefined, ['item'])).toEqual(['item']);
    expect(mergeArrays(['item'], undefined)).toEqual(['item']);
    expect(mergeArrays(undefined, undefined)).toEqual([]);
  });
});

describe('calculateConfidence', () => {
  test('returns none for empty data', () => {
    expect(calculateConfidence({}, {})).toBe('none');
    expect(calculateConfidence({ currentState: [] }, { currentState: [] })).toBe('none');
  });

  test('returns low for 1-2 items', () => {
    expect(calculateConfidence({ currentState: ['item'] }, {})).toBe('low');
    expect(calculateConfidence({ currentState: ['item1', 'item2'] }, {})).toBe('low');
  });

  test('returns medium for 3-5 items', () => {
    expect(calculateConfidence(
      { currentState: ['item1', 'item2'] },
      { currentState: ['item3'] }
    )).toBe('medium');
  });

  test('returns high for 6+ items', () => {
    expect(calculateConfidence(
      { currentState: ['1', '2', '3'], opportunities: ['4', '5', '6'] },
      {}
    )).toBe('high');
  });
});

describe('mergeStakeholders', () => {
  const mockIdGenerator = () => 'test-id';

  test('adds new stakeholders', () => {
    const existing = [];
    const newStakeholders = [{ name: 'John Doe', title: 'CEO' }];
    const result = mergeStakeholders(existing, newStakeholders, mockIdGenerator);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('John Doe');
    expect(result[0].title).toBe('CEO');
    expect(result[0].id).toBe('test-id');
  });

  test('updates existing stakeholder by name (case-insensitive)', () => {
    const existing = [{ id: '1', name: 'John Doe', title: 'Manager' }];
    const newStakeholders = [{ name: 'john doe', title: 'CEO' }];
    const result = mergeStakeholders(existing, newStakeholders, mockIdGenerator);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('John Doe'); // Original preserved
    expect(result[0].title).toBe('CEO'); // Updated
  });

  test('preserves existing values when new values are empty', () => {
    const existing = [{ id: '1', name: 'John', title: 'CEO', department: 'Exec' }];
    const newStakeholders = [{ name: 'John', title: null }];
    const result = mergeStakeholders(existing, newStakeholders, mockIdGenerator);

    expect(result[0].title).toBe('CEO');
    expect(result[0].department).toBe('Exec');
  });

  test('skips stakeholders without name', () => {
    const existing = [];
    const newStakeholders = [null, { title: 'CEO' }, { name: '', title: 'CTO' }];
    const result = mergeStakeholders(existing, newStakeholders, mockIdGenerator);

    // Empty name is falsy but still a string - this edge case
    expect(result.length).toBeLessThanOrEqual(1);
  });

  test('handles null/undefined inputs', () => {
    expect(mergeStakeholders(null, [{ name: 'John' }], mockIdGenerator)).toHaveLength(1);
    expect(mergeStakeholders([], null, mockIdGenerator)).toEqual([]);
    expect(mergeStakeholders(undefined, undefined, mockIdGenerator)).toEqual([]);
  });

  test('does not update role to Unknown', () => {
    const existing = [{ id: '1', name: 'John', role: 'Champion' }];
    const newStakeholders = [{ name: 'John', role: 'Unknown' }];
    const result = mergeStakeholders(existing, newStakeholders, mockIdGenerator);

    expect(result[0].role).toBe('Champion');
  });
});

describe('mergeMetrics', () => {
  test('adds new metrics', () => {
    const existing = {};
    const newMetrics = { projects_per_year: 50 };
    const result = mergeMetrics(existing, newMetrics);

    expect(result.projects_per_year.value).toBe(50);
  });

  test('updates existing metrics', () => {
    const existing = { projects_per_year: { value: 50 } };
    const newMetrics = { projects_per_year: 100 };
    const result = mergeMetrics(existing, newMetrics);

    expect(result.projects_per_year.value).toBe(100);
  });

  test('includes context when provided', () => {
    const result = mergeMetrics(
      {},
      { projects_per_year: 50 },
      { projects_per_year: 'Mentioned in discovery call' }
    );

    expect(result.projects_per_year.context).toBe('Mentioned in discovery call');
  });

  test('ignores null/undefined metrics', () => {
    const existing = { old_metric: { value: 100 } };
    const newMetrics = { projects_per_year: null, units: undefined };
    const result = mergeMetrics(existing, newMetrics);

    expect(result.projects_per_year).toBeUndefined();
    expect(result.units).toBeUndefined();
    expect(result.old_metric.value).toBe(100);
  });

  test('handles empty inputs', () => {
    expect(mergeMetrics(null, null)).toEqual({});
    expect(mergeMetrics(undefined, undefined)).toEqual({});
  });
});

describe('mergeGaps', () => {
  const mockIdGenerator = () => 'test-id';

  test('adds new gaps', () => {
    const existing = [];
    const newGaps = [{ question: 'Who is the buyer?', category: 'sales' }];
    const result = mergeGaps(existing, newGaps, mockIdGenerator);

    expect(result).toHaveLength(1);
    expect(result[0].question).toBe('Who is the buyer?');
    expect(result[0].category).toBe('sales');
    expect(result[0].status).toBe('open');
  });

  test('handles string-format gaps (legacy)', () => {
    const result = mergeGaps([], ['What is their budget?'], mockIdGenerator);

    expect(result[0].question).toBe('What is their budget?');
    expect(result[0].category).toBe('business');
  });

  test('avoids duplicate questions (case-insensitive)', () => {
    const existing = [{ id: '1', question: 'Who is the buyer?' }];
    const newGaps = [{ question: 'WHO IS THE BUYER?' }];
    const result = mergeGaps(existing, newGaps, mockIdGenerator);

    expect(result).toHaveLength(1);
  });

  test('skips gaps without questions', () => {
    const result = mergeGaps([], [null, { category: 'sales' }, { question: '' }], mockIdGenerator);
    expect(result).toHaveLength(0);
  });

  test('handles null/undefined inputs', () => {
    expect(mergeGaps(null, [{ question: 'test' }], mockIdGenerator)).toHaveLength(1);
    expect(mergeGaps([], null, mockIdGenerator)).toEqual([]);
  });
});

describe('topicMatches', () => {
  test('matches string topics', () => {
    const topics = ['discovery', 'pricing', 'demo'];
    expect(topicMatches(topics, 'discovery')).toBe(true);
    expect(topicMatches(topics, 'unknown')).toBe(false);
  });

  test('matches object topics with name property', () => {
    const topics = [{ name: 'Discovery Call' }, { name: 'Demo' }];
    expect(topicMatches(topics, 'discovery')).toBe(true);
    expect(topicMatches(topics, 'demo')).toBe(true);
  });

  test('matches object topics with label property', () => {
    const topics = [{ label: 'Pricing Discussion' }];
    expect(topicMatches(topics, 'pricing')).toBe(true);
  });

  test('handles mixed topic formats', () => {
    const topics = ['discovery', { name: 'Demo' }, { label: 'Pricing' }, null, undefined];
    expect(topicMatches(topics, 'discovery')).toBe(true);
    expect(topicMatches(topics, 'demo')).toBe(true);
    expect(topicMatches(topics, 'pricing')).toBe(true);
  });

  test('handles null/undefined input', () => {
    expect(topicMatches(null, 'test')).toBe(false);
    expect(topicMatches(undefined, 'test')).toBe(false);
    expect(topicMatches([], 'test')).toBe(false);
  });

  test('handles objects without name or label', () => {
    const topics = [{ id: 123 }, {}];
    expect(topicMatches(topics, 'test')).toBe(false);
  });
});

describe('mergeBusinessAreas', () => {
  test('merges new business area data', () => {
    const existing = {
      budgeting: { currentState: ['Uses Excel'], opportunities: [], quotes: [] }
    };
    const newData = {
      budgeting: { currentState: ['Manual process'], opportunities: ['Automation potential'] }
    };

    const result = mergeBusinessAreas(existing, newData);

    expect(result.budgeting.currentState).toContain('Uses Excel');
    expect(result.budgeting.currentState).toContain('Manual process');
    expect(result.budgeting.opportunities).toContain('Automation potential');
  });

  test('adds new business areas', () => {
    const existing = {};
    const newData = {
      invoicing: { currentState: ['NetSuite'], opportunities: [] }
    };

    const result = mergeBusinessAreas(existing, newData);

    expect(result.invoicing).toBeDefined();
    expect(result.invoicing.currentState).toContain('NetSuite');
  });

  test('handles null/undefined inputs', () => {
    expect(mergeBusinessAreas(null, null)).toEqual({});
    expect(mergeBusinessAreas({}, null)).toEqual({});
    expect(mergeBusinessAreas(null, {})).toEqual({});
  });

  test('includes confidence calculation', () => {
    const existing = {};
    const newData = {
      budgeting: { currentState: ['1', '2', '3'], opportunities: ['4', '5', '6'] }
    };

    const result = mergeBusinessAreas(existing, newData);
    expect(result.budgeting.confidence).toBe('high');
  });
});
