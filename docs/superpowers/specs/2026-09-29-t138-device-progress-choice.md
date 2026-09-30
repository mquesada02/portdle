# Ticket spec: Device progress choice (#138)

Ticket [#138](https://github.com/mquesada02/portdle/issues/138) of Spec 4 (accounts, sync, and leaderboards; issue #127, spec file `docs/superpowers/specs/2026-09-28-spec4-backend.md`). Map: #114. Blocked by Row sync (#136), merged. This ticket builds the Device progress choice. It builds no Preferences sync (#137), no Leaderboards (#139), and no Account deletion (#140).

In this spec "row" means one synced record (a Codex entry, a Best, a run, a Daily), never the Daily board's Row from `CONTEXT.md`. "Progress" means the Daily, run, Best, and Codex rows on the device; preferences alone are not progress.

## Problem Statement

A device remembers the account it last synced with (#136 writes it after each merge), but nothing reads it. When a different account signs in on that device, Sync imports the device's progress into the new account without asking. Someone else's progress can land in the new account and on the Leaderboards under the new account's name. The owner accepted this as a short public gap until this ticket ships (comment on #138, 2026-09-30).

## Solution

When a different account signs in on a device that holds progress and last synced with another account, the player chooses first, before the name confirm and before anything is pushed. "Add this device's progress to your account" imports as today. "Start from your account only" clears the device, pulls the account's rows, and remounts the app, so the screen, the theme, and the How-to dialog start from the account's data with nothing left from the cleared device. The dialog cannot be dismissed without choosing and returns on every app load until the player chooses. A device that never synced with any account imports without asking.

## User Stories

Spec 4 stories 23 and 63 (the clear half of "Start from your account only"), and:

1. (D1) As a player signing in with a different account on a device that holds progress from another account, I want to choose between adding this device's progress and starting from my account only, so that someone else's progress never lands in my account or on the Leaderboards under my name.
2. (D2) As that player, I want the choice before the name confirm and before anything is pushed, so that nothing of the device reaches my account until I decide.
3. (D3) As that player, I want no way to dismiss the choice except choosing (no Escape, no backdrop click, no close button), so that a skipped dialog never decides for me.
4. (D4) As that player, I want the choice to come back on every app load until I make it, so that reloading the page never imports by accident.
5. (D5) As that player, I want a Sync trigger (open, tab visible, focus) to push nothing while the choice is pending, so that the choice is a real gate.
6. (D6) As that player choosing "Add this device's progress to your account", I want the import to run as it does for every sign-in, so that the result does not depend on who signed in first.
7. (D7) As that player choosing "Start from your account only", I want every Portdle key on this device cleared, so that nothing of the other account stays.
8. (D8) As that player, I want the account's rows pulled after the clear and the app remounted, so that the screen, the theme, and the How-to dialog start from the account's data.
9. (D9) As that player who had a Daily on screen with guesses typed, I want those guesses gone after "Start from your account only", so that the next guess never writes cleared guesses back.
10. (D10) As a player whose device never synced with any account, I want my progress to import without a question, so that the first sign-in stays one step.
11. (D11) As a player who signs in with the same account the device last synced with, I want no question, so that a normal sign-in stays quick.
12. (D12) As a player whose device holds only preferences (no Daily, run, Best, or Codex row), I want no question, so that nothing is asked when nothing of another account is there.
13. (D13) As a player whose choice fails to save, I want a one-line error and the dialog to stay open, so that I can try again.
14. (D14) As a player with the How-to dialog open when the choice opens, I want the choice above it, so that I decide first.

## Implementation Decisions

- **Pending rule.** A device progress choice is pending when the signed-in account's id differs from the account id the device last synced with (`readSyncAccount`), that id exists, and the device holds any Codex entry, Best, run, or Daily. A missing last-synced id (a device that never synced) is never pending. The rule is one pure function of `Persist` and the account id, placed beside Sync and used by both Sync and the account menu, so they cannot disagree. It uses only existing `Persist` calls (`readCodex`, `readBlitzBests`, `readBlitzRuns`, `listDailyDates` and `readDaily` per Daily category). It counts only rows Sync could import: a run needs a valid `endedAt`, and a Daily must read back, so a device with only unreadable rows is not pending.
- **Gate in Sync.** `refresh()` treats a pending choice like an unconfirmed name: after `getAccount` returns a signed-in account, and before it checks the name or pulls, it checks the pending rule; when pending it stays inactive (an active Sync is reset first, as another tab signing in as someone else is), and nothing is pulled or pushed. The choice check comes before the name check, so both gates hold and the order the player sees matches the order Sync checks.
- **Account menu.** `AccountMenu` renders the Device progress choice for a signed-in account whose choice is pending, and only after that the name confirm for an unconfirmed name. `Shell` passes `persist` and `remount` to `AccountMenu`. The pending flag is computed when the account is read and again after each choice; it is state, not derived on every render. A pull never changes it: a pull cannot run while the choice is pending. It follows stored state, so it shows on every app load with a stored sign-in, not only after the redirect.
- **"Add this device's progress to your account".** First re-reads the pending rule; when it is no longer pending (another tab already chose), the dialog closes and nothing else happens. Otherwise it writes the account id as the device's last synced account, then calls `refresh()` on Sync. The device now counts as the account's, so the choice does not return. A failed write (`{ ok: false }`) shows the one-line error and keeps the dialog open. The name confirm follows if the name is unconfirmed; its existing `refresh()` after Continue runs the import.
- **"Start from your account only".** First re-reads the pending rule, with the same no-op when it is no longer pending. Then it runs in this order: `stop()` on Sync (drops timers and in-flight work); `clearAll()` on `Persist`; write the account id as the last synced account (the device is now this account's, and empty); `await refresh()` (pulls and merges when the name is confirmed; with an unconfirmed name Sync stays inactive and the pull happens after the name confirm, when the account still has nothing to pull); then remount the app. The result of the account id write is ignored: the device is already cleared, an empty device is not pending, and the pull writes the id again. A failed pull is silent, as every Sync failure is: the app remounts on the cleared device and the next trigger retries; the choice never shows "failed" for a pull. An `AccountGoneError` from the pull follows Sync's account gone steps (sign out, local data kept), and the app still remounts. A pull that never settles leaves the dialog open with both buttons disabled; a reload recovers, because an empty device is not pending. This risk is accepted.
- **Remount.** `App` holds a remount counter and keys the router provider on it, so a remount rebuilds every screen, and Shell reads the theme and the How-to seen flag again from the cleared or pulled store. `App` passes a stable `remount` function (the router is rebuilt when its inputs change, so the function must not change identity between renders) down the router context and Shell to `AccountMenu`. The remount is used only here in this ticket (Account deletion, #140, will need the same); a UTC day change still rebuilds only the router, as today.
- **Guesses on screen.** The Daily screen keeps its guesses in component state and writes them on the next try. The remount drops that state, so a guess after the choice starts from the cleared store. This is the reason the choice remounts instead of only clearing.
- **Dialog.** A new component in the app's native dialog pattern (`showModal`, compact card like the How-to, not full page). Title "Use this device's progress?", a short paragraph saying this device holds progress from another account, and two buttons: "Add this device's progress to your account" and "Start from your account only". `cancel` and Escape are prevented and stop propagating (Escape must not reach the How-to's or the menu's document listeners), a backdrop click does nothing, and a close the browser forces reopens the dialog, as the name confirm does. There is no Sign out link (the ticket says the player must choose). Both buttons are disabled while a choice runs. `aria-labelledby` names the title so the dialog is found by its name.
- **Copy.** The dialog's strings are exported constants (as `display-name-copy` does for the name confirm), so tests and the dialog share them.
- **No new domain term**, so `CONTEXT.md` does not change; "Device progress choice" comes from Spec 4. ADR 0002 already records that the sync bookkeeping and `clearAll` live on `Persist`.
- **Nothing else changes.** `Remote`, the adapter, the fake `Remote`'s row model, `Persist`, the migrations, and the smoke script are untouched. No migration.

## Testing Decisions

Good tests drive behavior through the highest seam: render `App` with `memoryStore` and the fake `Remote`, act as the player, and assert the screen, the local store's contents, and the fake account's rows.

- **App-level tests** (fake `Remote`, `memoryStore`; prior art `name-confirm.test.tsx`, `row-sync.test.tsx`):
  - a different account with progress on the device shows the dialog before the name confirm and before any push (the fake's push log stays empty, the local rows stay);
  - the dialog has no way out: Escape and a backdrop click leave it open;
  - reload (a second `App` render on the same store) shows it again while pending, and the name confirm does not show until the choice is made, and after it only for an unconfirmed name;
  - "Add" keeps local rows, the account receives them, and the name confirm follows for an unconfirmed name; a reload after "Add" shows no dialog;
  - "Start from your account only" clears the device, pulls the account's rows into the store, remounts (the Daily on screen with typed guesses shows none, and a guess made after the choice does not bring back the cleared guesses), and the theme and the How-to dialog follow the cleared store;
  - a device that never synced imports without asking; the same account signing in again asks nothing; a device holding only preferences asks nothing;
  - a failed write of the choice ("Add") shows an error and keeps the dialog (a `Persist` whose account write fails);
  - "Add" followed by Sign out at the name confirm leaves the device marked as that account's; a third account signing in then asks again;
  - a dialog left open by another tab's choice does nothing when a button is pressed (the stored last synced id already matches);
  - an `AccountGoneError` from the pull after "Start" still remounts and leaves the device signed out with the cleared data;
  - "Start" with an unconfirmed name shows the name confirm after the remount and pushes nothing before Continue;
  - a failed pull after "Start" still remounts and the next trigger retries.
- **Sync module tests** (`sync.test.ts`, fake `Remote`, fake clock): a pending choice keeps Sync inactive (nothing pulled or pushed on open, visible, focus, or the debounce timer); an already active Sync (account A) that sees account B pending resets, pulls nothing, and pushes nothing; after the account id is written, `refresh()` imports; the pending rule for each row kind, for a missing last-synced id, for the same id, and for preferences only.
- **Not in Vitest**: nothing new; no SQL or adapter change.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass; the existing suite is unchanged.

## Out of Scope

Preferences sync (#137); Leaderboards (#139); Account deletion and its remount use (#140); a sign-out link or any other way out of the choice; a per-row choice or a merge preview; any sync UI beyond the one-line error of a failed choice write; changes to `Remote`, the adapter, or the SQL.

## Further Notes

Author calls not decided by #138 or Spec 4, listed so they can be overruled:

- The pending rule is a shared pure function used by Sync and by the account menu.
- The choice is state-driven (stored last synced id), as Spec 4 says, so it survives a reload.
- "Add" records the account as the device's last synced account at choice time, before the first merge, so the choice never returns; #136 wrote that id only after a merge.
- A failed write of that id keeps the dialog open with a one-line error; the ticket named no failure path.
- "Start from your account only" ignores a failed pull (silent, retried by the next trigger) and still remounts, because the clear cannot be undone.
- With an unconfirmed name, "Start" clears and remounts without pulling (Sync stays inactive until Continue, and a new account has nothing to pull anyway); the pull then runs in the `refresh()` after Continue.
- Each choice button re-reads the pending rule first, so a dialog left open by another tab does nothing (it would otherwise clear progress the other tab just added).
- A pull that never settles after "Start" strands the dialog until a reload; no timeout is added.
- The remount is a counter on `App` that keys the router provider; #140 will reuse it (the two tickets may conflict on it when they merge).
- The dialog title and paragraph text, and the compact card size, are author choices; the two button labels come from the ticket.
- The choice has no Sign out link, following "no other way out" in Spec 4; a player who does not want either can only choose.
