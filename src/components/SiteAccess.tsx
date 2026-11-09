/**
 * The small Allow window (spec 0002, AC-4). Chrome only asks for site access
 * from a click on an extension page, so the note on the page opens this window
 * and its button makes the request for that one site.
 */
import { useState } from 'react';
import { siteOrigin } from '../lib/pageAccess';
import type { AccessGranted } from '../lib/pageMessages';

const params = new URLSearchParams(location.search);
const host = params.get('host') ?? '';
const tabId = Number(params.get('tab'));
const validHost = /^[a-z0-9.-]+$/i.test(host);

export function SiteAccess() {
  const [state, setState] = useState<'ask' | 'busy' | 'declined' | 'error'>('ask');

  const allow = async () => {
    setState('busy');
    try {
      const granted = await chrome.permissions.request({ origins: [siteOrigin(host)] });
      if (!granted) {
        setState('declined');
        return;
      }
      if (Number.isInteger(tabId)) await chrome.runtime.sendMessage({ type: 'site-access/granted', tabId } satisfies AccessGranted);
      window.close();
    } catch {
      setState('error');
    }
  };

  if (!validHost) {
    return <p className="text-sm text-ink-soft">This window was opened without a site. You can close it.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-lg font-bold">Show your notes on {host}?</h1>
      {state === 'declined' ? (
        <p role="status" className="text-sm leading-relaxed text-ink-soft">
          No problem. Your notes are still saved. To see them on this site, right click and choose “Show notes on this page”, or press Alt+Shift+N.
        </p>
      ) : (
        <p className="text-sm leading-relaxed text-ink-soft">
          Sticky Board will show your notes when you come back to pages on <strong className="text-ink">{host}</strong>. It reads only the page address and title, never the page. You can remove this any time in Settings.
        </p>
      )}
      {state === 'error' && (
        <p role="alert" className="text-sm text-danger">
          Chrome couldn't ask for access. Please try again.
        </p>
      )}
      <div className="flex gap-2">
        {state !== 'declined' && (
          <button
            type="button"
            autoFocus
            disabled={state === 'busy'}
            onClick={() => void allow()}
            className="h-11 flex-1 rounded-[10px] bg-accent text-sm font-semibold text-accent-ink hover:brightness-110 disabled:opacity-60"
          >
            Allow on {host}
          </button>
        )}
        <button type="button" onClick={() => window.close()} className="h-11 flex-1 rounded-[10px] border border-line-strong text-sm hover:bg-raise">
          {state === 'declined' ? 'Close' : 'Not now'}
        </button>
      </div>
    </div>
  );
}
