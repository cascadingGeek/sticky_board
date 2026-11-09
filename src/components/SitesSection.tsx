import { useEffect, useState } from 'react';
import { isActive } from '../lib/board';
import { grantedWebOrigins, hostnameOf, siteOrigin, splitOrigins, type SiteAccess } from '../lib/pageAccess';
import type { Note } from '../types';

const sectionTitle = 'text-xs font-semibold tracking-[0.06em] text-ink-faint uppercase';

/**
 * Settings, "Sites with page notes" (spec 0002, AC-16): each site Sticky Board
 * may show notes on by itself, with its note count and a Remove button.
 */
export function SitesSection({ notes }: { notes: Note[] }) {
  const [access, setAccess] = useState<SiteAccess | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const read = () =>
      grantedWebOrigins()
        .then(o => {
          if (!cancelled) setAccess(splitOrigins(o));
        })
        .catch(() => {
          if (!cancelled) setError(true);
        });
    void read();
    // Access can change in the Allow window or in Chrome while this is open.
    chrome.permissions.onAdded.addListener(read);
    chrome.permissions.onRemoved.addListener(read);
    return () => {
      cancelled = true;
      chrome.permissions.onAdded.removeListener(read);
      chrome.permissions.onRemoved.removeListener(read);
    };
  }, []);

  const pageNotes = notes.filter(n => n.page && isActive(n));
  const countFor = (host: string) => pageNotes.filter(n => hostnameOf(n.page!.url) === host).length;
  const remove = async (origins: string[]) => {
    try {
      await chrome.permissions.remove({ origins });
      setAccess(splitOrigins(await grantedWebOrigins()));
    } catch {
      setError(true);
    }
  };

  const rows = [
    ...(access?.allSites.length ? [{ key: 'all', label: 'All sites', count: pageNotes.length, origins: access.allSites }] : []),
    ...(access?.hosts ?? []).map(h => ({ key: h, label: h, count: countFor(h), origins: [siteOrigin(h)] })),
  ];

  return (
    <section aria-labelledby="set-sites" className="flex flex-col gap-3">
      <h3 id="set-sites" className={sectionTitle}>
        Sites with page notes
      </h3>
      <p className="text-[13px] leading-relaxed text-ink-faint">
        Notes show by themselves on these sites. On other sites, right click and choose “Show notes on this page”. A page note can be seen by the page it sits on.
      </p>
      {access && rows.length === 0 && <p className="text-[13px] text-ink-soft">No sites yet. Click Allow on a page note to add its site.</p>}
      {rows.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {rows.map(r => (
            <li key={r.key} className="flex min-h-12 items-center gap-3 rounded-[10px] border border-line bg-raise px-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm">{r.label}</span>
                <span className="text-xs text-ink-faint">
                  {r.count} {r.count === 1 ? 'note' : 'notes'}
                </span>
              </span>
              <button
                type="button"
                aria-label={`Remove ${r.label}`}
                onClick={() => void remove(r.origins)}
                className="h-9 rounded-[9px] border border-line-strong px-3 text-[13px] hover:bg-raise-strong"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-[13px] text-danger">
          Couldn't read site access. Try reopening Settings.
        </p>
      )}
    </section>
  );
}
