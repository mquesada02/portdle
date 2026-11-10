#!/usr/bin/env bash
# Prints the Markdown summary of a Loaded gate run: how many loaded compares
# failed, and the failed tests of each one, read from its failure artifact.
# Usage: loaded-gate-summary.sh <dir with the downloaded failure artifacts>
set -euo pipefail

dir=$1
if [ "$BASELINE" != success ]; then
	echo "The baseline job did not succeed ($BASELINE), so no compare ran."
	exit 0
fi

# Every compare job that did not succeed counts as failed, also a cancelled one.
failed=$(gh api --paginate "repos/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID/jobs" \
	-q '.jobs[] | select(.name | startswith(env.COMPARE_JOB)) | select(.conclusion != "success") | .name')
echo "Failed runs: $(grep -c . <<<"$failed" || true) of $RUNS"

while IFS= read -r name; do
	[ -n "$name" ] || continue
	run=${name#"$COMPARE_JOB"}
	report=$dir/$FAILURE_ARTIFACT${run%)}/gate-results.json
	echo "- $name"
	if [ ! -f "$report" ]; then
		echo "  - no gate report"
		continue
	fi
	jq -r '.. | objects | select(has("specs")) | .specs[] as $spec | $spec.tests[]
		| select(any(.results[]; .status != "passed" and .status != "skipped"))
		| "  - \($spec.file):\($spec.line) \($spec.title) (\(.projectName))"' "$report"
done <<<"$failed"
