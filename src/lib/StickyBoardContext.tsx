import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Todo, UserPreferences, DashboardStats, Priority } from '../types';

interface StickyBoardContextType {
  user: User | null;
  todos: Todo[];
  currentDateStr: string;
  activeTab: 'board' | 'calendar' | 'analytics' | 'focus' | 'settings';
  isLoading: boolean;
  stats: DashboardStats | null;
  isDemo: boolean;
  
  // Navigation
  setCurrentDateStr: (date: string) => void;
  setActiveTab: (tab: 'board' | 'calendar' | 'analytics' | 'focus' | 'settings') => void;
  
  // Auth
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  loginWithOAuthToken: (token: string) => void;
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
    subtasks?: { title: string; isCompleted: boolean }[];
  }) => Promise<boolean>;
  updateTodo: (id: string, updates: Partial<Todo>) => Promise<boolean>;
  deleteTodo: (id: string) => Promise<boolean>;
  duplicateTodo: (id: string) => Promise<boolean>;
  reorderTodos: (orderedIds: string[]) => Promise<boolean>;
  
  // AI Actions
  parseAIQuery: (query: string) => Promise<{
    success: boolean;
    todo?: any;
    error?: string;
  }>;
  getAIBriefing: (type: 'morning' | 'evening') => Promise<string>;
  
  // Demo Mode Helpers
  startDemo: () => void;
}

const StickyBoardContext = createContext<StickyBoardContextType | undefined>(undefined);

// Audio Synthesis for physical satisfying interaction sounds
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
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
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
    console.warn("Audio Context blocked or failed:", err);
  }
};

