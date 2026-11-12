// The page notes UI (spec 0002), drawn without its shadow root. Storage is the
// in-memory fake; writes go to a fake background through `send`.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { PageRequest } from '../lib/pageMessages';
import { makeNote, seedNotes } from '../test/notes';
import type { Note } from '../types';
import { createBridge, type Bridge } from './bridge';
import { resetHandFont } from './font';
import { LIMIT_MESSAGE, PageNotesApp, type Send } from './PageNotesApp';

const HERE = `${location.origin}/a?x=1`;
const page = (url = HERE) => ({ url, title: 'Here' });

let bridge: Bridge;
let send: Mock;
let allowed: boolean;

const reply = async (msg: PageRequest): Promise<unknown> => {
  if (msg.type === 'page-notes/hello') return { allowed };
  if (msg.type === 'page-notes/create') {
    return { note: makeNote({ title: msg.title, page: page(), positionX: msg.x, positionY: msg.y }) };
  }
  return { ok: true };
};

const mount = () => render(<PageNotesApp bridge={bridge} send={send as unknown as Send} />);
const requests = (type: PageRequest['type']) => send.mock.calls.map(c => c[0] as PageRequest).filter(m => m.type === type);

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  history.replaceState(null, '', '/a?x=1#top');
  bridge = createBridge();
  allowed = true;
  send = vi.fn(reply);
  resetHandFont();
});

