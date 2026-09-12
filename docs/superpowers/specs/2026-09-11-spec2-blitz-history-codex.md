# Spec: Blitz arena, round log, Blitz segment, History split, Codex (Spec 2)

Spec for the second round of player feedback after the UI redesign. Tracker: https://github.com/mquesada02/portdle/issues/70 (feedback in https://github.com/mquesada02/portdle/issues/42).

## Problem Statement

A player who opens Blitz today lands on a bare setup screen. Nothing on that screen says what "Default" and "Inverted" mean, and nothing remembers what they played last. During a run the HUD shows lives, score, and time, but not which round they are on, and each committed round vanishes the moment the next prompt appears: a miss flashes the service name for a second and is gone. When the run ends, the end card shows a score and a best, and the rounds are lost for good. History lists only Dailies, so the Blitz runs a player is proud of leave no trace. And across both modes, everything the player has learned about ports (the services they guessed, the ones they missed, the ones a wrong port turned out to belong to) is never collected anywhere. There is no reason to come back other than the next Daily.

## Solution

Blitz becomes an arena. The page opens on the player's last run and their bests, with one "New run" button. Setup moves into a dialog that preselects the last setup, where the two Orientation options carry a one-line caption each: "Default" / "See a service, type its port." and "Inverted" / "See a port, pick the service." During a run the HUD reads "Round {n}", and a round log under the input shows the last three rounds with their outcome, the entry's name and port, and on a miss what the player answered. The end card lists every round of the run. Every ended run is saved (the newest fifty), so the arena's "Last run" and a new Blitz segment in History can show them. History gets a Daily | Blitz switcher.

A Codex takes the fourth nav position. It shows every catalog entry as a card. An entry the player has never been shown reads `???`. An entry they have encountered shows its name and port and one of three states: Correct (guessed right at least once), Missed (asked and not guessed), or Identified (revealed by a wrong guess, never asked). A headline counts what they have seen and what they have got right. Cards group by catalog kind, sort by name or by port, and open the same popover as a Daily miss identification, with description and sources. Encounters come from Daily targets, Daily miss identifications, and Blitz rounds.

The design language, motion rules, and test seams from the UI redesign carry over unchanged. Game rules for Daily and Blitz do not change. Persistence stays in localStorage behind the existing seam; a backend is a later effort.

## User Stories

### Blitz arena

1. As a player, I want the Blitz screen to open on an arena instead of the setup screen, so that I see what I did last and what my bests are before I decide to play.
2. As a player, I want one "New run" button at the top of the arena, so that starting a run is a single obvious tap.
3. As a player, I want a "Last run" block showing the setup, why it ended and when, and the score, so that I can pick up where I left off.
4. As a player, I want to expand the last run's round log from the arena, so that I can reread what I missed without replaying.
5. As a player with no runs yet, I want the arena to say "No runs yet. Start one and it will show here.", so that an empty arena still tells me what to do.
6. As a player, I want a "Bests" table with one row per category, orientation, and mode I have scored in, so that my bests are visible without starting a run.
7. As a player with no bests yet, I want the Bests section hidden, so that the arena is not a table of dashes.
8. As a player, I want "Play again" on the end card to return me to the arena with the run I just finished as the last run, so that I see the updated arena before deciding to go again.

### Setup dialog

9. As a player, I want "New run" to open a dialog named "New run" with the Daily category, Orientation, and Mode groups, so that setup does not take over the page.
10. As a player, I want the dialog to preselect the setup of my last run, so that replaying my usual setup is two taps.
11. As a first-time player, I want the dialog to preselect Mixed, Default, and Sprint, so that the first run needs no decisions.
12. As a player, I want each Orientation option to show its title and a one-line caption, "Default" / "See a service, type its port." and "Inverted" / "See a port, pick the service.", so that I understand the choice without leaving the dialog.
13. As a player, I want Escape, a backdrop click, or a Cancel button to close the dialog without starting a run, so that opening it costs nothing.
14. As a player, I want the "Cannot start Blitz: not enough unused answers today." notice to show inside the dialog when the pool is empty, so that the failure is next to the Start button that caused it.
15. As a keyboard player, I want the dialog to trap focus and return focus to "New run" when it closes, so that it behaves like the How-to dialog.

### Blitz run

