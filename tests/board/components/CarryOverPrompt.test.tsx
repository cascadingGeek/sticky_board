import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CarryOverPrompt } from '@/board/components/CarryOverPrompt';
import { makeNote, seedNotes, storedNotes } from '../../support/notes';
import type { Meta } from '@/shared/types';

const TODAY = '2026-11-08';
const YESTERDAY = '2026-11-07';

// The board context is the component's input; everything below it (storage, locks) is real.
const board = vi.hoisted(() => ({
  value: {} as { loaded: boolean; meta: { onboardedAt?: string }; today: string; currentDateStr: string; toast: () => void },
}));
vi.mock('@/board/StickyBoardContext', () => ({ useStickyBoard: () => board.value }));

const setBoard = (fields: Partial<typeof board.value> = {}) => {
  board.value = { loaded: true, meta: { onboardedAt: '2026-11-01T09:00:00.000Z' }, today: TODAY, currentDateStr: TODAY, toast: vi.fn(), ...fields };
};

const readMeta = async () => (await chrome.storage.local.get('meta')).meta as Meta;

const prompt = () => screen.findByRole('dialog', { name: /unfinished notes/ });

beforeEach(async () => {
  setBoard();
  await chrome.storage.local.set({ meta: { schemaVersion: 1, lastCarryOverPromptDate: '2026-11-01' } });
});

describe('CarryOverPrompt', () => {
  it('offers the unfinished notes from the last active day', async () => {
    await seedNotes(
      makeNote({ title: 'Unfinished', dateStr: YESTERDAY }),
      makeNote({ title: 'Done', dateStr: YESTERDAY, isCompleted: true }),
      makeNote({ title: 'Already carried', dateStr: YESTERDAY, carriedToDate: TODAY }),
      makeNote({ title: 'Older day', dateStr: '2026-11-05' }),
    );
    render(<CarryOverPrompt />);

    const dialog = await prompt();
    expect(dialog).toHaveTextContent('Unfinished');
    expect(dialog).not.toHaveTextContent('Done');
    expect(dialog).not.toHaveTextContent('Already carried');
    expect(dialog).not.toHaveTextContent('Older day');
    expect(screen.getByRole('checkbox', { name: /Unfinished/ })).toBeChecked();
  });

  it('copies the selected notes onto today and tags the originals', async () => {
    const keep = makeNote({ title: 'Carry me', dateStr: YESTERDAY, remindedAt: '2026-11-07T10:00:00.000Z' });
    const skip = makeNote({ title: 'Leave me', dateStr: YESTERDAY });
    await seedNotes(keep, skip);
    const user = userEvent.setup();
    render(<CarryOverPrompt />);
    await prompt();

    await user.click(screen.getByRole('checkbox', { name: /Leave me/ }));
    await user.click(screen.getByRole('button', { name: 'Carry selected (1)' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const all = await storedNotes();
    const copy = all.find(n => n.carriedFromId === keep.id);
    expect(copy).toMatchObject({ title: 'Carry me', dateStr: TODAY, isCompleted: false });
    expect(copy).not.toHaveProperty('remindedAt');
    expect(all.find(n => n.id === keep.id)?.carriedToDate).toBe(TODAY);
    expect(all.find(n => n.id === skip.id)?.carriedToDate).toBeUndefined();
  });

  it('hides on "Not today" and records that today was offered', async () => {
    await seedNotes(makeNote({ title: 'Later', dateStr: YESTERDAY }));
    const user = userEvent.setup();
    render(<CarryOverPrompt />);
    await prompt();

    await user.click(screen.getByRole('button', { name: 'Not today' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect((await readMeta()).lastCarryOverPromptDate).toBe(TODAY);
    expect((await storedNotes()).filter(n => n.carriedFromId)).toEqual([]);
  });

  it('shows nothing once today was already offered', async () => {
    await chrome.storage.local.set({ meta: { schemaVersion: 1, lastCarryOverPromptDate: TODAY } });
    await seedNotes(makeNote({ dateStr: YESTERDAY }));
    render(<CarryOverPrompt />);
    await waitFor(async () => expect((await readMeta()).lastCarryOverPromptDate).toBe(TODAY));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('appears in only one of two tabs opened together', async () => {
    await seedNotes(makeNote({ title: 'Once', dateStr: YESTERDAY }));
    render(
      <>
        <CarryOverPrompt />
        <CarryOverPrompt />
      </>,
    );
    await prompt();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('stays hidden while you are looking at another day', async () => {
    setBoard({ currentDateStr: '2026-11-03' });
    await seedNotes(makeNote({ dateStr: YESTERDAY }));
    render(<CarryOverPrompt />);
    await new Promise(r => setTimeout(r, 50));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // Regression (found by /check verify): switch the time zone to a day ahead and
  // back. The offer made for "tomorrow" must not show once today is today again,
  // or "Carry all" copies today's notes onto today.
  it('drops an offer made for another day when today changes back', async () => {
    const todayNote = makeNote({ title: 'Today task', dateStr: TODAY });
    await seedNotes(todayNote);
    await chrome.storage.local.set({ meta: { schemaVersion: 1, lastCarryOverPromptDate: TODAY } });

    // Time zone ahead: today is the 9th, so the 8th's notes are offered.
    setBoard({ today: '2026-11-09', currentDateStr: '2026-11-09' });
    const { rerender } = render(<CarryOverPrompt />);
    await prompt();

    // Back to the computer's zone: today is the 8th again.
    setBoard({ today: TODAY, currentDateStr: TODAY });
    rerender(<CarryOverPrompt />);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((await storedNotes()).filter(n => n.title === 'Today task')).toHaveLength(1);
  });

  it('offers yesterday\'s notes after midnight even when shown earlier', async () => {
    await seedNotes(makeNote({ title: 'Late night task', dateStr: TODAY }));
    await chrome.storage.local.set({ meta: { schemaVersion: 1, lastCarryOverPromptDate: TODAY } });
    const { rerender } = render(<CarryOverPrompt />);

    setBoard({ today: '2026-11-09', currentDateStr: '2026-11-09' });
    rerender(<CarryOverPrompt />);

    expect(await prompt()).toHaveTextContent('Late night task');
  });

  it('labels each checkbox with the note title for screen readers', async () => {
    await seedNotes(makeNote({ title: 'Read me', dateStr: YESTERDAY }));
    render(<CarryOverPrompt />);
    await prompt();
    expect(screen.getByRole('checkbox', { name: 'Read me' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Notes to carry over/ })).toBeInTheDocument();
  });
});
