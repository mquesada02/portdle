import { StrictMode } from "react";
import { stopEarlyTapCapture } from "./early-tap";
import { SWITCH_OVER_DAY } from "./engine/switch-over";
import { isPrerendered, mount } from "./mount";
import { createPersist } from "./persist/storage";
import { remoteFromEnv } from "./remote/from-env";
import { readsAfterNextPaint } from "./remote/reads-after-paint";
import { App, prepareApp } from "./ui/app";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
	throw new Error("Missing #root");
}

const persist = createPersist(window.localStorage);
// Runs before the first render, so no screen mounts on a record the step
// changes or removes. It is idempotent; a failed write retries at next start.
persist.applySwitchOver(SWITCH_OVER_DAY);

const remote = remoteFromEnv();
const prepared = prepareApp({
	persist,
	remote: remote && readsAfterNextPaint(remote),
});
// The prerender ran the router in its server mode, which renders no Suspense
// boundary around the page. The router's `ssr` field tells the client mode to
// render the same tree, so the first client render matches the markup.
if (isPrerendered(root)) {
	prepared.router.ssr = { manifest: undefined };
}
// An unloaded router has no matches, so its first render would not match the
// prerendered markup.
await prepared.router.load();

stopEarlyTapCapture();
mount(
	root,
	<StrictMode>
		<App prepared={prepared} />
	</StrictMode>,
);
