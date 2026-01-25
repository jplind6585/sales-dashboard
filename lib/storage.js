/**
 * localStorage abstraction with error handling
 */

const STORAGE_KEYS = {
  ACCOUNTS: 'accounts',
};

/**
 * Load data from localStorage
 * @param {string} key - Storage key
 * @returns {any|null} Parsed data or null if not found/error
 */
export const loadFromStorage = (key) => {
  try {
    if (typeof window === 'undefined') return null;
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    console.error(`Error loading from storage (${key}):`, e);
    return null;
  }
};

/**
 * Save data to localStorage
 * @param {string} key - Storage key
 * @param {any} value - Data to save
 * @returns {boolean} Success status
 */
export const saveToStorage = (key, value) => {
  try {
    if (typeof window === 'undefined') return false;
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`Error saving to storage (${key}):`, e);
    return false;
  }
};

/**
 * Remove data from localStorage
 * @param {string} key - Storage key
 * @returns {boolean} Success status
 */
export const removeFromStorage = (key) => {
  try {
    if (typeof window === 'undefined') return false;
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.error(`Error removing from storage (${key}):`, e);
    return false;
  }
};

/**
 * Generate a unique ID
 * @returns {string} Unique identifier
 */
export const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export { STORAGE_KEYS };