16. As a player, I want the HUD to read "Round {n}", where n is the number of rounds I have committed plus one, so that I know how far into the run I am.
17. As a player, I want a round log under the input showing my last three committed rounds, newest first, so that I can see what just happened without the message flashing away.
18. As a player, I want each round log line to show the outcome as a dot with text for assistive tech, the entry's name, and its port, so that a miss teaches me the right answer.
19. As a player, I want a missed round in Default orientation to also show what I typed, as "you typed 6380", with the owner's name when that port belongs to an entry, as "you typed 6379 (Redis)", so that I see both what I answered and what it was.
20. As a player, I want a missed round in Inverted orientation to also show what I picked, as "you picked MySQL", so that I see the service I confused it with.
21. As a player, I want older rounds to drop off the round log after three, so that the input never scrolls out of reach on a phone.
22. As a player, I want an invalid guess to leave the round log unchanged, so that only committed rounds are counted.
23. As a player, I want a run that times out mid-prompt to leave that prompt out of the round log, so that only rounds I answered are recorded.
24. As a player, I want the existing miss message, hearts, score, and countdown to keep working as they do today, so that the run feels the same apart from the new context.

### End card

25. As a player, I want the end card to list every round of the run under a "Rounds ({n})" heading, in the same line format as the round log during the run but oldest first rather than newest first, so that I can review the whole run.
26. As a player, I want the end card to keep "Time's up" or "Out of lives", the score, the best, and the "New best" badge, so that nothing I had is lost.

### Blitz persistence

27. As a player, I want every ended run saved, including a run with score zero, so that History and the arena are complete.
28. As a player, I want only my newest fifty runs kept, so that storage never grows without bound.
29. As a player, I want a saved run to carry its setup, end reason, end time, score, and its rounds with names and ports, so that History renders it even if the catalog changes later.
30. As a player who refreshes mid-run, I want the run to be lost as today, so that the rules do not change; my Codex encounters from that run are kept.
31. As a player whose browser refuses to save, I want the "Progress may not save." notice as today and the run still playable, so that a storage failure never blocks play.

### History

32. As a player, I want a switcher at the top of History with Daily and Blitz, so that both records live in one place.
33. As a player, I want the switcher to work like the Daily switcher, with two addresses, so that a reload or a link keeps the segment I chose.
34. As a player, I want the History nav item lit on both segments, so that the two segments read as one surface.
35. As a player, I want the Daily segment unchanged, so that nothing I rely on moves.
36. As a player, I want the Blitz segment to list my saved runs newest first, grouped by local date, each with its setup, why it ended and at what time, its score, and an expandable round log, so that I can revisit any run.
37. As a player with no saved runs, I want the Blitz segment to say "No runs yet.", so that an empty segment still says something.
38. As a player, I want no links from History rows, so that History stays a record, as today.

### Codex

39. As a player, I want a Codex nav item, last in the nav, with a book outline icon, so that the Codex is one tap away on phone and desktop.
40. As a player, I want the Codex to show every catalog entry as a card, grouped under "Protocols" and "Applications" headings, so that the Codex has a shape.
41. As a player, I want an entry I have never been shown to appear as a `???` card with no port, so that the Codex has gaps to fill.
42. As a player, I want an entry I have encountered to show its name, its port large, and its transport, so that the card is the reward I earned.
43. As a player, I want each seen card to carry one state, Correct, Missed, or Identified, shown by color and by a text label, so that the state is readable without color.
44. As a player, I want a headline reading "Seen {n} / {total} · Correct {m}", so that I see progress at a glance.
45. As a player, I want each group heading to carry its own seen count out of its total, so that I know which catalog to work on.
46. As a player, I want a Name | Port sort toggle, defaulting to Name, so that I can browse alphabetically or by port range.
47. As a player, I want my sort choice remembered, so that the Codex opens the way I left it.
48. As a player, I want unseen cards to keep their position in either sort, so that the Codex never reorders as I fill it.
49. As a player, I want to tap a seen card to open the same popover as a Daily miss identification, with the description and sources, so that the Codex teaches as well as counts.
50. As a player, I want unseen cards to be inert and skipped by keyboard focus, so that nothing leaks and nothing is a dead stop.
51. As a player, I want cards that became seen since my last Codex visit to pop once when the page opens, so that new finds are noticed.
52. As a player, I want the Codex grid to be two columns on a phone and more on a wider screen, so that the cards read well at any width.

### Encounters

