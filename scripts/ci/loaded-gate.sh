#!/usr/bin/env bash
# Runs the WebKit screenshot gate under CPU load, for the Loaded gate workflow
# (.github/workflows/loaded-gate.yml). CI only: it starts one burner on every
# core, which breaks the CPU-load limits of a shared PC.
#
# The load has the shape of the local loaded runs of #249: one burner per core,
# with the tests on the same cores, and Playwright --workers=2.
set -euo pipefail

burners=()
stop_burners() {
	kill "${burners[@]}" 2>/dev/null || true
}
trap stop_burners EXIT

for _ in $(seq "$(nproc)"); do
	# The job timeout stops the job first; this bound is a second guard.
	timeout 3600 sh -c 'while :; do :; done' &
	burners+=("$!")
done

pnpm gate --project "webkit-*" --workers=2
