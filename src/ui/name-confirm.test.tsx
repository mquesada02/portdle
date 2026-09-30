import { createMemoryHistory } from "@tanstack/react-router";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { createPersist } from "../persist/storage";
import { createFakeRemote, type FakeRemote } from "../test/fake-remote";
import { memoryStore, stubMatchMedia } from "../test/helpers";
import { App } from "./app";

const UNCONFIRMED = {
	status: "signedIn",
	accountId: "u1",
	displayName: "Ada L.",
	nameConfirmed: false,
} as const;

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

function mountApp(
	remote: FakeRemote,
	store = memoryStore(),
	options: { howToSeen?: boolean } = {},
) {
	stubMatchMedia();
	const persist = createPersist(store);
	if (options.howToSeen !== false) {
		persist.writeHowToSeen();
	}
	const history = createMemoryHistory({ initialEntries: ["/portdle/"] });
	const view = render(
		<App
			persist={persist}
			remote={remote}
			history={history}
			utcToday="2026-09-09"
		/>,
	);
	return { persist, store, view };
}

async function findConfirm() {
	return (await screen.findByRole(
		"dialog",
		{ name: "Confirm your display name" },
		{ timeout: 3000 },
	)) as HTMLDialogElement;
}

function field() {
	return screen.getByRole("textbox", { name: "Display name" });
}

async function retype(user: ReturnType<typeof userEvent.setup>, text: string) {
	await user.clear(field());
	if (text !== "") {
		await user.type(field(), text);
	}
}

test("an unconfirmed name opens the dialog with the seeded name, notice, hint, Continue, and Sign out", async () => {
	mountApp(createFakeRemote(UNCONFIRMED));
	const dialog = await findConfirm();
	expect(dialog.hasAttribute("open")).toBe(true);
	expect((field() as HTMLInputElement).value).toBe("Ada L.");
	expect(
		screen.getByText("Other players see this name on the Leaderboards."),
	).toBeTruthy();
	expect(screen.getByText(/1 to 30 characters/)).toBeTruthy();
	expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
	expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
});

test("a confirmed name, a signed-out player, and no Remote show no dialog", async () => {
	mountApp(createFakeRemote({ ...UNCONFIRMED, nameConfirmed: true }));
	await screen.findByRole("button", { name: "Account" });
	await waitFor(() =>
		expect(screen.queryByRole("dialog", { name: /display name/ })).toBeNull(),
	);
	cleanup();
	mountApp(createFakeRemote());
	await screen.findByRole("button", { name: "Account" });
	expect(screen.queryByRole("dialog", { name: /display name/ })).toBeNull();
});

test("the dialog shows again on every load while the name is unconfirmed, and not after a confirm (story 19)", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(UNCONFIRMED);
	const store = memoryStore();
	const first = mountApp(remote, store);
	await findConfirm();
	first.view.unmount();
	mountApp(remote, store);
	await findConfirm();
	await user.click(screen.getByRole("button", { name: "Continue" }));
	await waitFor(() =>
		expect(screen.queryByRole("dialog", { name: /display name/ })).toBeNull(),
	);
	cleanup();
	mountApp(remote, store);
	await screen.findByRole("button", { name: "Account" });
	expect(screen.queryByRole("dialog", { name: /display name/ })).toBeNull();
});

