# Ticket spec: Privacy page contact email (#159)

Ticket spec: Privacy page contact email (#159). Parent: Spec 4 (#127, `docs/superpowers/specs/2026-09-28-spec4-backend.md`), map #114. Follow-up to the privacy page spec (`2026-09-29-t146-privacy-page.md`). It supersedes that spec's Contact section, its "Last updated" date, and its GitHub issues link test.

## Problem Statement

The Contact section of the privacy page tells players to open an issue in the GitHub repository. The repository is private, so players cannot reach it and have no way to contact the owner.

## Solution

The Contact section reads "Email mquesada@itba.edu.ar." The address is a `mailto:` link. No player-facing page links to the private repository. The "Last updated" date is the day of the change.

## User Stories

1. As a player, I want to see an email address in the privacy page Contact section, so that I can ask a question about my data.
2. As a player, I want the address to be a `mailto:` link, so that one tap opens my mail app.
3. As a player, I want no link to a page I cannot open, so that I am not sent to a dead end.
4. As a player, I want the "Last updated" date to match the change, so that I can trust the page is current.

## Implementation Decisions

- The static privacy page (`public/privacy.html`) is the only module that changes, plus its test.
- Contact paragraph text: "Email" followed by a `mailto:mquesada@itba.edu.ar` link with the address as link text, then a full stop.
- The `<time>` element gets `datetime="2026-09-30"` and the visible text "September 30, 2026". This is the implementation day. If the merge lands on a later day, the owner may update it.
- Audit result: the app source and `public/` have no other player-facing link to the private repository. The only other matches are `package.json` (repository metadata, not player-facing) and `AGENTS.md` (not served). `LICENSE` has only the name, not a link. No other fix is needed.
- The `mailto:` address is plain text in a public page by the owner's request. No migration and no owner steps.

## Testing Decisions

- A good test checks what the page shows, not how the HTML is written.
- Extend the existing privacy page test. Rename the "links back to the game and to the GitHub issues" test to "page links back to the game and shows the contact email". It checks: the link back to the game exists; the `mailto:mquesada@itba.edu.ar` link exists; the text contains "Email mquesada@itba.edu.ar."; no `a` element has an `href` containing `github.com/mquesada02`.
- Update the "last updated" test to expect `datetime="2026-09-30"` and the visible text "September 30, 2026". The no-repo-link check covers only the privacy page; the audit of other pages is a one-time manual check. Before commit, lint, typecheck, test, and build must pass.
- Prior art: the same test file. Written test-first: run the new checks, see them fail, then edit the page.

## Out of Scope

- Any other privacy page wording.
- The `package.json` repository URL, `AGENTS.md`, and `LICENSE`.
- Obfuscating the address against scrapers.

## Further Notes

Author calls for the owner: (1) a personal address is public plain text on this page; the owner asked for it. (2) Contact is by email only, because the repository is private.