53. As a player, I want a Daily I win to set its target to Correct, so that a won Daily counts as Correct in the Codex.
54. As a player, I want a Daily I lose to set its target to Missed, so that a lost Daily still reveals the entry.
55. As a player, I want a Daily try whose port belongs to another entry to set that entry to Identified, so that a wrong port still teaches me something I keep.
56. As a player, I want a Daily target to enter the Codex only when the Daily ends, so that an unfinished Daily reveals nothing.
57. As a player, I want a correct Blitz round to set its prompt to Correct, so that Blitz builds the Codex too.
58. As a player, I want a missed Blitz round to set its prompt to Missed, so that what the round log revealed is kept.
59. As a player, I want a missed Default round whose typed port belongs to an entry to set that entry to Identified, so that Blitz misses teach like Daily misses.
60. As a player, I want a missed Inverted round to set the entry I picked to Identified, including a same-port pick, so that the service I confused it with is kept.
61. As a player, I want a state to only ever move up, Identified to Missed to Correct, so that a later miss never takes a Correct away.
62. As a player, I want a timed-out prompt and browsing History to change nothing in the Codex, so that only play counts.
63. As a player, I want miss-only entries in the Codex, so that finding chargen by typing 19 still counts, even though they can only reach Identified.

### Shell, accessibility, motion

64. As a player, I want the nav to have exactly four items, Daily, Blitz, History, Codex, so that every surface fits the tab bar.
65. As a screen reader user, I want the setup dialog, the History switcher, the Sort toggle, the Codex grid, and each card to have accessible names, and the round log, the Last run and Bests sections, and the Round {n} readout to announce by their visible headings and text with no extra names, so that they announce properly without noise.
66. As a keyboard player, I want to open a Codex card's popover with Enter and close it with Escape, so that the Codex works without a pointer.
67. As a player who prefers reduced motion, I want the Codex card pop to be skipped, so that the existing reduced-motion rule holds.
68. As a player, I want the arena, dialog, History, and Codex to follow the existing design language, so that nothing looks bolted on.
69. As a player, I want the How-to rules to mention the Codex in one line, "The Codex collects every service you meet.", so that the rules cover every surface.

### Maintainer

70. As a maintainer, I want the new keys versioned under the existing prefix and validated on read, so that corrupt data in one key never breaks another.
71. As a maintainer, I want all Codex, round, and run logic in pure engine modules, so that they are tested without the DOM.
72. As a maintainer, I want the storage seam to stay synchronous and storage-agnostic, so that this spec's record shapes carry over unchanged when a later backend replaces the adapter and makes the seam async.

## Implementation Decisions

### Persistence

- Three new keys under the `portdle:v1:` prefix: two data keys and one preference key. No existing key changes shape, so no migration exists or is needed.
  - `blitzRuns`: an array of run records, newest first, capped at fifty. A pure helper in the engine prepends a run and drops anything past fifty; the page writes its result. Rounds per run are not capped. Time bounds Sprint and Marathon; Survival ends only on three misses, so an expert run can grow past the estimate. Fifty runs of about 150 rounds come to roughly 1 MB, within the 5 MB localStorage budget the ADR relies on; an overflow surfaces as a failed write and the existing "Progress may not save." notice, never as blocked play.
  - `codex`: a map from entry id to a Codex record.
  - `codexSort`: `"name"` or `"port"`, default `"name"`.
- Shapes (the decision-rich parts; names are illustrative, the seam decides the final ones):

  ```ts
  type RoundOutcome = "correct" | "miss";
  type WrongAnswer =
    | { kind: "typed"; port: number; owner: Identified | null }
    | { kind: "picked"; pick: Identified };
  // Identified is the existing { id, name, port } shape the guess results
  // carry; it is not renamed. The fields are named owner and pick so code
  // never reads `identified` next to the "identified" state.
  // Round lists the entry snapshot first and the answer after it; the
  // round-log line reads outcome, name, port, wrong answer, independently.
  type Round = {
    id: string;
    name: string;
    port: number;
    outcome: RoundOutcome;
    wrong: WrongAnswer | null;
  };
  type BlitzRun = {
    category: DailyCategory;
    orientation: Orientation;
    mode: BlitzMode;
    ended: "lives" | "timeout";
    endedAt: string; // ISO 8601 instant
    score: number;
    rounds: Round[];
  };
  type CodexState = "identified" | "missed" | "correct"; // a state, not the Identified shape above
  type CodexRecord = { state: CodexState; fresh: boolean };
  ```

- Names and ports inside a round are snapshots taken at commit time, so History and the arena render a run without a catalog lookup. The id identifies the entry; nothing reads it today, and it is kept so a later import can match rounds to entries.
- Reads validate the whole value; a value that fails validation reads as empty (no runs, empty Codex, name sort). Other keys are unaffected, as today.
- Everything goes through the existing storage seam, which stays synchronous. UI and engine never touch storage directly. Records are plain JSON: the Codex map is keyed by entry id, rounds carry entry ids, and a run has no id of its own, so `endedAt` orders runs and identifies them for a later import. See the ADR "localStorage until a backend".
- Write failures raise the existing "Progress may not save." notice and never block play.