test("Escape, cancel, close, and a backdrop click do not dismiss the dialog", async () => {
	const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
	mountApp(createFakeRemote(UNCONFIRMED), memoryStore(), { howToSeen: false });
	const dialog = await findConfirm();
	const escapeKey = new KeyboardEvent("keydown", {
		key: "Escape",
		bubbles: true,
		cancelable: true,
	});
	const documentSeen = vi.fn();
	document.addEventListener("keydown", documentSeen);
	act(() => {
		field().dispatchEvent(escapeKey);
	});
	document.removeEventListener("keydown", documentSeen);
	expect(escapeKey.defaultPrevented).toBe(true);
	expect(documentSeen).not.toHaveBeenCalled();
	expect(screen.getByRole("dialog", { name: "How-to" })).toBeTruthy();

	const cancel = new Event("cancel", { cancelable: true });
	act(() => {
		dialog.dispatchEvent(cancel);
	});
	expect(cancel.defaultPrevented).toBe(true);

	await userEvent.setup().click(dialog);
	expect(dialog.hasAttribute("open")).toBe(true);

	const calls = showModal.mock.calls.length;
	act(() => {
		dialog.dispatchEvent(new Event("close"));
	});
	expect(showModal.mock.calls.length).toBe(calls);
	act(() => {
		dialog.close();
		dialog.dispatchEvent(new Event("close"));
	});
	expect(showModal.mock.calls.length).toBe(calls + 1);
	expect(dialog.hasAttribute("open")).toBe(true);
});

test("the Name confirm opens after, so above, the How-to dialog", async () => {
	const order: string[] = [];
	vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(
		function (this: HTMLDialogElement) {
			order.push(this.getAttribute("aria-labelledby") ?? "");
			this.setAttribute("open", "");
		},
	);
	mountApp(createFakeRemote(UNCONFIRMED), memoryStore(), { howToSeen: false });
	await findConfirm();
	expect(order.indexOf("how-to-title")).toBeGreaterThanOrEqual(0);
	expect(order.indexOf("name-confirm-title")).toBeGreaterThan(
		order.indexOf("how-to-title"),
	);
});

test.each([
	["empty", ""],
	["spaces only", "   "],
	["31 characters", "a".repeat(31)],
	["an emoji", "Ada 😀"],
])(
	"%s shows an inline error, disables Continue, and calls nothing",
	async (_label, text) => {
		const user = userEvent.setup();
		const remote = createFakeRemote(UNCONFIRMED);
		mountApp(remote);
		await findConfirm();
		await retype(user, text);
		expect(screen.getByRole("alert").textContent).not.toBe("");
		const button = screen.getByRole("button", {
			name: "Continue",
		}) as HTMLButtonElement;
		expect(button.disabled).toBe(true);
		await user.type(field(), "{Enter}");
		fireEvent.submit(field());
		expect(remote.confirmCalls).toEqual([]);
	},
);

test("Continue confirms the seeded name and the menu shows it", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(UNCONFIRMED);
	mountApp(remote);
	await findConfirm();
	await user.click(screen.getByRole("button", { name: "Continue" }));
	await waitFor(() =>
		expect(screen.queryByRole("dialog", { name: /display name/ })).toBeNull(),
	);
	expect(remote.confirmCalls).toEqual(["Ada L."]);
	expect(remote.state).toMatchObject({ nameConfirmed: true });
});

test("Continue confirms an edited name and the menu shows it", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(UNCONFIRMED);
	mountApp(remote);
	await findConfirm();
	await retype(user, "Grace H.");
	await user.type(field(), "{Enter}");
	await waitFor(() =>
		expect(screen.queryByRole("dialog", { name: /display name/ })).toBeNull(),
	);
	expect(remote.confirmCalls).toEqual(["Grace H."]);
	await user.click(screen.getByRole("button", { name: "Account" }));
	expect(await screen.findByText("Grace H.")).toBeTruthy();
});

test("a failed confirm shows one line, changes nothing, and a retry succeeds", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(UNCONFIRMED);
	remote.failConfirmDisplayName = true;
	mountApp(remote);
	await findConfirm();
	await user.click(screen.getByRole("button", { name: "Continue" }));
	expect((await screen.findByRole("alert")).textContent).toBe(
		"Could not save your name. Try again.",
	);
	expect(remote.state).toEqual(UNCONFIRMED);
	expect(screen.getByRole("dialog", { name: /display name/ })).toBeTruthy();
	await user.click(screen.getByRole("button", { name: "Account" }));
	expect(screen.getByText("Ada L.")).toBeTruthy();

	await retype(user, "Ada M.");
	expect(screen.getByRole("alert").textContent).toBe("");
	remote.failConfirmDisplayName = false;
	await user.click(screen.getByRole("button", { name: "Continue" }));
	await waitFor(() =>
		expect(screen.queryByRole("dialog", { name: /display name/ })).toBeNull(),
	);
	expect(remote.state).toMatchObject({
		displayName: "Ada M.",
		nameConfirmed: true,
	});
});

