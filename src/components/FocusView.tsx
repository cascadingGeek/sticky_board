import React, { useState, useEffect, useRef } from 'react';
import { Timer as TimerIcon, Play, Pause, RotateCcw, Volume2, VolumeX, Flame, Focus, Coffee, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const FocusView: React.FC = () => {
  const [minutes, setMinutes] = useState<number>(25);
  const [seconds, setSeconds] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [mode, setMode] = useState<'work' | 'break'>('work');
  const [duration, setDuration] = useState<number>(25); // total duration in minutes

  // Synthesizer background audio state
  const [isAmbientPlaying, setIsAmbientPlaying] = useState<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const synthNodesRef = useRef<{ osc1: OscillatorNode; osc2: OscillatorNode; gain: GainNode } | null>(null);

  // Timer core tick interval
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive) {
      interval = setInterval(() => {
        if (seconds === 0) {
          if (minutes === 0) {
            // Timer expired: flip mode
            triggerAlarmSound();
            if (mode === 'work') {
              setMode('break');
              setMinutes(5);
              setDuration(5);
            } else {
              setMode('work');
              setMinutes(25);
              setDuration(25);
            }
            setSeconds(0);
            setIsActive(false);
          } else {
            setMinutes(minutes - 1);
            setSeconds(59);
          }
        } else {
          setSeconds(seconds - 1);
        }
      }, 1000);
    } else {
      if (interval) clearInterval(interval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, minutes, seconds, mode]);

  // Audio synthesis alarm chime on expiration
  const triggerAlarmSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = ctx.currentTime;
      [440, 554.37, 659.25, 880].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.3);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.35);
      });
    } catch (e) {
      console.warn("Expired chime context blocked:", e);
    }
  };

  // Immersive focus synth loop generator
  const toggleAmbientSound = () => {
    if (isAmbientPlaying) {
      // Stop
      if (synthNodesRef.current) {
        try {
          synthNodesRef.current.osc1.stop();
          synthNodesRef.current.osc2.stop();
        } catch (e) {}
        synthNodesRef.current = null;
      }
      setIsAmbientPlaying(false);
    } else {
      // Start ambient synth drones
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(110, ctx.currentTime); // Low A

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(110.5, ctx.currentTime); // Slight detune

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, ctx.currentTime);

        gain.gain.setValueAtTime(0.08, ctx.currentTime);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc1.start();
        osc2.start();

        synthNodesRef.current = { osc1, osc2, gain };
        setIsAmbientPlaying(true);
      } catch (err) {
        console.warn("Ambient Audio compilation blocked:", err);
      }
    }
  };

  // Cleanup synth on unmount
  useEffect(() => {
    return () => {
      if (synthNodesRef.current) {
        try {
          synthNodesRef.current.osc1.stop();
          synthNodesRef.current.osc2.stop();
        } catch (e) {}
      }
    };
  }, []);

  const toggleTimer = () => {
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    setMinutes(duration);
    setSeconds(0);
  };

  const setPreset = (mins: number, isBreak = false) => {
    setIsActive(false);
    setMode(isBreak ? 'break' : 'work');
    setDuration(mins);
    setMinutes(mins);
    setSeconds(0);
  };

  // Calculate percentage remaining for circular progress
  const totalSeconds = duration * 60;
  const elapsedSeconds = totalSeconds - (minutes * 60 + seconds);
  const progressPercent = (elapsedSeconds / totalSeconds) * 100;

  return (
    <div className="min-h-screen px-4 py-6 md:pl-72 md:pr-8 md:py-8 pb-24 md:pb-8 flex flex-col justify-center items-center relative overflow-hidden bg-[#0F0F11]">
      {/* Visual dynamic breathing ripple */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: [1, 1.05, 1], opacity: [0.03, 0.08, 0.03] }}
            exit={{ opacity: 0 }}
            transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
            className="absolute h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none"
          />
        )}
      </AnimatePresence>

      <div className="relative z-10 flex flex-col items-center w-full max-w-lg">
        {/* Status badges */}
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#0c0c0e] px-4 py-1.5 shadow">
          {mode === 'work' ? (
            <>
              <Focus className="h-4 w-4 text-indigo-400" />
              <span className="font-display text-xs font-bold text-white tracking-wide uppercase">Deep Focus block</span>
            </>
          ) : (
            <>
              <Coffee className="h-4 w-4 text-emerald-500" />
              <span className="font-display text-xs font-bold text-white tracking-wide uppercase">Rest & Recharge</span>
            </>
          )}
        </div>

        {/* GLOWING COUNTDOWN DISPLAY TIMER */}
        <div className="relative flex items-center justify-center h-72 w-72 mt-12">
          {/* Radial SVG Circle Indicator */}
          <svg className="absolute transform -rotate-90 w-full h-full">
            <circle
              cx="144"
              cy="144"
              r="124"
              className="stroke-zinc-900"
              strokeWidth="6"
              fill="transparent"
            />
            <circle
              cx="144"
              cy="144"
              r="124"
              className={`transition-all duration-300 ${
                mode === 'work' ? 'stroke-indigo-500' : 'stroke-emerald-500'
              }`}
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={2 * Math.PI * 124}
              strokeDashoffset={2 * Math.PI * 124 * (1 - progressPercent / 100)}
              strokeLinecap="round"
            />
          </svg>

          {/* Internal time display */}
          <div className="text-center">
            <span className="font-display text-5xl font-extrabold text-white tracking-tight leading-none block">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
            <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-500 mt-2 block">
              Remaining time
            </span>
          </div>
        </div>

        {/* TIMER PLAY CONTROLS */}
        <div className="flex items-center gap-4 mt-12">
          <button 
            onClick={resetTimer}
            className="rounded-xl border border-white/5 bg-[#0c0c0e] p-3 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <RotateCcw className="h-4.5 w-4.5" />
          </button>

          <button 
            onClick={toggleTimer}
            className={`rounded-2xl px-8 py-3.5 font-display text-sm font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 ${
              isActive 
                ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' 
                : 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-indigo-500/15 hover:brightness-110'
            }`}
          >
            {isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            <span>{isActive ? 'Pause Interval' : 'Start Focus'}</span>
          </button>

          {/* Ambient Loop Toggle */}
          <button 
            onClick={toggleAmbientSound}
            className={`rounded-xl border p-3 transition-all ${
              isAmbientPlaying 
                ? 'border-indigo-500/20 bg-indigo-500/5 text-indigo-400' 
                : 'border-white/5 bg-[#0c0c0e] text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {isAmbientPlaying ? <Volume2 className="h-4.5 w-4.5" /> : <VolumeX className="h-4.5 w-4.5" />}
          </button>
        </div>

        {/* INTENSIVE PRESET SELECTORS */}
        <div className="mt-12 w-full flex justify-center gap-2.5">
          <button 
            onClick={() => setPreset(25)}
            className={`rounded-xl px-4 py-2 font-display text-xs font-bold ${
              duration === 25 && mode === 'work'
                ? 'bg-indigo-500 text-white' 
                : 'border border-white/5 bg-zinc-950 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            25m Focus
          </button>

          <button 
            onClick={() => setPreset(50)}
            className={`rounded-xl px-4 py-2 font-display text-xs font-bold ${
              duration === 50 && mode === 'work'
                ? 'bg-indigo-500 text-white' 
                : 'border border-white/5 bg-zinc-950 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            50m Extreme
          </button>

          <button 
            onClick={() => setPreset(5, true)}
            className={`rounded-xl px-4 py-2 font-display text-xs font-bold ${
              duration === 5 && mode === 'break'
                ? 'bg-emerald-500 text-white' 
                : 'border border-white/5 bg-zinc-950 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            5m Short Break
          </button>

          <button 
            onClick={() => setPreset(15, true)}
            className={`rounded-xl px-4 py-2 font-display text-xs font-bold ${
              duration === 15 && mode === 'break'
                ? 'bg-emerald-500 text-white' 
                : 'border border-white/5 bg-zinc-950 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            15m Long Break
          </button>
        </div>
      </div>
    </div>
  );
};
