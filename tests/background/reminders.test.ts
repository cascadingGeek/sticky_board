import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REMINDER_ALARM, runReminderCheck } from '@/background/reminders';
import { makeNote, seedNotes } from '../support/notes';
import type { Note } from '@/shared/types';

const NOW = '2026-11-08T12:00:30Z'; // 12:00 in UTC, the zone these tests use

type Shown = chrome.notifications.NotificationOptions & { id: string };
const shown = (): Shown[] =>
  (vi.mocked(chrome.notifications.create).mock.calls as unknown as [string, chrome.notifications.NotificationOptions][]).map(([id, opts]) => ({ id, ...opts }));
const readNote = async (id: string) => (await chrome.storage.local.get(`note:${id}`))[`note:${id}`] as Note;
const alarm = () => chrome.alarms.get(REMINDER_ALARM);

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  await chrome.storage.sync.set({ settings: { timezone: 'UTC' } });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('runReminderCheck', () => {
  it('shows a lasting notification for a reminder due now and marks it reminded', async () => {
    const n = makeNote({ title: 'Call the bank', dueTime: '12:00', remind: true });
    await seedNotes(n);

    await runReminderCheck();

    expect(shown()).toEqual([expect.objectContaining({ id: `remind:${n.id}`, message: 'Call the bank', contextMessage: 'Due 12:00 PM', requireInteraction: true })]);
    expect((await readNote(n.id)).remindedAt).toBe(new Date(NOW).toISOString());
  });

  it.each([
    ['completed', { isCompleted: true }],
    ['trashed', { deletedAt: '2026-11-08T11:00:00.000Z' }],
    ['Remind off', { remind: false }],
    ['without a due time', { dueTime: undefined }],
    ['already reminded', { remindedAt: '2026-11-08T11:59:00.000Z' }],
  ])('stays quiet for a note that is %s', async (_label, fields) => {
    await seedNotes(makeNote({ dueTime: '12:00', remind: true, ...fields }));
    await runReminderCheck();
    expect(shown()).toEqual([]);
  });

  it('announces a reminder only once, even if checked twice', async () => {
    await seedNotes(makeNote({ dueTime: '12:00', remind: true }));
    await runReminderCheck();
    await runReminderCheck();
    expect(shown()).toHaveLength(1);
  });

  it('sets one alarm for the earliest future reminder', async () => {
    await seedNotes(
      makeNote({ dueTime: '12:30', remind: true }),
      makeNote({ dueTime: '12:10', remind: true }),
      makeNote({ dueTime: '12:05', remind: false }),
    );
    await runReminderCheck();
    expect((await alarm())?.scheduledTime).toBe(Date.parse('2026-11-08T12:10:00Z'));
  });

  it('clears the alarm when nothing is left to remind', async () => {
    await chrome.alarms.create(REMINDER_ALARM, { when: Date.parse('2026-11-08T13:00:00Z') });
    await runReminderCheck();
    expect(await alarm()).toBeUndefined();
  });

  it('sums up reminders missed while the browser was closed in one notification', async () => {
    const missed = makeNote({ title: 'Standup', dueTime: '09:00', remind: true });
    await seedNotes(missed);

    await runReminderCheck();

    expect(shown()).toEqual([expect.objectContaining({ id: 'missed', title: 'You missed 1 reminder', message: 'Standup', requireInteraction: true })]);
    expect((await readNote(missed.id)).remindedAt).toBeDefined();
  });

  it('says nothing on the next start once the summary was shown', async () => {
    await seedNotes(makeNote({ dueTime: '09:00', remind: true }));
    await runReminderCheck();
    vi.mocked(chrome.notifications.create).mockClear();
    await runReminderCheck();
    expect(shown()).toEqual([]);
  });

  it('lists the first three titles and counts the rest', async () => {
    await seedNotes(...['A', 'B', 'C', 'D', 'E'].map(t => makeNote({ title: t, dueTime: '08:00', remind: true })));
    await runReminderCheck();
    const [summary] = shown();
    expect(summary).toMatchObject({ title: 'You missed 5 reminders' });
    expect(summary?.message).toMatch(/ and 2 more$/);
  });

  it('treats a reminder within the last 2 minutes as due, not missed', async () => {
    vi.setSystemTime(new Date('2026-11-08T12:01:59Z'));
    const n = makeNote({ dueTime: '12:00', remind: true });
    await seedNotes(n);
    await runReminderCheck();
    expect(shown().map(s => s.id)).toEqual([`remind:${n.id}`]);
  });

  it('forgets reminders older than a week', async () => {
    await seedNotes(makeNote({ dateStr: '2026-10-30', dueTime: '09:00', remind: true }));
    await runReminderCheck();
    expect(shown()).toEqual([]);
  });

  it('reads due times in the settings time zone', async () => {
    await chrome.storage.sync.set({ settings: { timezone: 'Africa/Lagos' } }); // UTC+1
    await seedNotes(makeNote({ dueTime: '13:30', remind: true }));
    await runReminderCheck();
    expect((await alarm())?.scheduledTime).toBe(Date.parse('2026-11-08T12:30:00Z'));
  });
});
