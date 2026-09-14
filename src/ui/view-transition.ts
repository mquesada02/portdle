import { flushSync } from "react-dom";

// Mirrors the two-step gate @tanstack/router-core's own startViewTransition
// applies before it will pass transition types through (verified directly in
// its router.js): the API's presence, then support for the
// :active-view-transition-type() selector. Reproduced here because this
// helper calls the API directly rather than going through the router. The
// reduced-motion check runs first, before either form, which is stricter
// than the router in the band where the API exists but the selector does
// not — harmless there, since the stylesheet's universal reduced-motion rule
// zeroes the view-transition pseudo-elements regardless of type.
export function runViewTransition(types: string[], update: () => void): void {
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		update();
		return;
	}
	if (typeof document.startViewTransition !== "function") {
		update();
		return;
	}
	if (window.CSS.supports("selector(:active-view-transition-type(a))")) {
		document.startViewTransition({
			update: () => flushSync(update),
			types,
		});
	} else {
		document.startViewTransition(() => flushSync(update));
	}
}
