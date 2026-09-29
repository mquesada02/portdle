# Ticket spec: Accounts tracer, sign in and out (#134)

Ticket of Spec 4 (accounts, sync, and leaderboards; issue #127, spec file `docs/superpowers/specs/2026-09-28-spec4-backend.md`). Map: #114. This is the first vertical slice through every layer: a player signs in with Google or GitHub from the person icon in the Top bar and signs out again. It builds the `Remote` seam, the Supabase adapter, the account row migration, and the Account menu. It builds no Sync, no Name confirm, no rename, no Account deletion, and no Leaderboards.

## Problem Statement

Portdle has no backend and no Account. Every later Spec 4 ticket needs a `Remote` to talk through, a backend client, an account row with a Display name, and a place in the Top bar to reach them. None of that exists, and the backend's shape (lazy client, build-time configuration, explicit grants) is unproven end to end.

## Solution

A `Remote` seam is injected into the app beside `Persist`. A Supabase adapter implements it and loads its client library lazily. The Top bar gains a person icon that opens the Account menu: Google above GitHub when signed out; the Display name and Sign out when signed in. With no build configuration there is no `Remote`, and no account UI shows. One SQL migration creates the account row, its row-level security, its `CHECK`, and the seed trigger. A hand-run smoke script checks the adapter's backend and the SQL against the real project.

## User Stories

Spec 4 stories 4, 5, 6, 7, 8, 9, 10, 11, 52, 56, 60 (the database half), 66 (the sign-out half), and 70 (schema, row-level security, and name rule only), plus these local stories (numbered L1 to L8):

1. (L1) As a player on a build with no backend configured, I want no person icon and no account UI, so that nothing points at a service that is not there.
2. As a signed-out player, I want the person icon to open a menu with "Sign in with Google" above "Sign in with GitHub", so that the order is the same every time.
3. As a player, I want a sign-in start that fails to show one line of error in the menu and change nothing, so that I can try again.
4. As a player returning from a provider redirect that carries an error (I denied consent, or my GitHub account has no verified email), I want to stay signed out and see the Account menu open with a one-line error, so that I know why it did not work.
5. As a signed-in player, I want the menu to show my Display name and a Sign out button, so that I know which Account I am on and can leave it.
6. As a player, I want Sign out to leave everything on this device in place, so that signing out never destroys progress.
7. As a signed-out player who never opens the menu and has no stored sign-in, I want the page to load no backend code, so that the backend costs me nothing.
8. As the owner, I want the account row, its Display name `CHECK`, its row-level security, and its seed trigger as SQL in the repo, so that the backend can be rebuilt from source.

## Implementation Decisions

### `Remote` seam

- New module `src/remote/remote.ts` exports the types and nothing else:
  - `Provider = "google" | "github"`.
  - `AccountState = { status: "signedOut" } | { status: "signedIn"; accountId: string; displayName: string; nameConfirmed: boolean }`.
  - `Remote` with: `getAccount(): Promise<AccountState>` (rejects when the backend cannot be reached); `signIn(provider): Promise<void>` (starts the provider redirect; rejects when the start fails); `signOut(): Promise<void>` (rejects on failure); `redirectError(): string | null` (a pure read of the one-line error of the provider redirect the page loaded with, or `null`) and `clearRedirectError(): void`; `preload(): void` (starts loading the backend client without waiting for it).
  - `AccountState` carries `accountId` and `nameConfirmed` because Spec 4 defines the state that way and the Name confirm and Row sync tickets read them; this ticket's menu shows only the Display name.
  - Later tickets extend this type (pull, push, name change, leaderboard read, delete). This ticket adds only what it uses.
- `getAccount()` reads no network and loads no library when the device has no stored sign-in and the page did not load with a sign-in result: it resolves `signedOut` at once. Otherwise it loads the client and reads the session and the account row.
- In-memory fake in `src/test/fake-remote.ts`: holds a current `AccountState`, records calls, and lets a test make `getAccount`, `signIn`, or `signOut` reject, hold `getAccount` on a deferred promise the test can resolve (also after unmount), and set a redirect error. Its `getAccount` is async. `signIn` records the provider and leaves the state unchanged (a real sign-in leaves the page); a test then sets the signed-in state and renders a new app, as a redirect return does. `signOut` records the call and sets the state to `signedOut`. `clearRedirectError` clears the error. Later tickets grow it into a fake account.

### Build configuration and wiring

- `src/main.tsx` reads `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. When both are non-empty it creates the Supabase adapter and passes it to `App` as the optional prop `remote`; otherwise it passes none. A small `src/env.d.ts` types the two variables as optional strings (`ImportMetaEnv` extension).
- CI passes `VITE_SUPABASE_URL: ${{ vars.SUPABASE_URL }}` and `VITE_SUPABASE_ANON_KEY: ${{ vars.SUPABASE_ANON_KEY }}` to both `pnpm build` steps in `.github/workflows/ci.yml` (the `build` job and the `deploy` job). A pull request build from this repository reads the variables like a push does; a fork's pull request build reads them empty and builds with no `Remote`, which is handled. Both values are public by design.
- `App` accepts `remote?: Remote` and puts it in the router context beside `persist` (`RouterContext.remote?: Remote`), passed to `createAppRouter` like `persist`. `Shell` reads it. The router is rebuilt on a UTC day change, which remounts the Shell; the Shell then reads the account state again (a cheap call when signed out).

### Supabase adapter

- `src/remote/supabase.ts` exports `createSupabaseRemote({ url, anonKey })`, which returns a `Remote`. It imports `@supabase/supabase-js` dynamically (`import()`), memoized in one promise, only when a method needs the client. A new runtime dependency `@supabase/supabase-js` is added.
- The client is created with `flowType: "pkce"`, `detectSessionInUrl: true`, `persistSession: true`, and the library's default storage key (`sb-<first hostname label>-auth-token`), so the stored sign-in survives `Persist.clearAll()`, which removes only `portdle:` keys.
- **Stored sign-in check**: `hasStoredSignIn(url, storage)` returns whether `sb-<first hostname label>-auth-token` exists in localStorage, without loading the library. A storage that throws counts as no stored sign-in.
- **Redirect result**: two pure functions. `parseAuthRedirect(search, hash)` returns `{ hasResult: boolean; error: string | null }`: `hasResult` is true when the query or the hash carries `code` or `access_token` (a successful result the library will exchange); `error` is the `error_description` when the query or hash carries `error`, else "Sign-in did not complete." for a bare `error`, else `null`. `stripAuthError(search, hash)` returns the search and hash with `error`, `error_code`, and `error_description` removed. The adapter reads `window.location` once when it is created; if an error is present it replaces the address with the stripped one (`history.replaceState`) and keeps the text for `redirectError()` until `clearRedirectError()`. It leaves `code` for the library to exchange and clean. This runs in `main.tsx` before the router is created, so the router never sees the error address. `getAccount()` takes the loading path when `hasResult` is true or a stored sign-in exists; an error alone loads nothing. When `hasResult` is true and the session read returns an error or no session (a failed code exchange), `getAccount()` resolves signed out with no message (author call). `hasResult` is a snapshot from creation and stays true for the page's life; that only means a later `getAccount()` loads the library, which is accepted.
- **`signIn(provider)`** calls `signInWithOAuth` with `redirectTo` set to `${window.location.origin}${import.meta.env.BASE_URL}` (the site root; on the deployed site exactly `https://mquesada02.github.io/portdle/`, with the trailing slash, the string the allow-list holds). The redirect allow-list holds only the production URL, so a sign-in started from any other origin falls back to the project's Site URL and cannot finish there (the PKCE verifier lives in the origin that started it); sign-in is supported on the deployed site only. The adapter throws the library's error when it returns one.
- **`signOut()`** calls `signOut({ scope: "local" })`, so signing out here does not end the Account's sessions on other devices, and throws on error; if the client library cannot be loaded, it removes the stored sign-in key directly, so a stuck sign-in can always be left. It touches no `Persist` data.
- **`getAccount()`** on the loading path reads the session; no session resolves `signedOut`. With a session it reads the account row (`display_name`, `name_confirmed`) for that account id with the client, and resolves `signedIn`. A missing row or a read error rejects.
- **`preload()`** starts the dynamic import and swallows its failure (a later call retries).
- The Leaderboards tab is one of the lazy-load triggers in the ticket, but the tab is the Leaderboards ticket's; that ticket calls `remote.preload()` when the tab opens and owns the test for it, and the adapter needs no change. The build check for lazy loading: `pnpm build` output lists the client library in its own chunk, not in the entry chunk (checked by eye at review time).
- A stored sign-in the auth service refuses because its user no longer exists is Spec 4's "account gone" signal; it belongs to the Row sync ticket and is not handled here beyond `getAccount()` rejecting.

### Account menu UI

- The Top bar gets a person icon button (accessible name "Account") after the theme toggle, inside the existing group and with the same icon-button style. It renders only when `remote` is present. Opening it calls `remote.preload()`.
- The menu is a disclosure panel under the button (not a modal): the button has `aria-expanded` and `aria-controls`; the panel closes on Escape, on a click outside it, and on a second press of the button. Escape and a second press return focus to the button. The panel is an absolutely positioned card under the button, styled like the How-to card.
- **Contents**, from the account state the Shell loads on mount with `remote.getAccount()`:
  - Loading (`getAccount` has not settled and there is no redirect error): the line "Loading account."
  - Signed out: two buttons, "Sign in with Google" above "Sign in with GitHub". Pressing one calls `signIn`; both are disabled while it runs. If it rejects, the menu shows the line "Could not start sign-in. Try again." and both buttons work again.
  - Signed in: the Display name as text and a "Sign out" button. Pressing it calls `signOut`; on success the menu shows the signed-out contents; if it rejects, the menu shows "Could not sign out. Try again." and stays signed in. Local data is never touched.
  - Read failure (`getAccount` rejected): the line "Could not load your account." and a "Sign out" button, so a stuck stored sign-in can be left (on success, the signed-out contents).
  - A redirect error takes precedence over loading, and the error line is cleared when the player presses a sign-in button. The account menu reads `remote.redirectError()` in a state initializer and calls `remote.clearRedirectError()` in a mount effect. If the text is non-null, the Shell starts in the signed-out contents (both sign-in buttons) with the error line, the menu open, and never shows the loading line. `getAccount()` still runs: a `signedIn` result replaces the contents and clears the error line; a `signedOut` result or a rejection changes nothing.
- A `getAccount` result that arrives after the Shell unmounted (a `StrictMode` effect re-run, or the router rebuilt on a UTC day change) is ignored, through a cancelled flag in the effect cleanup.
- The redirect error text is shown as-is with whitespace collapsed to single spaces.
- A UTC-day router rebuild remounts the Shell: an open menu closes, the account state is read again, and "Loading account." may show briefly. This is accepted.
- The single error line is one `role="alert"` paragraph; a new action clears it first.
- The Account menu never blocks or dims the game; it does not appear in the Nav.

### Migration

- File `supabase/migrations/20260929000001_accounts.sql`, applied by the owner in the Supabase SQL editor. It contains, in order:
  1. `public.accounts`: `id uuid primary key references auth.users (id) on delete cascade`, `display_name text not null`, `name_confirmed boolean not null default false`, `created_at timestamptz not null default now()`, and a named `CHECK`: `char_length(display_name) between 1 and 30`, at least one character that is not a space (the allowed set holds no other whitespace, so this is Spec 4's "non-whitespace"), and only characters matching `^[[:alnum:] ''.-]+$` (as SQL text) (Unicode letters and digits, spaces, apostrophes, hyphens, periods; emoji and control characters fail).
  2. `alter table … enable row level security`, then explicit policies: `select` and `update` for role `authenticated` where `id = (select auth.uid())`, with a matching `with check` on update. No insert policy and no delete policy: the seed trigger inserts, and deleting the auth user cascades.
  3. Explicit grants: `grant select on public.accounts to authenticated` and `grant update (display_name, name_confirmed) on public.accounts to authenticated`. Nothing is granted to `anon`. (The project has "Automatically expose new tables" off.)
  4. `public.normalize_display_name(raw text)`: strips every character outside the allowed set (`regexp_replace(raw, '[^[:alnum:] ''.-]', '', 'g')`, the exact complement of the `CHECK` class), cuts to 30 characters, and returns `'Player'` when `raw` is null or the cut result is empty or only spaces. `immutable` (for trigger use only; `[[:alnum:]]` depends on the locale, so it is not for an index), `security invoker`, `search_path = ''`.
  5. `public.handle_new_user()`, `security definer`, `search_path = ''`: on insert into `auth.users`, inserts the account row with the normalized name from the provider metadata: for `raw_app_meta_data->>'provider' = 'github'`, the name is `raw_user_meta_data->>'user_name'` (else `preferred_username`); otherwise `raw_user_meta_data->>'full_name'` (else `name`), each read through `nullif(btrim(...), '')` so an empty string falls through. A missing name gives `'Player'`, so the insert can never fail the `CHECK` and block a sign-up. The body schema-qualifies `public.accounts` and `public.normalize_display_name`, since `search_path` is empty. `name_confirmed` stays false. `revoke all on function public.normalize_display_name(text)` and `public.handle_new_user()` from `public`, `anon`, and `authenticated`.
  6. Trigger `on_auth_user_created` after insert on `auth.users`, for each row, executing `handle_new_user`.
- A Google sign-in under the same verified email as an existing GitHub account links an identity to the existing user and inserts no `auth.users` row, so the trigger does not run again and the existing Display name stays.
- The `CHECK` uses `[[:alnum:]]`, which depends on the database's locale to accept non-ASCII letters; the smoke script tests it (see below). The shared client-side rule belongs to the Name confirm ticket, not this one; `[[:alnum:]]` rejects combining marks, which that rule must match.
- `supabase/tests/accounts.sql`: owner-run in the SQL editor after the migration. A `DO` block asserts `normalize_display_name` on a null, a 40-character name, an emoji-only name, a spaces-only name, a name mixing allowed and disallowed characters, and `Zoë-李 O'Neil.`; then inserts three `auth.users` rows (a GitHub user with `user_name`, a Google user with `full_name`, a user with no name metadata) and asserts the seeded rows (`name_confirmed` false, the third `Player`), and deletes the three users (the cascade removes the rows). It raises on the first failed assertion and prints a notice on success.

### Smoke script

- `scripts/smoke-backend.ts`, run by hand with `pnpm smoke:backend` (a new `package.json` script running `tsx scripts/smoke-backend.ts`), using plain `fetch` against the REST API (no library) with the `apikey` header and, for the signed-in checks, `Authorization: Bearer <token>`. Inputs are environment variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_ACCESS_TOKEN`, a signed-in browser's access token (copied from the stored sign-in in the browser's localStorage after signing in on the deployed site; it expires in about an hour, so copy it fresh). Later Spec 4 tickets add their own checks to the same file.
- "Refused" means HTTP 401 or 403 with code `42501` (grants), or HTTP 400 with code `23514` (the `CHECK`); any other status, a network error, or a 500 is a FAIL. The anonymous read passes on a 401/403 or on a 200 with `[]`. Checks, each printed as PASS or FAIL with the exit code non-zero if any fails: the anonymous role cannot read `accounts` (refused, or empty); the token's read of `accounts` returns exactly one row whose `display_name` passes the rule and whose `name_confirmed` is a boolean; an update of `display_name` to each of an emoji name, a 31-character name, and a spaces-only name is refused; an update to a valid non-ASCII name (`Zoë-李 O'Neil.`) succeeds and reads back (which also proves the database locale accepts non-ASCII letters), and the original name is restored afterwards (in a `finally`, so a failed update still restores); an insert of an account row for a random uuid is refused (permission denied, no insert grant); an update of a random uuid's row, sent with `Prefer: return=representation`, returns an empty array (row-level security); an update of `id` is refused (no column grant).
- The script prints the seeded name for the owner to compare by eye with their provider name (the trigger's logic is covered by `supabase/tests/accounts.sql`; this is a check of the real provider metadata).
- The script is not part of `pnpm test`, and it is type-checked by adding it to `tsconfig.node.json`'s `include` (which lists only `vite.config.ts` today; the older `scripts/*.ts` stay outside it, as the surgical-changes rule asks; `process.env` and `fetch` come from `@types/node`).

### Docs

- `CONTEXT.md` and the ADRs already carry every term this ticket uses; none change.

## Testing Decisions

- Good tests drive the highest seam and assert what the player sees and what the local store holds: render `App` with `memoryStore` and the fake `Remote`, act as the player.
- **App-level** (`src/ui/account-menu.test.tsx`): with no `remote`, there is no "Account" button and the Nav and Top bar are unchanged; with a signed-out fake, the menu lists "Sign in with Google" before "Sign in with GitHub" in document order, and pressing each calls `signIn` with that provider; a rejecting `signIn` shows "Could not start sign-in. Try again." and the buttons work again; a redirect error opens the menu with that text, also under `StrictMode`, and a later remount of the Shell shows none (the menu clears it after mount); while `getAccount` is held on a deferred promise the menu shows "Loading account."; with a redirect error and `getAccount` held, the menu shows the error and both sign-in buttons and no loading line, and a later `signedIn` result replaces them; a `getAccount` result after unmount changes nothing; a redirect error with a rejecting `getAccount` keeps the error and the buttons; the menu that starts open for a redirect error does not call `preload`; both sign-in buttons are disabled while `signIn` is pending; with a signed-in fake the menu shows the Display name and "Sign out", and pressing it shows the signed-out contents, calls `signOut`, and leaves every stored Portdle key unchanged; a rejecting `signOut` shows its line and stays signed in; a rejecting `getAccount` shows "Could not load your account." with "Sign out"; the button's `aria-expanded` follows the panel; the menu closes on Escape (focus returns to the button), on an outside click, and on a second press; opening it calls `preload`; the existing Top bar buttons still work.
- **Pure units** (`src/remote/supabase.test.ts`): `hasStoredSignIn` (key present, absent, throwing storage, host label taken from the URL) and `parseAuthRedirect` (query error, hash error, `code`, `access_token`, nothing, an error without a description, an error alone is not a result); with the library mocked, `getAccount()` with a session and a failed account-row read rejects; `signOut()` with a library that fails to load removes the stored sign-in key; `hasResult` true and a session read that errors or returns no session resolves `signedOut`; `stripAuthError` (removes the three keys from the query and the hash, keeps `code` and unrelated keys); and, with `@supabase/supabase-js` mocked, `getAccount()` resolves `signedOut` without importing the library when there is no stored sign-in and no result (local story L7).
- **Not in Vitest**: the adapter's network paths and the SQL, checked by the smoke script on the real project.
- The existing suite passes unchanged; `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.

## Out of Scope

- Sync, `Persist` changes, merge, Name confirm, display name edit and validation, Device progress choice, Account deletion, Leaderboards and their views, and the keep-alive job.
- Applying the migration or running the smoke script: the owner does both by hand.
- Revoking sessions on other devices at sign-out.
- A sign-in that returns to the screen where it started (the allow-list holds one URL).

## Further Notes

Author calls not covered by Spec 4:

- The account row is named `accounts` with columns `id`, `display_name`, `name_confirmed`, `created_at`; the migration file is `supabase/migrations/20260929000001_accounts.sql`.
- The Account menu is a disclosure panel, not a modal; a failed account read shows "Could not load your account." with Sign out; loading shows "Loading account."
- `signOut` uses local scope, so other devices stay signed in.
- The client uses PKCE and the library's default storage key, so the stored sign-in survives a device clear.
- The redirect error is read and removed from the address in `main.tsx` before the router exists.
- Update on `accounts` is granted column by column (`display_name`, `name_confirmed`); `id` and `created_at` cannot change.
- `revoke all` on the two trigger and helper functions from every client role.
- The smoke script takes a browser access token by environment variable, since it cannot run an OAuth sign-in.
- CI passes the build variables on pull requests too.
- A failed code exchange after a redirect leaves the player signed out with no message.
- The update grant and policy on `accounts` are written now so the Name confirm ticket needs no migration.
- A redirect error takes precedence over the loading line, and a later `signedIn` result replaces it; a rejected `getAccount` beside a redirect error keeps the error line and the sign-in buttons (no read-failure line).
- Spec 4 and #134 list a redirect with a sign-in result or an error as a lazy-load trigger; here an error alone loads nothing, because an error carries no session to read and the client is loaded by a press or a stored sign-in anyway. A menu that starts open because of a redirect error does not call `preload()`; only a press on the person icon does.
- The first paint of the menu before `getAccount` settles shows "Loading account." even on a signed-out device, since the fake is async; the real adapter settles at once in that case.
- The smoke script's restore of the original name is cleanup: it prints a warning if it fails, and is not a PASS/FAIL check.
- Sign-in works on the deployed site only.
- `redirectError()` is a pure read with a separate clear, so it survives `StrictMode`'s double render.
- The account row seeds `'Player'` for a missing provider name.
