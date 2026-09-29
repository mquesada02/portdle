# Ticket spec: Name confirm and rename (#135)

Ticket of Spec 4 (accounts, sync, and leaderboards; issue #127, spec file `docs/superpowers/specs/2026-09-28-spec4-backend.md`). Map: #114. Blocked by the accounts tracer (#134), which is merged. This ticket builds the Name confirm and the inline rename in the Account menu. It builds no Sync (nothing is pushed today, so the "nothing is pushed before the Name confirm" rule needs no code here), no device progress choice, no Account deletion, and no Leaderboards.

## Problem Statement

A newly signed-in player has a Seeded display name taken from their provider, and the account row already stores whether the name is confirmed. Nothing in the app reads that flag. A player's real name could become public on a Leaderboard without the player ever seeing it, and a player cannot change the name later.

## Solution

`Remote` gains two calls: confirm a Display name, and change it. When the app loads with a signed-in account whose name is not confirmed, a full-page Name confirm dialog opens over everything. It shows the Seeded display name in an editable field, says the name is public on Leaderboards, gives the rule as helper text, shows an inline error, and has Continue and a Sign out link. The Account menu's Display name gets a pencil that turns it into an inline field with Save and Cancel. Both use one Display name rule that matches the database `CHECK` for the covered cases.

## User Stories

Spec 4 stories 12 to 16 (the seed trigger from #134 implements 13 to 16; this ticket only renders the seeded value), 17, 18 (the client half: the dialog is the gate), 19, 53, 54, 55 (the write side only), 57 to 60 (for 60 the client rule mirrors the `CHECK`; #134 built the backend enforcement), and 66 (the Name confirm's Sign out link, client half), plus:

1. (L1) As a signed-in player whose name is not confirmed, I want the Name confirm on every app load until I confirm, so that closing the tab never skips it.
2. (L2) As a player on the Name confirm, I want Escape and a click outside to do nothing, so that I cannot skip it by accident.
3. (L3) As a player whose confirm or rename fails, I want a one-line error and the dialog or field left as it was, so that I can try again.

## Implementation Decisions

- **Display name rule** (`src/engine/display-name.ts`): `validateDisplayName(name): string | null` returns `null` for a valid name and a one-line message otherwise. Valid means 1 to 30 code points (counted with `[...name].length`), at least one character that is not a space (checked apart from the regex, which also matches a spaces-only name), and only letters, digits, spaces, apostrophes, hyphens, and periods (`/^[\p{L}\p{Nd} '.-]+$/u`, with `\p{Nd}` so the client never accepts a number-like character such as "²" that `[[:alnum:]]` may reject), the same rule as `accounts_display_name_valid`, approximated (see the last author call). There is no trimming: the database does not trim. The helper text is UI copy and lives in `src/ui/display-name-copy.ts` as `DISPLAY_NAME_HINT`, beside the other copy files. The client never normalizes: the seed trigger does that, so the ticket adds no normalizer.
- **`Remote`** gains `confirmDisplayName(name: string): Promise<void>` (sets the Display name and the confirmed flag in one update) and `changeDisplayName(name: string): Promise<void>` (sets the Display name only; its update omits `name_confirmed`, which the adapter test asserts). Both reject on failure.
- **Supabase adapter**: both calls read the account id from `auth.getSession()` (throwing when there is no session), then update that row with `.update(...).eq("id", id)` through the existing update grant and policy (`display_name` and `name_confirmed` are the granted columns), then select the row back; zero rows updated is an error, because a policy that filters the row is silent. No new migration.
- **Account menu state**: the signed-in view carries `nameConfirmed` next to `displayName`. `AccountMenu` renders the Name confirm as a sibling of its menu container (it already owns the account view), outside the outside-click area; that handler only closes the menu, which is harmless under a modal. So a confirm or rename updates the name the menu shows with no second read of the account.
- **Name confirm** (`src/ui/name-confirm.tsx`): a native `dialog` opened with `showModal()` on mount (guarded by `!dialog.open`, as the How-to does, so a StrictMode effect re-run is harmless), sized to the whole viewport (not the compact card), labelled "Confirm your display name". Escape is blocked three ways, because the other dialogs use a document-level Escape listener and a browser may close a modal dialog on a repeated Escape: a `keydown` handler on the dialog prevents the default and stops propagation, so the How-to's and the menu's document listeners never see it; the `cancel` event is prevented; and a `close` event while the dialog is still mounted reopens it with `showModal()`. The dialog has no click handler (backdrop). Contents: heading; the public-name notice ("Other players see this name on the Leaderboards."); a labelled text field ("Display name") holding the seeded name, with no `maxLength` so a too-long name shows the error instead of being cut; the hint; one inline `role="alert"` line; a Continue submit button inside a `form`, so Enter and Continue share one `onSubmit` that returns early while the name is invalid or a call is pending; a Sign out button styled as a link beneath it.
  - The field validates on every change. While the name is invalid the alert shows the rule message and Continue is disabled. Otherwise a failed confirm shows "Could not save your name. Try again." in the same alert.
  - Continue calls `confirmDisplayName` with the field's text. On success the view becomes signed in and confirmed with that name, and the dialog unmounts. On failure nothing changes and Continue stays available. While a call is pending both buttons are disabled.
  - Sign out calls `signOut` like the menu's Sign out (local data stays). On success the view becomes signed out and the dialog unmounts; on failure the alert shows "Could not sign out. Try again."
- **Inline rename**: a `form` (Enter and Save share one `onSubmit` guard, and a direct `submit` event test exercises it) opened by a pencil button (`aria-label` "Edit display name") next to the name switches to a text field with Save and Cancel, showing the same validation and alert as the Name confirm. While a save is pending the menu ignores every close (Escape, outside click, the person icon), so a late result always lands on an open edit field. Otherwise closing the menu cancels the edit. The menu's Sign out is disabled while a save is pending, since the menu shares one busy flag. Save calls `changeDisplayName`; success updates the shown name and leaves edit mode; failure shows "Could not save your name. Try again.", stays in edit mode, and can be retried. Cancel leaves edit mode, drops the typed text, and clears the error. Enter in the field behaves exactly like Save, including doing nothing while Save is disabled.
- **Layering**: the Name confirm opens after the account read returns, so it shows above the How-to dialog when both are open (later top-layer dialog on top), as the Spec 4 author call requires.

## Testing Decisions

Behavior through the App with `memoryStore` and the fake `Remote`, asserting what the player sees, the local store, and the fake account.

- `src/engine/display-name.test.ts`: valid names (ASCII, non-ASCII letters, apostrophe, hyphen, period, 1 and 30 characters, and 30 astral letters such as U+20000 counting as 30); invalid names (empty, spaces only, 31 characters, emoji, other punctuation, 31 astral letters, control characters (tab, newline, U+0000)).
- `src/ui/name-confirm.test.tsx` (App-level): unconfirmed name shows the dialog with the seeded name, notice, hint, Continue, and Sign out; a confirmed name shows no dialog; an Escape `keydown` on the dialog is prevented, does not close the How-to dialog beneath it, and leaves the How-to seen flag unwritten; a `cancel` event dispatched as `new Event("cancel", { cancelable: true })` has `defaultPrevented` set (the jsdom stubs in `src/test/setup.ts` need no change); after the test closes the dialog with `dialog.close()` and dispatches a `close` event, `showModal` is called again and the dialog is open, and a `close` event on an already-open dialog calls nothing (the handler guards with `!dialog.open`, since a real `showModal()` throws on an open dialog); a click on the dialog leaves it open; an invalid name shows the inline error, disables Continue, and calls nothing; Continue with the seeded name and with an edited name calls the fake, closes the dialog, and the menu shows the confirmed name; a failed confirm keeps the dialog with a one-line error and a retry succeeds; Sign out closes the dialog, signs out, and leaves the local store as it was; a failed sign-out keeps the dialog with a one-line error and a retry succeeds; a failed confirm leaves the menu name and the fake account unchanged; unmounting and rendering `App` again with the same fake `Remote` and store while the name is unconfirmed shows the dialog again, and after a confirm it does not; with the How-to dialog open (first visit) and an unconfirmed name, the Name confirm shows above it. jsdom has no top layer, so the test records the order of `showModal` calls and asserts the How-to's comes before the Name confirm's; a failed confirm followed by a failed sign-out shows the sign-out line, and the reverse shows the confirm line; editing the field clears a failure line; both buttons are disabled while a call is pending; Enter in the Name confirm field submits nothing while the name is invalid or a call is pending, and a `submit` event fired on the form directly in those states does the same (this exercises the `onSubmit` guard); with no `Remote` no dialog shows; signing out and back in on the confirmed fake account shows no dialog. The tests find Sign out by role button and name.
- `src/ui/account-menu.test.tsx` (extend): closing the menu mid-edit cancels the edit; pencil, invalid name error with Save disabled, Cancel restores, Enter on an invalid name saves nothing and Enter on a valid name saves, successful rename shows the new name, failed rename keeps edit mode with an error, leaves the shown name and the fake account unchanged, and a retry succeeds; editing the field clears the failure line; Cancel, Save, and the menu's Sign out are disabled while a save is pending, and Escape and an outside click do not close the menu then; saving an unchanged name calls the fake once.
- `src/remote/supabase.test.ts` (extend): the tests inject a fake `createClient` through `deps.loadLibrary`, exposing `auth.getSession` and a `from().update().eq().select()` chain, as the existing adapter tests do; both calls send the right update to the caller's own row and throw on a library error or an empty result.
- `src/test/fake-remote.ts`: the fake gains both calls, call logs, the switches `failConfirmDisplayName` and `failChangeDisplayName` (a rejection, like the existing `fail*` switches), and the gates `holdConfirmDisplayName()` and `holdChangeDisplayName()`, each returning a release function like `holdGetAccount` and each with its own gate, independent of the `getAccount` gate, so a test can observe the pending state, and mutates its state only on success, as the real account row would; both calls reject while the fake is signed out, like the adapter's no-session error.
- Not in Vitest: the SQL and the adapter against the real project. `scripts/smoke-backend.ts` gains a check that the own row's confirmed flag can be set and read back; restoring the original value is cleanup with a warning on failure, as for the name. No new migration, so the owner has only the smoke run to do by hand.

The existing suite passes unchanged; `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.

## Out of Scope

Sync, the Device progress choice (the ticket that adds it must gate the Name confirm's mount, since Spec 4 shows it first), Account deletion, Leaderboards, any change to the seed trigger or the `CHECK`, profanity or reserved-name filtering, and unique names.

## Further Notes

Docs: `CONTEXT.md` and the ADRs already carry Name confirm, Display name, Seeded display name, and Account menu; none change.

Stories 13 to 16 (the seeded name from GitHub or Google, normalized, "Player") belong to the seed trigger from #134; this ticket only renders the seeded value.

Author calls not decided by the map's tickets:

- `validateDisplayName` lives in `src/engine` because the rule is shared account logic beside the other pure modules; "Device progress choice" comes from Spec 4 and is not a `CONTEXT.md` term.
- The Name confirm is rendered by `AccountMenu`, not by the Shell, because the menu already owns the account view and both must show the same name.
- Save on an unchanged name still calls the backend; there is no "nothing changed" shortcut.
- The client validates with a JavaScript regex that approximates the database's `[[:alnum:]]` (letters and decimal digits, not combining marks); the database stays the authority.
- The failure line text: "Could not save your name. Try again."
- Continue, Save, and Cancel (and the Name confirm's Sign out) are disabled while a call is pending; Continue and Save are also disabled while the name is invalid.
- Enter in the rename field behaves like Save.
- The Name confirm and the menu keep separate error state, so a menu error never shows in the dialog.
- Editing the field clears any failure line.
- Closing the menu cancels a rename in progress, except that a pending save keeps the menu open.
- Cancel drops the typed text and clears the error; the Name confirm's field has no `maxLength`, so a too-long name shows the rule message.
- A UTC-day router rebuild remounts the Shell and so the Name confirm and any rename in progress, as Spec 4 already accepts for other state; the confirm reopens with the account's values.
- A failed Name confirm sign-out reuses the menu's line "Could not sign out. Try again.".
- Validation and failure messages share one alert line; in the Name confirm the latest failure (confirm or sign-out) shows unless the name is invalid, when the rule message shows.
- Parity between the JavaScript rule and the database `CHECK` is not verified automatically; the smoke script checks only the confirmed flag.
