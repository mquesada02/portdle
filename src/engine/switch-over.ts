// The UTC day the backend Schedule first goes live. Every Daily on or before
// it keeps the answer the committed schedule gave it. The import migration
// (20261001000009, generated once by a script since removed) holds the same
// day in SQL: a change here needs a matching change there.
export const SWITCH_OVER_DAY = "2026-10-04";
