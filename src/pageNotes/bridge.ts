/** Connects the content script entry (messages, address changes, right clicks) to the React app. */
export type BridgeEvent =
  | { type: 'new-draft'; via: 'menu' | 'shortcut' }
  | { type: 'access'; allowed: boolean }
  | { type: 'location'; href: string } // the new address
  | { type: 'reload' };

export interface Bridge {
  emit: (e: BridgeEvent) => void;
  on: (cb: (e: BridgeEvent) => void) => () => void;
  /** The spot of the last right click on the page, if one was seen recently. */
  takeContextSpot: () => { x: number; y: number } | null;
  setContextSpot: (x: number, y: number) => void;
}

const SPOT_FRESH_MS = 30_000;

export const createBridge = (): Bridge => {
  const listeners = new Set<(e: BridgeEvent) => void>();
  const queued: BridgeEvent[] = [];
  let spot: { x: number; y: number; at: number } | null = null;
  return {
    emit: e => {
      // Events sent before the app is listening (right after injection) wait for it.
      if (!listeners.size) queued.push(e);
      for (const l of listeners) l(e);
    },
    on: cb => {
      listeners.add(cb);
      for (const e of queued.splice(0)) cb(e);
      return () => listeners.delete(cb);
    },
    setContextSpot: (x, y) => {
      spot = { x, y, at: Date.now() };
    },
    takeContextSpot: () => {
      const s = spot;
      spot = null;
      return s && Date.now() - s.at < SPOT_FRESH_MS ? { x: s.x, y: s.y } : null;
    },
  };
};
