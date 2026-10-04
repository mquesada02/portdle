import { expect, test } from "vitest";
import migration from "../../supabase/migrations/20261001000009_catalog_schedule_import.sql?raw";
import { SWITCH_OVER_DAY } from "./switch-over";

test("the import migration holds the same switch-over day as the client", () => {
	expect(migration).toContain(`select date '${SWITCH_OVER_DAY}'`);
});
