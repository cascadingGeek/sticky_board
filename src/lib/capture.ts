/** Right click capture: turns a selection or a link into a note on today's board. */
import { hostOf, isHttpUrl } from './board';
import { resolveTz, todayInTz } from './dates';
import { createNote, settings } from './storage';
import { DESCRIPTION_MAX } from '../types';

const TITLE_CUT = 80;

const cut = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export const titleFromSelection = (selection: string): string => {
  const line = selection.split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).find(Boolean) ?? '';
  return cut(line, TITLE_CUT);
};

export const titleFromLink = (linkUrl: string, selection?: string): string => {
  const sel = selection ? titleFromSelection(selection) : '';
  if (sel) return sel;
  if (!isHttpUrl(linkUrl)) return 'Saved link';
  const u = new URL(linkUrl);
  return cut(`${u.host}${u.pathname === '/' ? '' : u.pathname}`, TITLE_CUT);
};

export const sourceFor = (pageUrl: string | undefined, tabTitle: string | undefined) =>
  pageUrl && isHttpUrl(pageUrl) ? { url: pageUrl, title: tabTitle?.trim() || hostOf(pageUrl) } : undefined;

export const captureSelection = async (selection: string, pageUrl?: string, tabTitle?: string) => {
  const s = await settings.get();
  const source = sourceFor(pageUrl, tabTitle);
  const title = titleFromSelection(selection) || (pageUrl ? hostOf(pageUrl) : 'Clipped text');
  return createNote({
    title,
    description: cut(selection.trim(), DESCRIPTION_MAX),
    dateStr: todayInTz(resolveTz(s.timezone)),
    source,
  });
};

export const captureLink = async (linkUrl: string, selection?: string, pageUrl?: string, tabTitle?: string) => {
  const s = await settings.get();
  return createNote({
    title: titleFromLink(linkUrl, selection),
    description: cut(linkUrl, DESCRIPTION_MAX),
    dateStr: todayInTz(resolveTz(s.timezone)),
    source: sourceFor(pageUrl, tabTitle),
  });
};
