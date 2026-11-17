# Disclosure height animation

The disclosure panels (`<details>`) in History and Blitz open with a 200 ms `height` transition on `::details-content`. The Hallmark design skill says to animate only `transform` and `opacity` (its rule 10a), because a height animation runs layout on each frame. Portdle keeps the height animation.

## Why this is out of scope

A `transform` or `opacity` animation cannot replace it. When a panel opens, the content below it must move down, and only a height change does that. The only real alternative is no animation at all.

The cost is small: the panels hold short content, the animation lasts 200 ms, and no tester has reported jank. The reduced-motion rule in `src/styles.css` already turns the transition off for players who ask for less motion.

## Prior requests

- #344 — "Disclosure height animation: keep or change" (UI audit, November 2026, finding L3)
