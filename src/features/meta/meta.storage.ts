import { SETTINGS_KEY } from '@/features/settings/settings.storage';
import { SCHEMA_VERSION, type Meta } from './meta.types';

const META_KEY = 'meta';
const nowIso = () => new Date().toISOString();

export const meta = {
  async get(): Promise<Meta> {
    const res = await chrome.storage.local.get(META_KEY);
    const m = res[META_KEY] as Partial<Meta> | undefined;
    return { schemaVersion: SCHEMA_VERSION, ...(m ?? {}) };
  },
  async patch(fields: Partial<Meta>): Promise<Meta> {
    const next = { ...(await meta.get()), ...fields };
    await chrome.storage.local.set({ [META_KEY]: next });
    return next;
  },
};

/**
 * Light became the default theme. Existing users who never saved one get `dark`
 * saved once, so their board doesn't change. Reads raw sync data, since
 * parseSettings would fill in the default.
 */
const settleThemeDefault = async (): Promise<void> => {
  const m = await meta.get();
  if (m.themeDefaultCheckedAt) return;
  try {
    const res = await chrome.storage.sync.get(SETTINGS_KEY);
    const raw = res[SETTINGS_KEY];
    const stored = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    if (m.onboardedAt && !('theme' in stored)) {
      await chrome.storage.sync.set({ [SETTINGS_KEY]: { ...stored, theme: 'dark' } });
    }
  } catch {
    return;
  }
  await meta.patch({ themeDefaultCheckedAt: nowIso() });
};

/** Migrations run in order by the background worker on install and update. */
export const runMigrations = async (): Promise<void> => {
  const m = await meta.get();
  if (m.schemaVersion < SCHEMA_VERSION) await meta.patch({ schemaVersion: SCHEMA_VERSION });
  else if (!(await chrome.storage.local.get(META_KEY))[META_KEY]) await meta.patch({ schemaVersion: SCHEMA_VERSION });
  await settleThemeDefault();
};
