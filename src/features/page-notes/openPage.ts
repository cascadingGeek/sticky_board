import type { Note } from '@/features/notes/notes.types';

/** Opens a page note's page in a new tab (Pages drawer and search). */
export const openPage = (n: Note) => {
  if (n.page) void chrome.tabs.create({ url: n.page.url });
};
