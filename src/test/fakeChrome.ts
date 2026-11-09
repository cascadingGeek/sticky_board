/**
 * An in-memory stand in for the chrome.* APIs the app uses (storage, alarms,
 * notifications, runtime) plus navigator.locks. Tests run the real storage
 * layer on top of it; only the browser boundary is faked.
 */
import { vi } from 'vitest';

type Listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => void;

const clone = <T>(v: T): T => (v === undefined ? v : structuredClone(v));

const makeArea = (name: 'local' | 'sync', listeners: Set<Listener>) => {
  const data = new Map<string, unknown>();
  const emit = (changes: Record<string, chrome.storage.StorageChange>) => {
    if (Object.keys(changes).length) for (const l of [...listeners]) l(changes, name);
  };
  return {
    data,
    get: vi.fn(async (keys?: string | string[] | null) => {
      const out: Record<string, unknown> = {};
      const wanted = keys == null ? [...data.keys()] : Array.isArray(keys) ? keys : [keys];
      for (const k of wanted) if (data.has(k)) out[k] = clone(data.get(k));
      return out;
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      const changes: Record<string, chrome.storage.StorageChange> = {};
      for (const [k, v] of Object.entries(items)) {
        changes[k] = { oldValue: clone(data.get(k)), newValue: clone(v) };
        data.set(k, clone(v));
      }
      emit(changes);
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      const changes: Record<string, chrome.storage.StorageChange> = {};
      for (const k of Array.isArray(keys) ? keys : [keys]) {
        if (!data.has(k)) continue;
        changes[k] = { oldValue: clone(data.get(k)) };
        data.delete(k);
      }
      emit(changes);
    }),
  };
};

/** A chrome event: listeners can be added and removed, and tests fire it with `emit`. */
export const makeEvent = <A extends unknown[]>() => {
  const listeners = new Set<(...args: A) => unknown>();
  return {
    addListener: (l: (...args: A) => unknown) => void listeners.add(l),
    removeListener: (l: (...args: A) => unknown) => void listeners.delete(l),
    hasListeners: () => listeners.size > 0,
    /** Calls every listener and waits for any promises they return. */
    emit: async (...args: A) => {
      await Promise.all([...listeners].map(l => l(...args)));
    },
  };
};

export const installFakeChrome = () => {
  const listeners = new Set<Listener>();
  const local = makeArea('local', listeners);
  const sync = makeArea('sync', listeners);
  const alarms = new Map<string, { name: string; scheduledTime: number }>();
  const notifications = new Map<string, chrome.notifications.NotificationOptions>();
  const granted = new Set<string>();
  const registered = new Map<string, chrome.scripting.RegisteredContentScript>();

  const fake = {
    storage: {
      local,
      sync,
      onChanged: {
        addListener: (l: Listener) => listeners.add(l),
        removeListener: (l: Listener) => listeners.delete(l),
      },
    },
    alarms: {
      create: vi.fn(async (name: string, info: { when?: number; delayInMinutes?: number; periodInMinutes?: number }) => {
        alarms.set(name, { name, scheduledTime: info.when ?? Date.now() + (info.delayInMinutes ?? 0) * 60_000 });
      }),
      clear: vi.fn(async (name: string) => alarms.delete(name)),
      get: vi.fn(async (name: string) => alarms.get(name)),
      onAlarm: makeEvent<[{ name: string }]>(),
    },
    notifications: {
      create: vi.fn((id: string, options: chrome.notifications.NotificationOptions) => {
        notifications.set(id, options);
      }),
      clear: vi.fn((id: string) => notifications.delete(id)),
      onClicked: makeEvent<[string]>(),
    },
    runtime: {
      id: 'test-id',
      getURL: (path: string) => `chrome-extension://test-id/${path.replace(/^\//, '')}`,
      onMessage: makeEvent<[unknown]>(),
      onInstalled: makeEvent<[{ reason: string }]>(),
      onStartup: makeEvent<[]>(),
      ContextType: { TAB: 'TAB' },
      getContexts: vi.fn(async (): Promise<{ documentUrl?: string; tabId?: number; windowId?: number }[]> => []),
    },
    contextMenus: {
      removeAll: vi.fn(async () => undefined),
      create: vi.fn(),
      onClicked: makeEvent<[{ menuItemId: string; selectionText?: string; linkUrl?: string; pageUrl?: string }, { title?: string } | undefined]>(),
    },
    action: { onClicked: makeEvent<[]>() },
    tabs: {
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
      get: vi.fn(async (id: number) => ({ id, status: 'complete' })),
      sendMessage: vi.fn(async (..._args: unknown[]): Promise<unknown> => undefined),
    },
    windows: { update: vi.fn(async () => ({})), create: vi.fn(async () => ({})) },
    // Site access (spec 0002). `granted` holds the origins Chrome has allowed.
    permissions: {
      getAll: vi.fn(async () => ({ origins: [...granted], permissions: [] })),
      contains: vi.fn(async ({ origins = [] }: { origins?: string[] }) =>
        origins.every(o => granted.has(o) || granted.has(o.replace(/^https?:/, '*:')))),
      request: vi.fn(async ({ origins = [] }: { origins?: string[] }) => {
        origins.forEach(o => granted.add(o));
        return true;
      }),
      remove: vi.fn(async ({ origins = [] }: { origins?: string[] }) => {
        origins.forEach(o => granted.delete(o));
        return true;
      }),
      onAdded: makeEvent<[unknown]>(),
      onRemoved: makeEvent<[unknown]>(),
    },
    scripting: {
      getRegisteredContentScripts: vi.fn(async ({ ids }: { ids?: string[] } = {}) =>
        [...registered.values()].filter(r => !ids || ids.includes(r.id))),
      registerContentScripts: vi.fn(async (list: chrome.scripting.RegisteredContentScript[]) => {
        list.forEach(r => registered.set(r.id, r));
      }),
      updateContentScripts: vi.fn(async (list: chrome.scripting.RegisteredContentScript[]) => {
        list.forEach(r => registered.set(r.id, { ...registered.get(r.id)!, ...r }));
      }),
      unregisterContentScripts: vi.fn(async ({ ids }: { ids?: string[] } = {}) => {
        (ids ?? [...registered.keys()]).forEach(id => registered.delete(id));
      }),
      executeScript: vi.fn(async (..._args: unknown[]): Promise<unknown[]> => []),
    },
    commands: { onCommand: makeEvent<[string, { id?: number; url?: string } | undefined]>() },
  };

  // navigator.locks: run callbacks for the same name one at a time, like the browser does.
  const queues = new Map<string, Promise<unknown>>();
  const locks = {
    request: <T>(name: string, cb: () => Promise<T>): Promise<T> => {
      const prev = queues.get(name) ?? Promise.resolve();
      const run = prev.catch(() => undefined).then(cb);
      queues.set(name, run);
      return run;
    },
  };

  vi.stubGlobal('chrome', fake);
  Object.defineProperty(navigator, 'locks', { value: locks, configurable: true });

  return { local: local.data, sync: sync.data, alarms, notifications, granted, registered, fake };
};

export type FakeChrome = ReturnType<typeof installFakeChrome>;
