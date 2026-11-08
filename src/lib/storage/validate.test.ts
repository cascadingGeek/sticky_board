import { describe, expect, it } from 'vitest';
import { parseNote, parseSettings } from './validate';
import { makeNote } from '../../test/notes';
import { DEFAULT_SETTINGS } from '../../types';

describe('parseNote', () => {
  it('accepts a valid note and keeps its fields', () => {
    const n = makeNote({ title: 'Buy milk', dueTime: '09:30', source: { url: 'https://x.io/a', title: 'X' } });
    expect(parseNote(n)).toMatchObject({ id: n.id, title: 'Buy milk', dueTime: '09:30', source: { url: 'https://x.io/a', title: 'X' } });
  });

  it('drops fields it doesn\'t know about', () => {
    const parsed = parseNote({ ...makeNote(), priority: 'high', userId: 'u1' });
    expect(parsed).not.toHaveProperty('priority');
    expect(parsed).not.toHaveProperty('userId');
  });

  it('fills defaults for an older note without description, subtasks or positions', () => {
    const { description: _d, subtasks: _s, positionX: _x, positionY: _y, z: _z, ...older } = makeNote();
    const parsed = parseNote(older);
    expect(parsed).toMatchObject({ description: '', subtasks: [] });
    expect(parsed?.positionX).toBeUndefined();
  });

  // covers: AC-5 (a javascript: source or a broken note is rejected)
  it.each([
    ['a javascript: source URL', { source: { url: 'javascript:alert(1)', title: 'x' } }],
    ['an empty title', { title: '   ' }],
    ['a title over 200 characters', { title: 'x'.repeat(201) }],
    ['a description over 5,000 characters', { description: 'x'.repeat(5001) }],
    ['an impossible date', { dateStr: '2026-02-30' }],
    ['an unknown color', { noteColor: 'red' }],
    ['more than 50 checklist items', { subtasks: Array.from({ length: 51 }, (_, i) => ({ id: `${i}`, title: 't', isCompleted: false })) }],
    ['a broken checklist item', { subtasks: [{ id: 's', title: 't' }] }],
    ['a bad due time', { dueTime: '25:00' }],
    ['a non number position', { positionX: '10' }],
    ['a bad deletedAt', { deletedAt: 'yesterday' }],
    ['a bad carriedToDate', { carriedToDate: 'soon' }],
    ['a missing id', { id: '' }],
  ])('rejects %s', (_label, bad) => {
    expect(parseNote({ ...makeNote(), ...bad })).toBeNull();
  });

  it.each([null, undefined, 'note', 42, []])('rejects a non object (%s)', raw => {
    expect(parseNote(raw)).toBeNull();
  });
});

describe('parseSettings', () => {
  it('returns defaults for nothing stored', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid fields and resets only the invalid ones', () => {
    expect(parseSettings({ theme: 'cork', soundEnabled: 'yes', timezone: 'Asia/Tokyo', startOfWeek: 1, handwritingFont: false })).toEqual({
      theme: 'cork',
      soundEnabled: true,
      timezone: 'Asia/Tokyo',
      startOfWeek: 1,
      handwritingFont: false,
    });
  });

  it('rejects an unknown theme', () => {
    expect(parseSettings({ theme: 'neon' }).theme).toBe('dark');
  });
});
