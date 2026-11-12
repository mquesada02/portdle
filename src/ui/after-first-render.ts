import { useLayoutEffect, useState } from "react";

// Runs once, after the first render and before the browser paints it. The
// first render of the app reads no stored state, so the markup of a route is
// the same for every player (the prerendered frame and the client's first
// render match); state read here applies before the player sees a frame.
export function useAfterFirstRenderEffect(effect: () => void): void {
	// biome-ignore lint/correctness/useExhaustiveDependencies: run once, after the first render.
	useLayoutEffect(effect, []);
}

// A value that is `neutral` in the first render and the result of `read` from
// then on. The setter replaces it, as `useState`'s does.
export function useAfterFirstRender<T>(
	read: () => T,
	neutral: T,
): [T, (value: T) => void] {
	const [value, setValue] = useState(neutral);
	useAfterFirstRenderEffect(() => setValue(read()));
	return [value, setValue];
}
