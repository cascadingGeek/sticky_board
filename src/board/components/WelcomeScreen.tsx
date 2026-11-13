import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useStickyBoard } from '../StickyBoardContext';
import { formatTime } from '../../shared/dates';
import type { PinColor } from '../../shared/notes';
import type { NoteColor, ThemeSetting } from '../../shared/types';
import { THEME_LABELS, THEME_ORDER, THEME_SWATCH } from '../themes';
import { Pin } from '../../shared/ui/Pin';

const HINTS: Record<ThemeSetting, string> = {
  light: 'Default, bright and clean',
  dark: 'Easy on the eyes',
  midnight: 'Pure black, calm accent',
  cork: 'A warm real corkboard',
  system: 'Dark or Light like your computer',
};

const SAMPLES: { title: string; text: string; color: NoteColor; pin: PinColor; left: number; top: number; tilt: number }[] = [
  { title: 'Plan the week', text: '3 small tasks', color: 'yellow', pin: 'red', left: 30, top: 40, tilt: -2.5 },
  { title: 'Read later', text: 'Saved from a website', color: 'blue', pin: 'yellow', left: 300, top: 90, tilt: 2 },
  { title: 'Call Ada', text: formatTime('18:00'), color: 'pink', pin: 'blue', left: 150, top: 290, tilt: 1.5 },
];

/** First run: pick a theme with a live preview, then start. Shown once. Light is the default. */
export function WelcomeScreen() {
  const { updateSettings, setThemeOverride, patchMeta } = useStickyBoard();
  const [choice, setChoice] = useState<ThemeSetting>('light');

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
    <main className="board-surface flex min-h-screen items-center justify-center px-4 py-12 text-ink sm:px-10">
      <div className="flex w-full max-w-[1220px] flex-wrap items-center justify-center gap-14">
        <section className="flex w-full max-w-[560px] min-w-0 flex-col gap-7 rounded-3xl bg-panel p-6 shadow-pop sm:p-10">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="paper-note paper-yellow relative h-[30px] w-[30px] -rotate-6">
              <span className="paper" />
            </span>
            <span className="text-lg font-bold">Sticky Board</span>
          </div>
          <div>
            <h1 className="m-0 text-[36px] leading-[1.05] font-bold tracking-[-0.02em] sm:text-[44px]">Your day, pinned to every new tab.</h1>
            <p className="mt-3.5 mb-0 text-[17px] leading-relaxed text-ink-faint">
              Pick a look to start. Your notes stay in this browser, and you can change the theme any time in Settings.
            </p>
          </div>
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2.5 text-[13px] font-semibold text-ink-soft">Theme</legend>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {THEME_ORDER.map(t => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={choice === t}
                  onClick={() => pick(t)}
                  className={`flex min-h-16 items-center gap-3 rounded-[14px] border-2 px-3.5 py-3 text-left ${
                    choice === t ? 'border-accent-soft bg-accent-wash' : 'border-line hover:bg-hover'
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
              className="flex h-12 items-center gap-2.5 rounded-xl bg-accent px-6 text-[15px] font-semibold text-accent-ink hover:opacity-90"
            >
              Start my board
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => finish(false)} className="min-h-11 px-2 text-sm text-ink-faint hover:text-ink">
              Skip for now
            </button>
          </div>
        </section>

        <div aria-hidden="true" className="relative hidden h-[520px] w-[600px] flex-none lg:block">
          {SAMPLES.map(n => (
            <div
              key={n.title}
              className={`paper-note paper-${n.color} absolute`}
              style={{ left: n.left, top: n.top, width: 220, height: 220, transform: `rotate(${n.tilt}deg)` }}
            >
              <div className="paper px-[18px] pt-11 pb-4">
                <Pin color={n.pin} />
                <p className="note-title">{n.title}</p>
                <p className="note-text mt-2 mb-0">{n.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
