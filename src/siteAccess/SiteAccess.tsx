/**
 * The small Allow window. Chrome only asks for site access from a click on an
 * extension page, so a page note opens this window to ask for its site.
 */
import { useState } from 'react';
import { siteOrigin } from '../shared/siteAccess';
import type { AccessGranted } from '../shared/messages';
import { Pin } from '../shared/ui/Pin';

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
    return <p className="m-0 text-sm text-ink-soft">This window was opened without a site. You can close it.</p>;
  }

  if (state === 'declined') {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="m-0 text-xl font-bold">No problem, your note is saved.</h1>
        <p role="status" className="m-0 text-sm leading-relaxed text-ink-soft">
          It won't show by itself on {host}. To see it, right click the page and choose <strong className="text-ink">Show notes on this page</strong>, or find it
          in Pages on your board.
        </p>
        <button
          type="button"
          autoFocus
          onClick={() => window.close()}
          className="mt-1.5 h-11 rounded-xl bg-accent text-sm font-semibold text-accent-ink hover:opacity-90"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <span aria-hidden="true" className="paper-note paper-pink relative mb-2 block h-16 w-16 -rotate-3">
        <span className="paper flex items-end px-2.5 pb-3 font-hand text-lg text-[var(--paper-ink)]">
          <Pin color="blue" style={{ top: 4, transform: 'scale(0.8)' }} />
          Ask…
        </span>
      </span>
      <h1 className="m-0 text-xl leading-snug font-bold">Show your notes on {host}?</h1>
      <p className="m-0 text-sm leading-relaxed text-ink-soft">
        Your notes will be waiting at the same spot every time you come back. Sticky Board only reads the page address and title on this one site,
        nothing else.
      </p>
      {state === 'error' && (
        <p role="alert" className="m-0 text-sm text-danger">
          Chrome couldn't ask for access. Please try again.
        </p>
      )}
      <button
        type="button"
        autoFocus
        disabled={state === 'busy'}
        onClick={() => void allow()}
        className="mt-1 h-[46px] rounded-xl bg-accent text-[15px] font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
      >
        Allow on {host}
      </button>
      <button type="button" onClick={() => window.close()} className="h-11 rounded-xl text-sm font-medium text-ink hover:bg-hover">
        Not now
      </button>
      <p className="m-0 mt-2 text-center text-xs text-ink-soft">Your note is saved either way. You'll find it in Pages on your board.</p>
    </div>
  );
}
