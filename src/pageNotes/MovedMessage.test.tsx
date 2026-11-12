// The message left on a page after a note moves to today's board (spec 0004).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MovedMessage, MOVED_MESSAGE_MS, type Notice } from './MovedMessage';

const moved: Notice = { key: 1, x: 24, y: 24, text: "Moved to today's board", undo: { pageId: 'p1', boardId: 'b1' } };

afterEach(() => {
  vi.useRealTimers();
});

describe('MovedMessage', () => {
  // covers: AC-5, AC-12
  it('is announced as a status, with a real Undo button that has focus', () => {
    render(<MovedMessage notice={moved} onUndo={vi.fn()} onDone={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent("Moved to today's board");
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus();
  });

  // covers: AC-7
  it('shows a plain notice with no Undo when there is nothing to undo', () => {
    render(<MovedMessage notice={{ key: 2, x: 0, y: 0, text: 'This note was already moved or deleted.' }} onUndo={vi.fn()} onDone={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('This note was already moved or deleted.');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  // covers: AC-5
  it('says Undoing and disables Undo while the request runs, then closes when it works', async () => {
    let finish!: (v: string | null) => void;
    const onUndo = vi.fn(() => new Promise<string | null>(r => (finish = r)));
    const onDone = vi.fn();
    render(<MovedMessage notice={moved} onUndo={onUndo} onDone={onDone} />);

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledWith({ pageId: 'p1', boardId: 'b1' });
    expect(screen.getByRole('status')).toHaveTextContent('Undoing…');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();

    await act(async () => finish(null));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  // covers: AC-11
  it('replaces the text with the reason and drops Undo when Undo is refused', async () => {
    const onDone = vi.fn();
    render(<MovedMessage notice={moved} onUndo={async () => 'This page already has 50 notes.'} onDone={onDone} />);
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('This page already has 50 notes.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });

  // covers: AC-5
  it('closes itself after 6 seconds, even after a refused Undo', async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<MovedMessage notice={moved} onUndo={async () => 'No luck.'} onDone={onDone} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Undo' })));
    expect(screen.getByText('No luck.')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(MOVED_MESSAGE_MS - 1));
    expect(onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

// Regression: a slow Undo (the background waking up) must not have its answer cut off by the 6 second timer.
describe('MovedMessage with a slow Undo', () => {
  it('stays open while Undo runs, and shows a late error for a fresh 6 seconds', async () => {
    vi.useFakeTimers();
    let finish!: (v: string | null) => void;
    const onDone = vi.fn();
    render(<MovedMessage notice={moved} onUndo={() => new Promise(r => (finish = r))} onDone={onDone} />);

    act(() => vi.advanceTimersByTime(5000));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    act(() => vi.advanceTimersByTime(2000)); // 7 seconds in, Undo still waiting
    expect(onDone).not.toHaveBeenCalled();

    await act(async () => finish('This page already has 50 notes.'));
    expect(screen.getByRole('status')).toHaveTextContent('This page already has 50 notes.');
    act(() => vi.advanceTimersByTime(MOVED_MESSAGE_MS - 1));
    expect(onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

// Regression: the message sits over the next stacked note's top bar (notes stack
// 24px apart), so it must not swallow clicks meant for that note's buttons.
describe('MovedMessage does not block the next note', () => {
  it('puts Undo first, in the moved note own corner, away from the next note buttons', () => {
    render(<MovedMessage notice={moved} onUndo={vi.fn()} onDone={vi.fn()} />);
    const status = screen.getByRole('status');
    expect(status.firstElementChild).toBe(screen.getByRole('button', { name: 'Undo' }));
  });

  it('lets clicks through everywhere but the Undo button', () => {
    const css = readFileSync(resolve(__dirname, 'style.css'), 'utf8');
    const rule = (selector: string) => {
      const m = css.match(new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`));
      return m?.[2] ?? '';
    };
    expect(rule('.sb-moved')).toMatch(/pointer-events:\s*none/);
    expect(rule('.sb-moved .sb-btn')).toMatch(/pointer-events:\s*auto/);
  });
});
