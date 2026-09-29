# Spec: Privacy page (ticket #146)

Ticket spec for issue #146, part of [Spec 4](2026-09-28-spec4-backend.md) (accounts, sync, and leaderboards; map #114). The owner added the ticket on 2026-09-29: Google's OAuth consent screen needs a privacy policy URL before the app can be published for everyone.

## Problem Statement

Spec 4 lets a player sign in and store data on a backend. Google will not publish the OAuth consent screen without a public privacy policy URL, and players have no place that says, in plain words, what Portdle stores and how to remove it.

## Solution

A static page, `privacy.html`, served at `https://mquesada02.github.io/portdle/privacy.html`. It is a plain file in `public/`, not an app route, so the existing build copies it to `dist/` and the existing deploy publishes it. It uses the site's look (zinc palette, light and dark) and short plain English. The How-to dialog links to it.

## User Stories

1. As a player, I want a page that says what Portdle stores, so that I can decide whether to sign in.
2. As a player, I want to know that signing in is optional and that local play keeps data only in my browser.
3. As a player, I want to know what signing in stores (my email and a public display name), and that the email is never shown.
4. As a player, I want to know that my synced progress is private and that only Blitz leaderboard rows are public.
5. As a player, I want to know who hosts the data and that there are no ads, no tracking, and no selling of data.
6. As a player, I want to know how to delete my data, for an account and for signed-out local data.
7. As a player, I want a contact route and a "last updated" date.
8. As a player, I want the page to follow my theme choice, light or dark, so that it does not flash the wrong theme.
9. As a player, I want a link to the page in the How-to dialog.
10. As the owner, I want a stable URL to give to Google's consent screen.

## Implementation Decisions

- **File**: `public/privacy.html`. Vite copies `public/` files to `dist/` unchanged, and `base` is `/portdle/`, so the page is served at `/portdle/privacy.html`. GitHub Pages serves the file itself, so the `404.html` fallback copy does not apply. No change to the build script, workflow, or router.
- **Styling**: one inline `<style>` block. Plain CSS, no Tailwind, no external files, no fonts or scripts from other hosts. Colors match the app's zinc palette (light: `zinc-50` page, `zinc-900` text; dark: `zinc-950` page, `zinc-100` text). Text column max width 40rem, 1rem side padding, so it reads on a phone.
- **Theme**: the page mirrors the app's `effectiveTheme` rule. A small inline script in `<head>` (runs before paint) reads the stored theme key `portdle:v1:theme` (a JSON string: `"light"`, `"dark"`, `"system"`, or absent). A stored `"dark"` adds the `dark` class to `<html>`; a stored `"light"` adds nothing, even on a dark system; `"system"`, absent, or an unreadable value (storage access or `JSON.parse` can throw, so both sit in a `try`/`catch`) uses `matchMedia("(prefers-color-scheme: dark)")`. The CSS is driven by `html.dark` only, with no `prefers-color-scheme` media query, so a stored choice always wins. With scripts off, the page renders light. The page never writes storage.
- **Head**: `lang="en"`, viewport meta, title "Privacy - Portdle", the same icons as `index.html` but with relative paths (`favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`), so they resolve under `/portdle/`.
- **Top of the page**: the wordmark "Portdle" links back to `./` (the game), so the player can return.
- **Content**, in this order, each a short heading with one to three plain sentences or a short list. Every statement matches Spec 4, except two facts the owner gave in #146 that Spec 4 does not state: the São Paulo region, and no ads, no tracking, no selling. Nothing else is promised.
  1. **Playing without an account**: signing in is optional. Without an account, Daily, Blitz, History, and the Codex keep their data only in your browser (its local storage).
  2. **What signing in stores**: you sign in with Google or GitHub. Portdle stores the email of your account, only for sign-in and to link a Google and a GitHub sign-in that use the same verified email. It is never shown to other players. It also stores a display name, which is public. The name starts as your GitHub username or your Google account name; you confirm or change it before it is public.
  3. **What syncs, and who can see it**: when you are signed in, your Codex, Blitz Bests, Blitz runs, Dailies, and preferences (theme, How-to seen flag, Codex sort) sync to your account. Other players cannot see them.
  4. **What is public**: your Blitz leaderboard rows: display name, score, time to score, and rank.
  5. **Where the data is**: Supabase hosts it, in the São Paulo region.
  6. **What Portdle does not do**: no ads, no tracking, no selling of data.
  7. **Deleting your account and local data**: Delete account in the account menu removes your account and all its data, leaderboard rows included, and clears this device. Any local copy of your data stays in that browser, on this device or another, until you clear the site's data in your browser settings; signing out also keeps it.
  8. **Contact**: open an issue at `https://github.com/mquesada02/portdle/issues`.
  9. **Last updated**: 2026-09-29 (written as "Last updated: September 29, 2026", in a `<time datetime="2026-09-29">` element).
