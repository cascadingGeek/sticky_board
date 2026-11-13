import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { pickColor } from '../lib/board';
import type { HelloReply, MoveReply, PageRequest, UndoMoveReply, WriteReply } from '../lib/pageMessages';
import { drawnSpot, normalizePageUrl, notesOnPage, stackedSpot, type PagePatch } from '../lib/pageNotes';
import { notes as noteStore, settings as settingsStore } from '../lib/storage';
import { DAY_FULL_MESSAGE, PAGE_NOTE_LIMIT, type Note } from '../types';
import type { Bridge } from './bridge';
import { loadHandFont } from './font';
import { MovedMessage, type Notice } from './MovedMessage';
import { PageDraft, type PageDraftState } from './PageDraft';
import { PageNote } from './PageNote';

export const LIMIT_MESSAGE = 'This page already has 50 notes.';
const MOVED_MESSAGE = "Moved to today's board";
const GONE_MESSAGE = 'This note was already moved or deleted.';
const MOVE_FAILED_MESSAGE = "Couldn't move the note. Try again.";

/** How long note text may stay hidden while the handwriting font loads. */
const FONT_WAIT_MS = 300;

export type Send = <R>(msg: PageRequest) => Promise<R>;

const docSize = () => ({
  w: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0, window.innerWidth),
  h: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0, window.innerHeight),
});

