import { hashOf } from '../lib/board';

/** A 22 px letter badge for a website, its colour fixed by the site name. */
export function SiteBadge({ site }: { site: string }) {
  const letter = site.replace(/^www\./, '').charAt(0).toUpperCase() || '?';
  return (
    <span aria-hidden="true" className={`site-badge site-badge-${hashOf(site) % 5}`}>
      {letter}
    </span>
  );
}