describe('which notes show', () => {
  // covers: AC-6
  it('shows active notes for this exact address, ignoring the #part', async () => {
    await seedNotes(
      makeNote({ title: 'Mine', page: page() }),
      makeNote({ title: 'Other query', page: page(`${location.origin}/a?x=2`) }),
      makeNote({ title: 'Other path', page: page(`${location.origin}/b`) }),
      makeNote({ title: 'Trashed', page: page(), deletedAt: '2026-11-08T00:00:00.000Z' }),
      makeNote({ title: 'Board note' }),
    );
    mount();
    expect(await screen.findByRole('region', { name: 'Sticky note: Mine' })).toBeInTheDocument();
    expect(screen.getAllByRole('region')).toHaveLength(1);
  });

  // covers: AC-14
  it('swaps notes when the address changes, and keeps them on a #part change', async () => {
    await seedNotes(makeNote({ title: 'On A', page: page() }), makeNote({ title: 'On B', page: page(`${location.origin}/b`) }));
    mount();
    await screen.findByRole('region', { name: 'Sticky note: On A' });

    // Real order: the event (with the new address) comes before location.href changes.
    act(() => {
      bridge.emit({ type: 'location', href: `${location.origin}/a?x=1#later` });
      history.pushState(null, '', '/a?x=1#later');
    });
    expect(screen.getByRole('region', { name: 'Sticky note: On A' })).toBeInTheDocument();

    act(() => {
      bridge.emit({ type: 'location', href: `${location.origin}/b` });
      history.pushState(null, '', '/b');
    });
    expect(await screen.findByRole('region', { name: 'Sticky note: On B' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Sticky note: On A' })).not.toBeInTheDocument();
  });

  // covers: AC-8 (another tab's change shows here)
  it('shows changes made elsewhere', async () => {
    const n = makeNote({ title: 'Before', page: page() });
    await seedNotes(n);
    mount();
    await screen.findByDisplayValue('Before');
    await act(() => seedNotes({ ...n, title: 'After', updatedAt: '2026-11-08T12:00:00.000Z' }));
    expect(await screen.findByDisplayValue('After')).toBeInTheDocument();
  });
});

describe('pinning a new note', () => {
  // covers: AC-2, AC-3
  it('places a shortcut draft 24 px in, stepped past a note on that spot, and saves it on Enter', async () => {
    await seedNotes(makeNote({ page: page(), positionX: 24, positionY: 24 }));
    mount();
    await screen.findAllByRole('region');
    act(() => bridge.emit({ type: 'new-draft', via: 'shortcut' }));
    const input = await screen.findByLabelText('New note title');
    expect(input).toHaveFocus();
    expect(screen.getByRole('region', { name: 'New sticky note' })).toHaveStyle({ left: '48px', top: '48px' });

    await userEvent.type(input, 'Compare prices{Enter}');
    expect(requests('page-notes/create')[0]).toMatchObject({ x: 48, y: 48, title: 'Compare prices' });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'New sticky note' })).not.toBeInTheDocument());
  });

  // covers: AC-2 (right click spot on an allowed site)
  it('uses the right click spot for "Pin a note here"', async () => {
    mount();
    bridge.setContextSpot(300, 1200);
    act(() => bridge.emit({ type: 'new-draft', via: 'menu' }));
    expect(await screen.findByRole('region', { name: 'New sticky note' })).toHaveStyle({ left: '300px', top: '1200px' });
  });

  // covers: AC-2
  it('discards a draft left with an empty title', async () => {
    mount();
    act(() => bridge.emit({ type: 'new-draft', via: 'shortcut' }));
    const input = await screen.findByLabelText('New note title');
    act(() => input.blur());
    await waitFor(() => expect(screen.queryByRole('region', { name: 'New sticky note' })).not.toBeInTheDocument());
    expect(requests('page-notes/create')).toHaveLength(0);
  });

  // Regression: pressing on the draft's paper used to blur the title and discard the draft.
  it('keeps the draft and its focus when you press on its paper', async () => {
    const user = userEvent.setup();
    mount();
    act(() => bridge.emit({ type: 'new-draft', via: 'shortcut' }));
    const input = await screen.findByLabelText('New note title');

    await user.click(screen.getByText('Enter to save · Esc to discard'));
    await user.keyboard('Still here');

    expect(screen.getByRole('region', { name: 'New sticky note' })).toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(input).toHaveValue('Still here');
  });

  // Regression: sites like ChatGPT grab focus when you type; the content script hands it back at once.
  it('keeps an empty draft when focus leaves and comes straight back', async () => {
    mount();
    act(() => bridge.emit({ type: 'new-draft', via: 'shortcut' }));
    const input = await screen.findByLabelText('New note title');
    const siteBox = document.body.appendChild(document.createElement('textarea'));

    act(() => {
      siteBox.focus();
      input.focus();
    });
    await act(() => new Promise(r => setTimeout(r, 20)));

    expect(screen.getByRole('region', { name: 'New sticky note' })).toBeInTheDocument();
    expect(requests('page-notes/create')).toHaveLength(0);
    siteBox.remove();
  });

  it('still saves a titled draft when focus moves away for good', async () => {
    const user = userEvent.setup();
    mount();
    act(() => bridge.emit({ type: 'new-draft', via: 'shortcut' }));
    const input = await screen.findByLabelText('New note title');
    await user.type(input, 'Read later');

    act(() => input.blur());

    await waitFor(() => expect(requests('page-notes/create')[0]).toMatchObject({ title: 'Read later' }));
  });

  // covers: AC-18
  it('shows the 50 note message on a full page and creates nothing', async () => {
    await seedNotes(...Array.from({ length: 50 }, (_, i) => makeNote({ page: page(), positionX: i * 300, positionY: 0 })));
    const { container } = mount();
    await waitFor(() => expect(container.querySelectorAll('.sb-note')).toHaveLength(50));
    act(() => bridge.emit({ type: 'new-draft', via: 'shortcut' }));
    expect(await screen.findByText(LIMIT_MESSAGE)).toBeInTheDocument();
    const input = screen.getByPlaceholderText('Write a title…');
    fireEvent.change(input, { target: { value: 'One more' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(requests('page-notes/create')).toHaveLength(0);
  });
});

describe('a note on the page', () => {
  // covers: AC-8
  it('saves title edits shortly after you stop typing', async () => {
    const n = makeNote({ title: 'Draft idea', page: page() });
    await seedNotes(n);
    mount();
    const title = await screen.findByDisplayValue('Draft idea');
    await userEvent.type(title, '!');
    // The save goes out within 1 second of the last keystroke.
    const typedAt = Date.now();
    await waitFor(() => expect(requests('page-notes/patch')).toContainEqual({ type: 'page-notes/patch', id: n.id, fields: { title: 'Draft idea!' } }), { timeout: 1500 });
    expect(Date.now() - typedAt).toBeLessThan(1000);
  });

  // covers: AC-8 (a reload or closed tab right after typing keeps the edit)
  it('sends unsaved text right away when the page goes away', async () => {
    const n = makeNote({ title: 'Draft idea', page: page() });
    await seedNotes(n);
    mount();
    const title = await screen.findByDisplayValue('Draft idea');
    await userEvent.type(title, '?');
    expect(requests('page-notes/patch')).toHaveLength(0); // still waiting on the save delay
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(requests('page-notes/patch')).toContainEqual({ type: 'page-notes/patch', id: n.id, fields: { title: 'Draft idea?' } });
  });

  // covers: AC-8 (the field you're typing in keeps your text)
  it('keeps your text in the focused field when another tab changes the note', async () => {
    const n = makeNote({ title: 'Mine', description: 'old', page: page() });
    await seedNotes(n);
    mount();
    const title = await screen.findByDisplayValue('Mine');
    title.focus();
    await act(() => seedNotes({ ...n, title: 'Theirs', description: 'new', updatedAt: '2026-11-08T12:00:00.000Z' }));
    expect(title).toHaveValue('Mine');
    expect(await screen.findByDisplayValue('new')).toBeInTheDocument();
  });

  // covers: AC-8 (checklist)
  it('adds a checklist item', async () => {
    const n = makeNote({ title: 'List', page: page() });
    await seedNotes(n);
    mount();
    await userEvent.type(await screen.findByLabelText('Add a checklist item'), 'Size 42{Enter}');
    await waitFor(() => {
      const fields = requests('page-notes/patch').at(-1) as { fields: Partial<Note> } | undefined;
      expect(fields?.fields.subtasks?.[0]).toMatchObject({ title: 'Size 42', isCompleted: false });
    });
  });

  // covers: AC-9
  it('collapses to a tab with the first 20 characters of the title', async () => {
    const n = makeNote({ title: 'A rather long note title here', page: page() });
    await seedNotes(n);
    mount();
    await userEvent.click(await screen.findByRole('button', { name: `Collapse ${n.title}` }));
    expect(requests('page-notes/patch')).toContainEqual({ type: 'page-notes/patch', id: n.id, fields: { collapsed: true } });
    expect(await screen.findByRole('button', { name: `Open note: ${n.title}` })).toHaveTextContent(/^A rather long note t$/);
  });

  // covers: AC-7
  it('saves the new spot when you drop a dragged note', async () => {
    const n = makeNote({ title: 'Drag me', page: page(), positionX: 100, positionY: 100 });
    await seedNotes(n);
    mount();
    const bar = (await screen.findByRole('region', { name: 'Sticky note: Drag me' })).querySelector('.sb-bar')!;
    (bar as HTMLElement).setPointerCapture = () => undefined;
    fireEvent.pointerDown(bar, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 60, clientY: 90 });
    fireEvent.pointerUp(bar, { pointerId: 1, clientX: 60, clientY: 90 });
    expect(requests('page-notes/patch')).toContainEqual({ type: 'page-notes/patch', id: n.id, fields: { positionX: 150, positionY: 180 } });
  });

  // covers: AC-10
  it('moves a note to Trash', async () => {
    const n = makeNote({ title: 'Bin', page: page() });
    await seedNotes(n);
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Move Bin to Trash' }));
    expect(requests('page-notes/trash')).toEqual([{ type: 'page-notes/trash', id: n.id }]);
    expect(screen.queryByRole('region', { name: 'Sticky note: Bin' })).not.toBeInTheDocument();
  });
});

describe('the Allow line', () => {
  // covers: AC-4, AC-5
  it('shows on a site that is not allowed and opens the Allow window for this host', async () => {
    allowed = false;
    await seedNotes(makeNote({ title: 'Ask', page: page() }));
    mount();
    expect(await screen.findByText('Show this note when you come back?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Allow' }));
    expect(requests('page-notes/open-access')).toEqual([{ type: 'page-notes/open-access', host: location.hostname }]);

    act(() => bridge.emit({ type: 'access', allowed: true }));
    expect(screen.queryByText('Show this note when you come back?')).not.toBeInTheDocument();
  });

  it('is not shown on an allowed site', async () => {
    await seedNotes(makeNote({ title: 'Quiet', page: page() }));
    mount();
    await screen.findByRole('region', { name: 'Sticky note: Quiet' });
    await waitFor(() => expect(send).toHaveBeenCalled());
    expect(screen.queryByText('Show this note when you come back?')).not.toBeInTheDocument();
  });
});

