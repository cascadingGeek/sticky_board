/**
 * Messages between the page-notes content script, the site access window and
 * the background worker (spec 0002, API surface). Pages never write storage:
 * every write is a message the background checks and applies.
 */
import type { Note, NoteColor } from '../types';
import type { PagePatch } from './pageNotes';

/** Content script → background. */
export type PageRequest =
  | { type: 'page-notes/hello' }
  | { type: 'page-notes/create'; x: number; y: number; title: string; color?: NoteColor }
  | { type: 'page-notes/patch'; id: string; fields: PagePatch }
  | { type: 'page-notes/trash'; id: string }
  | { type: 'page-notes/open-access'; host: string };

export type HelloReply = { allowed: boolean };
export type WriteReply = { note: Note } | { error: 'limit' | 'gone' | 'invalid' | 'failed' };

/** Site access window → background. */
export type AccessGranted = { type: 'site-access/granted'; tabId: number };

/** Background → content script. */
export type PageCommand =
  | { type: 'page-notes/ping' }
  | { type: 'page-notes/new-draft'; via: 'menu' | 'shortcut' }
  | { type: 'page-notes/access'; allowed: boolean };

export const PING_REPLY = 'page-notes/pong';

export const isPageRequest = (m: unknown): m is PageRequest =>
  !!m && typeof m === 'object' && typeof (m as { type?: unknown }).type === 'string' && (m as { type: string }).type.startsWith('page-notes/');
