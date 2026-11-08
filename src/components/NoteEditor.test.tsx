import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteEditor } from './NoteEditor';
import { StickyBoardProvider, useStickyBoard } from '../lib/StickyBoardContext';
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
    </StickyBoardProvider>,
  );
  return screen.findByRole('dialog');
};

const stored = async (id: string) => (await storedNotes()).find(n => n.id === id);

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-08T12:00:00Z'));
  await chrome.storage.sync.set({ settings: { timezone: 'UTC', soundEnabled: false } });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('NoteEditor', () => {
  // covers: AC-12 (the editor has only Title, Details, Checklist, Day, Due time and Remind)
  it('shows only Title, Details, Checklist, Day, Due time and Remind', async () => {
    await openEditor(makeNote({ title: 'Plan' }));
    expect(screen.getByLabelText('Title')).toHaveValue('Plan');
    expect(screen.getByLabelText('Details')).toBeInTheDocument();
    expect(screen.getByText('Checklist')).toBeInTheDocument();
    expect(screen.getByLabelText('Day')).toHaveValue('2026-11-08');
    expect(screen.getByLabelText('Due time')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Remind me/ })).toBeInTheDocument();
    expect(screen.queryByLabelText(/priority|category|color/i)).not.toBeInTheDocument();
  });

  // covers: AC-18 (changing the time reschedules: an edited time can remind again)
  it('clears remindedAt when the due time changes, so the new time reminds', async () => {
    const n = makeNote({ dueTime: '09:00', remind: true, remindedAt: '2026-11-08T09:00:00.000Z' });
    const user = userEvent.setup();
    await openEditor(n);

    await user.clear(screen.getByLabelText('Due time'));
    await user.type(screen.getByLabelText('Due time'), '15:30');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => expect((await stored(n.id))?.dueTime).toBe('15:30'));
    expect(await stored(n.id)).not.toHaveProperty('remindedAt');
  });

  it('clears remindedAt when the day changes', async () => {
    const n = makeNote({ dueTime: '09:00', remind: true, remindedAt: '2026-11-08T09:00:00.000Z' });
    const user = userEvent.setup();
    await openEditor(n);

    await user.clear(screen.getByLabelText('Day'));
    await user.type(screen.getByLabelText('Day'), '2026-11-10');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => expect((await stored(n.id))?.dateStr).toBe('2026-11-10'));
    expect(await stored(n.id)).not.toHaveProperty('remindedAt');
  });

  it('keeps remindedAt when only the title changes', async () => {
    const n = makeNote({ title: 'Old', dueTime: '09:00', remind: true, remindedAt: '2026-11-08T09:00:00.000Z' });
    const user = userEvent.setup();
    await openEditor(n);

    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'New');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => expect((await stored(n.id))?.title).toBe('New'));
    expect((await stored(n.id))?.remindedAt).toBe('2026-11-08T09:00:00.000Z');
  });

  // covers: AC-18 (Remind needs a due time; clearing the time turns Remind off)
  it('turns Remind on with a due time, and off when the time is cleared', async () => {
    const n = makeNote();
    const user = userEvent.setup();
    await openEditor(n);
    const remind = screen.getByRole('switch', { name: /Remind me/ });

    await user.type(screen.getByLabelText('Due time'), '10:00');
    await user.click(remind);
    expect(remind).toHaveAttribute('aria-checked', 'true');

    await user.clear(screen.getByLabelText('Due time'));
    expect(remind).toHaveAttribute('aria-checked', 'false');
  });

  it('saves a due time with Remind on', async () => {
    const n = makeNote();
    const user = userEvent.setup();
    await openEditor(n);

    await user.type(screen.getByLabelText('Due time'), '10:00');
    await user.click(screen.getByRole('switch', { name: /Remind me/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => expect(await stored(n.id)).toMatchObject({ dueTime: '10:00', remind: true }));
  });

  it('refuses an empty title and shows why', async () => {
    const n = makeNote({ title: 'Keep' });
    const user = userEvent.setup();
    await openEditor(n);

    await user.clear(screen.getByLabelText('Title'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Give the note a title.');
    expect((await stored(n.id))?.title).toBe('Keep');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('adds and removes checklist items', async () => {
    const n = makeNote();
    const user = userEvent.setup();
    await openEditor(n);

    await user.type(screen.getByLabelText(/Add a checklist item/), 'Milk{Enter}');
    await user.type(screen.getByLabelText(/Add a checklist item/), 'Eggs{Enter}');
    await user.click(screen.getByRole('button', { name: 'Remove Milk' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => expect((await stored(n.id))?.subtasks.map(s => s.title)).toEqual(['Eggs']));
  });

  it('Cancel closes without saving', async () => {
    const n = makeNote({ title: 'Same' });
    const user = userEvent.setup();
    await openEditor(n);

    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Changed');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect((await stored(n.id))?.title).toBe('Same');
  });

  it('Move to Trash closes the editor and trashes the note', async () => {
    const n = makeNote();
    const user = userEvent.setup();
    await openEditor(n);

    await user.click(screen.getByRole('button', { name: 'Move to Trash' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(async () => expect((await stored(n.id))?.deletedAt).toBeDefined());
  });

  it('is a labelled modal dialog with the title field focused or reachable', async () => {
    await openEditor(makeNote());
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName();
    expect(screen.getByRole('button', { name: 'Close editor' })).toBeInTheDocument();
  });
});