describe('handwriting (spec 0003)', () => {
  const g = globalThis as { FontFace?: unknown };
  afterEach(() => {
    delete g.FontFace;
  });
  const rootOf = (title: string) => screen.getByRole('region', { name: `Sticky note: ${title}` }).closest('.sb-root')!;

  // covers: AC-23
  it('uses the plain font when Handwriting on notes is off, and follows the setting live', async () => {
    await chrome.storage.sync.set({ settings: { handwritingFont: false } });
    await seedNotes(makeNote({ title: 'Plain', page: page() }));
    mount();
    await screen.findByRole('region', { name: 'Sticky note: Plain' });
    await waitFor(() => expect(rootOf('Plain')).toHaveClass('no-handwriting'));

    await act(() => chrome.storage.sync.set({ settings: { handwritingFont: true } }));
    await waitFor(() => expect(rootOf('Plain')).not.toHaveClass('no-handwriting'));
  });

  // covers: AC-24
  it('registers the bundled font as SB Hand and shows the text once it is ready', async () => {
    const add = vi.fn();
    const made: unknown[][] = [];
    g.FontFace = class {
      constructor(...args: unknown[]) {
        made.push(args);
      }
      load() {
        return Promise.resolve(this);
      }
    };
    Object.defineProperty(document, 'fonts', { value: { add }, configurable: true });
    await seedNotes(makeNote({ title: 'Hand', page: page() }));
    mount();
    await screen.findByRole('region', { name: 'Sticky note: Hand' });
    await waitFor(() => expect(rootOf('Hand')).not.toHaveClass('sb-hide-text'));
    expect(made[0]?.[0]).toBe('SB Hand');
    expect(made[0]?.[1]).toBeInstanceOf(Uint8Array);
    expect((made[0]?.[1] as Uint8Array).length).toBeGreaterThan(1000);
    expect(add).toHaveBeenCalledTimes(1);
  });

  // covers: AC-24
  it('hides the text while the font loads, then shows it after 300 ms even if the font never arrives', async () => {
    g.FontFace = class {
      load() {
        return new Promise(() => undefined);
      }
    };
    await seedNotes(makeNote({ title: 'Slow', page: page() }));
    mount();
    await screen.findByRole('region', { name: 'Sticky note: Slow' });
    expect(rootOf('Slow')).toHaveClass('sb-hide-text');
    await waitFor(() => expect(rootOf('Slow')).not.toHaveClass('sb-hide-text'), { timeout: 1000 });
  });
});

