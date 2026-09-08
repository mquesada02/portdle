# Portdle — design spec

Date: 2026-09-08  
Repo: https://github.com/mquesada02/portdle (private)  
Site (v1): https://mquesada02.github.io/portdle/

This spec is the product and architecture for v1. It is not an implementation plan.

## 1. What this is

Portdle is a Wordle-like daily game for network ports, plus a timed Blitz mode.

- **Default skill:** see a service **name**, type its **port**.
- **Inverted skill:** see a **port**, pick the **name** from a search list.
- Daily uses default only. Inverted exists only in Blitz.

v1 is a static SPA. There is no backend, no accounts, no leaderboards, no PWA. Global “how everyone did today” waits for a later server.

## 2. Glossary

| Term | Meaning |
|---|---|
| **Entry** | One catalog row: a named service with one port number |
| **Category** | `protocol` (RFC/IANA-style) or `application` (unofficial / tooling) |
| **Mixed** | Union of both categories; not its own JSON catalog |
| **Answer-eligible** | Entry that may be a Daily or Blitz **target** |
| **Miss-only** | Entry used only to name a wrong guess |
| **Daily** | One puzzle per UTC date per category (three Dailies) |
| **Orientation** | Default (name → port) or Inverted (port → name) |
| **Cycle** | One shuffled deck of answer-eligible ids for a category until exhausted |
| **Schedule** | Committed JSON: which id is the Daily on which UTC day |
| **Frozen prefix** | Already-dealt days in the current cycle **plus today** — identity must not change |

## 3. Out of scope (v1)

- Accounts, auth, synced streaks, Blitz leaderboards, global histograms
- Inverted Daily; length / difficulty settings
- Playable archive, replay of today’s Daily, practice trainer besides Blitz
- Blitz skip, PWA / service worker, sound, analytics, i18n
- IANA scrape pipeline, on-screen-only keypad, custom domain
- Changing a frozen-prefix entry’s `name` or `port`

## 4. Architecture

Pure engine + thin React.

```
src/catalogs/     JSON catalogs + committed schedules
src/engine/       Pure TS: lookup, guess, search, Blitz reducer, streaks
src/persist/      localStorage adapter
src/ui/           React screens and controls
scripts/          gen:schedule
```

- `engine/` does not import React, DOM, or `localStorage`.
- Tests inject `utcToday` and RNG. The UI passes UTC date from `Date`.
- No Redux/Zustand. Daily and Blitz do not share a live session.
- Search: in-memory prefix index (hundreds of rows). No worker.
- Router: TanStack Router, path URLs, `basepath: '/portdle'`.
- Vite `base: '/portdle/'`. Build copies `index.html` → `404.html` for GitHub Pages SPA refresh.

## 5. Catalog data

### 5.1 Files

- `src/catalogs/protocols.json` — array of protocol entries
- `src/catalogs/applications.json` — array of application entries
- Mixed is derived (union by `id`; ids are globally unique)

### 5.2 Entry schema

```ts
type Transport = "tcp" | "udp" | "both";

type CatalogEntry = {
  id: string;              // stable slug, unique globally, never reused
  name: string;            // canonical display, unique case-insensitive
  aliases?: string[];      // same service only; search keys; never a Daily title
  port: number;            // integer 0–65535
  transport: Transport;    // metadata; never part of the guess
  description: string;     // reveal; may contain the name
  blurb?: string;          // inverted collision hint; see 5.3
  answerEligible: boolean;
  retired?: boolean;       // omitted from the next cycle; still names misses
};
```

**Aliases** are other names for the **same** service (`postgres` → PostgreSQL). They are not related protocols, hostnames, or DNS labels (`www` is not an alias of HTTP).

**Name uniqueness:** `name` is unique across the whole catalog, case-insensitive. `id` is unique and stable forever.

**v1 content floor (hand-curated, no scraper):**

- ≥ 40 answer-eligible protocol entries
- ≥ 25 answer-eligible application entries
- Extra miss-only rows added by hand where useful

### 5.3 Blurb rule

If two or more **non-retired** entries in the **same category** share `port`, **each** of those entries **must** have a `blurb`.

- `blurb` must not contain that entry’s `name` or any alias (case-insensitive substring).
- Unique ports in a category: omit `blurb`; inverted shows the number only.
- Mixed inverted uses the **selected Blitz category’s** catalog for crowding (Protocols / Applications / Mixed). For Mixed, crowding is union-wide.

Build/test fails if this rule is violated.

### 5.4 Identity freeze

