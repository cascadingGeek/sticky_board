import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { User, Todo, UserPreferences, DashboardStats, Priority } from '../types';
import { createMockUser, createMockTodos, mockId } from './mockData';
import { todayStr, offsetDateStr, toDateStr } from './dates';

/**
 * StickyBoard global store.
 *
 * BACKEND STATUS: the Express API has been removed from this repo — every
 * action below currently mutates local dummy state (persisted to
 * localStorage so the presentation survives refreshes). Each mutation is
 * marked with a `TODO(backend)` comment naming the endpoint to call once
 * the Node/Express backend exists. The full API contract lives in
 * STICKY_BOARD_REVIEW.md — keep these function signatures unchanged so
 * re-integration only touches this file.
 */

interface StickyBoardContextType {
  user: User | null;
  todos: Todo[]; // todos for the currently viewed date
  allTodos: Todo[]; // every todo across all dates (used by Calendar densities)
  currentDateStr: string;
  activeTab: 'board' | 'calendar' | 'analytics' | 'focus' | 'settings';
  isLoading: boolean;
  stats: DashboardStats | null;

  // Navigation
  setCurrentDateStr: (date: string) => void;
  setActiveTab: (tab: 'board' | 'calendar' | 'analytics' | 'focus' | 'settings') => void;

  // Auth
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  loginWithOAuth: (provider: 'google' | 'github') => Promise<boolean>;
  logout: () => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<boolean>;

  // CRUD Actions
  addTodo: (todo: {
    title: string;
    description?: string;
    priority?: Priority;
    category?: string;
    dueTime?: string;
    noteColor?: string;
    estimatedMinutes?: number;
    dateStr?: string;
    subtasks?: { title: string; isCompleted: boolean }[];
  }) => Promise<boolean>;
  updateTodo: (id: string, updates: Partial<Todo>) => Promise<boolean>;
  deleteTodo: (id: string) => Promise<boolean>;
  duplicateTodo: (id: string) => Promise<boolean>;
  reorderTodos: (orderedIds: string[]) => Promise<boolean>;

  // AI Actions
  parseAIQuery: (query: string) => Promise<{
    success: boolean;
    todo?: {
      title: string;
      description?: string;
      priority: Priority;
      category: string;
      dueTime?: string;
      estimatedMinutes?: number;
      dateOffset: number;
    };
    error?: string;
  }>;
  getAIBriefing: (type: 'morning' | 'evening') => Promise<string>;

  // Demo Mode Helpers
  startDemo: () => void;
}

const StickyBoardContext = createContext<StickyBoardContextType | undefined>(undefined);

const STORAGE_USER = 'stickyboard_user';
const STORAGE_TODOS = 'stickyboard_todos';
// TODO(backend): restore `stickyboard_token` storage — persist the Bearer
// token returned by POST /api/auth/login|register and bootstrap the session
// with GET /api/auth/me on mount.

const COLOR_PRESETS = ['yellow', 'blue', 'green', 'pink', 'purple', 'orange', 'mint', 'cream'];

const colorForPriority = (priority: Priority): string => {
  if (priority === 'critical') return 'pink';
  if (priority === 'high') return 'orange';
  if (priority === 'medium') return 'yellow';
  return 'green';
};

// Audio synthesis for physical, satisfying interaction sounds
const playSound = (type: 'check' | 'pop' | 'crumple' | 'success') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'check') {
      // Crisp satisfying chime click
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else if (type === 'pop') {
      // Push pin pop sound
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'crumple') {
      // White noise brush for paper crumpling
      const bufferSize = ctx.sampleRate * 0.2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1000;

      noise.connect(filter);
      filter.connect(gain);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

      noise.start();
      noise.stop(ctx.currentTime + 0.2);
    } else if (type === 'success') {
      // Arpeggio chime chord
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = freq;
        o.connect(g);
        g.connect(ctx.destination);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.06, now + idx * 0.04 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.25);
        o.start(now + idx * 0.04);
        o.stop(now + idx * 0.04 + 0.35);
      });
    }
  } catch (err) {
    console.warn('Audio Context blocked or failed:', err);
  }
};

