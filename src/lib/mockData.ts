/**
 * Dummy data used while the backend is under development.
 *
 * TODO(backend): once the Express API is live, this module is only needed
 * for the guest demo flow — signed-in users will get their data from the API.
 * See STICKY_BOARD_REVIEW.md for the full API contract.
 */
import { Todo, User, UserPreferences } from '../types';
import { todayStr, offsetDateStr } from './dates';

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  accentColor: '#f43f5e',
  handwritingFont: true,
  soundEnabled: true,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  startOfWeek: 1,
  defaultPriority: 'medium',
  stickyColorMode: 'auto'
};

export const createMockUser = (email: string, name: string): User => ({
  id: 'local-user',
  email,
  name,
  createdAt: new Date().toISOString(),
  preferences: { ...DEFAULT_PREFERENCES }
});

let seq = 0;
export const mockId = (): string => `local-${Date.now()}-${++seq}`;

const note = (partial: Partial<Todo> & Pick<Todo, 'title' | 'dateStr'>): Todo => ({
  id: mockId(),
  userId: 'local-user',
  description: '',
  isCompleted: false,
  priority: 'medium',
  category: 'Personal',
  noteColor: 'yellow',
  subtasks: [],
  isPinned: false,
  isFavorite: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...partial
});

export const createMockTodos = (): Todo[] => {
  const today = todayStr();
  const yesterday = offsetDateStr(today, -1);
  const tomorrow = offsetDateStr(today, 1);

  return [
    note({
      title: 'Welcome to StickyBoard! Double-click me to edit ✏️',
      description: 'You can set subtasks, select priorities, and customize colors.',
      dateStr: today,
      priority: 'high',
      noteColor: 'yellow',
      isPinned: true,
      subtasks: [
        { id: mockId(), title: 'Try checking a subtask', isCompleted: true },
        { id: mockId(), title: 'Change note color', isCompleted: false }
      ]
    }),
    note({
      title: 'Complete this task to see push-pin animations 🎉',
      description: 'When completed, the pin pops, the paper peels, and confetti bursts!',
      dateStr: today,
      priority: 'critical',
      category: 'Urgent',
      noteColor: 'pink',
      isFavorite: true
    }),
    note({
      title: 'Try Focus Mode with the Pomodoro timer ⏱️',
      description: 'Tap "Focus" in the sidebar for a distraction-free timer with ambient sound.',
      dateStr: today,
      category: 'Work',
      noteColor: 'blue',
      dueTime: '15:00'
    }),
    note({
      title: 'Morning run before standup 🏃',
      dateStr: today,
      priority: 'low',
      category: 'Health',
      noteColor: 'green',
      isCompleted: true
    }),
    note({
      title: 'Review the weekly summary in the Calendar 📅',
      description: 'Past days stay frozen in time — browse them from the Calendar tab.',
      dateStr: yesterday,
      category: 'Work',
      noteColor: 'mint',
      isCompleted: true
    }),
    note({
      title: 'Pay electricity bill 💡',
      dateStr: tomorrow,
      priority: 'high',
      category: 'Finance',
      noteColor: 'orange',
      dueTime: '09:00'
    })
  ];
};