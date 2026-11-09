import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { pickColor } from '../lib/board';
import type { HelloReply, PageRequest, WriteReply } from '../lib/pageMessages';
import { drawnSpot, normalizePageUrl, notesOnPage, stackedSpot, type PagePatch } from '../lib/pageNotes';
import { notes as noteStore } from '../lib/storage';
import { PAGE_NOTE_LIMIT, type Note } from '../types';
import type { Bridge } from './bridge';
import { PageDraft, type PageDraftState } from './PageDraft';
import { PageNote } from './PageNote';

export const LIMIT_MESSAGE = 'This page already has 50 notes.';

export type Send = <R>(msg: PageRequest) => Promise<R>;

const docSize = () => ({
  w: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0, window.innerWidth),
  h: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0, window.innerHeight),
});

/** Every page note for the current address, plus a draft when you pin a new one. */
export function PageNotesApp({ bridge, send }: { bridge: Bridge; send: Send }) {
  const [url, setUrl] = useState(() => normalizePageUrl(location.href));
  const [all, setAll] = useState<Map<string, Note>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [allowed, setAllowed] = useState(true);
  const [draft, setDraft] = useState<PageDraftState | null>(null);
  const [size, setSize] = useState(docSize);
  const draftKey = useRef(0);

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

  // Live updates from the board and other tabs (AC-8).
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

  // A draft asked for before the notes loaded waits for them (the AC-3 spot needs them).
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
          // AC-14: a new address swaps the notes; only a #part change keeps them.
          // Use the address from the event: it fires before location.href changes.
          const next = normalizePageUrl(e.href);
          setUrl(cur => {
            if (cur !== next) setDraft(null);
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
    send<WriteReply>({ type: 'page-notes/patch', id: n.id, fields })
      .then(r => applyReply(n.id, r))
      .catch(() => undefined);
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
    <div className="sb-root">
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
          />
        );
      })}
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
