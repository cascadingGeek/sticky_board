import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteEditor } from './NoteEditor';
import { Toasts } from './Toasts';
import { StickyBoardProvider, useStickyBoard } from '../lib/StickyBoardContext';
import { notes as noteStore } from '../lib/storage';
import { makeNote, seedNotes, storedNotes } from '../test/notes';
import type { Note } from '../types';

// Opens the editor for one stored note inside the real provider, like App does.
function EditorFor({ id }: { id: string }) {
  const { notes, loaded, editorId, setEditorId } = useStickyBoard();
  useEffect(() => {
    if (loaded) setEditorId(id);
  }, [loaded, id, setEditorId]);
  const note = notes.find(n => n.id === id && !n.deletedAt);
  return editorId === id && note ? <NoteEditor note={note} /> : null;
}

const openEditor = async (note: Note) => {
  await seedNotes(note);
  render(
    <StickyBoardProvider>
      <EditorFor id={note.id} />
      <Toasts />
    </StickyBoardProvider>,
  );
  return screen.findByRole('dialog');
};

const stored = async (id: string) => (await storedNotes()).find(n => n.id === id);
const status = () => screen.getByRole('status');
const SAVE_ERROR = "Couldn't save the note. Your text is still here, try again.";

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-08T12:00:00Z'));
  await chrome.storage.sync.set({ settings: { timezone: 'UTC', soundEnabled: false } });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('NoteEditor layout', () => {
  // covers: spec 0003 AC-14 (fields, no colour control, no Cancel)
  it('shows Title, Details, Checklist, Day, Due time and Remind, with no colour control or Cancel', async () => {
    await openEditor(makeNote({ title: 'Plan' }));
    expect(screen.getByLabelText('Title')).toHaveValue('Plan');
    expect(screen.getByLabelText('Details')).toBeInTheDocument();
    expect(screen.getByText('Checklist')).toBeInTheDocument();
    expect(screen.getByLabelText('Day')).toHaveValue('2026-11-08');
    expect(screen.getByLabelText('Due time')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Remind me/ })).toBeInTheDocument();
    expect(screen.queryByLabelText(/priority|category|colou?r/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(status()).toHaveTextContent('Saved');
  });

  it('is a labelled modal dialog with a close button', async () => {
    await openEditor(makeNote());
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Edit note');
    expect(screen.getByRole('button', { name: 'Close editor' })).toBeInTheDocument();
  });
});

