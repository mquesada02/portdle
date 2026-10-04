// The UTC day the backend Schedule first goes live. Every Daily on or before
// it keeps the answer the imported schedule gave it. The import migration
// (20261001000009, generated once by a script removed at the release) holds
// the same day in SQL; switch-over.test.ts fails when the two differ.
export const SWITCH_OVER_DAY = "2026-10-04";