export const StickyBoardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [allTodos, setAllTodos] = useState<Todo[]>([]);
  const [currentDateStr, setCurrentDateStr] = useState<string>(todayStr());
  const [activeTab, setActiveTab] = useState<'board' | 'calendar' | 'analytics' | 'focus' | 'settings'>('board');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore the local session on load.
  // TODO(backend): replace with GET /api/auth/me using the stored Bearer token.
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(STORAGE_USER);
      const storedTodos = localStorage.getItem(STORAGE_TODOS);
      if (storedUser) {
        setUser(JSON.parse(storedUser));
        setAllTodos(storedTodos ? JSON.parse(storedTodos) : createMockTodos());
      }
    } catch (err) {
      console.warn('Failed to restore local session:', err);
      localStorage.removeItem(STORAGE_USER);
      localStorage.removeItem(STORAGE_TODOS);
    }
    setIsLoading(false);
  }, []);

  // Persist dummy data so the presentation survives refreshes.
  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem(STORAGE_USER, JSON.stringify(user));
      localStorage.setItem(STORAGE_TODOS, JSON.stringify(allTodos));
    } catch (err) {
      console.warn('Failed to persist local session:', err);
    }
  }, [user, allTodos]);

  // Todos for the currently viewed date.
  // TODO(backend): replace with GET /api/todos?dateStr=<currentDateStr>.
  const todos = useMemo(
    () => allTodos.filter(t => t.dateStr === currentDateStr),
    [allTodos, currentDateStr]
  );

  // Dashboard stats computed locally from the dummy data.
  // TODO(backend): replace with GET /api/analytics/summary.
  const stats = useMemo<DashboardStats | null>(() => {
    if (!user) return null;

    const completed = allTodos.filter(t => t.isCompleted);
    const total = allTodos.length;

    // Heatmap: completed count per day
    const heatmap: Record<string, number> = {};
    completed.forEach(t => {
      heatmap[t.dateStr] = (heatmap[t.dateStr] || 0) + 1;
    });

    // Streak: consecutive days (ending today or yesterday) with >= 1 completion
    const today = todayStr();
    let currentStreak = 0;
    let cursor = heatmap[today] ? today : offsetDateStr(today, -1);
    while (heatmap[cursor]) {
      currentStreak += 1;
      cursor = offsetDateStr(cursor, -1);
    }

    let longestStreak = 0;
    Object.keys(heatmap).forEach(dateStr => {
      if (heatmap[offsetDateStr(dateStr, -1)]) return; // not a streak start
      let length = 0;
      let day = dateStr;
      while (heatmap[day]) {
        length += 1;
        day = offsetDateStr(day, 1);
      }
      longestStreak = Math.max(longestStreak, length);
    });

    // Category distribution with display colors
    const categoryColor = (name: string) => {
      if (name === 'Work') return '#3b82f6';
      if (name === 'Urgent' || name === 'Critical') return '#ef4444';
      if (name === 'Finance') return '#f59e0b';
      if (name === 'Health') return '#ec4899';
      return '#10b981';
    };
    const categories: Record<string, number> = {};
    allTodos.forEach(t => {
      const cat = t.category || 'Personal';
      categories[cat] = (categories[cat] || 0) + 1;
    });
    const categoryDistribution = Object.entries(categories).map(([name, value]) => ({
      name,
      value,
      color: categoryColor(name)
    }));

    // Weekly activity for the current week (Sun..Sat)
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyActivity = daysOfWeek.map((day, offset) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + offset);
      const dateStr = toDateStr(date);
      const dayTodos = allTodos.filter(t => t.dateStr === dateStr);
      return {
        day,
        completed: dayTodos.filter(t => t.isCompleted).length,
        pending: dayTodos.filter(t => !t.isCompleted).length
      };
    });

    return {
      completionRate: total > 0 ? Math.round((completed.length / total) * 100) : 0,
      totalCompleted: completed.length,
      totalPending: total - completed.length,
      streak: {
        currentStreak,
        longestStreak: Math.max(longestStreak, currentStreak),
        lastCompletedDate: completed.length > 0 ? completed[completed.length - 1].dateStr : undefined
      },
      categoryDistribution,
      weeklyActivity,
      heatmap
    };
  }, [user, allTodos]);

  const signInLocally = (email: string, name: string) => {
    setUser(createMockUser(email, name));
    setAllTodos(createMockTodos());
  };

  // Auth: Login
  // TODO(backend): POST /api/auth/login { email, password } -> { token, user }
  const login = async (email: string, _password: string): Promise<boolean> => {
    signInLocally(email, email.split('@')[0] || 'Planner');
    return true;
  };

  // Auth: Register
  // TODO(backend): POST /api/auth/register { email, password, name } -> { token, user }
  const register = async (email: string, _password: string, name: string): Promise<boolean> => {
    signInLocally(email, name);
    return true;
  };

  // Auth: OAuth sign-in
  // TODO(backend): GET /api/auth/<provider>/url -> open popup -> receive token
  // via postMessage -> GET /api/auth/me. See STICKY_BOARD_REVIEW.md §4.2.
  const loginWithOAuth = async (provider: 'google' | 'github'): Promise<boolean> => {
    signInLocally(`guest@${provider}.demo`, provider === 'google' ? 'Google Guest' : 'GitHub Guest');
    return true;
  };

  // Auth: Logout
  const logout = () => {
    localStorage.removeItem(STORAGE_USER);
    localStorage.removeItem(STORAGE_TODOS);
    setUser(null);
    setAllTodos([]);
    setActiveTab('board');
  };

  // Preferences Update
  // TODO(backend): PUT /api/auth/preferences (partial) -> { preferences }
  const updatePreferences = async (prefs: Partial<UserPreferences>): Promise<boolean> => {
    setUser(prev => (prev ? { ...prev, preferences: { ...prev.preferences, ...prefs } } : null));
    return true;
  };

  // CRUD: Add Todo
  // TODO(backend): POST /api/todos -> 201 { todo }
  const addTodo: StickyBoardContextType['addTodo'] = async (draft) => {
    if (!user) return false;

    const priority = draft.priority || 'medium';
    const noteColor =
      draft.noteColor && COLOR_PRESETS.includes(draft.noteColor)
        ? draft.noteColor
        : colorForPriority(priority);

    const newTodo: Todo = {
      id: mockId(),
      userId: user.id,
      title: draft.title,
      description: draft.description || '',
      isCompleted: false,
      dateStr: draft.dateStr || currentDateStr,
      priority,
      category: draft.category || 'Personal',
      noteColor,
      subtasks: (draft.subtasks || []).map(s => ({
        id: mockId(),
        title: s.title,
        isCompleted: !!s.isCompleted
      })),
      dueTime: draft.dueTime || undefined,
      estimatedMinutes: draft.estimatedMinutes || undefined,
      isPinned: false,
      isFavorite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (user.preferences.soundEnabled) playSound('pop');
    setAllTodos(prev => [...prev, newTodo]);
    return true;
  };

  // CRUD: Update Todo (keep the optimistic-update pattern for the backend swap)
  // TODO(backend): PUT /api/todos/:id -> { todo }; roll back local state on failure.
  const updateTodo = async (id: string, updates: Partial<Todo>): Promise<boolean> => {
    if (updates.isCompleted === true && (user?.preferences.soundEnabled ?? true)) {
      playSound('check');
      setTimeout(() => playSound('success'), 400);
    }
    setAllTodos(prev =>
      prev.map(t => (t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t))
    );
    return true;
  };

  // CRUD: Delete Todo
  // TODO(backend): DELETE /api/todos/:id; roll back local state on failure.
  const deleteTodo = async (id: string): Promise<boolean> => {
    if (user?.preferences.soundEnabled ?? true) playSound('crumple');
    setAllTodos(prev => prev.filter(t => t.id !== id));
    return true;
  };

  // CRUD: Duplicate Todo
  // TODO(backend): POST /api/todos/:id/duplicate -> 201 { todo }
  const duplicateTodo = async (id: string): Promise<boolean> => {
    const item = allTodos.find(t => t.id === id);
    if (!item) return false;

    const copy: Todo = {
      ...item,
      id: mockId(),
      title: `${item.title} (Copy)`,
      isCompleted: false,
      subtasks: item.subtasks.map(s => ({ ...s, id: mockId(), isCompleted: false })),
      // Offset the copy so it doesn't stack exactly on the original in freeform mode
      positionX: item.positionX !== undefined ? item.positionX + 24 : undefined,
      positionY: item.positionY !== undefined ? item.positionY + 24 : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (user?.preferences.soundEnabled) playSound('pop');
    setAllTodos(prev => [...prev, copy]);
    return true;
  };

  // CRUD: Reorder Todos (grid mode drag & drop)
  // TODO(backend): PUT /api/todos/reorder { orderedIds }; roll back on failure.
  const reorderTodos = async (orderedIds: string[]): Promise<boolean> => {
    setAllTodos(prev => {
      const map = new Map(prev.map(t => [t.id, t]));
      const reordered: Todo[] = [];
      orderedIds.forEach(id => {
        const todo = map.get(id);
        if (todo) {
          reordered.push(todo);
          map.delete(id);
        }
      });
      map.forEach(todo => reordered.push(todo));
      return reordered;
    });
    return true;
  };

  // AI: Natural language -> structured todo.
  // TODO(backend): POST /api/gemini/parse { prompt, timezone } -> { result }.
  // The keyword heuristic below is a dummy stand-in for Gemini.
  const parseAIQuery: StickyBoardContextType['parseAIQuery'] = async (query) => {
    const q = query.toLowerCase();
    const priority: Priority = q.includes('critical') || q.includes('asap')
      ? 'critical'
      : q.includes('high')
        ? 'high'
        : q.includes('low')
          ? 'low'
          : 'medium';
    const category = q.includes('work') ? 'Work'
      : q.includes('health') || q.includes('gym') ? 'Health'
      : q.includes('finance') || q.includes('bill') || q.includes('budget') ? 'Finance'
      : q.includes('urgent') ? 'Urgent'
      : 'Personal';

    const timeMatch = q.match(/at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    let dueTime: string | undefined;
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const mins = timeMatch[2] || '00';
      if (timeMatch[3] === 'pm' && hours < 12) hours += 12;
      if (timeMatch[3] === 'am' && hours === 12) hours = 0;
      dueTime = `${String(hours).padStart(2, '0')}:${mins}`;
    }

    const title = query
      .replace(/\b(tomorrow|today|asap|urgent|critical|high|medium|low)( priority)?\b/gi, '')
      .replace(/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim() || 'New task';

    return {
      success: true,
      todo: {
        title: title.charAt(0).toUpperCase() + title.slice(1),
        priority,
        category,
        dueTime,
        dateOffset: q.includes('tomorrow') ? 1 : 0
      }
    };
  };

  // AI: Daily coaching briefing.
  // TODO(backend): POST /api/gemini/briefing { dateStr, type } -> { briefing }.
  const getAIBriefing = async (type: 'morning' | 'evening'): Promise<string> => {
    const pending = todos.filter(t => !t.isCompleted);
    const done = todos.filter(t => t.isCompleted);
    if (type === 'evening') {
      return `🌙 Lovely evening review! You completed ${done.length} of ${todos.length} notes today${done.length ? ' — well earned rest ahead' : ''}. Tomorrow brings a clean board at midnight.`;
    }
    if (pending.length === 0) {
      return '🌅 Your corkboard is clear! Pin a note or two and make today intentional.';
    }
    const top = pending[0];
    return `☀️ Good morning! You have ${pending.length} note${pending.length > 1 ? 's' : ''} pinned today. Start with "${top.title}" — popping that first pin builds momentum for everything else. ✨`;
  };

  // Guest demo mode (stays client-side even after the backend exists)
  const startDemo = () => {
    signInLocally('demo@stickyboard.co', 'Guest Planner');
  };

  return (
    <StickyBoardContext.Provider
      value={{
        user,
        todos,
        allTodos,
        currentDateStr,
        activeTab,
        isLoading,
        stats,
        setCurrentDateStr,
        setActiveTab,
        login,
        register,
        loginWithOAuth,
        logout,
        updatePreferences,
        addTodo,
        updateTodo,
        deleteTodo,
        duplicateTodo,
        reorderTodos,
        parseAIQuery,
        getAIBriefing,
        startDemo
      }}
    >
      {children}
    </StickyBoardContext.Provider>
  );
};

export const useStickyBoard = () => {
  const context = useContext(StickyBoardContext);
  if (!context) {
    throw new Error('useStickyBoard must be used within a StickyBoardProvider');
  }
  return context;
};