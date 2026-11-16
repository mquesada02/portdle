import { createMemoryHistory } from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { createPersist } from "../persist/storage";
import { createFakeRemote } from "../test/fake-remote";
import { loaded, memoryStore, stubMatchMedia } from "../test/helpers";
import { App } from "./app";

// The real started state, with a current puzzle that is not in the catalog.
vi.mock("../engine/blitz", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../engine/blitz")>();
	return {
		...actual,
		startBlitz: (...args: Parameters<typeof actual.startBlitz>) => {
			const started = actual.startBlitz(...args);
			return "error" in started
				? started
				: { ...started, currentId: "not-in-the-catalog" };
		},
	};
});

afterEach(() => {
	cleanup();
});

test("the Blitz fallback heading has the class list of the Blitz page heading", async () => {
	stubMatchMedia();
	const persist = createPersist(memoryStore());
	persist.writeHowToSeen();
	const history = createMemoryHistory({
		initialEntries: ["/portdle/blitz"],
	});
	render(
		<App persist={persist} remote={createFakeRemote()} history={history} />,
	);
	await screen.findByRole("navigation", { name: "Main" });
	await loaded();
	const pageHeading = screen.getByRole("heading", { level: 1, name: "Blitz" });
	const pageClasses = pageHeading.className;
	expect(pageClasses).toBe("text-2xl font-bold tracking-tight");

	const user = userEvent.setup();
	await user.click(screen.getByRole("button", { name: "New run" }));
	await user.click(screen.getByRole("button", { name: "Start" }));

	expect(screen.queryByRole("button", { name: "New run" })).toBeNull();
	const fallbackHeading = screen.getByRole("heading", {
		level: 1,
		name: "Blitz",
	});
	expect(fallbackHeading.className).toBe(pageClasses);
});
