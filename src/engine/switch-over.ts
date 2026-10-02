// The UTC day the backend Schedule first goes live. Every Daily on or before
// it keeps the answer the committed schedule gave it. The one generated
// migration (scripts/gen-catalog-migration.ts) takes this day; change it
// there only by running that script again. Placeholder until the release.
export const SWITCH_OVER_DAY = "2026-10-01";
