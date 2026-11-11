// Spec 0002: page notes never show on the day board, calendar counts or carry over (AC-11).
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StickyBoardProvider, useStickyBoard } from '../lib/StickyBoardContext';
import { makeNote, seedNotes } from '../test/notes';
import { Board } from './Board';
import { CalendarDrawer } from './CalendarDrawer';

const PAGE = { url: 'https://shop.io/a', title: 'Shop' };

function Probe({ onCtx }: { onCtx: (c: ReturnType<typeof useStickyBoard>) => void }) {
  onCtx(useStickyBoard());
  return null;
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-08T12:00:00Z'));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  await chrome.storage.sync.set({ settings: { timezone: 'UTC' } });
  await chrome.storage.local.set({ meta: { schemaVersion: 1, onboardedAt: '2026-11-01T00:00:00.000Z', lastCarryOverPromptDate: '2026-11-01' } });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('board views exclude page notes', () => {
  // covers: AC-11
  it('the context, board, calendar and carry over leave page notes out', async () => {
    await seedNotes(
      makeNote({ title: 'Board note', dateStr: '2026-11-08' }),
      makeNote({ title: 'Page note today', dateStr: '2026-11-08', page: PAGE }),
      makeNote({ title: 'Page note yesterday', dateStr: '2026-11-07', page: PAGE }),
    );
    let ctx!: ReturnType<typeof useStickyBoard>;
    render(
      <StickyBoardProvider>
        <Probe onCtx={c => (ctx = c)} />
        <Board inert={false} />
        <CalendarDrawer />
      </StickyBoardProvider>,
    );
    await screen.findByRole('article', { name: /Board note/ });

    expect(ctx.notes.map(n => n.title)).toEqual(['Board note']);
    expect(ctx.allNotes).toHaveLength(3);
    expect(screen.queryByText(/Page note/)).not.toBeInTheDocument();
    // The calendar shows one open note on the 8th and nothing on the 7th.
    expect(screen.getByRole('button', { name: /November 8, 1 note/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /November 7, no notes/i })).toBeInTheDocument();
    // Carry over: yesterday holds only a page note, so nothing is offered.
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /unfinished notes/ })).not.toBeInTheDocument());
  });
});
