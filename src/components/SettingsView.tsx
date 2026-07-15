import React from 'react';
import { useStickyBoard } from '../lib/StickyBoardContext';
import { Settings, Eye, Volume2, Sparkles, Key, Palette, Layout, BadgeCheck } from 'lucide-react';
import { motion } from 'motion/react';

export const SettingsView: React.FC = () => {
  const { user, updatePreferences } = useStickyBoard();

  if (!user) return null;

  const prefs = user.preferences;

  // Custom accent color selectors
  const accentColors = [
    { name: 'rose', value: '#f43f5e', label: 'Sunset Rose' },
    { name: 'blue', value: '#3b82f6', label: 'Linear Blue' },
    { name: 'violet', value: '#8b5cf6', label: 'Cosmic Violet' },
    { name: 'emerald', value: '#10b981', label: 'Zen Emerald' },
    { name: 'amber', value: '#f59e0b', label: 'Warm Amber' }
  ];

  return (
    <div className="min-h-screen px-4 py-6 md:pl-72 md:pr-8 md:py-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="border-b border-white/5 pb-6">
        <span className="text-[10px] uppercase font-mono tracking-wider text-indigo-400 font-bold">Preferences</span>
        <h1 className="font-display text-3xl font-extrabold text-white tracking-tight">Personalization</h1>
      </div>

      <div className="mt-8 max-w-2xl space-y-8">
        {/* SECTION 1: VISUAL THEME ACCENTS */}
        <div className="rounded-2xl border border-white/5 bg-[#0c0c0e] p-6 shadow-xl">
          <div className="flex items-center gap-2.5 border-b border-white/5 pb-4 mb-6">
            <Palette className="h-4.5 w-4.5 text-indigo-400" />
            <h3 className="font-display text-sm font-bold text-white">Visual Themes</h3>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-3">Accent Highlights</label>
              <div className="flex flex-wrap gap-3">
                {accentColors.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => updatePreferences({ accentColor: color.value })}
                    className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition-all hover:bg-white/[0.02] ${
                      prefs.accentColor === color.value 
                        ? 'border-indigo-500 bg-indigo-500/5 text-white' 
                        : 'border-white/5 bg-zinc-950 text-zinc-500'
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

        {/* SECTION 2: PHYSICALITY & FEEDBACK */}
        <div className="rounded-2xl border border-white/5 bg-[#0c0c0e] p-6 shadow-xl">
          <div className="flex items-center gap-2.5 border-b border-white/5 pb-4 mb-6">
            <Layout className="h-4.5 w-4.5 text-indigo-400" />
            <h3 className="font-display text-sm font-bold text-white">Tactile Feedback</h3>
          </div>

          <div className="space-y-6">
            {/* Handwriting Toggles */}
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-xs font-bold text-white">Handwritten Notes Style</span>
                <span className="block text-[10px] text-zinc-500 mt-1">
                  Enables beautiful Kalam & Caveat handwriting typography for sticky notes content.
                </span>
              </div>
              <button
                onClick={() => updatePreferences({ handwritingFont: !prefs.handwritingFont })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors outline-none ${
                  prefs.handwritingFont ? 'bg-indigo-500' : 'bg-zinc-800'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                    prefs.handwritingFont ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Sound FX Toggles */}
            <div className="flex items-center justify-between border-t border-white/5 pt-6">
              <div>
                <span className="block text-xs font-bold text-white">Physical Sound Feedback</span>
                <span className="block text-[10px] text-zinc-500 mt-1">
                  Plays satisfying click/pop and crumple frequencies on complete/delete triggers.
                </span>
              </div>
              <button
                onClick={() => updatePreferences({ soundEnabled: !prefs.soundEnabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors outline-none ${
                  prefs.soundEnabled ? 'bg-indigo-500' : 'bg-zinc-800'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                    prefs.soundEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* SECTION 3: PLATFORM SECURITY AND API INSTRUCTION */}
        <div className="rounded-2xl border border-indigo-500/10 bg-gradient-to-tr from-indigo-950/10 to-zinc-950 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 flex-shrink-0">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-display text-sm font-bold text-white">Gemini API Key Secure Configuration</h4>
              <p className="text-xs text-zinc-400 leading-normal mt-2">
                StickyBoard integrates fully with the Gemini API to parse voice-like text commands and compile productivity reports.
              </p>
              <div className="mt-4 flex items-center gap-2 text-[11px] text-emerald-400 font-semibold">
                <BadgeCheck className="h-4 w-4" />
                <span>API Key is managed securely in Settings &gt; Secrets. No client exposure.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
