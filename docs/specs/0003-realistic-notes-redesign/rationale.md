# 0003. Realistic paper notes redesign: rationale

The decision record behind [index.md](index.md). `/develop` builds from `index.md`; this file explains why.

## Context

Sticky Board is a WXT Chrome extension (React 19, Tailwind 4, `chrome.storage`), built under spec 0001 (the new tab board) and spec 0002 (notes pinned on websites). Every screen already works: board, editor, ⌘K search with commands, Calendar, Trash, Settings, Pages, onboarding, carry over, toasts, website notes and the Allow window. The current look is a dark first board with gradient paper, a flat dot pin, Caveat for handwriting and Space Grotesk for headings, as described in `design.md` and the earlier canvas.

A new canvas, "Realistic Sticky Board", redraws every one of those screens. Notes become realistic paper with a modelled pushpin, a glue band, contact and curl shadows and grain, on flat pastel colours with one ink colour. The default surface becomes a light wall, and a full dark set shows Dark, Midnight and Cork. The canvas is a visual source, so it carries some contradictions: the onboarding copy still calls Dark the default while every light board shows Light, done notes are drawn two ways, and due times appear in both 12 and 24 hour form.

The forces: the look touches almost every component, so the change must not alter behaviour or stored data. Existing users must not be surprised. The extension promises that nothing leaves the browser, so fonts stay bundled. Website notes live in a closed shadow root on someone else's page, where fonts declared inside the shadow root do not load and the page's CSP can block fetched resources. The install warning must stay "Display notifications" only.

Not deciding leaves `/develop` to resolve each canvas contradiction on its own, and leaves the board and website notes free to drift apart.

## Options considered

### Option 1: Restyle in place through tokens and the existing components

Change the tokens in `src/index.css`, add one shared paper CSS partial for the note look, and restyle each existing component to its board. Ship as one release with a one time theme migration.

**Pros**:
- Reuses components that already pass their tests; behaviour stays put.
- One paper partial shared by the board and the content script keeps both looks identical.
- Rollback is a revert; no stored data changes shape.

**Cons**:
- A wide diff touching most files, so review is heavy.
- The old and new looks cannot run side by side for comparison.

### Option 2: Build a fresh component layer and switch over

Write new presentational components (paper note, sheet, drawer, toast) from scratch to the canvas, then move each screen onto them and delete the old ones.

**Pros**:
- A clean slate; no leftovers from the old look.
- Each new component can be built and checked on its own.

**Cons**:
- Rewrites behaviour (drag, focus traps, keyboard handling, accessibility) that already works and is tested, to change only the look.
- Takes longer and risks regressions for no user gain.

### Option 3: Ship the new look behind a "New look" switch

Keep both looks in the code, selected by a setting, and let users opt in before the old one is removed.

**Pros**:
- Gradual rollout, instant rollback for a user.
- Lets early users compare.

**Cons**:
- Two full style systems to maintain in every component until the old one is removed.
- A visual reskin with no data change gains little from a switch; a revert already gives rollback.
- One more setting to sync and back up.

## Rationale

Option 1 wins because the change is visual and the behaviour underneath is already right. The components already handle drag, focus, keyboard, Trash and storage, and they are tested. Rewriting them (Option 2) would put that working behaviour at risk to change colours, shadows and fonts. A switch (Option 3) earns its cost when a change has a large blast radius on data or behaviour. Here a plain revert is already a full rollback, so two style systems would be pure upkeep.

**Default theme and the migration.** The engineer chose Light (Wall) as the default, confirmed after the canvas's "Dark: Default" copy was pointed out. The paper shadows and pin read best on the light wall, and every light board is drawn on it. Changing the default alone would silently flip anyone who skipped onboarding, because "Skip for now" never saves a theme. A one time check saves `dark` only for existing users (onboarding finished) with no theme saved, writing only the theme key straight to sync so settings syncing from another device are never overwritten, then records `meta.themeDefaultCheckedAt` so it never runs again. It reads the raw sync object, because `parseSettings` fills in defaults and would hide the missing key. A schema version bump was rejected because backup import refuses files from a newer version, which would break moving a backup back to an older build. Runner up: let everyone without a saved theme switch, which is simpler but surprises current users.

