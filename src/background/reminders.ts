/**
 * The reminder check, run by the background on start, on the `reminders` alarm
 * and when notes or settings change. One alarm is kept, for the next reminder.
 */
import { formatTime, resolveTz, zonedToEpoch } from '../shared/dates';
import { boardNotes } from '../shared/pageNotes';
import { notes, settings } from '../shared/storage';
import type { Note } from '../shared/types';

export const REMINDER_ALARM = 'reminders';
const MINUTE = 60_000;
const DUE_WINDOW = 2 * MINUTE;
const MISSED_WINDOW = 7 * 24 * 60 * MINUTE;

const isReminder = (n: Note) => n.remind && !!n.dueTime && !n.isCompleted && !n.deletedAt && !n.remindedAt;

export const runReminderCheck = (): Promise<void> =>
  navigator.locks.request('reminder-check', async () => {
    const [all, s] = await Promise.all([notes.getAll(), settings.get()]);
    const tz = resolveTz(s.timezone);
    const now = Date.now();
    const missed: Note[] = [];
    const dueNow: Note[] = [];
    let nextDue = Infinity;

    for (const n of boardNotes(all)) {
      if (!isReminder(n)) continue;
      const due = zonedToEpoch(n.dateStr, n.dueTime!, tz);
      if (due > now) nextDue = Math.min(nextDue, due);
      else if (due >= now - DUE_WINDOW) dueNow.push(n);
      else if (due >= now - MISSED_WINDOW) missed.push(n);
    }

    // Mark them reminded BEFORE notifying, so a second run can't announce them again.
    const stamp = new Date(now).toISOString();
    for (const n of [...missed, ...dueNow]) {
      try {
        await notes.patch(n.id, { remindedAt: stamp });
      } catch {
        // The note was removed meanwhile; nothing to announce.
      }
    }

    for (const n of dueNow) {
      chrome.notifications.create(`remind:${n.id}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon/128.png'),
        title: 'Sticky Board',
        message: n.title,
        contextMessage: `Due ${formatTime(n.dueTime!)}`,
        requireInteraction: true,
      });
    }

    if (missed.length) {
      const titles = missed.slice(0, 3).map(n => n.title).join(' · ');
      chrome.notifications.create('missed', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon/128.png'),
        title: `You missed ${missed.length} ${missed.length === 1 ? 'reminder' : 'reminders'}`,
        message: missed.length > 3 ? `${titles} and ${missed.length - 3} more` : titles,
        requireInteraction: true,
      });
    }

    if (Number.isFinite(nextDue)) await chrome.alarms.create(REMINDER_ALARM, { when: nextDue });
    else await chrome.alarms.clear(REMINDER_ALARM);
  });
