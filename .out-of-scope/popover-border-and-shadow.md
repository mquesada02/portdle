# Popover border and shadow

Every floating surface in Portdle (popover or dialog) has both a hairline border and a wide soft shadow. Today these are the account and miss popovers, and the How to play, Blitz setup, delete-account and device progress dialogs. The Hallmark design skill flags this pair and says to keep one (its finish check F24). Portdle keeps both on every floating surface, including new ones.

## Why this is out of scope

Each edge does a job in one theme:

- In light mode, the shadow lifts the surface above the page.
- In dark mode, a shadow barely shows on the dark background, so the hairline border defines the surface's edge.

Removing either one weakens the surface in one of the two themes.

## Prior requests

- #354 — "Account popover: border and wide shadow together" (UI audit, November 2026, finding N12)
