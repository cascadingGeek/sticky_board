import { Loader2 } from 'lucide-react';
import { Pin } from '@/components/ui/Pin';

/** The two screens shown before the board can draw: first load and a failed load. */

const GHOSTS = [
  { left: 110, top: 130, r: -2 },
  { left: 420, top: 112, r: 1.5 },
  { left: 735, top: 150, r: -1 },
  { left: 210, top: 480, r: 1 },
  { left: 540, top: 505, r: -2.5 },
];

/** First load: faint paper ghosts and a "Loading your board" pill. */
export function LoadingBoard() {
  return (
    <div className="board-surface relative min-h-screen overflow-hidden text-ink" aria-busy="true">
      <div aria-hidden="true">
        {GHOSTS.map((g, i) => (
          <div
            key={i}
            className="absolute h-[220px] w-[220px] border border-line bg-ghost"
            style={{ left: g.left, top: g.top + 64, transform: `rotate(${g.r}deg)` }}
          />
        ))}
      </div>
      <p
        role="status"
        className="absolute top-1/2 left-1/2 m-0 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-full bg-panel px-[22px] py-3.5 text-[15px] font-medium shadow-pop"
      >
        <Loader2 size={18} className="animate-spin text-ink-faint" aria-hidden="true" />
        Loading your board
      </p>
    </div>
  );
}

/** The first load failed. Notes are still in storage; a reload tries again. */
export function BoardLoadError() {
  return (
    <div className="board-surface relative min-h-screen text-ink">
      <main role="alert" className="absolute top-1/2 left-1/2 flex w-[min(360px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 text-center">
        <div aria-hidden="true" className="paper-note paper-cream relative h-24 w-24 -rotate-6">
          <div className="paper" />
          <Pin color="red" style={{ left: 'auto', right: 4, top: 6, transform: 'rotate(30deg)' }} />
        </div>
        <div className="board-backing flex flex-col items-center gap-3 px-4 py-2">
          <h1 className="m-0 mt-1.5 font-hand text-[32px] leading-none font-normal">Couldn't load your notes.</h1>
          <p className="m-0 text-sm leading-normal text-ink-faint">Try reopening the tab. Your notes are still saved in this browser.</p>
        </div>
        <button
          type="button"
          onClick={() => location.reload()}
          className="mt-1 h-11 rounded-xl bg-accent px-[18px] text-sm font-semibold text-accent-ink hover:opacity-90"
        >
          Reload board
        </button>
      </main>
    </div>
  );
}