| Field | Frozen prefix (past + today) | Future tail |
|---|---|---|
| `description`, `aliases`, `blurb`, `transport` | Anytime | Anytime |
| `name`, `port` | Forbidden | Allowed |
| `answerEligible` / `retired` | Do not remove from order file | Tail: drop + reshuffle tail (A2 reverse) |
| Delete row | Forbidden if `id` is in the current order | Prefer `retired: true` |

Retired entries stay in JSON so misses can still name them.

## 6. Schedules (Daily identity)

### 6.1 Files

`src/catalogs/schedules/{protocols,applications,mixed}.json`

```ts
type Cycle = {
  startDay: number; // UTC days since epoch (inclusive)
  order: string[];  // entry ids, index 0 is startDay
};

type ScheduleFile = {
  epoch: string; // UTC calendar date "YYYY-MM-DD"
  cycles: Cycle[];
};
```

**Epoch:** committed in these files. Initial value `2026-09-09`. May be changed **once** before the first public Daily. After players exist, never change `epoch` or rewrite a frozen prefix.

`utcDayIndex(date) =` whole UTC days from `epoch` to `date` (0 on epoch day).

Today’s id: find the cycle with `startDay <= utcDayIndex < startDay + order.length`, then `order[utcDayIndex - startDay]`.

If no cycle covers today, the UI shows “puzzle unavailable”. CI must make that impossible on `master`.

### 6.2 A2 updates — `pnpm gen:schedule`

Idempotent. Inputs: catalogs, existing schedules, `utcToday`. A second run with no catalog-eligibility changes is a no-op.

When answer-eligible ids are **added**, or tail ids are **retired**:

1. Leave `order[0] … order[todayIndex]` untouched (frozen prefix, including today).
2. Let `tail = order[todayIndex+1 …]` minus retired ids, plus new eligible ids not already in this cycle.
3. Deterministically shuffle `tail` (seed derived from `category + cycle startDay + sorted tail ids`).
4. Resolve **same-day distinctness** for days **after today** only (see 6.3).
5. If the current cycle has no remaining future cards and `utcToday` is past the last card, **append** a new cycle: shuffle all current non-retired answer-eligible ids (seed from category + new `startDay`).

Flavor-text-only JSON edits do not require this script.

**Coverage invariant:** after a successful run, each schedule covers `utcToday` through `utcToday + 7` (append full new cycles if the last assigned day is sooner). Do not wait for exhaustion day; that would make CI date-fragile.

`pnpm gen:schedule --check` exits non-zero if running the generator would change any schedule file, or if validation (blurbs, frozen identity, floors, coverage) fails.

### 6.3 Same-day distinctness

The three Dailies on one UTC date must be **three different `id`s**.

Resolved **at schedule generation**, not in the browser.

After building/updating a tail (or a new cycle), walk days from `today+1` (or from `startDay` for a brand-new cycle) forward:

- Let `P`, `A`, `M` be the ids assigned that calendar day.
- If `M === P` or `M === A`, swap `M` with the nearest **later** Mixed id that does not collide with that day’s `P` and `A`.
- If no later Mixed id works, insert the next unused Mixed-eligible id (answer-eligible in either catalog, not already in this Mixed cycle) into that slot. Never steal a Protocols or Applications card.
- If the Mixed pool is exhausted, append the next Mixed cycle and continue filling from it.

Do **not** rewrite frozen prefix even if a historical collision exists.

### 6.4 History

Read-only UI lists every scheduled Daily with `date < utcToday`, plus **today** only after that category’s Daily is `won` or `lost` for this browser.

Never list future tail ids. History is not playable.

## 7. Engine

All functions are pure. `utcToday` is always a `YYYY-MM-DD` UTC date string.

### 7.1 Default guess (name → port)

Slots length = decimal digit count of `answer.port` **without** leading zeros (port `80` → 2 slots; port `0` → 1 slot).

The submitted value is the integer of the digit string (`parseInt`, base 10). Leading zeros collapse (`080` in 3 slots → `80`).

| Condition | Result | Spends a try |
|---|---|---|
| Incomplete / non-digits | `invalid` | No |
| Integer `> 65535` | `invalid` | No |
| Same integer already submitted this puzzle | `duplicate` | No |
| Integer `=== answer.port` | `correct` | Yes (winning try) |
| Else, some non-retired entry in **this Daily’s category catalog** has that `port` | `miss` + `identified: { name, port }` | Yes |
| Else | `miss` + `identified: null` (“not in this catalog”) | Yes |

If several entries share the guessed port, `identified` is the one with the lexicographically smallest `id`.

Six misses → `lost`. Reveal still shows the answer.

Category catalog for Mixed Daily misses = union of both JSON files (non-retired).