### Encounters and the Codex engine

- The rule behind every encounter: an entry enters the Codex when the player has been shown its name and port together on a play surface. Everything below follows from it.
- A new pure Codex module owns the state machine. It takes the current Codex map and an encounter, and returns the next map. Encounters are: `correct`, `missed`, and `identified`, each with an entry id; the first two apply to a Daily target or a Blitz prompt alike.
- Precedence: Unseen < Identified < Missed < Correct. A state only moves up. Applying an encounter whose state is not above the stored one returns the map unchanged. Any transition from Unseen sets `fresh: true`; a later upgrade between seen states leaves the flag as it is. The Codex screen reads the map with the flags intact to render the visit, then, in the same mount, writes the map back with every flag cleared; the cards keep popping from the values read, and the next visit finds no flags.
- Which moments emit which encounter:

  | Moment | Encounter |
  |---|---|
  | Daily ends won | `correct` for the target |
  | Daily ends lost | `missed` for the target |
  | Daily try commits a miss with a miss identification | `identified` for the identified entry |
  | Blitz round committed correct | `correct` for the prompt |
  | Blitz round committed miss, Default | `missed` for the prompt; `identified` for the typed port's owner when one exists |
  | Blitz round committed miss, Inverted | `missed` for the prompt; `identified` for the picked entry |
  | Timeout mid-prompt | nothing (follows from the rule: no committed round) |
  | Viewing History or the arena | nothing (follows from the rule: neither is a play surface) |
  | Invalid or duplicate Daily try, invalid Blitz guess | nothing (follows from the rule: nothing is committed) |
  | Viewing the Codex | nothing (follows from the rule: not a play surface) |

- The Inverted pick counts as shown with its port: for a differing port the existing miss message "{name} is {port}" shows it, and for a same-port pick the existing message "Wrong service, same port." names no port because the prompt's own port is already the heading on screen.
- The Daily target enters the Codex when the Daily ends, not on the first try. Daily miss identifications enter on the try that revealed them. Blitz encounters enter on the round's commit, not at run end, so a refresh mid-run keeps them. Encounters start at release: Dailies finished before it, and the already-committed tries of a Daily still playing at release, do not backfill the Codex, so an existing player opens an empty Codex; only tries and ends after release count.
- The same module derives the Codex grouping: cards grouped by catalog kind (Protocols first), sorted by name (case-folded) or by port (ties by name, case-folded), each card carrying entry, state or unseen, and fresh. It also derives the counts: seen (any state above Unseen, per the glossary) and correct, per group and overall. Retired entries, should any appear, are listed like any other; no test covers them while the catalog has none. Miss-only entries are listed and can only ever be Identified.
- Unseen cards keep their position in both sorts. A port-sorted `???` between 22 and 25 gives away 23; this is accepted for a single-player game. Do not "fix" it.

### Blitz reducer

- The Blitz state gains `rounds: Round[]`. Every committed round (correct or miss) appends one round; an invalid guess appends nothing; a timeout appends nothing. A Blitz guess is never a duplicate: each prompt takes exactly one committed answer, so the Daily's duplicate case has no Blitz counterpart. The round number shown in the HUD is `rounds.length + 1`.
- The reducer keeps the pure, rng-injected shape it has today. Building a round from a guess result is part of the reducer, since it already has the answer entry and the guess result in hand.
- The typed-port owner for a Default miss is the guess result's existing miss identification. The picked entry for an Inverted miss is the existing `identified` on the inverted result.
- Run end (lives or timeout) is where a pure engine function builds the run record from the final state plus an injected clock; the page only calls it, writes the result to the runs key, and records the best as today. Encounters are written per round from the same reducer output the page already handles.

### Blitz screen

