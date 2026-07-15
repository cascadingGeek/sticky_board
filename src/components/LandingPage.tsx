import React, { useState } from 'react';
import { useStickyBoard } from '../lib/StickyBoardContext';
import { Sparkles, ArrowRight, Play, ChevronDown, Check, Trash2, Calendar, Focus, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LandingPageProps {
  onStartAuth: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStartAuth }) => {
  const { startDemo } = useStickyBoard();
  
  // Fake state for landing page interactive demo board
  const [demoTodos, setDemoTodos] = useState([
    { id: 1, title: 'Check me to see push-pin pop-outs! 📌', isCompleted: false, color: 'pink', rot: -2 },
    { id: 2, title: 'Double-click sticky notes to edit ✏️', isCompleted: false, color: 'yellow', rot: 1.5 },
    { id: 3, title: 'Pristine paper-curled drop shadows', isCompleted: true, color: 'mint', rot: -1 }
  ]);
  const [newTodoText, setNewTodoText] = useState('');
  const [demoConfetti, setDemoConfetti] = useState<{ id: number; x: number; y: number; color: string }[]>([]);

  // FAQ Toggle states
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const colors = [
    { name: 'pink', bg: 'sticky-pink', pin: '#ec4899' },
    { name: 'yellow', bg: 'sticky-yellow', pin: '#eab308' },
    { name: 'mint', bg: 'sticky-mint', pin: '#14b8a6' },
    { name: 'blue', bg: 'sticky-blue', pin: '#3b82f6' }
  ];

  const addDemoTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;
    
    const randomColor = colors[Math.floor(Math.random() * colors.length)].name;
    const randomRotation = Math.random() * 4 - 2; // -2 to 2 degrees

    const newTodo = {
      id: Date.now(),
      title: newTodoText,
      isCompleted: false,
      color: randomColor,
      rot: randomRotation
    };

    setDemoTodos([...demoTodos, newTodo]);
    setNewTodoText('');
  };

  const toggleDemoTodo = (id: number, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Trigger local micro confetti particles
    const particleColors = ['#f43f5e', '#3b82f6', '#10b981', '#fbbf24', '#a78bfa'];
    const newParticles = Array.from({ length: 15 }).map((_, i) => ({
      id: Date.now() + i,
      x: x + (Math.random() * 80 - 40),
      y: y + (Math.random() * 80 - 40),
      color: particleColors[Math.floor(Math.random() * particleColors.length)]
    }));

    setDemoConfetti(prev => [...prev, ...newParticles]);
    setTimeout(() => {
      setDemoConfetti(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
    }, 1000);

    setDemoTodos(prev => prev.map(t => t.id === id ? { ...t, isCompleted: !t.isCompleted } : t));
  };

  const deleteDemoTodo = (id: number) => {
    setDemoTodos(prev => prev.filter(t => t.id !== id));
  };

  const faqs = [
    {
      q: "How does the Daily Isolation timeline work?",
      a: "Every day at midnight in your local timezone, StickyBoard clears your corkboard workspace, giving you a fresh, clean slate. All previous days' notes remain frozen in time, easily accessible via the integrated monthly Calendar. No more rolling over endless uncompleted tasks into infinite clutter!"
    },
    {
      q: "Do I need a paid API key for AI scheduling?",
      a: "No! Basic AI schedules utilize our standard platform servers. However, you can add your own Gemini API Key inside Settings > Secrets for private, limitless, premium AI natural-language parsing and morning reports."
    },
    {
      q: "Can I use StickyBoard offline?",
      a: "Absolutely. Our single-player guest mode stores all credentials and notes directly inside your local browser storage. If you sign up for a cloud account, notes synchronize across all devices instantly."
    },
    {
      q: "Is there keyboard support?",
      a: "Yes. StickyBoard supports a global command palette via Ctrl/Cmd + K, arrow keys to navigate boards, and tactile shortcuts for creating, pinning, and deleting tasks."
    }
  ];

  return (
    <div className="min-h-screen bg-[#0F0F11] text-zinc-100 selection:bg-indigo-500/30 selection:text-white">
      {/* HEADER NAVBAR */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0F0F11]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-white">StickyBoard</span>
          </div>

          <nav className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm text-zinc-400 hover:text-white">Features</a>
            <a href="#demo" className="text-sm text-zinc-400 hover:text-white">Interactive Demo</a>
            <a href="#faq" className="text-sm text-zinc-400 hover:text-white">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <button 
              onClick={startDemo} 
              className="text-sm font-semibold text-zinc-400 hover:text-white"
            >
              Live Demo
            </button>
            <button
              onClick={onStartAuth}
              className="rounded-lg bg-white px-4 py-2 font-display text-xs font-semibold text-black transition-all hover:bg-zinc-200 active:scale-95"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative overflow-hidden px-6 pt-20 pb-28 text-center md:pt-28 md:pb-36">
        {/* Glow Spheres */}
        <div className="absolute top-1/4 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute top-1/3 left-1/4 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-4xl">
          {/* Tagline */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto inline-flex items-center gap-2 rounded-full border border-indigo-500/15 bg-indigo-500/5 px-3.5 py-1 text-xs font-semibold text-indigo-400"
          >
            <Sparkles className="h-3 w-3" />
            Introducing the first Tactile Daily Planner
          </motion.div>

          {/* Heading */}
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-6 font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl"
          >
            A productivity canvas as tactile as <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-indigo-500 bg-clip-text text-transparent">
              real-life sticky notes.
            </span>
          </motion.h1>

          {/* Subheading */}
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-base text-zinc-400 sm:text-lg"
          >
            Beautiful, paper-curled sticky notes pinned onto an elegant virtual corkboard. 
            Isolated daily timelines that reset at midnight, keeping you focused, organized, and clutter-free.
          </motion.p>

          {/* CTAs */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-10 flex flex-wrap justify-center gap-4"
          >
            <button
              onClick={onStartAuth}
              className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-3.5 font-display text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:brightness-110 active:scale-98"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <a
              href="#demo"
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 font-display text-sm font-semibold text-white transition-all hover:bg-white/10"
            >
              <Play className="h-4 w-4 text-indigo-400 fill-indigo-400" />
              Try Interactive Demo
            </a>
          </motion.div>
        </div>
      </section>

      {/* BENCHMARK COMPARISON INTERACTIVE BOARD */}
      <section id="demo" className="mx-auto max-w-7xl px-6 py-12">
        <div className="relative rounded-2xl border border-white/10 bg-[#121217] p-8 shadow-2xl">
          {/* Header of board */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-6">
            <div>
              <span className="font-display text-xs font-semibold tracking-wider uppercase text-indigo-400">Try it out</span>
              <h2 className="font-display text-2xl font-bold tracking-tight text-white mt-1">The Interactive Sandbox Board</h2>
              <p className="text-xs text-zinc-400 mt-1">Check subtasks, toggle notes complete, or pin them. Fully active client-side demo.</p>
            </div>

            {/* Quick add for demo */}
            <form onSubmit={addDemoTodo} className="flex gap-2">
              <input 
                type="text" 
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
                placeholder="Type a task name..."
                className="rounded-lg border border-white/10 bg-zinc-900/50 px-3.5 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-indigo-500"
              />
              <button 
                type="submit"
                className="rounded-lg bg-indigo-500 px-3.5 py-1.5 font-display text-xs font-bold text-white transition-all hover:bg-indigo-600"
              >
                Pin Sticky
              </button>
            </form>
          </div>

          {/* Simulated Corkboard Frame */}
          <div className="corkboard-grid relative min-h-[360px] rounded-xl border-4 border-amber-950/45 p-8 flex flex-wrap justify-center items-start gap-6 overflow-hidden">
            {/* Ambient Lighting overlay */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-white/[0.02]" />

            <AnimatePresence>
              {demoTodos.map((todo) => {
                const isCompleted = todo.isCompleted;
                const isPink = todo.color === 'pink';
                const isMint = todo.color === 'mint';
                const isBlue = todo.color === 'blue';

                return (
                  <motion.div
                    key={todo.id}
                    layout
                    initial={{ scale: 0.8, opacity: 0, rotate: todo.rot * 1.5 }}
                    animate={{ 
                      scale: isCompleted ? 0.95 : 1, 
                      opacity: isCompleted ? 0.75 : 1, 
                      rotate: todo.rot 
                    }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    style={{ transformOrigin: 'top center' }}
                    className={`folded-corner relative w-56 flex-shrink-0 p-5 shadow-sticky transition-all hover:scale-102 hover:shadow-sticky-hover ${
                      isPink ? 'sticky-pink' : isMint ? 'sticky-mint' : isBlue ? 'sticky-blue' : 'sticky-yellow'
                    }`}
                  >
                    {/* Push Pin */}
                    <div className="absolute top-2 left-1/2 z-20 h-4 w-4 -translate-x-1/2">
                      <div className="absolute top-0 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full shadow-md" style={{ backgroundColor: isPink ? '#ec4899' : isMint ? '#14b8a6' : isBlue ? '#3b82f6' : '#eab308' }} />
                      <div className="mx-auto mt-2 h-2.5 w-0.5 bg-zinc-400" />
                    </div>

                    {/* Folded corner overlay */}
                    <div className="corner-fold" />

                    {/* Checkbox and title */}
                    <div className="flex items-start gap-2.5 mt-2">
                      <button 
                        onClick={(e) => toggleDemoTodo(todo.id, e)}
                        className={`mt-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border border-current transition-all ${
                          isCompleted ? 'bg-current' : 'hover:bg-black/5'
                        }`}
                      >
                        {isCompleted && <Check className="h-3 w-3 text-[#09090b]" />}
                      </button>

                      <div className="flex-1">
                        <p className={`font-handwritten text-lg leading-snug ${isCompleted ? 'line-through opacity-60 decoration-2' : ''}`}>
                          {todo.title}
                        </p>
                      </div>
                    </div>

                    {/* Delete footer icon */}
                    <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-2 text-[10px] opacity-70">
                      <span className="font-mono uppercase tracking-wider">Demo Sandbox</span>
                      <button 
                        onClick={() => deleteDemoTodo(todo.id)}
                        className="rounded p-1 hover:bg-black/5 hover:text-rose-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Click confetti particles */}
            {demoConfetti.map((particle) => (
              <motion.div
                key={particle.id}
                initial={{ x: particle.x, y: particle.y, scale: 1, opacity: 1 }}
                animate={{ 
                  y: particle.y + (Math.random() * 60 - 30), 
                  x: particle.x + (Math.random() * 60 - 30), 
                  scale: 0.1, 
                  opacity: 0 
                }}
                transition={{ duration: 0.8 }}
                className="absolute z-30 h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: particle.color }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CORE INNOVATIONS - BENTO FEATURES */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-20">
        <div className="text-center">
          <span className="font-display text-xs font-semibold tracking-wider uppercase text-indigo-400">Crafted Masterpiece</span>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-white mt-2 sm:text-4xl">The isolated daily workflow.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-zinc-400 text-sm">
            Most todo apps are a graveyard of yesterday's failures. StickyBoard isolates your schedules daily, resetting the canvas so you wake up motivated and organized.
          </p>
        </div>

        {/* Bento Grid layout */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Bento Card 1: Daily resets */}
          <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-zinc-900/30 p-8 transition-all hover:border-white/10 hover:bg-zinc-900/50">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
              <Calendar className="h-5 w-5" />
            </div>
            <h3 className="font-display text-lg font-bold text-white mt-6">Isolated Timelines</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Each date behaves as an isolated board. A brand-new daily planner is automatically generated at 12:00 AM in your local timezone.
            </p>
          </div>

          {/* Bento Card 2: AI Parsing */}
          <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-zinc-900/30 p-8 transition-all hover:border-white/10 hover:bg-zinc-900/50">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
              <Brain className="h-5 w-5" />
            </div>
            <h3 className="font-display text-lg font-bold text-white mt-6">Natural AI Processing</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Type naturally: "Review budget reports tomorrow morning priority critical category Finance". Gemini handles dates, colors, and prioritizes instantly.
            </p>
          </div>

          {/* Bento Card 3: Focus timers */}
          <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-zinc-900/30 p-8 transition-all hover:border-white/10 hover:bg-zinc-900/50">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
              <Focus className="h-5 w-5" />
            </div>
            <h3 className="font-display text-lg font-bold text-white mt-6">Distraction-Free Focus</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Deep work widgets with customizable Pomodoro countdowns, ambient visual pulses, sound toggles, and total page immersion.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" className="mx-auto max-w-4xl px-6 py-20">
        <div className="text-center mb-12">
          <span className="font-display text-xs font-semibold tracking-wider uppercase text-indigo-400">Curious Minds</span>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-white mt-2">Frequently Asked Questions</h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div 
              key={idx} 
              className="rounded-xl border border-white/5 bg-zinc-900/30 overflow-hidden"
            >
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="flex w-full items-center justify-between p-5 text-left text-sm font-semibold text-white outline-none hover:bg-white/5"
              >
                <span>{faq.q}</span>
                <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform duration-300 ${openFaq === idx ? 'rotate-180 text-indigo-400' : ''}`} />
              </button>

              <AnimatePresence initial={false}>
                {openFaq === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <p className="px-5 pb-5 text-xs text-zinc-400 leading-relaxed border-t border-white/5 pt-3">
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 bg-[#060608]">
        <div className="mx-auto max-w-7xl px-6 py-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="font-display text-sm font-bold tracking-tight text-white">StickyBoard</span>
          </div>

          <p className="text-xs text-zinc-500 font-mono">
            © 2026 StickyBoard Inc. Designed for elegant daily planners.
          </p>

          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <a href="#" className="hover:text-zinc-300">Privacy</a>
            <a href="#" className="hover:text-zinc-300">Terms of Use</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