test("both buttons are disabled while a confirm is pending", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(UNCONFIRMED);
	const release = remote.holdConfirmDisplayName();
	mountApp(remote);
	await findConfirm();
	await user.click(screen.getByRole("button", { name: "Continue" }));
	await waitFor(() =>
		expect(
			(screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement)
				.disabled,
		).toBe(true),
	);
	expect(
		(screen.getByRole("button", { name: "Sign out" }) as HTMLButtonElement)
			.disabled,
	).toBe(true);
	fireEvent.submit(field());
	expect(remote.confirmCalls).toHaveLength(1);
	await act(async () => release());
});

test("Sign out closes the dialog, signs out, and leaves the local store as it was", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(UNCONFIRMED);
	const store = memoryStore();
	const { persist } = mountApp(remote, store);
	persist.writeTheme("dark");
	await findConfirm();
	const before = JSON.stringify(Object.fromEntries(store.data));
	await user.click(screen.getByRole("button", { name: "Sign out" }));
	await waitFor(() =>
		expect(screen.queryByRole("dialog", { name: /display name/ })).toBeNull(),
	);
	expect(remote.signOutCalls).toBe(1);
	expect(JSON.stringify(Object.fromEntries(store.data))).toBe(before);
	await user.click(screen.getByRole("button", { name: "Account" }));
	expect(
		await screen.findByRole("button", { name: "Sign in with Google" }),
	).toBeTruthy();
});

test("a failed sign-out keeps the dialog with a line, and the latest failure shows", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(UNCONFIRMED);
	remote.failSignOut = true;
	remote.failConfirmDisplayName = true;
	mountApp(remote);
	await findConfirm();
	await user.click(screen.getByRole("button", { name: "Sign out" }));
	expect((await screen.findByRole("alert")).textContent).toBe(
		"Could not sign out. Try again.",
	);
	await user.click(screen.getByRole("button", { name: "Continue" }));
	await waitFor(() =>
		expect(screen.getByRole("alert").textContent).toBe(
			"Could not save your name. Try again.",
		),
	);
	remote.failSignOut = false;
	await user.click(screen.getByRole("button", { name: "Sign out" }));
	await waitFor(() =>
		expect(screen.queryByRole("dialog", { name: /display name/ })).toBeNull(),
	);
});

test("a failed confirm then a failed sign-out shows the sign-out line", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(UNCONFIRMED);
	remote.failConfirmDisplayName = true;
	remote.failSignOut = true;
	mountApp(remote);
	await findConfirm();
	await user.click(screen.getByRole("button", { name: "Continue" }));
	await waitFor(() =>
		expect(screen.getByRole("alert").textContent).toBe(
			"Could not save your name. Try again.",
		),
	);
	await user.click(screen.getByRole("button", { name: "Sign out" }));
	await waitFor(() =>
		expect(screen.getByRole("alert").textContent).toBe(
			"Could not sign out. Try again.",
		),
	);
});

test("signing out and back in on a confirmed account shows no dialog", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote({ ...UNCONFIRMED, nameConfirmed: true });
	mountApp(remote);
	await user.click(await screen.findByRole("button", { name: "Account" }));
	await user.click(await screen.findByRole("button", { name: "Sign out" }));
	await screen.findByRole("button", { name: "Sign in with Google" });
	cleanup();
	remote.state = { ...UNCONFIRMED, nameConfirmed: true };
	mountApp(remote);
	await screen.findByRole("button", { name: "Account" });
	expect(screen.queryByRole("dialog", { name: /display name/ })).toBeNull();
});
