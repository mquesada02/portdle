import { createMemoryHistory } from "@tanstack/react-router";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, expect, test } from "vitest";
import { createPersist } from "../persist/storage";
import { createFakeRemote, type FakeRemote } from "../test/fake-remote";
import { memoryStore, stubMatchMedia } from "../test/helpers";
import { App } from "./app";

async function renderApp(options: { remote?: FakeRemote; strict?: boolean }) {
	stubMatchMedia();
	const store = memoryStore();
	const persist = createPersist(store);
	persist.writeHowToSeen();
	const history = createMemoryHistory({ initialEntries: ["/portdle/"] });
	const app = (
		<App persist={persist} remote={options.remote} history={history} />
	);
	render(options.strict ? <StrictMode>{app}</StrictMode> : app);
	await screen.findByRole("navigation", { name: "Main" });
	return { persist, store };
}

const SIGNED_IN = {
	status: "signedIn",
	accountId: "u1",
	displayName: "Ada L.",
	nameConfirmed: true,
} as const;

afterEach(() => {
	cleanup();
});

function accountButton() {
	return screen.getByRole("button", { name: "Account" });
}

function pencil() {
	return screen.getByRole("button", { name: "Edit display name" });
}

test("without a Remote there is no Account button", async () => {
	await renderApp({});
	expect(screen.queryByRole("button", { name: "Account" })).toBeNull();
	expect(screen.getByRole("button", { name: "How to play" })).toBeTruthy();
	expect(
		screen.getByRole("button", { name: "Toggle color theme" }),
	).toBeTruthy();
});

test("signed out, the menu lists Google above GitHub and each starts its sign-in", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote();
	await renderApp({ remote });
	await user.click(accountButton());
	const buttons = await screen.findAllByRole("button", {
		name: /^Sign in with/,
	});
	expect(buttons.map((b) => b.textContent)).toEqual([
		"Sign in with Google",
		"Sign in with GitHub",
	]);
	await user.click(buttons[0] as HTMLElement);
	await user.click(buttons[1] as HTMLElement);
	expect(remote.signInCalls).toEqual(["google", "github"]);
});

test("a failed sign-in start shows one error line and the buttons work again", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote();
	remote.failSignIn = true;
	await renderApp({ remote });
	await user.click(accountButton());
	await user.click(
		await screen.findByRole("button", { name: "Sign in with Google" }),
	);
	expect((await screen.findByRole("alert")).textContent).toBe(
		"Could not start sign-in. Try again.",
	);
	expect(
		(
			screen.getByRole("button", {
				name: "Sign in with Google",
			}) as HTMLButtonElement
		).disabled,
	).toBe(false);
	remote.failSignIn = false;
	await user.click(screen.getByRole("button", { name: "Sign in with GitHub" }));
	await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});

test("both sign-in buttons are disabled while a sign-in starts", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote();
	let release: () => void = () => {};
	remote.signIn = () =>
		new Promise<void>((resolve) => {
			release = resolve;
		});
	await renderApp({ remote });
	await user.click(accountButton());
	await user.click(
		await screen.findByRole("button", { name: "Sign in with Google" }),
	);
	for (const name of ["Sign in with Google", "Sign in with GitHub"]) {
		expect(
			(screen.getByRole("button", { name }) as HTMLButtonElement).disabled,
		).toBe(true);
	}
	await act(async () => release());
});

test("signed in, the menu shows the display name and Sign out keeps local data", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	const { store } = await renderApp({ remote });
	const before = new Map(store.data);
	await user.click(accountButton());
	expect(await screen.findByText("Ada L.")).toBeTruthy();
	expect(screen.queryByRole("button", { name: /^Sign in with/ })).toBeNull();
	await user.click(screen.getByRole("button", { name: "Sign out" }));
	expect(
		await screen.findByRole("button", { name: "Sign in with Google" }),
	).toBeTruthy();
	expect(remote.signOutCalls).toBe(1);
	expect(store.data).toEqual(before);
});

test("a failed sign-out shows its line and stays signed in", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	remote.failSignOut = true;
	await renderApp({ remote });
	await user.click(accountButton());
	await user.click(await screen.findByRole("button", { name: "Sign out" }));
	expect((await screen.findByRole("alert")).textContent).toBe(
		"Could not sign out. Try again.",
	);
	expect(screen.getByText("Ada L.")).toBeTruthy();
});

