import { useMemo, useRef, useState } from 'react';
import { Download, Loader2, ShieldCheck, Upload } from 'lucide-react';
import { useStickyBoard } from '../lib/StickyBoardContext';
import { exportBackup, importBackup, ImportError, type ImportResult } from '../lib/storage/backup';
import { todayInTz } from '../lib/dates';
import { THEME_LABELS, THEME_SWATCH } from '../lib/themes';
import type { ThemeSetting } from '../types';
import { Drawer } from './Drawer';
import { SitesSection } from './SitesSection';

/** Settings order from the canvas: Light, Dark, Midnight, then Cork, System. */
const SETTINGS_THEMES: ThemeSetting[] = ['light', 'dark', 'midnight', 'cork', 'system'];

const sectionTitle = 'm-0 text-xs font-semibold tracking-[0.06em] text-ink-faint uppercase';

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex min-h-12 items-center justify-between">
      <span className="text-[15px] text-ink">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-[26px] w-11 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-switch-off'}`}
      >
        <span className={`absolute top-[3px] h-5 w-5 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.25)] transition-all ${checked ? 'right-[3px] bg-accent-ink' : 'left-[3px] bg-white'}`} />
      </button>
    </div>
  );
}

/** Settings: theme, board, days, your data, shortcut and privacy. */
export function SettingsDrawer() {
  const { settings, updateSettings, openDrawer, tz, allNotes: notes } = useStickyBoard();
  const fileRef = useRef<HTMLInputElement>(null);
  const [restoreSettings, setRestoreSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf('timeZone');
    } catch {
      return [tz];
    }
  }, [tz]);

  const download = async () => {
    const blob = await exportBackup();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sticky-board-backup-${todayInTz(tz)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const r: ImportResult = await importBackup(file, restoreSettings);
      setResult({
        tone: 'ok',
        text: `Imported ${file.name}: ${r.added} added, ${r.updated} updated, ${r.skipped} already up to date.`,
      });
    } catch (e) {
      setResult({ tone: 'error', text: e instanceof ImportError ? e.message : "Couldn't import that file. Nothing was changed." });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const kbd = 'rounded-md bg-kbd px-1.5 py-0.5 font-mono text-xs font-semibold text-ink';
  const outlineBtn =
    'flex h-11 items-center justify-center gap-2 rounded-[10px] border border-line-strong bg-raise text-sm font-semibold text-ink hover:bg-hover disabled:opacity-60';

  return (
    <Drawer title="Settings" onClose={() => openDrawer(null)}>
      <div className="flex flex-col gap-7 px-1">
        <section aria-labelledby="set-theme" className="flex flex-col gap-2.5">
          <h3 id="set-theme" className={sectionTitle}>
            Theme
          </h3>
          <div role="group" aria-labelledby="set-theme" className="grid grid-cols-3 gap-2">
            {SETTINGS_THEMES.map(t => {
              const on = settings.theme === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => updateSettings({ theme: t })}
                  className={`flex flex-col gap-1.5 rounded-[12px] border-2 p-1.5 text-left text-xs font-semibold text-ink ${
                    on ? 'border-accent-soft bg-accent-wash' : 'border-line bg-raise hover:bg-hover'
                  }`}
                >
                  <span aria-hidden="true" className={`block h-10 rounded-[7px] ${THEME_SWATCH[t]}`} />
                  {THEME_LABELS[t]}
                </button>
              );
            })}
          </div>
        </section>

        <section aria-label="Board" className="-my-2 flex flex-col">
          <Switch label="Handwriting on notes" checked={settings.handwritingFont} onChange={v => updateSettings({ handwritingFont: v })} />
          <Switch label="Sounds" checked={settings.soundEnabled} onChange={v => updateSettings({ soundEnabled: v })} />
        </section>

        <section aria-labelledby="set-days" className="flex flex-col gap-3">
          <h3 id="set-days" className={sectionTitle}>
            Days
          </h3>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="set-tz" className="text-sm text-ink">
              Time zone
            </label>
            <select
              id="set-tz"
              value={settings.timezone}
              onChange={e => updateSettings({ timezone: e.target.value })}
              className="h-11 rounded-[10px] border border-line-strong bg-field px-3 text-[15px] text-ink"
            >
              <option value="auto">Automatic (this computer, {Intl.DateTimeFormat().resolvedOptions().timeZone})</option>
              {zones.map(z => (
                <option key={z} value={z}>
                  {z.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div role="group" aria-label="Week starts on" className="flex items-center justify-between gap-3">
            <span className="text-sm text-ink">Week starts on</span>
            <div className="flex rounded-[10px] border border-line bg-field p-[3px]">
              {(['Sunday', 'Monday'] as const).map((d, i) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={settings.startOfWeek === i}
                  onClick={() => updateSettings({ startOfWeek: i as 0 | 1 })}
                  className={`h-[34px] min-w-[76px] rounded-lg text-sm ${
                    settings.startOfWeek === i ? 'bg-raise-strong font-semibold text-ink' : 'text-ink-faint'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="set-data" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h3 id="set-data" className={sectionTitle}>
              Your data
            </h3>
            <span className="text-xs text-ink-faint">
              {notes.length} {notes.length === 1 ? 'note' : 'notes'}
            </span>
          </div>
          <p role="note" className="m-0 rounded-[12px] border border-warn-line bg-warn-wash px-3.5 py-3 text-[13px] leading-relaxed text-warn-ink">
            Notes live only in this browser. Removing the extension deletes them, so keep a backup.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={() => void download()} className={outlineBtn}>
              <Download size={16} aria-hidden="true" />
              Download backup
            </button>
            <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className={outlineBtn}>
              {busy ? <Loader2 size={16} aria-hidden="true" className="animate-spin" /> : <Upload size={16} aria-hidden="true" />}
              {busy ? 'Importing…' : 'Import backup'}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={e => void onFile(e.target.files?.[0])}
          />
          <label className="flex min-h-10 items-center gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={restoreSettings}
              onChange={e => setRestoreSettings(e.target.checked)}
              className="h-[18px] w-[18px] accent-[var(--color-accent)]"
            />
            Also restore settings when importing
          </label>
          {result && (
            <p
              role={result.tone === 'error' ? 'alert' : 'status'}
              className={`m-0 rounded-[12px] border px-3.5 py-3 text-[13px] leading-relaxed ${
                result.tone === 'error' ? 'border-danger-wash-line bg-danger-wash text-danger' : 'border-ok-line bg-ok-wash text-ok-ink'
              }`}
            >
              {result.text}
            </p>
          )}
          <p className="m-0 text-xs text-ink-faint">Importing merges with what's here. If a note is in both, the newer one wins.</p>
        </section>

        <SitesSection notes={notes} />

        <section aria-label="Shortcut and privacy" className="flex flex-col gap-3 rounded-[14px] bg-raise p-4 text-[13px] leading-relaxed text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
          <p className="m-0">
            Open the board from anywhere with <kbd className={kbd}>Alt+Shift+S</kbd>, and pin a note on a web page with <kbd className={kbd}>Alt+Shift+N</kbd>.{' '}
            <button
              type="button"
              onClick={() => void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}
              className="text-ink underline underline-offset-2 hover:no-underline"
            >
              Change shortcuts
            </button>
          </p>
          <p className="m-0 flex gap-2.5">
            <ShieldCheck size={16} aria-hidden="true" className="mt-0.5 flex-none text-ink-faint" />
            No accounts, no tracking. Nothing you write leaves this browser.
          </p>
        </section>
      </div>
    </Drawer>
  );
}