- The page has four states driven by one state machine: arena, dialog open (over the arena), run, ended. Play again returns to the arena. The existing "Progress may not save." notice keeps its current placement and shows in every state once a write has failed: under the `h1` "Blitz" in the arena, dialog, and ended states, and above the HUD row during a run, as today.
- Arena, top to bottom: the `h1` "Blitz"; the primary "New run" button; a "Last run" section with either a card (setup badges for category, orientation, mode, reading "Mixed", "Protocols", "Applications", "Default", "Inverted", "Sprint", "Marathon", "Survival" without the mode durations, wherever badges appear; "Time's up" or "Out of lives" with the local date and time as `YYYY-MM-DD HH:MM`, the date in the Daily segment's existing form and the time in 24-hour form; the score large; a native disclosure "Rounds ({n})" containing the full round log in play order) or the text "No runs yet. Start one and it will show here."; a "Bests" section with a two-column table, no header row, setup badges in the first cell and the score in the second, one row per stored best, ordered by category, then orientation, then mode, in the fixed orders Mixed, Protocols, Applications; Default, Inverted; Sprint, Marathon, Survival; hidden when no best exists.
- The dialog reuses the How-to dialog mechanics: native `<dialog>`, `showModal`, backdrop click and Escape close, focus restored on close. Its accessible name is "New run", taken from a visible `h2` title the way How-to's is. It holds the three groups with the same fieldset names and radio names as today. Category and Mode stay pills. Orientation renders as two radio cards, each with the title and its caption (from the prototype: "Default" / "See a service, type its port." and "Inverted" / "See a port, pick the service."). The title alone is the radio's accessible name; the caption sits outside the label and is wired to the radio as its accessible description, so screen readers hear it and tests keep finding the radios "Default" and "Inverted". A "Start" primary button, then a "Cancel" text button. The empty-pool notice renders inside the dialog between Start and Cancel.
- The dialog preselects the last run's setup when a run exists, otherwise Mixed, Default, Sprint.
- During a run: the HUD row gains "Round {n}" between the hearts and the score. The round log shows the last three rounds, newest first. It comes last: below the input, below the Search panel (Inverted only), and below the message line. The round log is not a live region; the existing message line stays the only announcement, unchanged, so a correct round still announces nothing. The round log is a plain list with no group name, the "Last run" and "Bests" sections are named by their headings, the Bests table has no caption beyond that heading, and "Round {n}" is plain text with no separate accessible text. Each line: the outcome as a colored dot, emerald for correct and zinc for miss like the board's tiles, carrying the accessible text "correct" or "miss" the way a tile does (an image role with a label), the entry name, the port in monospace, and for a miss the wrong-answer text: "you typed 6380", "you typed 6379 (Redis)", or "you picked MySQL", with the embedded port in monospace like every other port, per the redesign's design-language rule.
- End card: unchanged top (outcome line, score, best, "New best", the existing live message line, "Play again"; no setup badges, since the setup is the one just played), followed by a "Rounds ({n})" heading and the full round log in play order using the same line component.
- The first-cut prototype floated the orientation explanation as a callout under an info icon; inside the 343px-wide dialog it covered the Inverted pill. The radio cards with captions are the resolution, not an alternative.

### History

- Two routes: the existing History address for Daily and a `blitz` child address for Blitz. Both render the History screen with a switcher between the `h1` "History" and the list, the same segmented control as the Daily switcher, named "History switcher", with "Daily" and "Blitz" segments. The outer list keeps the accessible name "History" in both segments. The nav's History item is active on both.
- Daily segment: unchanged.
- Blitz segment: runs from the runs key, newest first, grouped by local calendar date (from `endedAt`) with a date heading per group in the Daily segment's existing `YYYY-MM-DD` form. Each row, in the arena card's order: setup badges, "Time's up" or "Out of lives" with the local time as `HH:MM` in 24-hour form, the score, and a native disclosure "Rounds ({n})" with the full round log in play order. No links. Empty state text: "No runs yet."
- The History engine module gains a function that groups runs by local date. It takes the local-date formatter as a parameter: the page passes one built on the browser's timezone, tests pass a fixed one, so no timezone stubbing is needed.

### Codex screen

- Route `/codex`. The nav gains a fourth item "Codex" with a book outline icon in the style of the existing nav icons, after History; the tab bar returns to four equal columns as in the redesign.
- Codex, top to bottom: the `h1` "Codex"; the headline "Seen {n} / {total} · Correct {m}" (totals come from the catalog, not literals); the sort toggle, a group of two radio buttons styled as the Daily switcher's segmented control but with no route behind it, named "Sort" with the options "Name" and "Port"; then one section per catalog kind with a heading like "Protocols 12 / 48" and a card grid labelled by that heading (these per-kind grids are the "Codex grid" of story 65; no outer wrapper needs a name), two columns below the small breakpoint, three at small, four at medium.
- Card: name, port large in monospace, transport badge, and a state label with a matching accent drawn as the card's left edge: "Correct" emerald, "Missed" rose, "Identified" zinc. A seen card's accessible name is its visible text joined by single spaces in that order, "{name} {port} {transport} {state label}", so tests find it by name. An unseen card is a non-interactive element with an image role labelled "Unseen" (not a button), shows `???` large in monospace where the port would be, no port, no transport, and is not focusable. A fresh card plays the shared pop animation on mount (150ms, the same keyframe the board uses); the reduced-motion rule already zeroes it.
- A seen card is a button that opens the miss popover component with that entry: same pin, hover, Escape, and outside-click model, except that focus alone does not open it, so tabbing across the grid stays quiet; Enter or click toggles the pin, as a click does on the Daily trigger. The popover is extracted so the trigger can be a card rather than a text link; the Daily miss caption keeps its current look. The extracted component takes a placement argument, inline or grid, which also decides focus behavior: inline keeps the Daily caption's current positioning and its focus-opens rule; grid drops the focus-opens rule, keeps the panel's width, and sits it below the card, aligned to the card's left edge, or to its right edge when the card is in the last column; the card learns its column from its index and the current column count, which the grid derives from the same breakpoints that set the count, so it never leaves the grid. Placement is checked by eye in screenshots, not by a seam test, like the Daily popover's placement today.
- Sort choice is read on mount and written on change via the seam.

### Copy

- Exact strings introduced by this spec: "New run", "Last run", "No runs yet. Start one and it will show here.", "No runs yet.", "Bests", "Rounds ({n})", "Round {n}", "Cancel", the badge forms "Sprint" and "Marathon" (the existing pill labels with their durations stripped), the Orientation captions "See a service, type its port." and "See a port, pick the service." (their titles reuse the existing radio labels "Default" and "Inverted"), the round-log outcome text "correct" and "miss", "you typed {port}", "you typed {port} ({name})", "you picked {name}", "History switcher" (its segments reuse the existing nav labels "Daily" and "Blitz"), "Codex", the transport badge text reused from the Reveal unchanged, the templates "Seen {n} / {total} · Correct {m}" and "{Kind} {n} / {total}" (totals come from the catalog, 74, 48, and 26 today), "Sort", "Name", "Port", "???", "Unseen", "Correct", "Missed", "Identified", and the seventh How-to rule "The Codex collects every service you meet.". Existing strings are unchanged.

### Motion

- Unchanged from the redesign. The only new use is the Codex fresh-card pop, reusing the board's pop keyframe and duration. Fresh cards pop together, no stagger. Motion, including the reduced-motion rule, stays outside the seam tests, as in the redesign.

## Testing Decisions

A good test exercises a public seam with literal inputs and asserts what a player sees or what a pure function returns. It does not read class names, colors, or library internals. Expected values are literals from this spec.

1. **Engine seam** (pure functions; prior art: the Blitz reducer, marks, and history test files).
   - Codex: applying `identified` to an unseen entry gives Identified with fresh, `missed` gives Missed with fresh, and `correct` gives Correct with fresh; `missed` on Identified gives Missed, keeping fresh true when it was true and false when it was false; `correct` on Missed gives Correct and `correct` on Identified gives Correct, each keeping fresh as it was; `identified` on Identified leaves Identified; `identified` on Missed leaves Missed; `missed` on Missed leaves Missed; `correct` on Correct leaves Correct; `identified` on Correct leaves Correct; `missed` on Correct leaves Correct; clearing fresh flags leaves states intact; counts on a map with one of each state read seen 3 and correct 1; a map with two protocol entries seen and one application entry seen reads Protocols 2 and Applications 1; the grouping puts Protocols before Applications, sorts "chargen" between "BGP" and "Daytime" under name sort (case-folded), sorts by port with a case-folded name tie-break, and keeps a `???` in place in both sorts.
   - Blitz reducer: a committed correct round appends a round with the answer's name and port and no wrong answer; a Default miss appends a round whose wrong answer is `typed` with the port and the owner or null; an Inverted miss appends `picked` with the picked entry; a same-port Inverted miss still appends `picked`; an invalid guess and a timeout append nothing; the round number after two committed rounds is 3.
   - Runs: building a run from an ended state and a fixed clock yields the setup, end reason, that instant, score, and the rounds; prepending a run to fifty stored runs keeps fifty, newest first; grouping three runs across two local dates, with a fixed formatter injected, yields two groups in newest-first order.
2. **Persist seam** (prior art: the storage test file).
   - Corrupt JSON, a non-array, and a run missing `rounds` under the runs key read as no runs; a Codex value with a state outside identified, missed, and correct reads as empty; an invalid sort reads as name; the neighboring keys are untouched.
3. **App seam** (render the app with a memory store, memory history, injected day; prior art: the Blitz, Blitz best, Daily marks, History, and app test files; Blitz tests derive the current entry from the heading, as today; the page receives no rng, only the reducer does, so the App seam has nothing to inject).
   - Arena: with no runs, the page shows "No runs yet. Start one and it will show here." and no "Bests" heading; with bests seeded but no runs, as every existing player will find on first visit, the empty-state line and the "Bests" heading show together; with a seeded run and best, "Last run" shows the score and its mode badge reading "Sprint" and not "Sprint (1m)", and the disclosure "Rounds ({n})" reveals the seeded round lines; "Bests" lists one row, its mode badge reading "Sprint" and not "Sprint (1m)" the same way; with bests seeded for Protocols Default Sprint and Mixed Inverted Survival, the Mixed row comes first.
   - Dialog: "New run" opens a dialog named "New run"; the seeded run's setup is preselected, and with no run Mixed, Default, and Sprint are; Escape, a backdrop click, and "Cancel" each close it and return focus to "New run"; the Orientation group shows both captions and each radio's accessible description is its caption; Start begins a run with the HUD reading "Round 1"; with every eligible entry excluded, Start shows "Cannot start Blitz: not enough unused answers today." inside the dialog.
   - Run: after one correct and one missed round the round log shows two lines, newest first, each with its outcome text "correct" or "miss", the miss line naming the entry, its port, and "you typed {port}" for an unowned port or "you typed {port} ({name})" for an owned one; in Inverted orientation a miss line reads "you picked {name}"; after four rounds only three lines show; an invalid guess leaves the round log unchanged.
   - End card: "Play again" lands on the arena whose "Last run" shows the just-finished score; the end card lists "Rounds ({n})" with every line.
   - Persistence: a finished run writes one run record with the expected rounds, a score-zero run included; a fifty-first run evicts the oldest; a mid-run miss writes the Codex before the run ends.
   - History: "/history/blitz" shows the switcher named "History switcher" with Blitz selected, the nav's History item current, and a group per local date (the page uses the test runner's real timezone; seeded run instants sit at 12:00 UTC so every offset from -11 to +11, which covers CI and the dev machines in use, agrees on the date, and no TZ pinning is needed); a seeded row shows its setup badges, "Time's up", its score, and a "Rounds ({n})" disclosure that reveals the seeded lines; "/history" is unchanged; with no runs the Blitz segment reads "No runs yet."
   - Codex: with an empty Codex every card reads `???` and the headline reads "Seen 0 / 74 · Correct 0"; after a seeded map the matching cards show name, port, transport, and state labels, and each group heading carries its own seen count; unseen cards carry the accessible name "Unseen" and are not focusable; clicking a seen card opens a note with the description and sources, Enter on a focused card opens it and Escape closes it; the Sort toggle, a group named "Sort", reorders on its "Port" option and the choice persists, "Name" restoring the default; a fresh card renders on mount and every stored record's `fresh` field reads false once the page has mounted.
   - Encounters end to end: winning a Daily records its target as Correct in the store; losing records it as Missed; a Daily try on a known wrong port records that entry as Identified; a correct Blitz round records the prompt as Correct; a Blitz Default miss on a known port records the prompt as Missed and the port's owner as Identified; a Blitz Default miss on an unowned port records the prompt as Missed and nothing else; a Blitz Inverted miss records the prompt as Missed and the pick as Identified, a same-port pick included; an invalid Daily try, a duplicate Daily try, an invalid Blitz guess, a timeout mid-prompt, a History visit, an arena visit, and a Codex visit leave every stored state unchanged.
   - Shell: exactly four nav links, Codex last (the four-column tab bar is checked by eye, like the rest of the layout); the How-to dialog lists seven rules, the last "The Codex collects every service you meet."