describe('NoteEditor saves as you type (spec 0003, AC-27)', () => {
  it('saves only the changed field 500 ms after typing stops', async () => {
    const n = makeNote({ title: 'Old', description: 'keep' });
    const patch = vi.spyOn(noteStore, 'patch');
    const user = userEvent.setup();
    await openEditor(n);

    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'New');
    expect(status()).toHaveTextContent('Saving…');

    await waitFor(() => expect(status()).toHaveTextContent('Saved'));
    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith(n.id, { title: 'New' });
    expect((await stored(n.id))?.title).toBe('New');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Esc sends a waiting change first, then closes', async () => {
    const n = makeNote({ description: '' });
    const user = userEvent.setup();
    await openEditor(n);

    await user.type(screen.getByLabelText('Details'), 'Bring snacks');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((await stored(n.id))?.description).toBe('Bring snacks');
  });

  it('Done saves and closes', async () => {
    const n = makeNote({ dueTime: '09:00', remind: true, remindedAt: '2026-11-08T09:00:00.000Z' });
    const user = userEvent.setup();
    await openEditor(n);

    await user.clear(screen.getByLabelText('Due time'));
    await user.type(screen.getByLabelText('Due time'), '15:30');
    await user.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((await stored(n.id))?.dueTime).toBe('15:30');
    expect(await stored(n.id)).not.toHaveProperty('remindedAt');
  });

  it('clears remindedAt when the day changes', async () => {
    const n = makeNote({ dueTime: '09:00', remind: true, remindedAt: '2026-11-08T09:00:00.000Z' });
    const user = userEvent.setup();
    await openEditor(n);

    await user.clear(screen.getByLabelText('Day'));
    await user.type(screen.getByLabelText('Day'), '2026-11-10');
    await user.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(async () => expect((await stored(n.id))?.dateStr).toBe('2026-11-10'));
    expect(await stored(n.id)).not.toHaveProperty('remindedAt');
  });

  it('refuses to move the note to a day that already has 50 notes, and says why', async () => {
    await seedNotes(...Array.from({ length: 50 }, () => makeNote({ dateStr: '2026-11-10' })));
    const n = makeNote({ title: 'Mover' });
    const user = userEvent.setup();
    await openEditor(n);

    await user.clear(screen.getByLabelText('Day'));
    await user.type(screen.getByLabelText('Day'), '2026-11-10');

    expect(await screen.findByText('That day already has 50 notes. Pick another day.')).toBeInTheDocument();
    await waitFor(() => expect(status()).toHaveTextContent('Not saved'));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((await stored(n.id))?.dateStr).toBe('2026-11-08');
  });

  it('lets the details hold 10,000 characters', async () => {
    await openEditor(makeNote());
    expect(screen.getByLabelText('Details')).toHaveAttribute('maxLength', '10000');
  });

  it('keeps remindedAt when only the title or Remind changes', async () => {
    const n = makeNote({ title: 'Old', dueTime: '09:00', remind: true, remindedAt: '2026-11-08T09:00:00.000Z' });
    const user = userEvent.setup();
    await openEditor(n);

    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'New');
    await user.click(screen.getByRole('switch', { name: /Remind me/ }));
    await user.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(async () => expect(await stored(n.id)).toMatchObject({ title: 'New', remind: false }));
    expect((await stored(n.id))?.remindedAt).toBe('2026-11-08T09:00:00.000Z');
  });

  it('clearing the due time sends the time and Remind off in one save', async () => {
    const n = makeNote({ dueTime: '10:00', remind: true });
    const patch = vi.spyOn(noteStore, 'patch');
    const user = userEvent.setup();
    await openEditor(n);
    const remind = screen.getByRole('switch', { name: /Remind me/ });
    expect(remind).toHaveAttribute('aria-checked', 'true');

    await user.clear(screen.getByLabelText('Due time'));
    expect(remind).toHaveAttribute('aria-checked', 'false');
    expect(remind).toBeDisabled();

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patch).toHaveBeenCalledWith(n.id, { dueTime: undefined, remind: false, remindedAt: undefined });
  });

  it('never saves an empty title, says why, saves other fields, and closing keeps the old title', async () => {
    const n = makeNote({ title: 'Keep', description: '' });
    const user = userEvent.setup();
    await openEditor(n);

    await user.clear(screen.getByLabelText('Title'));
    expect(screen.getByText('Give the note a title.')).toBeInTheDocument();
    expect(status()).toHaveTextContent(/Saving…|Not saved/);
    await user.type(screen.getByLabelText('Details'), 'still saved');

    await waitFor(async () => expect((await stored(n.id))?.description).toBe('still saved'));
    await waitFor(() => expect(status()).toHaveTextContent('Not saved'));
    expect((await stored(n.id))?.title).toBe('Keep');

    await user.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((await stored(n.id))?.title).toBe('Keep');
  });

  it('a title of only spaces counts as empty; a saved title is trimmed', async () => {
    const n = makeNote({ title: 'Keep' });
    const user = userEvent.setup();
    await openEditor(n);

    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), '   ');
    expect(screen.getByText('Give the note a title.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Title'), 'Trimmed  ');
    await user.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(async () => expect((await stored(n.id))?.title).toBe('Trimmed'));
  });

  it('adds and removes checklist items', async () => {
    const n = makeNote();
    const user = userEvent.setup();
    await openEditor(n);

    await user.type(screen.getByLabelText(/Add a checklist item/), 'Milk{Enter}');
    await user.type(screen.getByLabelText(/Add a checklist item/), 'Eggs{Enter}');
    await user.click(screen.getByRole('button', { name: 'Remove Milk' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(async () => expect((await stored(n.id))?.subtasks.map(s => s.title)).toEqual(['Eggs']));
  });

  it('text typed in "Add item" is added before Esc closes', async () => {
    const n = makeNote();
    const user = userEvent.setup();
    await openEditor(n);

    await user.type(screen.getByLabelText(/Add a checklist item/), 'Bread');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((await stored(n.id))?.subtasks.map(s => s.title)).toEqual(['Bread']);
  });

  it('an emptied item keeps its saved text on a timed save, and is dropped on close', async () => {
    const n = makeNote({ description: '', subtasks: [{ id: 's1', title: 'Milk', isCompleted: false }] });
    const user = userEvent.setup();
    await openEditor(n);

    await user.clear(screen.getByLabelText('Checklist item 1'));
    await user.type(screen.getByLabelText('Details'), 'x');
    await waitFor(async () => expect((await stored(n.id))?.description).toBe('x'));
    expect((await stored(n.id))?.subtasks).toEqual([{ id: 's1', title: 'Milk', isCompleted: false }]);

    await user.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(async () => expect((await stored(n.id))?.subtasks).toEqual([]));
  });

  it('runs one save at a time; a later save carries only the later change', async () => {
    const n = makeNote({ title: 'A', description: '' });
    const real = noteStore.patch.bind(noteStore);
    let release!: () => void;
    const gate = new Promise<void>(r => (release = r));
    const patch = vi.spyOn(noteStore, 'patch').mockImplementationOnce(async (id, fields) => {
      await gate;
      return real(id, fields);
    });
    const user = userEvent.setup();
    await openEditor(n);

    await user.type(screen.getByLabelText('Title'), 'B');
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    await user.type(screen.getByLabelText('Details'), 'later');
    await new Promise(r => setTimeout(r, 700));
    expect(patch).toHaveBeenCalledTimes(1); // the second waits for the first

    act(() => release());
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
    expect(patch.mock.calls[0]?.[1]).toEqual({ title: 'AB' });
    expect(patch.mock.calls[1]?.[1]).toEqual({ description: 'later' });
  });

  it('Done during a running save closes only after every save lands', async () => {
    const n = makeNote({ title: 'A', description: '' });
    const real = noteStore.patch.bind(noteStore);
    let release!: () => void;
    const gate = new Promise<void>(r => (release = r));
    vi.spyOn(noteStore, 'patch').mockImplementationOnce(async (id, fields) => {
      await gate;
      return real(id, fields);
    });
    const user = userEvent.setup();
    await openEditor(n);

    await user.type(screen.getByLabelText('Title'), 'B');
    await new Promise(r => setTimeout(r, 600));
    await user.type(screen.getByLabelText('Details'), 'more');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    act(() => release());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await stored(n.id)).toMatchObject({ title: 'AB', description: 'more' });
  });

  it('a failed save keeps the editor open with Try again; Esc a second time closes', async () => {
    const n = makeNote({ title: 'Same' });
    vi.spyOn(noteStore, 'patch').mockRejectedValue(new Error('disk full'));
    const user = userEvent.setup();
    await openEditor(n);

    await user.type(screen.getByLabelText('Title'), '!');
    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(status()).toHaveTextContent('Not saved');
    expect(screen.getByRole('alert')).toHaveTextContent(SAVE_ERROR);

    await user.keyboard('{Escape}');
    await new Promise(r => setTimeout(r, 50));
    expect(screen.getByRole('dialog')).toBeInTheDocument(); // first Esc tries again
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((await stored(n.id))?.title).toBe('Same');
  });

  it('shows one error toast when saves keep failing while you type', async () => {
    const n = makeNote({ title: 'T' });
    vi.spyOn(noteStore, 'patch').mockRejectedValue(new Error('disk full'));
    const user = userEvent.setup();
    await openEditor(n);

    await user.type(screen.getByLabelText('Title'), 'a');
    await waitFor(() => expect(status()).toHaveTextContent('Not saved'));
    await user.type(screen.getByLabelText('Title'), 'b');
    await new Promise(r => setTimeout(r, 700));
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('never overwrites a field another tab changed, unless you edit it here', async () => {
    const n = makeNote({ title: 'A', dateStr: '2026-11-08' });
    const user = userEvent.setup();
    await openEditor(n);

    await act(async () => {
      await seedNotes({ ...n, dateStr: '2026-11-09', updatedAt: new Date().toISOString() });
    });
    await user.type(screen.getByLabelText('Title'), 'B');
    await user.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(async () => expect((await stored(n.id))?.title).toBe('AB'));
    expect((await stored(n.id))?.dateStr).toBe('2026-11-09');
  });

  it('sends nothing when the note is removed elsewhere with a change waiting', async () => {
    const n = makeNote({ title: 'A' });
    const patch = vi.spyOn(noteStore, 'patch');
    const user = userEvent.setup();
    await openEditor(n);

    await user.type(screen.getByLabelText('Title'), 'B');
    await act(async () => {
      await chrome.storage.local.remove(`note:${n.id}`);
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await new Promise(r => setTimeout(r, 700));
    expect(patch).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('Move to Trash saves waiting text, closes and trashes the note', async () => {
    const n = makeNote({ description: '' });
    const user = userEvent.setup();
    await openEditor(n);

    await user.type(screen.getByLabelText('Details'), 'last words');
    await user.click(screen.getByRole('button', { name: 'Move to Trash' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(async () => expect((await stored(n.id))?.deletedAt).toBeDefined());
    expect((await stored(n.id))?.description).toBe('last words');
  });
});
