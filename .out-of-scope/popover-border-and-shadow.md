# Popover border and shadow

The account popover has both a hairline border and a wide soft shadow (`shadow-xl`). The Hallmark design skill flags this pair and says to keep one (its finish check F24). Portdle keeps both.

## Why this is out of scope

Each edge does a job in one theme:

- In light mode, the shadow lifts the popover above the page.
- In dark mode, a shadow barely shows on the dark background, so the hairline border defines the popover's edge.

Removing either one weakens the popover in one of the two themes.

## Prior requests

- #354 — "Account popover: border and wide shadow together" (UI audit, November 2026, finding N12)
