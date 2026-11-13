import { afterEach, describe, expect, it, vi } from 'vitest';
import { clampX, firstFreeSpot, hostOf, isHttpUrl, latestNoteColor, linkify, nextZ, pickColor, pinFor, tiltFor } from '@/shared/notes';
import { makeNote } from '../support/notes';
import { NOTE_COLORS } from '@/shared/types';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pickColor', () => {
  it('never repeats the latest note\'s color, whatever the random number is', () => {
    const notes = [makeNote({ noteColor: 'blue', createdAt: '2026-11-08T10:00:00.000Z' })];
    for (const r of [0, 0.124, 0.5, 0.875, 0.9999]) {
      vi.spyOn(Math, 'random').mockReturnValue(r);
      expect(pickColor(notes)).not.toBe('blue');
    }
  });

  it('can return any of the other seven colors', () => {
    const notes = [makeNote({ noteColor: 'yellow' })];
    const seen = new Set<string>();
    for (let i = 0; i < 7; i++) {
      vi.spyOn(Math, 'random').mockReturnValue(i / 7 + 0.01);
      seen.add(pickColor(notes));
    }
    expect(seen).toEqual(new Set(NOTE_COLORS.filter(c => c !== 'yellow')));
  });

  it('keeps a preferred color unless it equals the latest note\'s color', () => {
    const notes = [makeNote({ noteColor: 'pink' })];
    expect(pickColor(notes, 'mint')).toBe('mint');
    expect(pickColor(notes, 'pink')).not.toBe('pink');
  });

  it('ignores carry over copies when finding the latest note', () => {
    const original = makeNote({ noteColor: 'green', createdAt: '2026-11-08T09:00:00.000Z' });
    const copy = makeNote({ noteColor: 'orange', carriedFromId: original.id, createdAt: '2026-11-08T10:00:00.000Z' });
    expect(latestNoteColor([original, copy])).toBe('green');
  });

  it('breaks createdAt ties by the greater id', () => {
    const ts = '2026-11-08T09:00:00.000Z';
    expect(latestNoteColor([makeNote({ id: 'a', noteColor: 'blue', createdAt: ts }), makeNote({ id: 'b', noteColor: 'cream', createdAt: ts })])).toBe('cream');
  });

  it('picks freely on an empty board', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(pickColor([])).toBe('yellow');
  });
});

describe('nextZ', () => {
  it('is the highest z among the day\'s active notes plus one', () => {
    const notes = [
      makeNote({ dateStr: '2026-11-08', z: 3 }),
      makeNote({ dateStr: '2026-11-08', z: 9, deletedAt: '2026-11-08T10:00:00.000Z' }),
      makeNote({ dateStr: '2026-11-07', z: 20 }),
    ];
    expect(nextZ(notes, '2026-11-08')).toBe(4);
  });

  it('starts at 1 on an empty day', () => {
    expect(nextZ([], '2026-11-08')).toBe(1);
  });
});

describe('clampX', () => {
  it('keeps a note inside the board width minus a 16 px margin', () => {
    expect(clampX(1000, 700)).toBe(700 - 220 - 16);
    expect(clampX(100, 700)).toBe(100);
  });

  it('never goes negative', () => {
    expect(clampX(-50, 1280)).toBe(0);
    expect(clampX(300, 100)).toBe(0);
  });
});

describe('firstFreeSpot', () => {
  const viewport = { top: 0, width: 1280 };

  it('starts 24 px inside the top left on an empty day', () => {
    expect(firstFreeSpot([], viewport)).toEqual({ x: 24, y: 24 });
  });

  it('skips cells that are taken, left to right', () => {
    const taken = [makeNote({ positionX: 24, positionY: 24 }), makeNote({ positionX: 268, positionY: 24 })];
    expect(firstFreeSpot(taken, viewport)).toEqual({ x: 512, y: 24 });
  });

  it('starts from the visible top when the board is scrolled', () => {
    expect(firstFreeSpot([], { top: 900, width: 1280 })).toEqual({ x: 24, y: 924 });
  });

  it('cascades from the newest note when every cell is full', () => {
    const narrow = { top: 0, width: 300 }; // one column, three rows
    const full = [0, 1, 2].map(r =>
      makeNote({ positionX: 24, positionY: 24 + r * 244, createdAt: `2026-11-08T09:00:0${r}.000Z` }),
    );
    // The newest note is the last row; the cascade steps 24 px from it (x is clamped to 64).
    expect(firstFreeSpot(full, narrow)).toEqual({ x: 48, y: 24 + 2 * 244 + 24 });
  });
});

describe('tiltFor', () => {
  it('is the same for the same id every time', () => {
    expect(tiltFor('abc-123')).toBe(tiltFor('abc-123'));
  });

  it('stays between -2.5 and 2.5 degrees', () => {
    for (const id of ['a', 'zzzzzzzzzz', '', ...Array.from({ length: 1000 }, () => crypto.randomUUID())]) {
      const t = tiltFor(id);
      expect(t).toBeGreaterThanOrEqual(-2.5);
      expect(t).toBeLessThanOrEqual(2.5);
    }
  });
});

describe('pinFor', () => {
  it('is the same for the same id every time', () => {
    const id = crypto.randomUUID();
    expect(pinFor(id)).toBe(pinFor(id));
  });

  it('gives all four pin colours across many notes', () => {
    const seen = new Set(Array.from({ length: 1000 }, () => pinFor(crypto.randomUUID())));
    expect([...seen].sort()).toEqual(['blue', 'green', 'red', 'yellow']);
  });
});

describe('linkify', () => {
  it('turns an http(s) URL into a link without trailing punctuation', () => {
    expect(linkify('Read https://example.com/page. Then rest.')).toEqual([
      { text: 'Read ' },
      { text: 'https://example.com/page', href: 'https://example.com/page' },
      { text: '. Then rest.' },
    ]);
  });

  it('handles several links and closing brackets', () => {
    const parts = linkify('(see http://a.io/x) and https://b.io!');
    expect(parts.filter(p => p.href).map(p => p.href)).toEqual(['http://a.io/x', 'https://b.io']);
  });

  it('never links other schemes', () => {
    expect(linkify('javascript:alert(1) ftp://x.io')).toEqual([{ text: 'javascript:alert(1) ftp://x.io' }]);
  });

  it('returns plain text unchanged', () => {
    expect(linkify('just words')).toEqual([{ text: 'just words' }]);
    expect(linkify('')).toEqual([]);
  });
});

describe('isHttpUrl and hostOf', () => {
  it('accepts only http and https', () => {
    expect(isHttpUrl('https://x.io')).toBe(true);
    expect(isHttpUrl('http://x.io')).toBe(true);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('file:///etc/passwd')).toBe(false);
    expect(isHttpUrl('not a url')).toBe(false);
  });

  it('returns the host, or the input when it isn\'t a URL', () => {
    expect(hostOf('https://news.example.org:8080/a?b')).toBe('news.example.org:8080');
    expect(hostOf('nope')).toBe('nope');
  });
});
