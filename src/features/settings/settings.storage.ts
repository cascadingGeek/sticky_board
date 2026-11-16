/** Settings live in chrome.storage.sync, so they follow the user across browsers. */
import { DEFAULT_SETTINGS, type Settings } from './settings.types';
import { parseSettings } from './settings.validate';

export const SETTINGS_KEY = 'settings';

// Settings: debounced writes (sync allows 120 writes per minute), flushed on page hide.
let pendingSettings: Partial<Settings> | null = null;
let settingsTimer: ReturnType<typeof setTimeout> | null = null;

export const settings = {
  async get(): Promise<Settings> {
    try {
      const res = await chrome.storage.sync.get(SETTINGS_KEY);
      return parseSettings(res[SETTINGS_KEY]);
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  },

  patch(fields: Partial<Settings>): void {
    pendingSettings = { ...(pendingSettings ?? {}), ...fields };
    if (settingsTimer) clearTimeout(settingsTimer);
    settingsTimer = setTimeout(() => void settings.flush(), 500);
  },

  async flush(): Promise<void> {
    if (settingsTimer) clearTimeout(settingsTimer);
    settingsTimer = null;
    if (!pendingSettings) return;
    const fields = pendingSettings;
    pendingSettings = null;
    const current = await settings.get();
    await chrome.storage.sync.set({ [SETTINGS_KEY]: { ...current, ...fields } });
  },

  async replace(next: Settings): Promise<void> {
    pendingSettings = null;
    await chrome.storage.sync.set({ [SETTINGS_KEY]: parseSettings(next) });
  },

  subscribe(cb: (s: Settings) => void): () => void {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'sync' && changes[SETTINGS_KEY]) cb(parseSettings(changes[SETTINGS_KEY].newValue));
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  },
};