test("a failed account read shows an error line with Sign out", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	remote.failGetAccount = true;
	await renderApp({ remote });
	await user.click(accountButton());
	expect((await screen.findByRole("alert")).textContent).toBe(
		"Could not load your account.",
	);
	await user.click(screen.getByRole("button", { name: "Sign out" }));
	expect(
		await screen.findByRole("button", { name: "Sign in with Google" }),
	).toBeTruthy();
});

test("while the account loads the menu says so", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	const release = remote.holdGetAccount();
	await renderApp({ remote });
	await user.click(accountButton());
	expect(screen.getByText("Loading account.")).toBeTruthy();
	await act(async () => release());
	expect(await screen.findByText("Ada L.")).toBeTruthy();
});

test("a redirect error opens the menu signed out with the error, even under StrictMode", async () => {
	const remote = createFakeRemote();
	remote.setRedirectError("Error getting user email from external provider");
	await renderApp({ remote, strict: true });
	expect(accountButton().getAttribute("aria-expanded")).toBe("true");
	expect((await screen.findByRole("alert")).textContent).toBe(
		"Error getting user email from external provider",
	);
	expect(
		screen.getByRole("button", { name: "Sign in with Google" }),
	).toBeTruthy();
	expect(remote.preloadCalls).toBe(0);
	cleanup();
	await renderApp({ remote });
	expect(accountButton().getAttribute("aria-expanded")).toBe("false");
});

test("a redirect error beats loading and a later signed-in result replaces it", async () => {
	const remote = createFakeRemote(SIGNED_IN);
	remote.setRedirectError("Denied");
	const release = remote.holdGetAccount();
	await renderApp({ remote });
	expect(screen.queryByText("Loading account.")).toBeNull();
	expect((await screen.findByRole("alert")).textContent).toBe("Denied");
	expect(
		screen.getByRole("button", { name: "Sign in with GitHub" }),
	).toBeTruthy();
	await act(async () => release());
	expect(await screen.findByText("Ada L.")).toBeTruthy();
	expect(screen.queryByRole("alert")).toBeNull();
});

test("a redirect error stays when the account read rejects", async () => {
	const remote = createFakeRemote();
	remote.setRedirectError("Denied");
	remote.failGetAccount = true;
	await renderApp({ remote });
	await act(async () => {});
	expect((await screen.findByRole("alert")).textContent).toBe("Denied");
	expect(screen.queryByText("Could not load your account.")).toBeNull();
	expect(
		screen.getByRole("button", { name: "Sign in with Google" }),
	).toBeTruthy();
});

test("a result that arrives after unmount changes nothing", async () => {
	const remote = createFakeRemote(SIGNED_IN);
	const release = remote.holdGetAccount();
	await renderApp({ remote });
	cleanup();
	await act(async () => release());
	expect(document.body.textContent).not.toContain("Ada L.");
});

test("the menu closes on Escape with focus back on the button, on outside click, and on a second press", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote();
	await renderApp({ remote });
	await user.click(accountButton());
	expect(remote.preloadCalls).toBe(1);
	expect(accountButton().getAttribute("aria-expanded")).toBe("true");
	await user.keyboard("{Escape}");
	expect(accountButton().getAttribute("aria-expanded")).toBe("false");
	expect(document.activeElement).toBe(accountButton());
	await user.click(accountButton());
	await user.click(document.body);
	expect(accountButton().getAttribute("aria-expanded")).toBe("false");
	await user.click(accountButton());
	await user.click(accountButton());
	expect(accountButton().getAttribute("aria-expanded")).toBe("false");
});

test("the theme toggle still works beside the Account button", async () => {
	const user = userEvent.setup();
	const { persist } = await renderApp({ remote: createFakeRemote() });
	await user.click(screen.getByRole("button", { name: "Toggle color theme" }));
	expect(persist.readTheme()).toBe("dark");
});

async function openRename(user: ReturnType<typeof userEvent.setup>) {
	await user.click(accountButton());
	await user.click(
		await screen.findByRole("button", { name: "Edit display name" }),
	);
	return screen.getByRole("textbox", { name: "Display name" });
}

test("the pencil turns the name into a field; Cancel restores the name and drops the text", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	await renderApp({ remote });
	const input = await openRename(user);
	expect((input as HTMLInputElement).value).toBe("Ada L.");
	await user.clear(input);
	await user.type(input, "Grace");
	await user.click(screen.getByRole("button", { name: "Cancel" }));
	expect(screen.getByText("Ada L.")).toBeTruthy();
	expect(remote.changeCalls).toEqual([]);
	await user.click(screen.getByRole("button", { name: "Edit display name" }));
	expect(
		(screen.getByRole("textbox", { name: "Display name" }) as HTMLInputElement)
			.value,
	).toBe("Ada L.");
});

