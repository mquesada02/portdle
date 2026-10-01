#!/usr/bin/env bash
# Runs every supabase/tests/*.sql file with psql, stopping at the first failure.
# row-sync-cleanup.sql is the owner's cleanup script, not a test, so it is skipped.
# DATABASE_URL defaults to the local stack; set it when the stack uses another port.
# Needs the psql client on PATH.
set -euo pipefail

cd "$(dirname "$0")/.."
url="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

ran=0
for file in supabase/tests/*.sql; do
	[ "$(basename "$file")" = row-sync-cleanup.sql ] && continue
	echo "== $file"
	psql "$url" -v ON_ERROR_STOP=1 -f "$file"
	ran=$((ran + 1))
done

if [ "$ran" -eq 0 ]; then
	echo "No SQL test files found." >&2
	exit 1
fi