**Pin colour from the id.** A hash of the id gives each note a stable, varied pin with no schema, validation or backup change, the same way the tilt already works. The hash is salted (`id + ':pin'`) so pin colour does not track tilt. Runner up: tie the pin to the paper colour, which is simpler but makes the board look repetitive.

**Caveat Brush only, Inter for headings.** It is the canvas's font, about 30 KB bundled through `@fontsource`, matching how the other fonts ship. Offering all five handwriting fonts would add a setting and about 150 KB for little gain. Space Grotesk appeared on only one board, so removing it simplifies type and shrinks the bundle.

**Done notes faded with a line, no stamp.** Done work should step back so open notes stand out, which fits the "notes are the only thing you look at" direction. A stamp adds a label to a board that has no other labels.

**Locale time formatting.** `Intl.DateTimeFormat` with the browser locale removes the 12 and 24 hour mismatch with no new setting, and the stored `HH:MM` stays the same. Runner up: always 24 hour, which is unambiguous but reads oddly to US users.

**Website font from bundled bytes.** A font declared inside a shadow root does not apply, so the font must be registered on the document. `new FontFace(name, arrayBuffer)` with `document.fonts.add` makes no fetch, so the page's CSP cannot block it. It also needs no `web_accessible_resources` entry, so sites cannot probe a URL to detect the extension. The cost is about 40 KB in the content script, and only on sites the user allowed. Runner up: a web accessible woff2 with `use_dynamic_url`, which keeps the script smaller but can be blocked by CSP and widens the extension's surface on every page. The font is registered under a private name (`SB Hand`) so it cannot clash with a site's own fonts; a site can still notice it was added, as it can notice the notes.

**Website notes ignore the theme.** They sit on someone else's page, which has its own colours, so dimming them to match a dark board would look wrong on a white article. Reading the theme into the content script would also add a second source of theme state. They do follow the handwriting switch, because that is about the note, not the surroundings.

**Darker paper colours, not a filter.** The canvas dims paper with `filter: brightness()`. A filter on every note creates an extra drawing layer per note on top of the blurred shadows, and also darkens the pin. Precomputed darker colours give the same look for free and keep the pin bright.

**Done notes are exempt from the contrast rule.** Fading the whole note is the agreed look, and it drops text contrast to about 2.5:1. The note is finished work that should step back; the line through the title carries the meaning. This is a conscious exception, written into AC-8 so `/check verify` does not flag it.

**Recommended without asking.** With handwriting off, Inter at 18/14 px keeps note text readable inside 220 px. The tall editor (about 760 px) scrolls inside itself on short windows so "Done" stays reachable. Calendar shows at most 3 squares per day, as drawn. Shadows stay pure CSS, with a measured fallback rather than an early optimisation.

**The editor saves as you type, without a colour picker (settled 2026-11-10, after /develop flagged the gap).** The canvas editor shows "Saved", "Not saved" and a lone Done button, which only makes sense if the editor saves on its own, but the first version of this spec still promised no behaviour change. The engineer chose saving as you type: it matches the canvas, and website notes already save this way (500 ms after typing stops), so the product gets one save model instead of two. The cost is losing Cancel, the one step way to throw edits away; that was judged rare enough for sticky notes. Runner up: keep Save and Cancel and correct the canvas, which keeps an undo escape but leaves two save models. Only changed fields are sent, measured against what the editor last saved rather than the note at open, so an edit in another tab to a different field survives. An empty title or an invalid day is simply not saved, with the message the canvas already draws, the same rule website notes use for an empty title. A failed save on close keeps the editor open with "Try again" so text is never silently lost, and a second close lets you leave anyway. The engineer chose to leave the colour picker out: random colour was a deliberate choice in spec 0001 (one less decision per note), so the canvas's swatch row is dropped instead. Runner up: add the picker, which the canvas draws but which reverses that earlier choice.
