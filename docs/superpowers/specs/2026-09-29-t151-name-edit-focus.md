# Ticket spec: Focus management for the display name edit (#151)

Ticket of Spec 4 (accounts, sync, and leaderboards; issue #127, spec file `docs/superpowers/specs/2026-09-28-spec4-backend.md`). Map: #114. Follow-up from #135 (the Name confirm and rename ticket, `docs/superpowers/specs/2026-09-29-t135-name-confirm.md`), accepted by the owner on 2026-09-29 (as recorded on #151). It has no blockers. This ticket changes only where keyboard focus goes around the Account menu's inline Display name edit. It adds no backend call, no migration, no glossary term, and no Sync.

## Problem Statement

A keyboard or screen reader player opens the Account menu and presses the pencil to rename. The pencil disappears and a field takes its place, but focus stays nowhere useful (the removed pencil), so the player has to tab back into the field. After Save or Cancel the field disappears again and focus is lost. Escape closes the whole menu instead of just the edit. After a failed save the player cannot tell where they are.

## Solution

Focus follows the edit. Opening the edit puts focus in the Display name field. Save (on success), Cancel, and Escape end the edit and put focus back on the pencil. Escape during an edit ends only the edit; the Account menu stays open. A failed save keeps the edit open with focus in the field, and the existing one-line error is announced there.

## User Stories

1. As a keyboard player, I want focus in the Display name field when I press the pencil, so that I can type without tabbing.
2. As a keyboard player, I want focus back on the pencil after a successful Save, so that I do not lose my place in the menu.
3. As a keyboard player, I want focus back on the pencil after Cancel, so that I do not lose my place in the menu.
4. As a keyboard player, I want Escape in the field to end the edit and return focus to the pencil, so that I can back out without closing the menu.
5. As a keyboard player, I want a failed save to leave focus in the field, so that I can fix the name and press Enter again.
6. As a screen reader player, I want the failure line announced while focus is in the field, so that I hear why the save did not work.
7. As a keyboard player, I want Escape outside an edit to keep closing the menu and returning focus to the person icon, so that the menu behaves as it does today.
8. As a keyboard player, I want Escape during a pending save to do nothing, so that the result of the save lands on a field that is still there.

## Implementation Decisions

- **Scope**: `AccountMenu` only (`src/ui/account-menu.tsx`). No change to `Remote`, the fake, the Name confirm, or the copy files.
- **Focus into the field**: a ref on the rename input. Focus moves to it when the edit opens (the transition from not editing to editing), by an effect keyed on whether an edit is open, not on the typed text.
- **Focus back to the pencil**: a ref on the pencil button. The pencil is unmounted while editing, so focus is restored by an effect that runs after the pencil is mounted again. The effect is keyed on whether an edit is open, so an unrelated re-render never refocuses. A flag records that the edit ended by Save success, Cancel, or Escape; it is set just before the edit closes, and it is cleared by that effect and whenever the menu closes, so it never goes stale. The effect focuses the pencil only when the flag is set, then clears it. Closing the menu (person icon, outside click) never sets the flag: the pencil is gone then and focus must not be stolen.
- **Escape**: the menu's document `keydown` handler gains a rule before the current one. While an edit is open and no save is pending, Escape ends the edit (same state changes as Cancel: typed text dropped, error cleared) with the flag set, and the menu stays open. While a call is pending during an edit (a save, or a sign-out, which share one busy flag), Escape does nothing at all: it neither closes the menu nor moves focus (today it still moves focus to the person icon when the close is ignored). With no edit open, Escape behaves as it does today.
- **Failed save**: the save keeps the edit open. The save's failure path (not the shared error line, which a failed sign-out also sets) sets a "refocus the field" flag, and an effect keyed on the pending-call state focuses the field when the call ends with that flag set, then clears it. Because the effect follows the pending-call transition, every failed save refocuses, including two in a row with the same message. A failed sign-out mid-edit sets no flag and moves no focus. The field is read-only, not disabled, while a call is pending, and the Save button is disabled, so a browser may drop focus from Save; the effect puts it in the field. The failure line is already `role="alert"`, so it is announced without other change.
- **Escape listener**: the document `keydown` effect now also reads whether an edit is open and whether a call is pending, so it lists them as dependencies (or reads them through a ref). This supersedes the #135 behavior that Escape mid-edit closes the menu and so cancels the edit: Escape now ends just the edit, and the menu stays open. Escape during an accepted IME composition also ends the edit; the spec accepts that.
- **StrictMode**: every focus effect is idempotent (focusing twice is harmless) and the flags are unset on mount, so a StrictMode effect re-run changes nothing.
- **Sign out mid-edit**: a successful sign-out swaps the edit for the sign-in buttons; no flag is set and focus falls where it does today.
- **UTC-day remount mid-edit**: as accepted in #135, the remount drops the edit and its focus; this ticket adds nothing for it.
- **Enter** in the field is Save, so a successful Enter-save returns focus to the pencil as Save does.

## Testing Decisions

Good tests act as the player through `App` and assert what the player sees: which element has focus (`document.activeElement`), whether the menu is open, and the field and the alert on screen. Prior art: the existing rename tests in `src/ui/account-menu.test.tsx` (fake `Remote` with `failChangeDisplayName` and `holdChangeDisplayName`).

Extend `src/ui/account-menu.test.tsx`:

- Pressing the pencil focuses the "Display name" field.
- Save with a valid name focuses the "Edit display name" pencil and shows the new name; Enter in the field does the same.
- Cancel focuses the pencil.
- Escape in the field ends the edit, leaves the menu open, drops the typed text, and focuses the pencil.
- A failed save (triggered by clicking the Save button, so focus starts on the button) leaves the field open and focused with the failure line showing; a retry that succeeds focuses the pencil.
- Escape during a held (pending) save leaves the menu and the edit open (the test asserts only that, not which element holds focus, since a disabled Save may drop focus); after release the result lands and focus goes to the pencil.
- Escape with no edit open still closing the menu and focusing the Account button is already covered by an existing test; no new test.
- Closing the menu with the person icon during an edit leaves focus on the Account button (the click focuses it) and the menu gone.
- A failed sign-out during an edit shows its line and does not move focus into the field.
- Two failed saves in a row (each triggered by clicking Save) each return focus to the field.
- jsdom cannot test a screen reader announcement, so "announced" is asserted as the `role="alert"` line being present with the field focused.

One existing test changes on purpose. "closing the menu mid-edit cancels the edit" presses Escape mid-edit and then clicks the person icon to reopen the menu; under the new rule Escape ends only the edit and leaves the menu open, so that click would close it. The test is rewritten to close the menu with the person icon mid-edit (the closing-with-the-person-icon bullet above) and keeps its assertion that reopening the menu shows the name, not the field and is renamed to match. The Escape case gets its own test (the fourth bullet). Every other existing test passes unchanged.

`pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.

## Out of Scope

Focus management for the Name confirm (it is a native modal dialog and manages its own focus), a focus trap in the Account menu, arrow-key navigation in the menu, any visual change, and the Delete account and Device progress choice dialogs (their tickets own their focus).

## Further Notes

Author calls not decided by the ticket or Spec 4, listed so they can be overruled:

- Escape during an edit ends only the edit and keeps the menu open. The ticket says Escape returns focus to the pencil, which only exists while the menu is open, so the menu must stay open.
- Escape during a pending save does nothing (no close, no focus move), extending the existing rule that a pending save keeps the menu open.
- Focus is not restored to the pencil when the edit ends because the menu closed.
- No new announcement text: the existing `role="alert"` line is the announcement.
- Implementation uses effects and refs inside `AccountMenu`, not a new hook or module; the behavior is used once.