### 7.2 Inverted guess (port → name) — Blitz only

Submit is a catalog `id` from the **chosen Blitz category** (picker; garbage strings cannot be submitted).

| Condition | Result | Spends a life |
|---|---|---|
| Same `id` already submitted this puzzle | `duplicate` | No |
| `id === answer.id` | `correct` | Yes (score) |
| Else | `miss` + picked row’s `{ name, port }` + `samePort: picked.port === answer.port` | Yes |

Aliases only affect which row the UI selects; the engine compares `id`.

Inverted prompt: show `answer.port`. If that port is crowded in the **chosen category** (including Mixed = union), also show `answer.blurb`.

### 7.3 Search index

Built once from the category catalog (full, including miss-only and retired, so inverted can still pick them as wrong guesses).

- Haystack tokens: `name` + each alias, `toLowerCase`.
- Query: trimmed, lowercased. Empty query → empty list (do not dump the catalog).
- Match: any token **starts with** the query (prefix, not infix).
- Sort: name-prefix matches first, then alias-prefix, then `name` locale-compare.
- Cap: 20 rows.
- Debounce in UI: 200ms.
- Description and blurb are **not** indexed.

### 7.4 Blitz reducer

Start arguments: `category`, `orientation`, `mode: "sprint" | "marathon" | "survival"`, `utcToday`, catalogs, schedules, `rng`.

Pool: answer-eligible, non-retired ids in that category, **minus the three Daily ids for `utcToday`**. Shuffle with `rng`. If the filtered pool is empty, Blitz cannot start (show why).

State: `{ lives: 3, score: 0, remainingIds, currentId, ended: null | "lives" | "timeout" }`.

- Correct: `score += 1`, next id from `remainingIds`. If empty, reshuffle a fresh copy of the start pool (including already-solved ids) so the run can continue.
- Miss: `lives -= 1`; if `lives === 0`, `ended: "lives"`; else next id (same reshuffle rule).
- Duplicate/invalid: no state change.
- `timeout` (UI event): `ended: "timeout"`. Survival never emits timeout.
- No skip.

Timer (UI): Sprint 60s, Marathon 300s, Survival none. Wall clock (`Date.now()`); backgrounded tabs still consume time. Refresh discards the run.

### 7.5 Streaks and personal stats

Per category:

```ts
type CategoryStats = {
  currentStreak: number;
  bestStreak: number;
  played: number;
  wins: number;
  histogram: [number, number, number, number, number, number]; // tries 1–6
};
```

On a finished Daily (once per category per UTC date):

- `played += 1`
- Win: `wins += 1`, `histogram[tries-1] += 1`, `currentStreak += 1`, `bestStreak = max(best, current)`
- Loss: do **not** increment `histogram` (wins-only 1–6 bars), `currentStreak = 0`

Streak gap, applied when loading a new UTC day **or** when recording today’s finish:

- Missing `lastPlayed` (never finished a Daily in this category): leave `currentStreak` as stored (0).
- `lastPlayed < yesterday`: skipped day(s) → `currentStreak = 0` before applying today’s result.
- `lastPlayed === yesterday` but that Daily key is missing or still `playing`: unfinished → `currentStreak = 0`.
- `lastPlayed === yesterday` and `won`/`lost`: already applied; don’t double-count.

Playing Protocols never mutates Mixed stats.

Headline streak on `/` is Mixed.

## 8. Persistence

Prefix `portdle:v1:`. Corrupt JSON for one key is ignored; other keys stay. Version is in the key; no v1→v2 migration.

| Key | Value |
|---|---|
| `portdle:v1:daily:{category}:{date}` | Guesses, `playing \| won \| lost`, committed slot rows |
| `portdle:v1:stats:{category}` | `CategoryStats` |
| `portdle:v1:lastPlayed:{category}` | UTC date last streak-applied |
| `portdle:v1:blitzBests` | Best score per `category|orientation|mode` |
| `portdle:v1:theme` | `system` \| `light` \| `dark` (default `system`) |
| `portdle:v1:howToSeen` | boolean |
| `portdle:v1:lastSeenUtc` | Last observed UTC date in this tab (new-day while open) |

Blitz **run** is not persisted. Best scores write on run end.

`setItem` throw → non-blocking “Progress may not save.” Game remains playable.

No cookies, no analytics, no network besides static assets.

## 9. UI

### 9.1 Routes (TanStack Router, code-based)

| Path | Screen |
|---|---|
| `/` | Mixed Daily |
| `/protocols` | Protocols Daily |
| `/applications` | Applications Daily |
| `/blitz` | Setup then in-page run (no run sub-route) |
| `/history` | Read-only past answers |
| `/help` | How-to copy |

