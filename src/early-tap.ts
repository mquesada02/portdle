// A prerendered button has no handler until the app hydrates it, so a tap on it
// before then does nothing. The inline script src/early-tap-script.js runs
// with the bundle loader and stores the last tap on a button (and stops its
// default, so a form does not submit natively). The app stops the capture
// right before it hydrates, since React handles taps from then on, and replays
// the stored tap once the page has hydrated.

// The global that src/early-tap-script.js sets.
export const EARLY_TAP_GLOBAL = "__portdleEarlyTap";

export type EarlyTapState = {
	stopped: boolean;
	tap: { button: HTMLButtonElement; text: string | null } | null;
};

function earlyTapState(): EarlyTapState | undefined {
	return (window as unknown as Record<string, EarlyTapState | undefined>)[
		EARLY_TAP_GLOBAL
	];
}

export function stopEarlyTapCapture(): void {
	const state = earlyTapState();
	if (state) {
		state.stopped = true;
	}
}

// Clicks the stored button only when it is still on the page, enabled and
// shows the same text: hydration keeps the prerendered nodes, so this is the
// button the player tapped, and the tap never lands on one that changed.
export function replayEarlyTap(): void {
	const state = earlyTapState();
	const tap = state?.tap;
	if (!state || !tap) {
		return;
	}
	state.tap = null;
	const { button, text } = tap;
	if (button.isConnected && !button.disabled && button.textContent === text) {
		button.click();
	}
}
