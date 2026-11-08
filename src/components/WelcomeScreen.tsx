import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useStickyBoard } from '../lib/StickyBoardContext';
import { THEMES, type ThemeSetting } from '../types';
import { THEME_LABELS, THEME_SWATCH } from '../lib/themes';

const HINTS: Record<ThemeSetting, string> = {
  dark: 'Default, easy on the eyes',
  light: 'Bright and clean',
  midnight: 'Pure black, calm accent',
  cork: 'A warm real corkboard',
  system: 'Dark or Light like your computer',
};

/** First run: pick a theme with a live preview, then start. Shown once. */
export function WelcomeScreen() {
  const { updateSettings, setThemeOverride, patchMeta } = useStickyBoard();
  const [choice, setChoice] = useState<ThemeSetting>('dark');

  const pick = (t: ThemeSetting) => {
    setChoice(t);
    setThemeOverride(t);
  };
  const finish = (save: boolean) => {
    if (save) updateSettings({ theme: choice });
    setThemeOverride(null);
    void patchMeta({ onboardedAt: new Date().toISOString() });
  };

  return (
    <main className="board-surface flex min-h-screen items-center justify-center px-6 py-16 text-ink">
      <div className="flex w-full max-w-[1100px] flex-wrap items-center gap-14">
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-7 rounded-3xl bg-panel p-8 shadow-2xl">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="paper-yellow flex h-[34px] w-[34px] -rotate-6 items-center justify-center rounded-[9px]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--pin)' }} />
            </span>
            <span className="font-display text-lg font-bold">Sticky Board</span>
          </div>
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-[44px] leading-[1.05] font-bold tracking-tight">Your day, pinned to every new tab.</h1>
            <p className="max-w-[460px] text-[17px] leading-relaxed text-ink-faint">
              Pick a look to start. Your notes stay in this browser, and you can change the theme any time in Settings.
            </p>
          </div>
          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 text-[13px] font-semibold text-ink-soft">Theme</legend>
            <div className="grid grid-cols-2 gap-2.5">
              {THEMES.map(t => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={choice === t}
                  onClick={() => pick(t)}
                  className={`flex min-h-16 items-center gap-3 rounded-[14px] border-2 px-3.5 py-3 text-left ${
                    choice === t ? 'border-accent-soft bg-accent-wash' : 'border-line hover:bg-raise'
                  }`}
                >
                  <span aria-hidden="true" className={`h-9 w-9 flex-none rounded-[9px] ${THEME_SWATCH[t]}`} />
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold">{THEME_LABELS[t]}</span>
                    <span className="text-xs text-ink-faint">{HINTS[t]}</span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => finish(true)}
              className="flex h-12 items-center gap-2.5 rounded-xl bg-accent px-6 text-[15px] font-semibold text-accent-ink hover:brightness-110"
            >
              Start my board
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => finish(false)} className="min-h-11 px-2 text-sm text-ink-faint hover:text-ink">
              Skip for now
            </button>
          </div>
        </div>

        <div aria-hidden="true" className="relative h-[460px] min-w-0 flex-[1_1_480px]">
          <div className="paper-yellow absolute top-[40px] left-[30px] h-[170px] w-[170px] -rotate-2 rounded p-4 pt-7" style={{ boxShadow: 'var(--note-shadow)' }}>
            <div className="font-hand text-[28px] leading-none font-bold">Plan the week</div>
            <div className="mt-2.5 text-xs">3 small tasks</div>
          </div>
          <div className="paper-blue absolute top-[80px] left-[240px] h-[170px] w-[170px] rotate-[1.5deg] rounded p-4 pt-7" style={{ boxShadow: 'var(--note-shadow)' }}>
            <div className="font-hand text-[28px] leading-none font-bold">Read later</div>
            <div className="mt-2.5 text-xs">Saved from a website</div>
          </div>
          <div className="paper-pink absolute top-[250px] left-[110px] h-[170px] w-[170px] rotate-[2.5deg] rounded p-4 pt-7" style={{ boxShadow: 'var(--note-shadow)' }}>
            <div className="font-hand text-[28px] leading-none font-bold">Call Ada</div>
            <div className="mt-2.5 text-xs">18:00</div>
          </div>
        </div>
      </div>
    </main>
  );
}
