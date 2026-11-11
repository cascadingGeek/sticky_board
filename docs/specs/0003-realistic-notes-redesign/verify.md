# Verify · 0003 realistic notes redesign

Steps you can run by hand to check the build against the spec. Run `npm run build`, then load `.output/chrome-mv3` as an unpacked extension in Chrome. The design canvas is https://claude.ai/artifact/6YWUQSwVqvQTs2E6XsfBye.

## Fresh install and themes

1. With a fresh Chrome profile, open a new tab. The welcome screen opens on Light with Light preselected. Click "Skip for now": the board is Light. (AC-1, AC-3)
2. Press N, type a title, press Enter. The note has a pushpin, a glue band, a slight tilt and Caveat Brush handwriting. Reload: same pin colour and tilt. (AC-5, AC-6, AC-7)
3. In Settings, switch through Light, Dark, Midnight, Cork and System. Every screen stays readable; on Cork the empty board text sits on a light backing. (AC-20 to AC-22)
4. Turn "Handwriting on notes" off. Notes switch to Inter at the smaller sizes. (AC-7)

## Existing user theme check

5. Install the previous release, finish onboarding without picking a theme, add a note, then update to this build. The board stays on Dark and your note is unchanged. If you picked Cork before, it stays Cork. (AC-2)

## Board, editor and dialogs

6. The top bar shows "Today · N notes", the globe button and "New note". Go back a day and forward: the subtitle reads Yesterday, Tomorrow or the weekday. (AC-11)
7. A note with a due time shows the time in your locale (for example 3:00 PM in the US, 15:00 in the UK). (AC-9)
8. Double click a note. The editor is a paper sheet with no colour control and no Cancel. Type: "Saving…" then "Saved" appears. Press Esc: it closes and the change is kept. (AC-14, AC-27)
9. Clear the title and close: the old title stays, with "Give the note a title." shown first. (AC-27)
10. Open Trash, then "Empty trash" and "Delete forever": both confirm dialogs match the canvas. (AC-17)

## Drawers and search

11. Calendar, Trash, Settings and Pages open as 440 px drawers. Calendar days show up to 3 small paper squares; today is filled dark. (AC-15)
12. Press ⌘K: a centred panel with commands and key hints. Type a word: results show a paper square, the match highlighted, and the day or the site. Type nonsense: "No notes match." (AC-16)

## Notes on websites

13. On any normal website, right click and choose "Pin a note here". The draft is paper with a pin; type a title and press Enter. The note uses the same paper, pin and handwriting as the board, even with the board on Dark. (AC-23)
14. Collapse the note: it becomes a short paper strip with its pin. (AC-23)
15. On a site you have not allowed, the note shows "Show this note when you come back?" with Allow. Click it: the Allow window is Light, with a small pink note, "Allow on <site>", "Not now" and the footer line. (AC-25)
16. Open DevTools on that page, Network tab, and reload: no font request is made. In the Console, `document.fonts` includes `SB Hand`. (AC-24)
17. On a page with a strict Content Security Policy (for example `default-src 'none'`), notes still show handwriting, or the system font after a short moment, and stay usable. (AC-24)

## Install

18. Run `npm run zip` and install the zip in a fresh profile. The only install warning is "Display notifications". (AC-26)
