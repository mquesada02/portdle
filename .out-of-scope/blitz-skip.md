# Blitz skip

Blitz has no control to move past an item without a guess (a skip, pass, next, reroll or swap), in either orientation (Default or Inverted), and that includes a skip for Inverted only. When a run deals a service or a port that the player does not know, the player still guesses: a miss costs a life, and in Sprint and Marathon the clock keeps running.

## Why this is out of scope

Blitz is a test of what the player knows under pressure. Both Blitz specs decided this from the start. The Blitz Default spec (docs/superpowers/specs/2026-09-08-blitz-default.md, story 40):

> As a player, I want no Skip control, so that I cannot bypass an item.

The Blitz Inverted spec (docs/superpowers/specs/2026-09-10-blitz-inverted.md, story 33) keeps "no Skip, so that Inverted uses the same lives and timer rules as Default."

Blitz Best scores also feed the leaderboards (see Leaderboard in CONTEXT.md). A free skip would let a player pass every hard item, so a Best score would measure how often the player skipped, not what they know, and Best scores would no longer compare fairly.

A rare item is part of the game: the lives (and, in Sprint and Marathon, the timer) already limit how much one hard item can cost.

## Prior requests

- #327 — "Blitz Inverted: a skip control" (tester feedback, September 2026)