## Out of Scope

- Any storage other than localStorage: IndexedDB and Firebase, held for a later "Backend" spec, along with the v1 design spec's "Later" items that depend on one (accounts, synced streaks, global try-distribution, Blitz leaderboards).
- A Codex detail dialog with dates, state history, or where an entry was first seen.
- Marks (placed, present, absent) in Blitz.
- Links from History or Codex rows to play surfaces, and a playable archive.
- Removing the accepted port-order leak of unseen Codex cards.
- Changes to Daily rules, the schedule, the catalog, or the miss popover's content.

## Further Notes

- Author calls not covered by the interview or the prototype, listed so they can be overruled. The first group was shown to the user before this spec was written; the second was added while writing and is surfaced before tickets.
  - Shown before writing: the runs cap is fifty and score-zero runs are kept; rounds store name and port snapshots plus the id; a run has no id of its own and is ordered and identified by its end instant; port sort breaks ties by name; the Codex record holds a state and a `fresh` flag and nothing else (the interview first said "state only"; the `fresh` flag was then approved so the fresh-card pop can know which cards are new); the `fresh` flag is set on any transition from Unseen and cleared by a Codex visit; the sort choice is persisted under its own key; Codex writes happen on a Daily try that identifies an entry, on a Daily end, and on each committed Blitz round; the wrong-answer copy is "you typed {port}", "you typed {port} ({name})", and "you picked {name}" (examples use uncrowded ports, since a crowded port identifies its first entry by id); a same-port Inverted pick still sets the picked entry to Identified; the dialog is named "New run" and preselects the last setup or Mixed, Default, Sprint; the empty-pool notice renders inside the dialog between Start and Cancel; the Bests table lists only scored combinations, ordered by category, then orientation, then mode, in the fixed orders Mixed, Protocols, Applications; Default, Inverted; Sprint, Marathon, Survival; card accents are emerald, rose, and zinc, drawn as the card's left edge, with text labels; unseen cards are not focusable; the headline is "Seen {n} / {total} · Correct {m}" and group headings carry "{n} / {total}"; retired entries stay listed; the Blitz segment groups by local date and shows local time, dates as `YYYY-MM-DD` like the Daily segment and times as 24-hour `HH:MM`; the How-to gains one Codex line; the miss popover is extracted so a card can be its trigger.
  - Added while writing: the setup dialog has a visible "Cancel" button besides Escape and backdrop; the Codex grid is two columns below the small breakpoint, three at small, four at medium; the arena empty state reads "No runs yet. Start one and it will show here." and the Blitz segment's empty state reads "No runs yet."; an unseen card hides the transport badge as well as the port; invalid guesses, duplicate Daily tries, and arena and Codex visits emit no encounter (derived from the encounter rule); rounds per run are not capped even for Survival, accepting that an extreme run can push the store past its budget and trip the existing write-failure notice; the Codex How-to line reads "The Codex collects every service you meet."; read-only badges show "Sprint" and "Marathon" with the durations stripped, unlike the dialog's own mode pills; every full round log (end card, arena, History) lists rounds in play order, oldest first, while only the three-line log during a run is newest first; fresh Codex cards pop together with no stagger, unlike board tiles; the Sort toggle reuses the segmented control's look only, as radios with no route behind them; a Codex card does not open its popover on focus alone, unlike the Daily miss trigger; Dailies finished before release, and the already-committed tries of a Daily still playing at release, do not backfill the Codex.
