import React from 'react';
import { useStickyBoard } from '../lib/StickyBoardContext';
import { Key, Palette, Layout, BadgeCheck, Moon, Sun, CalendarDays, Globe } from 'lucide-react';
import { Priority } from '../types';

// Full IANA list when the browser supports it, otherwise a sane subset
const getTimezones = (): string[] => {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [
      'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
      'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
      'Africa/Lagos', 'Africa/Nairobi', 'Asia/Dubai', 'Asia/Kolkata',
      'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland'
    ];
  }
};

const Toggle: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
  <button
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors outline-none ${
      checked ? 'bg-accent' : 'bg-muted-strong'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

export const SettingsView: React.FC = () => {
  const { user, updatePreferences } = useStickyBoard();

  if (!user) return null;

  const prefs = user.preferences;
  const timezones = getTimezones();

  // Custom accent color selectors
  const accentColors = [
    { name: 'indigo', value: '#6366f1', label: 'Classic Indigo' },
    { name: 'rose', value: '#f43f5e', label: 'Sunset Rose' },
    { name: 'blue', value: '#3b82f6', label: 'Linear Blue' },
    { name: 'violet', value: '#8b5cf6', label: 'Cosmic Violet' },
    { name: 'emerald', value: '#10b981', label: 'Zen Emerald' },
    { name: 'amber', value: '#f59e0b', label: 'Warm Amber' }
  ];

  const selectClass =
    'w-full rounded-xl border border-line bg-field px-3.5 py-2 text-xs text-ink outline-none focus:border-accent';

  return (
    <div className="min-h-screen px-4 py-6 md:pl-72 md:pr-8 md:py-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="border-b border-line pb-6">
        <span className="text-[10px] uppercase font-mono tracking-wider text-accent-soft font-bold">Preferences</span>
        <h1 className="font-display text-3xl font-extrabold text-ink tracking-tight">Personalization</h1>
      </div>

      <div className="mt-8 max-w-2xl space-y-8">
        {/* SECTION 1: VISUAL THEMES */}
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-xl">
          <div className="flex items-center gap-2.5 border-b border-line pb-4 mb-6">
            <Palette className="h-4.5 w-4.5 text-accent-soft" />
            <h3 className="font-display text-sm font-bold text-ink">Visual Themes</h3>
          </div>

          <div className="space-y-6">
            {/* Theme mode */}
            <div>
              <label className="text-xs font-semibold text-ink-soft block mb-3">Appearance</label>
              <div className="flex gap-3">
                {([
                  { value: 'dark', label: 'Dark', Icon: Moon },
                  { value: 'light', label: 'Light', Icon: Sun }
                ] as const).map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    onClick={() => updatePreferences({ theme: value })}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition-all ${
                      prefs.theme === value
                        ? 'border-accent bg-accent/5 text-ink'
                        : 'border-line bg-field text-ink-faint hover:text-ink-soft'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Accent color */}
            <div className="border-t border-line pt-6">
              <label className="text-xs font-semibold text-ink-soft block mb-3">Accent Highlights</label>
              <div className="flex flex-wrap gap-3">
                {accentColors.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => updatePreferences({ accentColor: color.value })}
                    className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition-all hover:bg-raise-faint ${
                      prefs.accentColor === color.value
                        ? 'border-accent bg-accent/5 text-ink'
                        : 'border-line bg-field text-ink-faint'
                    }`}
                  >
                    <div className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: color.value }} />
                    <span>{color.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: BOARD BEHAVIOR */}
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-xl">
          <div className="flex items-center gap-2.5 border-b border-line pb-4 mb-6">
            <CalendarDays className="h-4.5 w-4.5 text-accent-soft" />
            <h3 className="font-display text-sm font-bold text-ink">Board Behavior</h3>
          </div>

          <div className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Start of week */}
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-2">Week Starts On</label>
                <select
                  value={prefs.startOfWeek}
                  onChange={(e) => updatePreferences({ startOfWeek: Number(e.target.value) as 0 | 1 })}
                  className={selectClass}
                >
                  <option value={0}>Sunday</option>
                  <option value={1}>Monday</option>
                </select>
                <span className="block text-[10px] text-ink-faint mt-1.5">Applies to Calendar and weekly analytics.</span>
              </div>

              {/* Default priority */}
              <div>
                <label className="text-xs font-semibold text-ink-soft block mb-2">Default Priority</label>
                <select
                  value={prefs.defaultPriority}
                  onChange={(e) => updatePreferences({ defaultPriority: e.target.value as Priority })}
                  className={selectClass}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                <span className="block text-[10px] text-ink-faint mt-1.5">Pre-selected on every new sticky note.</span>
              </div>
            </div>

            {/* Timezone */}
            <div className="border-t border-line pt-6">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft mb-2">
                <Globe className="h-3.5 w-3.5" />
                Timezone
              </label>
              <select
                value={prefs.timezone}
                onChange={(e) => updatePreferences({ timezone: e.target.value })}
                className={selectClass}
              >
                {!timezones.includes(prefs.timezone) && <option value={prefs.timezone}>{prefs.timezone}</option>}
                {timezones.map(tz => (
                  <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <span className="block text-[10px] text-ink-faint mt-1.5">
                Determines when "Today" rolls over to a fresh board.
              </span>
            </div>

            {/* Sticky color mode */}
            <div className="flex items-center justify-between border-t border-line pt-6">
              <div>
                <span className="block text-xs font-bold text-ink">Automatic Note Colors</span>
                <span className="block text-[10px] text-ink-faint mt-1">
                  Derives paper color from priority (critical → pink, high → orange…). Turn off to pick colors yourself.
                </span>
              </div>
              <Toggle
                checked={prefs.stickyColorMode === 'auto'}
                onChange={() => updatePreferences({ stickyColorMode: prefs.stickyColorMode === 'auto' ? 'manual' : 'auto' })}
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: PHYSICALITY & FEEDBACK */}
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-xl">
          <div className="flex items-center gap-2.5 border-b border-line pb-4 mb-6">
            <Layout className="h-4.5 w-4.5 text-accent-soft" />
            <h3 className="font-display text-sm font-bold text-ink">Tactile Feedback</h3>
          </div>

          <div className="space-y-6">
            {/* Handwriting Toggles */}
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-xs font-bold text-ink">Handwritten Notes Style</span>
                <span className="block text-[10px] text-ink-faint mt-1">
                  Enables beautiful Kalam & Caveat handwriting typography for sticky notes content.
                </span>
              </div>
              <Toggle
                checked={prefs.handwritingFont}
                onChange={() => updatePreferences({ handwritingFont: !prefs.handwritingFont })}
              />
            </div>

            {/* Sound FX Toggles */}
            <div className="flex items-center justify-between border-t border-line pt-6">
              <div>
                <span className="block text-xs font-bold text-ink">Physical Sound Feedback</span>
                <span className="block text-[10px] text-ink-faint mt-1">
                  Plays satisfying click/pop and crumple frequencies on complete/delete triggers.
                </span>
              </div>
              <Toggle
                checked={prefs.soundEnabled}
                onChange={() => updatePreferences({ soundEnabled: !prefs.soundEnabled })}
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: AI */}
        <div className="rounded-2xl border border-accent/10 bg-gradient-to-tr from-accent/5 to-field p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent-soft flex-shrink-0">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-display text-sm font-bold text-ink">AI Assistance (Gemini)</h4>
              <p className="text-xs text-ink-soft leading-normal mt-2">
                StickyBoard integrates with the Gemini API to parse natural-language commands and compile daily coach briefings.
                AI requests are proxied through the StickyBoard backend — currently running on local demo data while the API is under development.
              </p>
              <div className="mt-4 flex items-center gap-2 text-[11px] text-emerald-500 font-semibold">
                <BadgeCheck className="h-4 w-4" />
                <span>The API key lives server-side only. No client exposure.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
