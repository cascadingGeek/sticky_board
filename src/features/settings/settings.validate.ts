import { DEFAULT_SETTINGS, THEMES, type Settings } from './settings.types';

/** Each settings field is checked on its own; an invalid one falls back to its default. */
export const parseSettings = (raw: unknown): Settings => {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    theme: THEMES.includes(r.theme as Settings['theme']) ? (r.theme as Settings['theme']) : DEFAULT_SETTINGS.theme,
    handwritingFont: typeof r.handwritingFont === 'boolean' ? r.handwritingFont : DEFAULT_SETTINGS.handwritingFont,
    soundEnabled: typeof r.soundEnabled === 'boolean' ? r.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
    timezone: typeof r.timezone === 'string' && r.timezone ? r.timezone : DEFAULT_SETTINGS.timezone,
    startOfWeek: r.startOfWeek === 1 ? 1 : 0,
  };
};