/** Every page note for the current address, plus a draft when you pin a new one. */
export function PageNotesApp({ bridge, send }: { bridge: Bridge; send: Send }) {
  const [url, setUrl] = useState(() => normalizePageUrl(location.href));
  // The current address, for replies that arrive after the page moved on.
  const urlRef = useRef(url);
  const [all, setAll] = useState<Map<string, Note>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [allowed, setAllowed] = useState(true);
  const [draft, setDraft] = useState<PageDraftState | null>(null);
  const [size, setSize] = useState(docSize);
  const draftKey = useRef(0);
  // Moves waiting on a reply, their errors, and the messages left behind.
  const [moving, setMoving] = useState<Map<string, string | null>>(new Map());
  const [notices, setNotices] = useState<Notice[]>([]);
  const noticeKey = useRef(0);
  // The last save sent for each note, so a move waits for text typed just before it.
  const writes = useRef(new Map<string, Promise<unknown>>());

  const load = useCallback(
    () =>
      noteStore.getAll().then(list => {
        setAll(new Map(list.map(n => [n.id, n])));
        setLoaded(true);
      }),
    [],
  );

  // First load, and whether this site is allowed (no Allow line when it is).
  useEffect(() => {
    load().catch(() => undefined);
    send<HelloReply>({ type: 'page-notes/hello' })
      .then(r => setAllowed(!!r?.allowed))
      .catch(() => undefined);
  }, [load, send]);

  // "Handwriting on notes" from Settings, kept current.
  const [plain, setPlain] = useState(false);
  useEffect(() => {
    let gone = false;
    void settingsStore.get().then(s => {
      if (!gone) setPlain(!s.handwritingFont);
    });
    const stop = settingsStore.subscribe(s => setPlain(!s.handwritingFont));
    return () => {
      gone = true;
      stop();
    };
  }, []);

  // Text stays hidden until the font is ready or refused, or FONT_WAIT_MS pass.
  const [textReady, setTextReady] = useState(false);
  useEffect(() => {
    let gone = false;
    const show = () => {
      if (!gone) setTextReady(true);
    };
    const timer = setTimeout(show, FONT_WAIT_MS);
    void loadHandFont().then(show);
    return () => {
      gone = true;
      clearTimeout(timer);
    };
  }, []);

  // Live updates from the board and other tabs.
  useEffect(
    () =>
      noteStore.subscribe(({ upserted, removed }) =>
        setAll(prev => {
          const next = new Map(prev);
          for (const n of upserted) next.set(n.id, n);
          for (const id of removed) next.delete(id);
          return next;
        }),
      ),
    [],
  );

  // Page size, for keeping notes inside the page when drawn.
  useEffect(() => {
    const update = () => setSize(docSize());
    const ro = new ResizeObserver(update);
    ro.observe(document.documentElement);
    if (document.body) ro.observe(document.body);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const allList = useMemo(() => [...all.values()], [all]);
  const onPage = useMemo(() => (url ? notesOnPage(allList, url).sort((a, b) => a.z - b.z) : []), [allList, url]);

  const startDraft = useCallback(
    (via: 'menu' | 'shortcut') => {
      const clicked = bridge.takeContextSpot();
      const spot = via === 'menu' && clicked ? clicked : stackedSpot(onPage, window.scrollX, window.scrollY);
      draftKey.current += 1;
      setDraft({
        key: draftKey.current,
        x: Math.round(spot.x),
        y: Math.round(spot.y),
        color: pickColor(allList),
        title: '',
        saving: false,
        error: onPage.length >= PAGE_NOTE_LIMIT ? LIMIT_MESSAGE : undefined,
      });
    },
    [bridge, onPage, allList],
  );

  // A draft asked for before the notes loaded waits for them.
  const waiting = useRef<'menu' | 'shortcut' | null>(null);
  const startRef = useRef(startDraft);
  useLayoutEffect(() => {
    startRef.current = startDraft;
  }, [startDraft]);
  useEffect(() => {
    if (loaded && waiting.current) {
      startRef.current(waiting.current);
      waiting.current = null;
    }
  }, [loaded]);
  const loadedRef = useRef(loaded);
  useLayoutEffect(() => {
    loadedRef.current = loaded;
  }, [loaded]);

  useEffect(
    () =>
      bridge.on(e => {
        if (e.type === 'new-draft') {
          if (loadedRef.current) startRef.current(e.via);
          else waiting.current = e.via;
        } else if (e.type === 'access') {
          setAllowed(e.allowed);
        } else if (e.type === 'location') {
          // A new address swaps the notes; only a #part change keeps them.
          // Use the address from the event: it fires before location.href changes.
          const next = normalizePageUrl(e.href);
          urlRef.current = next;
          setUrl(cur => {
            if (cur !== next) {
              setDraft(null);
              setNotices([]);
            }
            return next;
          });
        } else if (e.type === 'reload') {
          void load();
        }
      }),
    [bridge, load],
  );

  const commitDraft = async () => {
    const d = draft;
    if (!d || d.saving || d.error) return;
    const title = d.title.trim();
    if (!title) {
      setDraft(null);
      return;
    }
    setDraft({ ...d, saving: true });
    try {
      const r = await send<WriteReply>({ type: 'page-notes/create', x: d.x, y: d.y, title, color: d.color });
      if ('note' in r) {
        setAll(prev => new Map(prev).set(r.note.id, r.note));
        setDraft(cur => (cur?.key === d.key ? null : cur));
      } else {
        const error = r.error === 'limit' ? LIMIT_MESSAGE : "Couldn't save the note. Try again.";
        setDraft(cur => (cur?.key === d.key ? { ...cur, saving: false, error } : cur));
      }
    } catch {
      setDraft(cur => (cur?.key === d.key ? { ...cur, saving: false, error: "Couldn't save the note. Try again." } : cur));
    }
  };

  const applyReply = (id: string, r: WriteReply) => {
    if ('note' in r) setAll(prev => new Map(prev).set(r.note.id, r.note));
    else if (r.error === 'gone') {
      setAll(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const patch = (n: Note, fields: PagePatch) => {
    setAll(prev => new Map(prev).set(n.id, { ...n, ...fields }));
    const sent = send<WriteReply>({ type: 'page-notes/patch', id: n.id, fields })
      .then(r => applyReply(n.id, r))
      .catch(() => undefined);
    writes.current.set(n.id, sent);
  };

  const setMove = (id: string, value: string | null | undefined) =>
    setMoving(prev => {
      const next = new Map(prev);
      if (value === undefined) next.delete(id);
      else next.set(id, value);
      return next;
    });
  const addNotice = (n: Omit<Notice, 'key'>) => {
    noticeKey.current += 1;
    const key = noticeKey.current;
    setNotices(list => [...list, { ...n, key }]);
  };

  /** Not optimistic: the note stays, buttons disabled, until the background answers. */
  const moveToBoard = async (n: Note, x: number, y: number) => {
    if (moving.get(n.id) === null) return;
    setMove(n.id, null);
    const from = urlRef.current;
    await writes.current.get(n.id);
    let r: MoveReply;
    try {
      r = await send<MoveReply>({ type: 'page-notes/move-to-board', id: n.id });
    } catch {
      r = { error: 'failed' };
    }
    if ('boardId' in r) {
      setMove(n.id, undefined);
      setAll(prev => new Map(prev).set(n.id, { ...n, deletedAt: new Date().toISOString() }));
      // A message belongs to the address it was made on; the page may have moved on since.
      if (urlRef.current === from) addNotice({ x, y, text: MOVED_MESSAGE, undo: { pageId: r.pageId, boardId: r.boardId } });
    } else if (r.error === 'gone') {
      setMove(n.id, undefined);
      setAll(prev => {
        const next = new Map(prev);
        next.delete(n.id);
        return next;
      });
      if (urlRef.current === from) addNotice({ x, y, text: GONE_MESSAGE });
    } else {
      setMove(n.id, r.error === 'day-full' ? DAY_FULL_MESSAGE : MOVE_FAILED_MESSAGE);
    }
  };

  const undoMove = async ({ pageId, boardId }: { pageId: string; boardId: string }): Promise<string | null> => {
    try {
      const r = await send<UndoMoveReply>({ type: 'page-notes/undo-move', pageId, boardId });
      if ('ok' in r) {
        void load();
        return null;
      }
      if (r.error === 'limit') return LIMIT_MESSAGE;
      if (r.error === 'gone') return "Couldn't undo, the page note is no longer in Trash.";
      return "Couldn't undo. Please try again.";
    } catch {
      return "Couldn't undo. Please try again.";
    }
  };

  const trash = (n: Note) => {
    setAll(prev => new Map(prev).set(n.id, { ...n, deletedAt: new Date().toISOString() }));
    send<WriteReply>({ type: 'page-notes/trash', id: n.id })
      .then(r => applyReply(n.id, r))
      .catch(() => undefined);
  };

  const allow = () => {
    void send({ type: 'page-notes/open-access', host: location.hostname }).catch(() => undefined);
  };

  return (
    <div className={`sb-root${plain ? ' no-handwriting' : ''}${textReady ? '' : ' sb-hide-text'}`}>
      {onPage.map(n => {
        const spot = drawnSpot(n, size.w, size.h);
        return (
          <PageNote
            key={n.id}
            note={n}
            x={spot.x}
            y={spot.y}
            allowed={allowed}
            onPatch={fields => patch(n, fields)}
            onTrash={() => trash(n)}
            onAllow={allow}
            moving={moving.get(n.id) === null}
            moveError={moving.get(n.id) ?? undefined}
            onMove={() => void moveToBoard(n, spot.x, spot.y)}
          />
        );
      })}
      {notices.map(n => (
        <MovedMessage key={n.key} notice={n} onUndo={undoMove} onDone={() => setNotices(list => list.filter(x => x.key !== n.key))} />
      ))}
      {draft && (
        <PageDraft
          draft={draft}
          onChange={title => setDraft(d => (d ? { ...d, title } : d))}
          onCommit={() => void commitDraft()}
          onDiscard={() => setDraft(null)}
        />
      )}
    </div>
  );
}