export const StickyBoardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [currentDateStr, setCurrentDateStr] = useState<string>(new Date().toISOString().split("T")[0]);
  const [activeTab, setActiveTab] = useState<'board' | 'calendar' | 'analytics' | 'focus' | 'settings'>('board');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isDemo, setIsDemo] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(localStorage.getItem('stickyboard_token'));

  // Default demo data
  const loadDemoData = () => {
    setIsDemo(true);
    setUser({
      id: 'demo-user',
      email: 'demo@stickyboard.co',
      name: 'Guest Planner',
      createdAt: new Date().toISOString(),
      preferences: {
        theme: 'dark',
        accentColor: '#f43f5e',
        handwritingFont: true,
        soundEnabled: true,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        startOfWeek: 1,
        defaultPriority: 'medium',
        stickyColorMode: 'auto'
      }
    });

    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    
    const demoTodos: Todo[] = [
      {
        id: 'demo-1',
        userId: 'demo-user',
        title: 'Organize dynamic sticky notes by priority 🏷️',
        description: 'Drag, click, edit, and filter notes with standard smooth spring physics.',
        isCompleted: false,
        dateStr: today,
        priority: 'high',
        category: 'Personal',
        noteColor: 'orange',
        subtasks: [
          { id: 'ds-1', title: 'Hover note for shortcut tools', isCompleted: true },
          { id: 'ds-2', title: 'Double-click note to edit', isCompleted: false }
        ],
        isPinned: true,
        isFavorite: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'demo-2',
        userId: 'demo-user',
        title: 'Check this todo to trigger physical pin and confetti animations 📌',
        description: 'Click the checkbox: the push pin pops out, paper wiggles and falls off, and micro-confetti triggers!',
        isCompleted: false,
        dateStr: today,
        priority: 'critical',
        category: 'Work',
        noteColor: 'pink',
        subtasks: [],
        isPinned: false,
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'demo-3',
        userId: 'demo-user',
        title: 'Try Focus Mode with the Pomodoro Timer ⏱️',
        description: 'Tap "Focus" in the sidebar to enter distraction-free mode with an integrated timer and relaxing sounds.',
        isCompleted: false,
        dateStr: today,
        priority: 'medium',
        category: 'Personal',
        noteColor: 'yellow',
        subtasks: [],
        isPinned: false,
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'demo-4',
        userId: 'demo-user',
        title: 'Review the weekly summary in the Calendar 📅',
        description: 'Every date shows task densities. Previous dates remain frozen in time, preserving history.',
        isCompleted: true,
        dateStr: today,
        priority: 'low',
        category: 'Health',
        noteColor: 'green',
        subtasks: [],
        isPinned: false,
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    setTodos(demoTodos);
    setIsLoading(false);
  };

  const startDemo = () => {
    loadDemoData();
  };

  // Check login session on load
  useEffect(() => {
    const checkAuth = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const response = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          setIsDemo(false);
        } else {
          // Stale session
          localStorage.removeItem('stickyboard_token');
          setToken(null);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, [token]);

  // Fetch todos whenever viewed date or active user changes
  useEffect(() => {
    if (isDemo || !user) return;

    const fetchTodos = async () => {
      try {
        const res = await fetch(`/api/todos?dateStr=${currentDateStr}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setTodos(data.todos);
        }
      } catch (err) {
        console.error("Failed to fetch todos:", err);
      }
    };
    fetchTodos();
  }, [currentDateStr, user, token, isDemo]);

  // Fetch stats periodically
  const fetchStats = async () => {
    if (isDemo) {
      // Mock stats for demo
      const completed = todos.filter(t => t.isCompleted).length;
      const total = todos.length;
      setStats({
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        totalCompleted: completed,
        totalPending: total - completed,
        streak: { currentStreak: 3, longestStreak: 7, lastCompletedDate: currentDateStr },
        categoryDistribution: [
          { name: 'Personal', value: 2, color: '#f43f5e' },
          { name: 'Work', value: 1, color: '#3b82f6' },
          { name: 'Health', value: 1, color: '#10b981' }
        ],
        weeklyActivity: [
          { day: 'Mon', completed: 3, pending: 1 },
          { day: 'Tue', completed: 4, pending: 0 },
          { day: 'Wed', completed: completed, pending: total - completed },
          { day: 'Thu', completed: 0, pending: 0 },
          { day: 'Fri', completed: 0, pending: 0 },
          { day: 'Sat', completed: 0, pending: 0 },
          { day: 'Sun', completed: 0, pending: 0 }
        ],
        heatmap: { [currentDateStr]: completed }
      });
      return;
    }

    if (!user || !token) return;

    try {
      const res = await fetch('/api/analytics/summary', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user, todos, isDemo]);

  // Auth: Login
  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('stickyboard_token', data.token);
        setToken(data.token);
        setUser(data.user);
        setIsDemo(false);
        setIsLoading(false);
        return true;
      }
    } catch (err) {
      console.error("Login failed:", err);
    }
    setIsLoading(false);
    return false;
  };

  // Auth: Register
  const register = async (email: string, password: string, name: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('stickyboard_token', data.token);
        setToken(data.token);
        setUser(data.user);
        setIsDemo(false);
        setIsLoading(false);
        return true;
      }
    } catch (err) {
      console.error("Registration failed:", err);
    }
    setIsLoading(false);
    return false;
  };

  // Auth: Google / OAuth login token assignment
  const loginWithOAuthToken = (newToken: string) => {
    localStorage.setItem('stickyboard_token', newToken);
    setToken(newToken);
    setIsDemo(false);
  };

  // Auth: Logout
  const logout = () => {
    localStorage.removeItem('stickyboard_token');
    setToken(null);
    setUser(null);
    setTodos([]);
    setIsDemo(false);
    setActiveTab('board');
  };

  // Preferences Update
  const updatePreferences = async (prefs: Partial<UserPreferences>): Promise<boolean> => {
    if (isDemo) {
      setUser(prev => prev ? {
        ...prev,
        preferences: { ...prev.preferences, ...prefs }
      } : null);
      return true;
    }

    try {
      const res = await fetch('/api/auth/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(prefs)
      });
      if (res.ok) {
        const data = await res.json();
        setUser(prev => prev ? { ...prev, preferences: data.preferences } : null);
        return true;
      }
    } catch (err) {
      console.error("Failed to update preferences:", err);
    }
    return false;
  };

  // CRUD: Add Todo
  const addTodo = async (todoDraft: any): Promise<boolean> => {
    const playEffect = user?.preferences?.soundEnabled ?? true;

    if (isDemo) {
      const newTodo: Todo = {
        id: `demo-${Date.now()}`,
        userId: 'demo-user',
        title: todoDraft.title,
        description: todoDraft.description || '',
        isCompleted: false,
        dateStr: currentDateStr,
        priority: todoDraft.priority || 'medium',
        category: todoDraft.category || 'Personal',
        noteColor: todoDraft.noteColor || 'yellow',
        subtasks: (todoDraft.subtasks || []).map((s: any, idx: number) => ({
          id: `demo-sub-${Date.now()}-${idx}`,
          title: s.title,
          isCompleted: false
        })),
        dueTime: todoDraft.dueTime || undefined,
        estimatedMinutes: todoDraft.estimatedMinutes || undefined,
        isPinned: false,
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      if (playEffect) playSound('pop');
      setTodos(prev => [...prev, newTodo]);
      return true;
    }

    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...todoDraft, dateStr: currentDateStr })
      });
      if (res.ok) {
        const data = await res.json();
        if (playEffect) playSound('pop');
        setTodos(prev => [...prev, data.todo]);
        return true;
      }
    } catch (err) {
      console.error("Failed to add todo:", err);
    }
    return false;
  };

  // CRUD: Update Todo (with optimistic state updates)
  const updateTodo = async (id: string, updates: Partial<Todo>): Promise<boolean> => {
    const playEffect = user?.preferences?.soundEnabled ?? true;
    
    // Play sounds for check status
    if (updates.isCompleted === true && playEffect) {
      playSound('check');
      setTimeout(() => playSound('success'), 400);
    }

    // Optimistic Update
    const originalTodos = [...todos];
    setTodos(prev => prev.map(t => t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t));

    if (isDemo) {
      return true;
    }

    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      if (!res.ok) {
        // Rollback on failure
        setTodos(originalTodos);
        return false;
      }
      return true;
    } catch (err) {
      console.error("Failed to update todo:", err);
      setTodos(originalTodos);
      return false;
    }
  };

  // CRUD: Delete Todo (optimistic)
  const deleteTodo = async (id: string): Promise<boolean> => {
    const playEffect = user?.preferences?.soundEnabled ?? true;
    if (playEffect) playSound('crumple');

    const originalTodos = [...todos];
    setTodos(prev => prev.filter(t => t.id !== id));

    if (isDemo) {
      return true;
    }

    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        setTodos(originalTodos);
        return false;
      }
      return true;
    } catch (err) {
      console.error("Failed to delete todo:", err);
      setTodos(originalTodos);
      return false;
    }
  };

  // CRUD: Duplicate Todo
  const duplicateTodo = async (id: string): Promise<boolean> => {
    if (isDemo) {
      const item = todos.find(t => t.id === id);
      if (item) {
        const copy: Todo = {
          ...item,
          id: `demo-${Date.now()}`,
          title: `${item.title} (Copy)`,
          isCompleted: false,
          subtasks: item.subtasks.map(s => ({ ...s, id: `demo-sub-${Date.now()}-${Math.random()}`, isCompleted: false })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setTodos(prev => [...prev, copy]);
        if (user?.preferences?.soundEnabled) playSound('pop');
        return true;
      }
      return false;
    }

    try {
      const res = await fetch(`/api/todos/${id}/duplicate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTodos(prev => [...prev, data.todo]);
        if (user?.preferences?.soundEnabled) playSound('pop');
        return true;
      }
    } catch (err) {
      console.error("Failed to duplicate todo:", err);
    }
    return false;
  };

  const reorderTodos = async (orderedIds: string[]): Promise<boolean> => {
    const originalTodos = [...todos];

    // Sort todos optimistically
    const todoMap = new Map<string, Todo>(todos.map(t => [t.id, t]));
    const reordered: Todo[] = [];
    orderedIds.forEach(id => {
      const todo = todoMap.get(id);
      if (todo) {
        reordered.push(todo);
        todoMap.delete(id);
      }
    });
    todoMap.forEach(todo => {
      reordered.push(todo);
    });

    setTodos(reordered);

    if (isDemo) {
      return true;
    }

    try {
      const res = await fetch('/api/todos/reorder', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ orderedIds })
      });
      if (!res.ok) {
        setTodos(originalTodos);
        return false;
      }
      return true;
    } catch (err) {
      console.error("Failed to reorder todos:", err);
      setTodos(originalTodos);
      return false;
    }
  };

  // AI Action: Natural Language Parse
  const parseAIQuery = async (query: string): Promise<any> => {
    if (isDemo) {
      // Simulated mock parser if offline or demo
      return {
        success: true,
        todo: {
          title: query.replace(/(tomorrow|asap|today|priority high|priority critical|work|personal|at \d+\w+)/gi, '').trim() || 'AI Parsed Task',
          priority: query.toLowerCase().includes('critical') ? 'critical' : query.toLowerCase().includes('high') ? 'high' : 'medium',
          category: query.toLowerCase().includes('work') ? 'Work' : 'Personal',
          dueTime: '12:00',
          dateOffset: query.toLowerCase().includes('tomorrow') ? 1 : 0
        }
      };
    }

    try {
      const res = await fetch('/api/gemini/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt: query, timezone: user?.preferences?.timezone })
      });
      if (res.ok) {
        const data = await res.json();
        return { success: true, todo: data.result };
      } else {
        const err = await res.json();
        return { success: false, error: err.error || "Failed to parse via AI" };
      }
    } catch (err: any) {
      console.error("AI parse failed:", err);
      return { success: false, error: err.message || "Network error while parsing" };
    }
  };

  // AI Action: Daily Coaching Briefing
  const getAIBriefing = async (type: 'morning' | 'evening'): Promise<string> => {
    if (isDemo) {
      return type === 'morning' 
        ? "🌅 Welcome back to StickyBoard! Today you have several key sticky notes on the corkboard, including pinning your high-priority items. Start by popping off that critical pin!" 
        : "🌙 Incredible evening review! You completed a task and stayed focused. Ready for a clean board tomorrow at midnight.";
    }

    try {
      const res = await fetch('/api/gemini/briefing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ dateStr: currentDateStr, type })
      });
      if (res.ok) {
        const data = await res.json();
        return data.briefing;
      }
    } catch (err) {
      console.error("Briefing failed:", err);
    }
    return "☀️ Conquering your day, one note at a time!";
  };

  return (
    <StickyBoardContext.Provider value={{
      user,
      todos,
      currentDateStr,
      activeTab,
      isLoading,
      stats,
      isDemo,
      setCurrentDateStr,
      setActiveTab,
      login,
      register,
      loginWithOAuthToken,
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
    }}>
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
