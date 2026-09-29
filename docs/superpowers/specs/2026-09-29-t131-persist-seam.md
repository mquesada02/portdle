# Ticket spec: Persist seam for sync (#131)

Ticket of Spec 4 (accounts, sync, and leaderboards; issue #127, and its spec file in `docs/superpowers/specs/`). Map: #114. This ticket is the prefactor: the local storage seam gains what Sync will need, with no player-visible change. It builds no Sync, no `Remote`, no merge engine, and no UI.

## Problem Statement

Sync (later Spec 4 tickets) has to read and write bookkeeping about what changed, list a category's stored Dailies, learn when the player wrote something, and clear the device. The storage seam (`Persist` over a `KeyValueStore`) offers none of this. The Codex screen also writes back the Codex it read at mount, which would overwrite merged data a pull wrote in between.

## Solution

`Persist` and `KeyValueStore` gain exactly those capabilities, behind the same synchronous seam. Nothing a player sees or stores today changes: the same keys, the same values, the same screens. The Codex screen's fresh-flag clear reads the stored Codex when it writes.

## User Stories

1. As the Sync module, I want to list the dates that have a stored Daily for a Daily category, so that I can rebuild stats and streaks from every stored Daily.
2. As the Sync module, I want to read and write the set of rows changed since the last successful push, so that a push sends only what changed.
3. As the Sync module, I want to read and write the id of the account this device last synced with, so that a different account signing in can be detected.
4. As the Sync module, I want `Persist` to tell me after each successful write of player data what was written, so that no screen has to call Sync.
5. As the Sync module, I want my own bookkeeping writes and the device clear not to notify me, so that Sync never triggers itself.
6. As the Sync module, I want to clear every Portdle key on the device, so that account deletion and "Start from your account only" leave nothing behind.
7. As the Sync module, I want the clear to leave keys that Portdle does not own untouched, so that other sites' or tools' data on the same origin survives.
8. As a player, I want the Codex screen to clear fresh flags on the Codex as stored at that moment, so that a Codex merged in from my account is never overwritten by a stale copy.
9. As a player, I want the Codex screen to show the same fresh cards on mount as today, so that the fresh-card pop (Spec 3) still plays once.
10. As a player, I want everything else to behave exactly as before, so that this prefactor costs me nothing.
11. As a developer, I want `memoryStore` to support key removal and key listing, so that tests reach the new behaviour without a browser.

## Implementation Decisions

- **`KeyValueStore`** gains `removeItem(key)` and key listing in the shape of the browser's `Storage`: a `length` and `key(index)`. `window.localStorage` already satisfies it, so the app's wiring is unchanged. `memoryStore` (test helper) gains the same three members over its map: `length` is live (it reflects the map's current size) and `key(index)` returns `null` when the index is out of range.
- **Listing Dailies**: `Persist` gains `listDailyDates(category)`, returning the UTC dates that have a stored Daily key for that Daily category, ascending. It lists by key and keeps only keys whose date part has the `YYYY-MM-DD` shape (as the existing date check does), so a corrupt stored value still lists (Sync's read of it returns `null`, as `readDaily` does today) and a stray key such as one ending in `junk` does not.
- **Sync bookkeeping keys**: two new keys, `portdle:v1:syncChanges` and `portdle:v1:syncAccount`.
  - Changed rows: `readSyncChanges()` returns `SyncChanges`, and `writeSyncChanges(value)` stores it. `SyncChanges` holds one string list per synced row kind: `codex` (entry ids), `bests` (`category|orientation|mode` keys), `runs` (`endedAt` values), `dailies` (`category|date`), and `preferences` (`theme`, `howToSeen`, `codexSort`). A missing or corrupt value reads as all lists empty; a stored object with a missing or malformed list reads that one list as empty and keeps the others, and a list drops any element that is not a string. `readSyncAccount()` reads a missing, corrupt, non-string, or empty value as `null`. Sync owns what goes in the lists; `Persist` only stores and validates the shape.
  - Last synced account: `readSyncAccount()` returns the account id or `null`; `writeSyncAccount(id)` stores it.
  - Both write methods return `{ ok: true } | { ok: false }` like every other write.
- **Clearing**: `clearAll()` removes every key of the store that starts with `portdle:`, bookkeeping keys included, and leaves other keys alone. It collects the keys first, then removes them, so removal never disturbs the listing. It returns nothing and tolerates a removal that throws, so one failing key does not stop the rest from being removed.
- **Write listener**: `Persist` gains `onWrite(listener)`, which registers one listener and returns a function that unregisters it; registering again replaces the previous listener. After each successful write of player data, `Persist` calls the listener with what was written: `{ kind: "theme" | "howToSeen" | "codexSort" | "codex" | "blitzBests" | "blitzRuns" | "lastSeenUtc" }`, `{ kind: "daily", category, date }`, or `{ kind: "stats" | "lastPlayed", category }`. Failed writes call nothing. The descriptor is deliberately coarse: it names the kind and, for a Daily, its category and date, not the changed row or the old value, so Sync diffs against its own snapshot. The Codex screen's fresh-flag clear notifies like any Codex write; Sync ignores it because the synced value did not change. A listener that throws never turns a successful write into a failure: the write still returns `{ ok: true }`. The function returned by a registration unregisters only that registration, so calling it after the listener was replaced does nothing. The bookkeeping writes and `clearAll()` call nothing, so Sync's own bookkeeping never triggers a push and a device clear never counts as a player change. Sync tells its own data writes (pulls, the stats rebuild) from the player's by its own means, in its own ticket.
- **Codex fresh-flag clear**: on mount the Codex screen still renders from the Codex it read at mount, fresh flags intact. Its mount effect now writes `clearCodexFresh` of the Codex read from `Persist` at that moment, not of the mount-time copy. The save-warning behaviour on a failed write is unchanged. The other write paths already re-read the store before writing (Spec 4, "Never disturb the screen") and are not touched.

## Testing Decisions

- A good test drives behaviour through the highest seam and asserts what is stored or shown, never internal calls. The seam is `Persist` over `memoryStore`; the Codex change is tested through the mounted screen.
- **`Persist` tests**: `listDailyDates` (ascending, per category, ignores other categories, other keys, and non-date suffixes, lists a corrupt value); sync bookkeeping round trips and the defaults for missing, corrupt, and malformed values (one bad list empties only that list; a bad account id reads `null`); `clearAll` removes every `portdle:` key and keeps a foreign key, and finishes when a removal throws; the listener receives each write's descriptor, receives nothing on a failed write, nothing on bookkeeping writes, nothing on `clearAll`, is replaced by a second registration, stops after unregistering, is not unregistered by a stale unregister function, and a throwing listener leaves the write returning `{ ok: true }`. Prior art: the round-trip and failure tests already in that file.
- **`memoryStore`**: covered through the `Persist` tests above (`removeItem`, `length`, `key`).
- **Codex screen tests**: the mount effect runs right after the mount-time read, so the test wraps `Persist` so that its first `readCodex()` call returns the stored Codex and then changes the stored Codex (later calls read normally) (an entry that was not in the first read); after mount the stored Codex keeps that entry, with every fresh flag cleared, instead of being replaced by the mount-time copy; the existing test that the fresh cards render on mount and every stored flag reads false after mount keeps passing. Prior art: the existing fresh-flag test in that file.
- The existing suite passes unchanged, and `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.

## Out of Scope

- Sync, `Remote`, the merge engines, time to score, the stats rebuild, and any UI.
- The new ADR that records the amended storage decision (ADR 0001). #131's acceptance criteria do not list it, so it ships with whichever Spec 4 ticket owns it (see #127), not here.
- Changing any stored key, value shape, or existing `Persist` method signature.
- Re-read changes to any write path other than the Codex fresh-flag clear.

## Further Notes

- Author calls not decided by #131 or Spec 4, listed so they can be overruled: the `Storage`-shaped key listing on `KeyValueStore`; the name and shape of `SyncChanges`; `listDailyDates` returning ascending dates; one replaceable listener with a descriptor argument; the listener firing for every player-data write, `lastSeenUtc`, stats, and last played included, so Sync decides which are synced; `clearAll` matching the `portdle:` prefix, including the bookkeeping keys, and returning nothing; the bookkeeping writes and `clearAll` not notifying the listener, although #131 says "each successful write"; a throwing listener being swallowed; the ADR left out of this ticket.
