#!/usr/bin/env bash
# Runs the screenshot gate of one engine ($ENGINE: webkit, chromium or firefox)
# under CPU load, for the Loaded gate workflow (.github/workflows/loaded-gate.yml).
# CI only: it starts one burner on every core, which breaks the CPU-load limits
# of a shared PC.
#
# The load has the shape of the local loaded runs of #249: one burner per core,
# with the tests on the same cores, and Playwright --workers=2.
set -euo pipefail

# The burners are this shell's only background jobs.
trap 'kill $(jobs -p) 2>/dev/null || true' EXIT

for _ in $(seq "$(nproc)"); do
	# The job timeout stops the job first; this bound is a second guard.
	timeout 3600 sh -c 'while :; do :; done' &
done

# --workers=2 overrides the committed workers: 1 (and rule COST-06) on purpose:
# the local loaded runs that found #249 and #253 used 2 workers.
pnpm gate --project "${ENGINE:?}-*" --workers=2
