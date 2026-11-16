export const THEMES = ['dark', 'light', 'midnight', 'cork', 'system'] as const;
export type ThemeSetting = (typeof THEMES)[number];
export type ResolvedTheme = Exclude<ThemeSetting, 'system'>;

export interface Settings {
  theme: ThemeSetting;
  handwritingFont: boolean;
  soundEnabled: boolean;
  timezone: string; // 'auto' or an IANA zone the user picked
  startOfWeek: 0 | 1;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  handwritingFont: true,
  soundEnabled: true,
  timezone: 'auto',
  startOfWeek: 0,
};
