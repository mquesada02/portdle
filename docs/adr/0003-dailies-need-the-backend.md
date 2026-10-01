# The Daily and the catalog need the backend

Amends [ADR 0001](0001-localstorage-until-backend.md) and [ADR 0002](0002-localstorage-stays-local-store.md). While specifying [Spec 5](../superpowers/specs/2026-09-30-spec5-dailies-backend.md) (Dailies served from the backend) we moved the catalog and the Schedule into Postgres on the Supabase project, so the site bundle no longer carries future answers. The client has no bundled catalog, no bundled Schedule, and no stored copy of either. The Daily, the Archive, Blitz, and the Codex now need the backend, and offline Blitz and Codex are dropped. The site no longer works with no backend: with no backend, with a paused project, or when offline, these screens show the Error panel while nothing is loaded (a Daily already loaded keeps working if the network drops), while History still shows saved results. A build with no backend configured still hides the account features.

Player state still lives in localStorage behind the synchronous storage seam, as ADR 0001 and ADR 0002 decided; this ADR changes only where the catalog and the Schedule come from.

Supersedes:

- v1 design §3, "Playable archive" out of scope (`2026-09-08-portdle-design.md`, also the ticket specs of #10, #12, #14) → the Archive with late plays.
- v1 design §3, "Global histograms" out of scope → the per-Daily global guess distribution.
- Spec 4, "Email and password" out of scope → enabled only in the local stack for end-to-end tests; the live project keeps it off.
- Spec 4, stories 1 and 27 and "No `Remote`, no account features", as far as they promise a site that works with no backend or offline play with no message → the Daily, the Archive, Blitz, and the Codex need the backend. Account features without a backend stay hidden.
- Spec 4, "a UTC day change still rebuilds the router" → a new server today no longer remounts screens, so a theme pulled from the account now applies only at the next app load.
- Spec 4, stats and last played stored and rebuilt after a pull → stats are never stored; every screen folds them.
- ADR 0001 and ADR 0002, as far as they assume the catalog and the Schedule come from the bundle and the game works offline. Neither ADR states this; this ADR says it no longer holds.
