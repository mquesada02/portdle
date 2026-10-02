import { screen } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";
import { catalogFor } from "../engine/catalog";
import type { CatalogEntry } from "../engine/types";
import { fixtureCatalog, padToAnswer } from "./dailies";
import { portDigits } from "./helpers";

const { protocols, applications } = fixtureCatalog();
export const catalog = catalogFor("mixed", protocols, applications);

// The entry the Blitz Default prompt heading names.
export function currentEntry(): CatalogEntry {
	const name = screen.getByRole("heading", { level: 1 }).textContent;
	const entry = catalog.find((candidate) => candidate.name === name);
	if (!entry) {
		throw new Error(`missing entry ${name}`);
	}
	return entry;
}

// Spends all three lives with wrong ports, which ends a Default run.
export async function missThree(user: ReturnType<typeof userEvent.setup>) {
	for (let i = 0; i < 3; i += 1) {
		const answer = currentEntry();
		const missPort = answer.port === 80 ? 19 : 80;
		await user.clear(portDigits());
		await user.type(portDigits(), padToAnswer(missPort, answer));
		await user.click(screen.getByRole("button", { name: "Submit" }));
	}
}
