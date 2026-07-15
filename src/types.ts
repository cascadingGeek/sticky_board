/**
 * StickyBoard - Global TypeScript Type Definitions
 */

export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface Subtask {
  id: string;
  title: string;
  isCompleted: boolean;
}

export interface UserPreferences {
  theme: 'dark' | 'light';
  accentColor: string; // Tailwind color class or hex, e.g. '#3b82f6'
  handwritingFont: boolean; // toggle handwriting style for sticky note contents
  soundEnabled: boolean; // satisficing interface sounds
  timezone: string; // IANA Timezone, e.g. 'America/New_York'
  startOfWeek: 0 | 1; // 0 = Sunday, 1 = Monday
  defaultPriority: Priority;
  stickyColorMode: 'auto' | 'manual'; // Auto-assigns colors based on priority/category or manual selection
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  preferences: UserPreferences;
}

export interface Todo {
  id: string;
  userId: string;
  title: string;
  description: string;
  isCompleted: boolean;
  dateStr: string; // YYYY-MM-DD in the user's local timezone
  priority: Priority;
  category: string; // 'Work', 'Personal', 'Urgent', etc.
  noteColor: string; // Color preset: yellow, blue, green, pink, purple, orange, mint, cream
  subtasks: Subtask[];
  dueTime?: string; // HH:MM
  estimatedMinutes?: number;
  isPinned: boolean;
  isFavorite: boolean;
  positionX?: number;
  positionY?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: string; // 'create_todo', 'complete_todo', 'delete_todo', etc.
  details: string;
  createdAt: string;
}

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate?: string; // YYYY-MM-DD
}

export interface DashboardStats {
  completionRate: number; // percentage
  totalCompleted: number;
  totalPending: number;
  streak: StreakStats;
  categoryDistribution: { name: string; value: number; color: string }[];
  weeklyActivity: { day: string; completed: number; pending: number }[]; // Mon-Sun
  heatmap: Record<string, number>; // dateStr -> count
}