describe('details limit', () => {
  // Long notes from calls were cut off at 5,000 characters.
  it('lets a page note hold 10,000 characters of details', async () => {
    await seedNotes(makeNote({ title: 'Call notes', page: page() }));
    mount();
    const note = await screen.findByRole('region', { name: 'Sticky note: Call notes' });
    expect(note.querySelector('textarea')).toHaveAttribute('maxLength', '10000');
  });
});

describe('Move to today\'s board on the page (spec 0004)', () => {
  const answer = (move: unknown, undo: unknown = { ok: true }) =>
    send.mockImplementation(async (msg: PageRequest) => {
      if (msg.type === 'page-notes/move-to-board') return move;
      if (msg.type === 'page-notes/undo-move') return undo;
      return reply(msg);
    });

  // covers: AC-1, AC-5, AC-12
  it('moves the note, leaves a message with Undo in focus, and Undo asks to put it back', async () => {
    const n = makeNote({ title: 'Call notes', page: page() });
    await seedNotes(n);
    answer({ pageId: n.id, boardId: 'b1' });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: "Move Call notes to today's board" }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent("Moved to today's board");
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus();
    expect(screen.queryByRole('region', { name: 'Sticky note: Call notes' })).not.toBeInTheDocument();
    expect(requests('page-notes/move-to-board')).toEqual([{ type: 'page-notes/move-to-board', id: n.id }]);

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(requests('page-notes/undo-move')).toEqual([{ type: 'page-notes/undo-move', pageId: n.id, boardId: 'b1' }]);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  // covers: AC-5
  it('clears the message after 6 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const n = makeNote({ title: 'Call notes', page: page() });
    await seedNotes(n);
    answer({ pageId: n.id, boardId: 'b1' });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: "Move Call notes to today's board" }));
    await screen.findByRole('status');
    // The 6 second timer starts in the same step that moves focus to Undo.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus());
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  // covers: AC-6
  it('keeps the note and says why on a full day', async () => {
    const n = makeNote({ title: 'Call notes', page: page() });
    await seedNotes(n);
    answer({ error: 'day-full' });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: "Move Call notes to today's board" }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This day already has 50 notes');
    expect(screen.getByRole('region', { name: 'Sticky note: Call notes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Move Call notes to today's board" })).toBeEnabled();
  });

  // covers: AC-7
  it('says when the note was already moved, and when the background does not answer', async () => {
    const a = makeNote({ title: 'Gone one', page: page() });
    const b = makeNote({ title: 'Stuck one', page: page() });
    await seedNotes(a, b);
    send.mockImplementation(async (msg: PageRequest) => {
      if (msg.type === 'page-notes/move-to-board') {
        if (msg.id === a.id) return { error: 'gone' };
        throw new Error('Extension context invalidated');
      }
      return reply(msg);
    });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: "Move Gone one to today's board" }));
    expect(await screen.findByRole('status')).toHaveTextContent('This note was already moved or deleted.');
    await userEvent.click(screen.getByRole('button', { name: "Move Stuck one to today's board" }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't move the note. Try again.");
  });

  it('sends text typed just before the move first', async () => {
    const n = makeNote({ title: 'Call notes', page: page() });
    await seedNotes(n);
    answer({ pageId: n.id, boardId: 'b1' });
    mount();
    const note = await screen.findByRole('region', { name: 'Sticky note: Call notes' });
    await userEvent.type(note.querySelector('textarea')!, 'last words');
    await userEvent.click(screen.getByRole('button', { name: "Move Call notes to today's board" }));
    await screen.findByRole('status');
    const types = send.mock.calls.map(c => (c[0] as PageRequest).type);
    expect(types.indexOf('page-notes/patch')).toBeGreaterThan(-1);
    expect(types.indexOf('page-notes/patch')).toBeLessThan(types.indexOf('page-notes/move-to-board'));
  });

  // covers: AC-5 (each move gets its own message)
  it('leaves one message per move when two notes move in a row', async () => {
    const a = makeNote({ title: 'First', page: page() });
    const b = makeNote({ title: 'Second', page: page(), positionY: 48 });
    await seedNotes(a, b);
    send.mockImplementation(async (msg: PageRequest) =>
      msg.type === 'page-notes/move-to-board' ? { pageId: msg.id, boardId: `board-${msg.id}` } : reply(msg),
    );
    mount();
    await userEvent.click(await screen.findByRole('button', { name: "Move First to today's board" }));
    await screen.findByRole('status');
    await userEvent.click(screen.getByRole('button', { name: "Move Second to today's board" }));

    await waitFor(() => expect(screen.getAllByRole('status')).toHaveLength(2));
    expect(screen.getAllByRole('button', { name: 'Undo' })).toHaveLength(2);
  });

  // covers: AC-1 (open notes only), AC-12
  it('offers no Move button on a collapsed note', async () => {
    await seedNotes(makeNote({ title: 'Tucked away', page: page(), collapsed: true }));
    mount();
    expect(await screen.findByRole('button', { name: /Open note: Tucked away/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "Move Tucked away to today's board" })).not.toBeInTheDocument();
  });

  // covers: AC-11
  it('says the page is full when Undo is refused, and keeps the message', async () => {
    const n = makeNote({ title: 'Call notes', page: page() });
    await seedNotes(n);
    answer({ pageId: n.id, boardId: 'b1' }, { error: 'limit' });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: "Move Call notes to today's board" }));
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(await screen.findByRole('status')).toHaveTextContent(LIMIT_MESSAGE);
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
  });

  // covers: AC-11
  it('says the page note is gone when it was emptied from Trash', async () => {
    const n = makeNote({ title: 'Call notes', page: page() });
    await seedNotes(n);
    answer({ pageId: n.id, boardId: 'b1' }, { error: 'gone' });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: "Move Call notes to today's board" }));
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(await screen.findByRole('status')).toHaveTextContent("Couldn't undo, the page note is no longer in Trash.");
  });

  it('gives the general Undo error, not the Trash one, when the pair does not match', async () => {
    const n = makeNote({ title: 'Call notes', page: page() });
    await seedNotes(n);
    answer({ pageId: n.id, boardId: 'b1' }, { error: 'invalid' });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: "Move Call notes to today's board" }));
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(await screen.findByRole('status')).toHaveTextContent("Couldn't undo. Please try again.");
  });

  // A move that answers after the page moved to another address leaves no message there.
  it.each([
    ['moved', (id: string) => ({ pageId: id, boardId: 'b1' })],
    ['gone', () => ({ error: 'gone' })],
  ])('shows no message on the new address when a %s reply comes late', async (_, answerFor) => {
    const n = makeNote({ title: 'Call notes', page: page() });
    await seedNotes(n);
    let finish!: (v: unknown) => void;
    send.mockImplementation(async (msg: PageRequest) =>
      msg.type === 'page-notes/move-to-board' ? new Promise(r => (finish = r)) : reply(msg),
    );
    mount();
    await userEvent.click(await screen.findByRole('button', { name: "Move Call notes to today's board" }));
    act(() => {
      bridge.emit({ type: 'location', href: `${location.origin}/elsewhere` });
      history.pushState(null, '', '/elsewhere');
    });

    await act(async () => finish(answerFor(n.id)));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('clears the message when the page moves to another address', async () => {
    const n = makeNote({ title: 'Call notes', page: page() });
    await seedNotes(n);
    answer({ pageId: n.id, boardId: 'b1' });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: "Move Call notes to today's board" }));
    await screen.findByRole('status');
    act(() => {
      bridge.emit({ type: 'location', href: `${location.origin}/elsewhere` });
      history.pushState(null, '', '/elsewhere');
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
