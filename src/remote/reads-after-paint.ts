import type { Remote } from "./remote";

// Runs `run` once, after the browser shows its next frame. A frame callback
// runs before its frame is painted, and the frame reaches the screen a few
// milliseconds after the paint, so `run` waits for the callback of the frame
// after it, then for a task. A hidden page paints no frame, so there `run`
// runs at once, or when the page is hidden.
export function afterNextPaint(run: () => void): void {
	let done = false;
	const once = () => {
		if (done) {
			return;
		}
		done = true;
		document.removeEventListener("visibilitychange", onHidden);
		run();
	};
	const onHidden = () => {
		if (document.visibilityState === "hidden") {
			once();
		}
	};
	if (document.visibilityState === "hidden") {
		once();
		return;
	}
	document.addEventListener("visibilitychange", onHidden);
	requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(once, 0)));
}

// The remote, with each public read held until the browser paints the frame
// after the first public read. The app asks for its reads as it hydrates, so
// the page first paints what it shows without them (the How-to, the stored
// lists), and only then starts the requests.
export function readsAfterNextPaint(remote: Remote): Remote {
	let painted: Promise<void> | undefined;
	const wait = () => {
		painted ??= new Promise((resolve) => afterNextPaint(resolve));
		return painted;
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