Shell: nav Mixed · Protocols · Applications · Blitz · History · Help; theme control (sun/moon). Stored value is `system` | `light` | `dark`. First visit: `system` (follow `prefers-color-scheme`). Each click toggles **light ↔ dark** and persists that explicit choice (leaves `system` once the user has clicked).

First visit on `/`: How-to dialog; dismiss sets `howToSeen`. `/help` is the same rules, always.

### 9.2 Visual tone

Clean puzzle UI (Wordle cousin). Quiet chrome. Port slots and committed guesses **monospace**. Service names in a normal UI sans-serif. Light and dark themes. `prefers-reduced-motion` disables non-essential transitions.

### 9.3 Daily screen

- `h1` / title: canonical `name`
- Empty slots = digit length
- Input: digits, Backspace, Enter or Submit; `inputMode="numeric"`
- Invalid / duplicate: inline message, no new row
- Miss: commit the row, show identified name or “Not in this catalog.”
- Win or 6th miss: freeze; reveal `name`, `port`, `transport` as `TCP` / `UDP` / `TCP/UDP`, `description`; personal stats; Share
- Reload restores in-progress or finished state
- Already finished today: reveal + stats, no input

**Share** (clipboard; fallback select/copy), no spoilers:

```
Portdle · Mixed · 2026-09-09 · 3/6

⬜⬜🟩
```

Miss square: ⬜. Winning try: 🟩. Loss: `X/6` and six ⬜. One share per category Daily.

### 9.4 Blitz screens

Setup: category, orientation, mode, Start.

Run: lives, score, remaining time (not Survival), same slot control **or** inverted listbox (`role="listbox"`, ↑/↓/Enter, click). Empty filter: “No matches.”

End: score, `lives` vs `timeout`, comparison to stored best, Play again → setup. Write `blitzBests` if score > best.

### 9.5 History

Newest first: date, category, name, port. No play links. Today’s row only if finished in this browser.

### 9.6 Accessibility

One `h1` per screen. Slots are a labelled group. Status messages go to an `aria-live` region. Theme control has an accessible name. Keyboard completes Daily and inverted search without a pointer.

## 10. Tooling and hosting

- **pnpm** pinned via `packageManager`, strict peer deps
- **TypeScript:** `strict`, `noUncheckedIndexedAccess`
- **Biome:** lint + format, unused, no `any`, organize imports
- **Vite + React + Tailwind v4**
- **Vitest** for engine, `gen:schedule`, and a few UI tests
- **TanStack Router**
- No Playwright in v1, no UI kit, no state library, no service worker

Scripts: `dev`, `build`, `preview`, `lint`, `format`, `test`, `gen:schedule`.

`package.json`:

- `description`: “Wordle-like daily game for network ports.”
- `repository`: `https://github.com/mquesada02/portdle`

MIT `LICENSE`. GitHub About description matches `package.json`.

**CI (`master`):** lint, typecheck, test, `gen:schedule --check`, build, deploy GitHub Pages (public site, private repo, GitHub Pro). English UI only.

## 11. Testing (required behaviors)

Engine / generator (Vitest):

- `getDaily` for a fixture schedule date
- Default: correct, miss identified, miss unknown, incomplete, `65536`, duplicate, win try 1, lose try 6, Mixed miss uses union
- Inverted: correct id, wrong other port, wrong same port, duplicate
- Search: name prefix, alias prefix, no description match, empty query, case-fold
- Blitz: score, lives, timeout, excludes today’s three Daily ids, reshuffle when pool empty
- Streaks: win increment, loss reset, UTC gap reset, no cross-category leak
- `gen:schedule`: A2 freeze when adding an id, same-day ids distinct after today, `--check` idempotent, blurb required on crowded ports, frozen `name`/`port` rejected

UI (few tests):

- Slots refuse incomplete submit
- Typeahead submits only a listed row
- How-to sets `howToSeen`

## 12. Failure table

| Situation | Behavior |
|---|---|
| Corrupt persist key | Ignore that key |
| `localStorage` quota | “Progress may not save.” Play on |
| Clipboard denied | Select/copy fallback |
| Schedule missing today | “Puzzle unavailable” + link to Help |
| Empty typeahead | “No matches.” |
| Blitz pool empty (all answers are today’s Dailies) | Cannot start; explain |
| Catalog/schedule invalid | CI fails; no deploy |

## 13. Later (not v1)

Accounts, synced streaks, global try-distribution, Blitz leaderboards, dedicated domain, PWA with cache-bust on schedule version, playable archive, skip-as-strike, length settings, IANA scrape, extra locales.
