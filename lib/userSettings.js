// User settings storage utility
// For now uses localStorage, will migrate to Supabase when auth is enabled

const SETTINGS_KEY = 'banner_user_settings';

const defaultSettings = {
  emailSignature: '',
  emailPreferences: {
    autoAppendSignature: true,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * Get user settings from localStorage
 */
export function getUserSettings() {
  if (typeof window === 'undefined') return defaultSettings;

  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return defaultSettings;

    const settings = JSON.parse(stored);
    return {
      ...defaultSettings,
      ...settings,
    };
  } catch (error) {
    console.error('Error loading user settings:', error);
    return defaultSettings;
  }
}

/**
 * Save user settings to localStorage
 */
export function saveUserSettings(settings) {
  if (typeof window === 'undefined') return false;

  try {
    const currentSettings = getUserSettings();
    const updatedSettings = {
      ...currentSettings,
      ...settings,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updatedSettings));
    return true;
  } catch (error) {
    console.error('Error saving user settings:', error);
    return false;
  }
}

/**
 * Get email signature
 */
export function getEmailSignature() {
  const settings = getUserSettings();
  return settings.emailSignature || '';
}

/**
 * Save email signature
 */
export function saveEmailSignature(signature) {
  return saveUserSettings({ emailSignature: signature });
}

/**
 * Check if auto-append signature is enabled
 */
export function shouldAppendSignature() {
  const settings = getUserSettings();
  return settings.emailPreferences?.autoAppendSignature !== false;
}