test("an invalid typed name shows an inline error and cannot be saved", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	await renderApp({ remote });
	const input = await openRename(user);
	await user.clear(input);
	await user.type(input, "Ada 😀");
	expect(screen.getByRole("alert").textContent).not.toBe("");
	expect(
		(screen.getByRole("button", { name: "Save" }) as HTMLButtonElement)
			.disabled,
	).toBe(true);
	await user.type(input, "{Enter}");
	fireEvent.submit(input);
	expect(remote.changeCalls).toEqual([]);
});

test("Save and Enter rename the account and show the new name", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	await renderApp({ remote });
	let input = await openRename(user);
	await user.clear(input);
	await user.type(input, "Grace H.");
	await user.click(screen.getByRole("button", { name: "Save" }));
	expect(await screen.findByText("Grace H.")).toBeTruthy();
	expect(remote.changeCalls).toEqual(["Grace H."]);
	expect(remote.state).toMatchObject({
		displayName: "Grace H.",
		nameConfirmed: true,
	});
	await user.click(screen.getByRole("button", { name: "Edit display name" }));
	input = screen.getByRole("textbox", { name: "Display name" });
	await user.clear(input);
	await user.type(input, "Grace{Enter}");
	expect(await screen.findByText("Grace")).toBeTruthy();
	expect(remote.changeCalls).toEqual(["Grace H.", "Grace"]);
});

test("saving an unchanged name calls the account once", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	await renderApp({ remote });
	await openRename(user);
	await user.click(screen.getByRole("button", { name: "Save" }));
	await screen.findByRole("button", { name: "Edit display name" });
	expect(remote.changeCalls).toEqual(["Ada L."]);
});

test("a failed rename shows one line, changes nothing, keeps editing, and a retry succeeds", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	remote.failChangeDisplayName = true;
	await renderApp({ remote });
	const input = await openRename(user);
	await user.clear(input);
	await user.type(input, "Grace");
	await user.click(screen.getByRole("button", { name: "Save" }));
	expect((await screen.findByRole("alert")).textContent).toBe(
		"Could not save your name. Try again.",
	);
	expect(remote.state).toEqual(SIGNED_IN);
	expect(screen.getByRole("textbox", { name: "Display name" })).toBeTruthy();
	await user.type(input, "s");
	expect(screen.queryByRole("alert")).toBeNull();
	remote.failChangeDisplayName = false;
	await user.click(screen.getByRole("button", { name: "Save" }));
	expect(await screen.findByText("Graces")).toBeTruthy();
	expect(remote.state).toMatchObject({ displayName: "Graces" });
});

test("closing the menu with the person icon mid-edit cancels the edit", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	await renderApp({ remote });
	const input = await openRename(user);
	await user.type(input, "xyz");
	await user.click(accountButton());
	expect(screen.queryByRole("textbox", { name: "Display name" })).toBeNull();
	expect(document.activeElement).toBe(accountButton());
	await user.click(accountButton());
	expect(await screen.findByText("Ada L.")).toBeTruthy();
});

test("opening the edit focuses the name field", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	await renderApp({ remote });
	const input = await openRename(user);
	expect(document.activeElement).toBe(input);
});

test("a successful Save focuses the pencil, by button and by Enter", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	await renderApp({ remote });
	await openRename(user);
	await user.type(screen.getByRole("textbox", { name: "Display name" }), "1");
	await user.click(screen.getByRole("button", { name: "Save" }));
	expect(await screen.findByText("Ada L.1")).toBeTruthy();
	expect(document.activeElement).toBe(pencil());
	await user.click(pencil());
	await user.type(
		screen.getByRole("textbox", { name: "Display name" }),
		"2{Enter}",
	);
	expect(await screen.findByText("Ada L.12")).toBeTruthy();
	expect(document.activeElement).toBe(pencil());
});

test("Cancel focuses the pencil", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	await renderApp({ remote });
	await openRename(user);
	await user.click(screen.getByRole("button", { name: "Cancel" }));
	expect(document.activeElement).toBe(pencil());
});

