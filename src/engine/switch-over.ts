// The UTC day the backend Schedule first goes live. Every Daily on or before
// it keeps the answer the imported schedule gave it. The import migration
// and the release checklist hold the same day; switch-over.test.ts fails
// when they differ.
export const SWITCH_OVER_DAY = "2026-10-04";
