# Blitz skip

Blitz has no control to skip an item, in Default or in Inverted mode. When a run deals a service or a port that the player does not know, the player still guesses: a miss costs a life, and in Sprint and Marathon the clock keeps running.

## Why this is out of scope

Blitz is a test of what the player knows under pressure. The Blitz Default spec decided this from the start (docs/superpowers/specs/2026-09-08-blitz-default.md, story 40):

> As a player, I want no Skip control, so that I cannot bypass an item.

Blitz scores also feed the leaderboards, which rank runs by window, category, orientation (Default or Inverted) and mode. A free skip would let a player pass every hard item, so a score would measure how often the player skipped, not what they know, and runs would no longer compare fairly.

A rare item is part of the game: the lives (and, in Sprint and Marathon, the timer) already limit how much one hard item can cost.

## Prior requests

- #327: "Blitz Inverted: a skip control" (tester feedback, September 2026)