test("Escape in the field ends only the edit and focuses the pencil", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	await renderApp({ remote });
	const input = await openRename(user);
	await user.type(input, "xyz");
	await user.keyboard("{Escape}");
	expect(screen.queryByRole("textbox", { name: "Display name" })).toBeNull();
	expect(accountButton().getAttribute("aria-expanded")).toBe("true");
	expect(screen.getByText("Ada L.")).toBeTruthy();
	expect(document.activeElement).toBe(pencil());
	await user.click(pencil());
	expect(
		(screen.getByRole("textbox", { name: "Display name" }) as HTMLInputElement)
			.value,
	).toBe("Ada L.");
});

test("a failed Save keeps focus in the field with the alert, each time", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	remote.failChangeDisplayName = true;
	await renderApp({ remote });
	const input = await openRename(user);
	await user.type(input, "1");
	for (let attempt = 0; attempt < 2; attempt++) {
		await user.click(screen.getByRole("button", { name: "Save" }));
		expect((await screen.findByRole("alert")).textContent).toBe(
			"Could not save your name. Try again.",
		);
		await waitFor(() => expect(document.activeElement).toBe(input));
		await user.click(document.getElementById("account-menu") as HTMLElement);
		expect(document.activeElement).not.toBe(input);
	}
	remote.failChangeDisplayName = false;
	await user.click(screen.getByRole("button", { name: "Save" }));
	expect(await screen.findByText("Ada L.1")).toBeTruthy();
	expect(document.activeElement).toBe(pencil());
});

test("a failed sign-out mid-edit does not move focus into the field", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	remote.failSignOut = true;
	await renderApp({ remote });
	await openRename(user);
	const signOut = screen.getByRole("button", { name: "Sign out" });
	await user.click(signOut);
	expect((await screen.findByRole("alert")).textContent).toBe(
		"Could not sign out. Try again.",
	);
	expect(document.activeElement).toBe(signOut);
	expect(document.activeElement).not.toBe(
		screen.getByRole("textbox", { name: "Display name" }),
	);
});

test("Escape during a pending save changes nothing, then the result focuses the pencil", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	const release = remote.holdChangeDisplayName();
	await renderApp({ remote });
	await openRename(user);
	await user.type(screen.getByRole("textbox", { name: "Display name" }), "1");
	await user.click(screen.getByRole("button", { name: "Save" }));
	await user.keyboard("{Escape}");
	expect(accountButton().getAttribute("aria-expanded")).toBe("true");
	expect(screen.getByRole("textbox", { name: "Display name" })).toBeTruthy();
	await act(async () => release());
	expect(await screen.findByText("Ada L.1")).toBeTruthy();
	expect(document.activeElement).toBe(pencil());
});

test("a pending save disables the buttons and keeps the menu open", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	const release = remote.holdChangeDisplayName();
	await renderApp({ remote });
	const input = await openRename(user);
	await user.type(input, "z");
	await user.click(screen.getByRole("button", { name: "Save" }));
	await waitFor(() =>
		expect(
			(screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement)
				.disabled,
		).toBe(true),
	);
	for (const name of ["Save", "Sign out"]) {
		expect(
			(screen.getByRole("button", { name }) as HTMLButtonElement).disabled,
		).toBe(true);
	}
	await user.keyboard("{Escape}");
	await user.click(document.body);
	expect(screen.getByRole("textbox", { name: "Display name" })).toBeTruthy();
	await act(async () => release());
	expect(await screen.findByText("Ada L.z")).toBeTruthy();
});

// Issue 306: the Daily's slots mount when its read ends, which can be after
// the player opened the menu. The open menu keeps its focus then.
test("the Daily's slots that mount after the menu opens leave the focus in it", async () => {
	const user = userEvent.setup();
	const remote = createFakeRemote(SIGNED_IN);
	const release = remote.holdDailies();
	await renderApp({ remote });
	await user.click(accountButton());
	await act(async () => release());
	await screen.findByLabelText(/^Digit 1 of \d+$/, {}, { timeout: 3000 });
	expect(document.activeElement).toBe(accountButton());
});

// A focused nav link does not stop the slots from taking the focus, so a
// player can type digits at once.
test("the Daily's slots that mount while a nav link has the focus take it", async () => {
	const remote = createFakeRemote(SIGNED_IN);
	const release = remote.holdDailies();
	await renderApp({ remote });
	within(screen.getByRole("navigation", { name: "Main" }))
		.getByRole("link", { name: "Blitz" })
		.focus();
	await act(async () => release());
	const first = await screen.findByLabelText(
		/^Digit 1 of \d+$/,
		{},
		{ timeout: 3000 },
	);
	expect(document.activeElement).toBe(first);
});