- **Link in the app**: in the How-to dialog (`src/ui/how-to.tsx`), a text link "Privacy" sits at the left of the existing button row, with "Got it" staying at the right. In the DOM, "Got it" comes first and the link second, and the row uses `flex-row-reverse justify-between` (instead of `justify-end`), so "Got it" stays the first focusable element and `showModal()` keeps focusing it; Enter on open never opens the link. The link `href` is `${import.meta.env.BASE_URL}privacy.html`, opens in a new tab (`target="_blank"`, `rel="noopener"`), so a player mid-run is not sent away from the game. Style: small underlined zinc text, matching the dialog's muted text. No change to the shell footer (there is none), the nav, or the top bar.
- **No Spec 4 dependency**: the page is static and the link shows for every build, including a build with no `Remote`. The page describes the signed-in behavior that Spec 4 ships; it does not depend on account code existing.

## Testing Decisions

- **Page content**: a Vitest test in `src/ui/privacy-page.test.ts` loads the page with `import html from "../../public/privacy.html?raw"` (typed by `vite/client`, so no `node:fs` and no tsconfig change; if Vite refuses an import from `public/`, add `"node"` to `types` in `tsconfig.app.json` and read the file with `node:fs` instead) and parses it with `DOMParser` and asserts each acceptance point by visible text: optional sign-in and browser-only local data; email for sign-in and linking, never shown; a public display name; the five synced kinds and that they are private; leaderboard rows (display name, score, time to score, rank) public; Supabase and São Paulo; no ads, no tracking, no selling; Delete account and clearing the site's data; the GitHub issues link; a `<time>` element with `datetime="2026-09-29"`; the `lang` and viewport meta. It also asserts the page has no `<script src>` and no `<link rel="stylesheet">` to another host.
- **Theme**: the same test file runs the inline theme script logic through a small check that the script text reads `portdle:v1:theme` and toggles the `dark` class; a stored `"dark"` adds the class; a stored `"light"` does not, even with a dark `matchMedia`; `"system"` and absent follow `matchMedia`. (Executed by evaluating the inline script with `new Function` against jsdom's `document` and `localStorage`; each case stubs `window.matchMedia` and resets `document.documentElement.className` and `localStorage`.) The stored-key string in the test comes from the page, and a second assertion checks it equals `"portdle:v1:theme"`, so a rename of the app's key breaks the test.
- **Link**: an App-level test in `src/ui/app.test.tsx`: open the How-to dialog, find the link named "Privacy", assert its `href` equals `${import.meta.env.BASE_URL}privacy.html`, its `target` is `_blank`, and `rel` contains `noopener`. Also assert that the first of `dialog.querySelectorAll('button, a[href]')` is "Got it" (the jsdom `showModal` stub in `src/test/setup.ts` does not move real focus, so real focus is checked by hand). Existing How-to tests keep passing (rules list, Got it, Escape, backdrop).
- **Build**: `pnpm build` output is checked by hand once: `dist/privacy.html` exists. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass.
- **Not tested in Vitest**: the deployed URL and visual rendering, checked once by hand in the built `dist/` served by `pnpm preview` in light and dark.

## Out of Scope

- Any account, sync, or leaderboard code (other Spec 4 tickets).
- A terms-of-service page, a cookie banner, or a data export.
- A React route for the page, or a footer.
- Changing the build, the deploy workflow, or the `404.html` copy.
- Translations.

## Further Notes

- Author calls, listed so the owner can overrule them:
  - The São Paulo region and the no ads, no tracking, no selling statements come from #146, not Spec 4; the owner must create the Supabase project in São Paulo (owner setup, #129) or update the page.
  - Tab order in the How-to dialog is Got it, then Privacy, the reverse of the visual left-to-right order; accepted so Got it keeps the initial focus (one extra tab stop).
  - Run `pnpm format` and `pnpm lint` so Biome accepts `privacy.html`; if Biome flags the inline script, use a `biome-ignore` comment with a reason, not a `biome.json` change.
  - The page lists rank among the public leaderboard fields; #146 names display name, score, and time to score, and Spec 4's leaderboard views expose rank too.
  - The link sits in the How-to dialog, not a footer (the app has no footer), and opens in a new tab.
  - The page reads the app's stored theme key so it matches the toggle; without it, the system preference decides.
- Terms follow `CONTEXT.md`: Account menu, Display name, Codex, Blitz, Daily, Leaderboard, Time to score, Preferences.
