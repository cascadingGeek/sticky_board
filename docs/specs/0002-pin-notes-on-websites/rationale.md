# 0002. Pin sticky notes on web pages: rationale

## Context

Sticky Board lives on the new tab page and keeps notes per day. People also want notes that sit on the web page they belong to: a thought next to a paragraph, a reminder on a product page. The reference extension, Simple Sticky Notes, shows the demand: per page notes that come back on revisit, made by right click or a shortcut, with a dashboard by site.

Showing anything on other people's websites needs Chrome's host access, and that is the most sensitive permission an extension can hold. Asked for at install, it shows "Read and change all your data on all websites" to everyone, including people who never pin a note. Spec 0001 chose least privilege on purpose (AC-21 allows only the "Display notifications" warning), and that trust is part of the product.

The on page UI also runs inside pages Sticky Board doesn't control. Site CSS can restyle it, site scripts can read it, and single page apps change the address without reloading. The data has to fit the existing storage layer, so search, Trash, backup and the save queue keep working without a second code path.

Not deciding leaves the feature in Deferred, where spec 0001 put it because of the permission cost.

## Options considered

### Option 1: All sites access at install, static content script

Declare `host_permissions` for all sites and a manifest content script on every page. Notes show everywhere with no prompts.

**Pros**:
- The simplest code: no registration logic, no permission states.
- Notes always appear by themselves, on every site.

**Cons**:
- The install warning becomes "Read and change all your data on all websites" for everyone, which breaks spec 0001 AC-21 and the product's trust story.
- Code runs on every page you visit, even with no notes, which costs page load time and adds risk.

### Option 2: Optional per site access, script registered at run time, `activeTab` on demand

Keep install clean. After the first pin on a site, offer an Allow button that asks Chrome for that one host. Register the content script at run time for allowed origins only. Use `activeTab` to inject on demand when you pin or ask to see notes on a site you haven't allowed.

**Pros**:
- Install warning unchanged; access is narrow, visible and removable.
- Code runs only on sites where you have notes.
- Works even if you decline: notes still save and show on demand.

**Cons**:
- More moving parts: registration has to track permission changes, and there are three access states to design for.
- More prompts: one per new site.
- `permissions.request` needs a real user gesture in an extension page, so the request can't happen in the right click itself. It needs one extra click on an Allow button that opens a small extension window.

### Option 3: `activeTab` only, never automatic

Never ask for site access. Notes show only when you right click or press the shortcut on a page.

**Pros**:
- No new prompts or warnings at all.
- The least code that touches other sites.

**Cons**:
- Fails the core promise that a note is there when you come back; you have to remember the note exists to see it.
- Feels broken next to the reference extension.

### Data shape (sub decision)

A board `Note` with an optional `page` field was chosen over a separate page note record. The separate record keeps board code untouched, but needs a second path in search, Trash, backup, import and validation, which is where bugs hide. The cost of the chosen shape is one guard (`isBoardNote`) in every place the day board reads notes, listed in the spec's invariants.

### On page UI (sub decision)

React in a closed Shadow DOM through WXT's shadow root UI was chosen over an iframe (strong isolation, but dragging across the page and sizing the frame get awkward) and plain DOM (smallest script, but a second UI codebase).

## Rationale

The forces are trust, the core promise, and maintenance. Option 1 delivers the promise but spends the trust spec 0001 protected, and charges every user for a feature only some use. Option 3 keeps the trust but breaks the promise, since a note that doesn't come back is just a bookmark you forget. Option 2 is the only one that keeps both: install stays clean, and a single prompt per site, tied to the moment you pin, explains itself.

The extra moving parts in Option 2 are bounded and well understood: one function keeps the registration equal to the allowed origins, and it runs on four known events. A cross check on a second model found that the permission prompt can't be trusted to work from the background worker, so the spec asks from a small extension window behind an Allow button instead of guessing. The same check moved every page write through the background, because `navigator.locks` and the save queue are per origin and would not protect a page tab and the board from each other.

Reusing the `Note` record follows the same reasoning as spec 0001's single storage layer. One shape and one write path keeps backup, Trash and live updates across tabs correct for free, and the board guard is a short, testable list.