- Persistence direction: the interview considered IndexedDB for game data and Firebase for sync, and deferred both. Recorded in the ADR "localStorage until a backend". This spec's records are plain JSON reachable only through the seam so that import is mechanical later: the Codex map is keyed by entry id, rounds carry entry ids, and a run is identified by its end instant.
- Primary source: branch `prototype/blitz-arena`, commit `1361cd7`, on the real Blitz route behind `?variant=A|B|C` and `?empty=true`. Verdict: variant B (Orientation as two captioned radio cards) for the dialog, and Play again returning to the arena. Finding: a floating callout under an info icon covered the Inverted pill inside the dialog on a phone. Never merge the prototype; the implementation rewrites the arena, dialog, and round log with tests.
- Supersedes, in the v1 design spec: section 7.4's `BlitzState` shape (gains `rounds`); section 8's "Blitz run is not persisted" line and its key table (three keys are added); section 9.1's routes table (adds the Codex route and the History segment's child address); section 9.4's setup-as-page and end card; section 9.5's History as a single list. Supersedes, in the UI redesign spec: the Blitz setup section (setup moves into a dialog, and Orientation stops rendering as pills in favor of two captioned radio cards), the HUD row (gains the round number), the end card (gains the round log, and Play again lands on the arena instead of setup), the History section (a switcher and a Blitz segment are added), and the Miss popover section's "Daily miss rows only" rule (Codex cards now trigger it too), and the Shell section's "each other item is active on its own route" rule (History is active on both of its addresses). Supersedes, in the digit-feedback spec: the three-item nav (Codex makes four).
- Glossary: `CONTEXT.md` gains Arena, Setup dialog, Run, Round, Round log, Play surface, Encounter, Prompt, Codex, Codex card, Unseen, Seen, Identified, Missed, Correct, Wrong answer, History, History switcher, Segment, Sort toggle; Nav becomes four items; Answer-eligible reads "Daily target or Blitz prompt"; Miss-only reads "Never a target or a prompt"; HUD gains the round number; End card gains the round log; Miss popover broadens from "on a miss identification" to "on a miss identification or a seen Codex card". "Seen" is the umbrella for any state above Unseen and is never used for Identified alone. "Last run" and "Bests" are section headings on the arena, "Codex grid" is the layout that holds the Codex cards, and `fresh` is a persistence field; none are glossary terms.
