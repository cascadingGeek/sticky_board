// Regression: notes must never draw above the top bar, drawers or editor.
// Each note's z grows by one per add or move, so on a busy day it passes the
// panels' z (top bar 30, drawers 40, editor 50). The board container isolates
// stacking so note z only orders notes among themselves.
// jsdom can't paint, so this checks the stacking layer the browser relies on.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StickyBoardProvider, useStickyBoard } from '@/board/StickyBoardContext';
import { DAY_FULL_MESSAGE } from '@/shared/types';
import { Toasts } from '@/board/components/Toasts';
import { makeNote, seedNotes } from '../../support/notes';
import { Board } from '@/board/components/Board';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-08T12:00:00Z'));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  await chrome.storage.sync.set({ settings: { timezone: 'UTC' } });
  await chrome.storage.local.set({ meta: { schemaVersion: 1, onboardedAt: '2026-11-01T00:00:00.000Z', lastCarryOverPromptDate: '2026-11-08' } });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('board stacking', () => {
  it('keeps a note with a high stacking number inside the board layer, below the panels', async () => {
    await seedNotes(makeNote({ title: 'Busy day note', dateStr: '2026-11-08', z: 60 }));
    render(
      <StickyBoardProvider>
        <Board inert={false} />
      </StickyBoardProvider>,
    );

    const note = await screen.findByRole('article', { name: /Busy day note/ });

    // The note's own z is above the editor's 50: only the board layer keeps it below.
    expect(note).toHaveStyle({ zIndex: '60' });
    const layer = note.parentElement;
    expect(layer?.closest('main')).toBe(screen.getByRole('main', { name: 'Board' }));
    expect(layer).toHaveClass('isolate');
  });
});

function NewNoteButton() {
  const { requestNewNote, loaded } = useStickyBoard();
  return loaded ? <button onClick={requestNewNote}>Add</button> : null;
}

describe('day note limit (50 a day)', () => {
  const renderBoard = () =>
    render(
      <StickyBoardProvider>
        <NewNoteButton />
        <Board inert={false} />
        <Toasts />
      </StickyBoardProvider>,
    );

  it('says the day is full and opens no blank note when the day has 50 notes', async () => {
    await seedNotes(...Array.from({ length: 50 }, (_, i) => makeNote({ title: `Note ${i}`, dateStr: '2026-11-08' })));
    renderBoard();
    await screen.findByRole('article', { name: /Note 49/ });

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText(DAY_FULL_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Write a title…')).not.toBeInTheDocument();
  });

  it('opens a blank note when the day has room', async () => {
    await seedNotes(...Array.from({ length: 49 }, (_, i) => makeNote({ title: `Note ${i}`, dateStr: '2026-11-08' })));
    renderBoard();
    await screen.findByRole('article', { name: /Note 48/ });

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(screen.getByPlaceholderText('Write a title…')).toBeInTheDocument());
    expect(screen.queryByText(DAY_FULL_MESSAGE)).not.toBeInTheDocument();
  });
});
