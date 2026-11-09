/**
 * Background service worker: right click capture, reminders, trash purge,
 * migrations, opening the board, and page notes (spec 0002). It keeps no state between events;
 * everything is read from storage each time. All listeners are registered
 * at the top level so Chrome can wake the worker for any of them.
 */
import { captureLink, captureSelection } from '../lib/capture';
import { resolveTz, todayInTz } from '../lib/dates';
import { pageMessageListener, pinOnTab, syncRegistration } from '../lib/pageAccess';
import { REMINDER_ALARM, runReminderCheck } from '../lib/reminders';
import { notes, purgeTrash, runMigrations, settings } from '../lib/storage';

const PURGE_ALARM = 'purge-trash';
const BOARD_PATH = 'newtab.html';
const WEB_PAGES = ['http://*/*', 'https://*/*'];

const today = async () => todayInTz(resolveTz((await settings.get()).timezone));

const ensureAlarms = async () => {
  if (!(await chrome.alarms.get(PURGE_ALARM))) {
    await chrome.alarms.create(PURGE_ALARM, { periodInMinutes: 1440, delayInMinutes: 1440 });
  }
};

/** Focuses an open board tab (and shows `dateStr`), or opens a new one. */
const openBoard = async (dateStr: string) => {
  const boardUrl = chrome.runtime.getURL(BOARD_PATH);
  const contexts = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.TAB] });
  const board = contexts.find(c => c.documentUrl?.startsWith(boardUrl) && c.tabId !== undefined && c.tabId >= 0);
  if (board && board.tabId !== undefined) {
    await chrome.tabs.update(board.tabId, { active: true });
    if (board.windowId !== undefined && board.windowId >= 0) await chrome.windows.update(board.windowId, { focused: true });
    try {
      await chrome.tabs.sendMessage(board.tabId, { type: 'go-to-date', dateStr });
    } catch {
      // "Receiving end does not exist": the page is still loading; it shows today anyway.
    }
    return;
  }
  await chrome.tabs.create({ url: `${boardUrl}#date=${dateStr}` });
};

const notifyFailure = () =>
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon/128.png'),
    title: 'Sticky Board',
    message: "Couldn't save to Sticky Board. Please try again.",
  });

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(async () => {
    await runMigrations();
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({ id: 'send-selection', title: 'Send selection to Sticky Board', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'save-link', title: 'Save link to Sticky Board', contexts: ['link'] });
    chrome.contextMenus.create({ id: 'pin-note', title: 'Pin a note here', contexts: ['page'], documentUrlPatterns: WEB_PAGES });
    chrome.contextMenus.create({ id: 'show-page-notes', title: 'Show notes on this page', contexts: ['page'], documentUrlPatterns: WEB_PAGES });
    await syncRegistration().catch(() => undefined);
    await ensureAlarms();
    await runReminderCheck();
  });

  chrome.runtime.onStartup.addListener(async () => {
    await syncRegistration().catch(() => undefined);
    await purgeTrash();
  });

  // Site access changed (the Allow window, Settings, or Chrome itself): register for exactly those sites.
  chrome.permissions.onAdded.addListener(() => void syncRegistration().catch(() => undefined));
  chrome.permissions.onRemoved.addListener(() => void syncRegistration().catch(() => undefined));

  // Every write from a page note comes through here.
  chrome.runtime.onMessage.addListener(pageMessageListener);

  // Alt+Shift+N: pin a note on the current page.
  chrome.commands.onCommand.addListener(async (command, tab) => {
    if (command === 'pin-note') await pinOnTab(tab, 'shortcut');
  });

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'pin-note') return pinOnTab(tab, 'menu');
    if (info.menuItemId === 'show-page-notes') return pinOnTab(tab, 'show');
    try {
      if (info.menuItemId === 'send-selection' && info.selectionText) {
        await captureSelection(info.selectionText, info.pageUrl, tab?.title);
      } else if (info.menuItemId === 'save-link' && info.linkUrl) {
        await captureLink(info.linkUrl, info.selectionText, info.pageUrl, tab?.title);
      }
    } catch {
      notifyFailure();
    }
  });

  chrome.alarms.onAlarm.addListener(async alarm => {
    if (alarm.name === REMINDER_ALARM) await runReminderCheck();
    if (alarm.name === PURGE_ALARM) await purgeTrash();
  });

  // Notes or settings changed anywhere: the next due reminder may have moved.
  chrome.storage.onChanged.addListener((changes, area) => {
    const relevant =
      (area === 'local' && Object.keys(changes).some(k => k.startsWith('note:'))) ||
      (area === 'sync' && 'settings' in changes);
    if (relevant) void runReminderCheck();
  });

  chrome.notifications.onClicked.addListener(async id => {
    chrome.notifications.clear(id);
    let dateStr = await today();
    if (id.startsWith('remind:')) {
      const note = await notes.get(id.slice('remind:'.length));
      if (note && !note.deletedAt) dateStr = note.dateStr;
    }
    await openBoard(dateStr);
  });

  // Toolbar icon click, and the Alt+Shift+S shortcut (_execute_action).
  chrome.action.onClicked.addListener(async () => {
    await openBoard(await today());
  });

  // Every wake: make sure alarms exist and nothing due was missed (covers
  // browser start, install, update, reload and waking from sleep).
  void ensureAlarms();
  void runReminderCheck();
});
