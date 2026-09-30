# Ticket spec: one account read at load, throttle focus pulls (#162)

Ticket: https://github.com/mquesada02/portdle/issues/162. Parent: Spec 4 (#127, `docs/superpowers/specs/2026-09-28-spec4-backend.md`), map #114. Client only: no migration, no owner steps.

## Problem Statement

An owner HAR capture of the live site showed two things. App open reads the account twice: the sync module reads it before its pull, and the account menu reads it again on mount. And every focus or visibility change pulls all five tables, however recent the last pull was. Sync works as designed, but both cost free-tier requests for no benefit.

## Solution

1. The sync module owns the one account read at load and publishes what it reads; the account menu takes its sign-in state from that instead of calling `Remote.getAccount` itself.
2. A pull triggered by the tab regaining focus or becoming visible is skipped when the last successful pull finished less than 30 seconds ago and no local change is waiting to be pushed.
3. Spec 4 and `CONTEXT.md` record both rules as an owner decision (2026-09-30).

## Behavior

### One account read at load

- `Sync.onAccount` (which today reports the sign-in state after each successful pull) becomes the report of every account read sync makes, after the epoch check and before the device progress and name checks (so before `applyPull`): an `AccountState` (any status), or `{ status: "failed" }` for a failed read; the listener type widens to that union and the `Sync` type comment changes with it. It is delivered only when the read is still current (same epoch), so a read that a sign-out, account gone, or deletion overtook is never reported. `AccountGoneError` is handled by sync as today (it signs the device out and fires the account-gone listeners) and is not reported as a failed read.
- Sync keeps the latest report. A listener added later is called at once with it, so a menu that mounts before or after the first read gets the same state, and no second read is needed. `reset` (the epoch change inside a run) does not clear it. `stop` (sign-out, account gone, deletion, the device clear, and `attach`'s cleanup) sets it to signed out without calling listeners (a mounted menu already hears `onAccountGone`), so a menu remounted after them shows signed out at once, not "Loading account"; the next read replaces it. Under React StrictMode's dev double-mount the menu may briefly show signed out; this is accepted (dev only). A menu that mounts later (a remount) shows the state of the latest read, a failed one included until the next read; the next pull, or the refresh that follows a rename or name confirm, corrects it, as Spec 4 already says for a name changed on another device.
- App open makes exactly one `getAccount` call: the read of the first sync run. Every later pull reads once, as today.
- The account menu no longer calls `Remote.getAccount`; it still calls `remote.clearRedirectError()` on mount. A signed-in report from a view that is not signed in (loading, load-failed, or signed out) sets the signed-in view (the menu still computes `choicePending` from `persist`, as today) and clears the error line, exactly as the mount read does today (so a later signed-in report replaces a redirect error, as the existing test expects); while the view is signed in, it updates only the display name and confirmed flag and never touches the error line (so a later pull cannot wipe a save or sign-out failure message). A signed-out or failed report applies only while the view is loading; a failed report shows the load-failed view and message as today, and is ignored when a redirect error is set (that message stays), as today. With no `Sync` (not the case in the app), it reads `Remote.getAccount` directly, as today.
- Signed-out, choice-pending, and name-unconfirmed devices still read the account on each focus (no pull, so nothing is recorded as a pull). This is accepted: with no stored sign-in the Supabase adapter answers signed out without a network call, and the choice and name-confirm states are modal steps that end quickly. A menu that is already signed in also ignores a later signed-out report on such a device (another tab signed out); this matches today's read at mount only.

### Throttled focus and visibility pulls

- `SyncClock` gains `now(): number` (milliseconds). `systemClock` uses `Date.now()`; the fake clock returns its own time.
- Sync records the time a pull finished successfully (after the merge is applied) as `lastPullAt: number | null`, set right after the merge is applied and before the push, so a pull whose push then fails still counts and the waiting-row rule is what makes the next focus retry the push; `null` means none, so a pull at fake time 0 counts. `reset` clears it.
- The `focus` and `visibilitychange` (visible) handlers in `attach` skip the pull when a successful pull finished `elapsed` ms ago with `0 <= elapsed < PULL_THROTTLE_MS` (`PULL_THROTTLE_MS = 30000`, exported like `PUSH_DELAY_MS`) and `persist.readSyncChanges()` lists no waiting row. They also skip while a pull is in flight and no row waits, because the browser fires `visibilitychange` and `focus` together on tab return and the second event would otherwise queue a full second pull. A negative elapsed time (clock moved back) does not skip. At exactly 30 seconds the pull runs.
- A waiting row means an earlier push failed or is still debounced, so the pull runs and its push retries, as Spec 4 says ("the next open, visibility, or focus is the retry").
- These always pull: app open, sign-in completion, the device progress choice (each calls `refresh`, not the throttled handlers), and the other existing `refresh` callers (a rename, the name confirm, opening the Leaderboards tab).
- A failed pull (account read failure, pull failure, or a state that stops before the pull: signed out, choice pending, name unconfirmed) records no time, so the next trigger retries.
- The one-read-at-open test does not render under React StrictMode (whose dev double-mount attaches twice).
- The throttle delays by up to 30 seconds how soon a sign-out, sign-in, or account deletion made in another tab is noticed; this is accepted.

### Docs

- Spec 4, Pull bullet: focus and visibility pulls are throttled (30 seconds, unless a row waits to be pushed); open, sign-in completion, and the device progress choice always pull.
- Spec 4, Sync module bullet: add that the clock has `now` and that `onAccount` reports every read. Spec 4, Display name on other devices and the author call that repeats it: the load read is the pull's own read, shared with the account menu.
- Spec 4, Failures are silent and the Sync module test list: the retry on focus is subject to the throttle; add the throttle tests.
- Spec 4, Further Notes: a dated owner decision (2026-09-30) for both rules, after review of a HAR capture of the live site.
- `CONTEXT.md`, Sync entry: it pulls on app open and on return to the tab, at most once every 30 seconds (a small addition beyond the ticket, kept so the glossary matches Spec 4).

## Testing Decisions

Through the highest seam that names the behavior; fake clock for time.

- Sync tests (`src/sync/sync.test.ts`), fake clock and fake `Remote`, focus fired with `window.dispatchEvent(new Event("focus"))` after `attach()`:
  - focus 10 seconds after a pull does not pull; 29.999 s does not; exactly 30 s pulls; 31 s pulls;
  - a visibility change to visible follows the same rule;
  - focus after a failed pull pulls; focus after a pull whose push failed pulls and retries the push;
  - `refresh` (app open, sign-in completion) pulls inside the 30 seconds;
  - `stop` clears the time (sign out, sign in, focus inside 30 s pulls);
  - a focus during an in-flight pull is skipped with no waiting row and not skipped with one; a pull that stops on choice-pending or name-unconfirmed records no time;
  - a clock moved back (the test overrides `d.clock.now`) does not skip; a pull at fake time 0 followed by focus 10 s later skips; a `visibilitychange` then `focus` on tab return make one pull;
  - `onAccount` reports every read (signed out, signed in, failed), replays the latest to a late listener, is cleared by `stop`, and drops a read that a sign-out overtook.
- App-level tests: `App` with the fake `Remote` signed in makes exactly one `getAccount` call at open (new `getAccountCalls` counter on the fake), with the account menu showing the display name; a signed-out open makes one call too; an account gone at open makes one `getAccount` call and one `signOut` call and shows a signed-out menu; a delete followed by a remount shows a signed-out menu without a new read; a signed-in report after a redirect error shows signed in and clears the error, as today.
- Existing tests that change: the `sync.test.ts` test "every successful pull reports the sign-in state it read again" (renamed "every account read is reported"; a failed pull now reports too); the `sync.test.ts` test "visible and focus pull, hidden does not" (split: hidden does not pull; visible after `clock.advance(PULL_THROTTLE_MS)` pulls; focus 10 s after that pull skips); and the `row-sync.test.tsx` test "a display name changed on another device shows in the menu after the next pull" (`App` keeps `systemClock` and gets no clock prop, so it waits for the open pull to settle (`persist.readSyncAccount()` is set, which happens after the time is recorded), then moves `Date.now` forward 30 s with `vi.spyOn(Date, "now")` before its focus), and the two `account-deletion.test.tsx` tests that fire `focus` on `App` right after open ("another device signs itself out after a deletion elsewhere..." and "the dialog closes when the account is reported gone while it is open"), which wait for the open pull to settle and then move `Date.now` forward 30 s the same way. Each test that spies on `Date.now` restores it (`vi.restoreAllMocks()` in `afterEach`). Other account-menu, name-confirm, device-choice, and deletion suites keep passing.
- Touched test support: `src/test/fake-clock.ts` (`now`), `src/test/fake-remote.ts` (`getAccountCalls`).

## Done when

The acceptance criteria of #162 hold: the tests above pass, Spec 4 text is updated, and `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.

## Out of Scope

Changing push timing, adding a throttle to other triggers, and any UI.

## Author calls (for the owner)

- The Leaderboards tab open and the account menu's rename and name confirm keep their unthrottled `refresh`; the ticket throttles only focus and visibility.
- Beyond the ticket's time-only rule, a focus or visibility pull is not skipped while a row waits to be pushed, because Spec 4 makes the next focus the retry for a failed push. A pull counts as successful once its merge is applied, even if its push then fails. Owner: keep, or throttle by time only.
- The glossary edit in `CONTEXT.md` is beyond the ticket's list; it adds that the pull runs on app open and on return to the tab, at most once every 30 seconds.
- `Sync.onAccount` now reports every read (signed out and failed included) and replays the latest; this is how the load read is shared, not a new feature.
- Beyond the ticket, a focus or visibility event during an in-flight pull (no waiting row) is skipped, so the paired `visibilitychange` and `focus` events of a tab return make one pull; a clock moved back does not skip.
- The throttle is exactly 30 seconds, inclusive on the pull side (30 s pulls), as "less than 30 seconds" skips.
