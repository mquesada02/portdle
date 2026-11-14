import type { Remote } from "./remote";

// Settles after the browser shows its next frame. A frame callback runs
// before its frame is painted, and the frame reaches the screen a few
// milliseconds after the paint, so it waits for the callback of the frame
// after it, then for a task. A hidden page paints no frame, so there it
// settles at once, or when the page is hidden.
function nextFrameShown(): Promise<void> {
	return new Promise((resolve) => {
		if (document.visibilityState === "hidden") {
			resolve();
			return;
		}
		const done = () => {
			document.removeEventListener("visibilitychange", onHidden);
			resolve();
		};
		const onHidden = () => {
			if (document.visibilityState === "hidden") {
				done();
			}
		};
		document.addEventListener("visibilitychange", onHidden);
		requestAnimationFrame(() =>
			requestAnimationFrame(() => setTimeout(done, 0)),
		);
	});
}

// The remote, with each public read held until the browser paints the frame
// after the first public read. The app asks for its reads as it hydrates, so
// the page first paints what it shows without them (the How-to, the stored
// lists), and only then starts the requests. It holds the public reads of
// `Remote` (the ones that need no sign-in); a new public read belongs here
// too. `readLeaderboard` is not held: it starts only when the player opens
// the Blitz Leaderboards tab.
export function readsAfterNextPaint(remote: Remote): Remote {
	let shown: Promise<void> | undefined;
	const wait = () => {
		shown ??= nextFrameShown();
		return shown;
	};
	return {
		...remote,
		readCatalog: (signal) => wait().then(() => remote.readCatalog(signal)),
		readCurrentDailies: (signal) =>
			wait().then(() => remote.readCurrentDailies(signal)),
		readSchedule: (signal) => wait().then(() => remote.readSchedule(signal)),
		readDailyStats: (category, date, signal) =>
			wait().then(() => remote.readDailyStats(category, date, signal)),
	};
}
