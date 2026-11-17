# Loading skeletons

While data loads, a screen shows one short loading line, for example "Loading…". It does not show a placeholder in the shape of the content, such as a grid of empty card outlines for the Codex or empty rows for the Leaderboards. The Hallmark design skill's rules for app screens ask for such placeholders (skeletons).

## Why this is out of scope

A skeleton must match the size of the real content, or the page jumps when the data arrives. That jump is layout shift, and it counts against the Lighthouse floors that Spec 7 set. The Codex grid and the Leaderboards change size with the data, so a matching skeleton is hard to keep exact.

The owner chose the minimum fix instead (#353): every loading line uses one style, with the ellipsis character and centred text.

## Prior requests

- #353 — "Loading states: placeholders instead of bare Loading text" (UI audit, November 2026, finding N8; the skeleton part was declined, the one-style part was accepted)
