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
  light: 'bg-[radial-gradient(ellipse_at_62%_38%,#fdfcfa,#e6e2da)] border border-black/10',
  dark: 'bg-[#1a1a1d] border border-white/10',
  midnight: 'bg-black border border-white/10',
  cork: 'bg-[#b98a5e] bg-[radial-gradient(rgba(70,38,14,0.35)_1px,transparent_1.4px)] bg-[length:5px_5px]',
  system: 'bg-[linear-gradient(135deg,#1a1a1d_50%,#edebe6_50%)] border border-black/10',
};

/** The order themes are offered in (Light first, the default since spec 0003). */
export const THEME_ORDER: ThemeSetting[] = ['light', 'dark', 'cork', 'midnight', 'system'];
