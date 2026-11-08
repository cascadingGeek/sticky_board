import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureLink, captureSelection, sourceFor, titleFromLink, titleFromSelection } from './capture';
import { storedNotes } from '../test/notes';

describe('titleFromSelection', () => {
  // covers: AC-16 (title is the first line, max 80)
  it('uses the first non empty line with spaces collapsed', () => {
    expect(titleFromSelection('\n\n  Hello   big\tworld \nsecond line')).toBe('Hello big world');
  });

  it('cuts long lines to 80 characters with an ellipsis', () => {
    const t = titleFromSelection('a'.repeat(120));
    expect(t).toHaveLength(80);
    expect(t.endsWith('…')).toBe(true);
  });

  it('keeps an 80 character line whole', () => {
    expect(titleFromSelection('b'.repeat(80))).toBe('b'.repeat(80));
  });

  it('returns empty for whitespace only', () => {
    expect(titleFromSelection('  \n \t ')).toBe('');
  });
});

describe('titleFromLink', () => {
  // covers: AC-17 (host and path, or "Saved link")
  it('uses the link\'s host and path', () => {
    expect(titleFromLink('https://docs.example.com/guide/start?x=1')).toBe('docs.example.com/guide/start');
  });

  it('uses just the host for a root link', () => {
    expect(titleFromLink('https://example.com/')).toBe('example.com');
  });

  it('says "Saved link" for a non http link', () => {
    expect(titleFromLink('mailto:me@example.com')).toBe('Saved link');
  });

  it('prefers selected link text when there is some', () => {
    expect(titleFromLink('https://example.com/a', 'Read this')).toBe('Read this');
  });
});

describe('sourceFor', () => {
  it('links back to an http page with its tab title', () => {
    expect(sourceFor('https://news.example.org/story', 'A story')).toEqual({ url: 'https://news.example.org/story', title: 'A story' });
  });

  // covers: value sourcing "Capture source title" (PDF viewer has no tab title)
  it('falls back to the host when the tab has no title', () => {
    expect(sourceFor('https://files.example.org/doc.pdf', '  ')).toEqual({ url: 'https://files.example.org/doc.pdf', title: 'files.example.org' });
    expect(sourceFor('https://files.example.org/doc.pdf', undefined)?.title).toBe('files.example.org');
  });

  it('has no source for non http pages', () => {
    expect(sourceFor('chrome://settings', 'Settings')).toBeUndefined();
    expect(sourceFor(undefined, 'x')).toBeUndefined();
  });
});

describe('capture into storage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-08T23:30:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // covers: AC-16
  it('saves a selection as a note on today with a source link', async () => {
    await chrome.storage.sync.set({ settings: { timezone: 'UTC' } });
    const note = await captureSelection('First line\nmore text', 'https://site.io/post', 'Post');
    const [stored] = await storedNotes();
    expect(stored).toEqual(note);
    expect(note).toMatchObject({ title: 'First line', description: 'First line\nmore text', dateStr: '2026-11-08', source: { url: 'https://site.io/post', title: 'Post' } });
  });

  it('uses the settings time zone for "today"', async () => {
    await chrome.storage.sync.set({ settings: { timezone: 'Pacific/Kiritimati' } });
    const note = await captureSelection('hi', 'https://site.io');
    expect(note.dateStr).toBe('2026-11-09');
  });

  // covers: AC-17
  it('saves a link with the URL in the details', async () => {
    await chrome.storage.sync.set({ settings: { timezone: 'UTC' } });
    const note = await captureLink('https://example.com/a/b', undefined, 'https://from.io', 'From');
    expect(note).toMatchObject({ title: 'example.com/a/b', description: 'https://example.com/a/b', source: { url: 'https://from.io', title: 'From' } });
  });
});
