import { Globe } from 'lucide-react';
import { isActive } from '../lib/board';
import { hostnameOf, siteOrigin } from '../lib/pageAccess';
import { useSiteAccess } from '../lib/useSiteAccess';
import type { Note } from '../types';
import { SiteBadge } from './SiteBadge';

const sectionTitle = 'm-0 text-xs font-semibold tracking-[0.06em] text-ink-faint uppercase';

/**
 * Settings, "Sites with page notes" (spec 0002, AC-16): each site Sticky Board
 * may show notes on by itself, with its note count and a Remove button.
 */
export function SitesSection({ notes }: { notes: Note[] }) {
  const { access, error, setError, refresh } = useSiteAccess();

  const pageNotes = notes.filter(n => n.page && isActive(n));
  const countFor = (host: string) => pageNotes.filter(n => hostnameOf(n.page!.url) === host).length;
  const remove = async (origins: string[]) => {
    try {
      await chrome.permissions.remove({ origins });
      await refresh();
    } catch {
      setError(true);
    }
  };

  const rows = [
    ...(access?.allSites.length ? [{ key: 'all', label: 'All sites', all: true, count: pageNotes.length, origins: access.allSites }] : []),
    ...(access?.hosts ?? []).map(h => ({ key: h, label: h, all: false, count: countFor(h), origins: [siteOrigin(h)] })),
  ];

  return (
    <section aria-labelledby="set-sites" className="flex flex-col gap-3">
      <h3 id="set-sites" className={sectionTitle}>
        Sites with page notes
      </h3>
      {access && rows.length === 0 && <p className="m-0 text-sm text-ink">No sites yet. Click Allow on a page note to add its site.</p>}
      {rows.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {rows.map(r => (
            <li key={r.key} className="flex min-h-[52px] items-center gap-3 rounded-[12px] bg-raise px-3 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
              {r.all ? (
                <span aria-hidden="true" className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md bg-accent text-accent-ink">
                  <Globe size={13} />
                </span>
              ) : (
                <SiteBadge site={r.label} />
              )}
              <span className={`min-w-0 flex-1 truncate text-sm ${r.all ? 'font-semibold' : ''}`}>{r.label}</span>
              <span className="flex-none text-xs text-ink-faint">
                {r.count} {r.count === 1 ? 'note' : 'notes'}
              </span>
              <button
                type="button"
                aria-label={`Remove ${r.label}`}
                onClick={() => void remove(r.origins)}
                className="min-h-11 flex-none rounded-[9px] px-2.5 text-[13px] font-semibold text-danger hover:bg-hover"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="m-0 text-xs leading-relaxed text-ink-faint">
        Removing a site keeps its notes. They show again when you ask from the right click menu. Page notes are visible to the page they sit on.
      </p>
      {error && (
        <p role="alert" className="m-0 text-[13px] text-danger">
          Couldn't read site access. Try reopening Settings.
        </p>
      )}
    </section>
  );
}
