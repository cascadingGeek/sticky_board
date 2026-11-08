import type { ThemeSetting } from '../types';

export const THEME_LABELS: Record<ThemeSetting, string> = {
  dark: 'Dark',
  light: 'Light',
  midnight: 'Midnight',
  cork: 'Cork',
  system: 'System',
};

/** A small swatch previewing each theme's board surface (its own fixed colors, by design). */
export const THEME_SWATCH: Record<ThemeSetting, string> = {
  dark: 'bg-[#0f0f11] border border-white/10',
  light: 'bg-[#f1f1f3]',
  midnight: 'bg-black border border-white/10',
  cork: 'bg-[#b98a5e] bg-[radial-gradient(rgba(70,38,14,0.4)_1px,transparent_1.3px)] bg-[length:6px_6px]',
  system: 'bg-[linear-gradient(135deg,#0f0f11_50%,#f1f1f3_50%)]',
};
