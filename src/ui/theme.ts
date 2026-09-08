import type { Theme } from "../persist/storage";

export type EffectiveTheme = "light" | "dark";

export function effectiveTheme(
	stored: Theme,
	prefersDark: boolean,
): EffectiveTheme {
	if (stored === "light" || stored === "dark") {
		return stored;
	}
	return prefersDark ? "dark" : "light";
}

export function oppositeTheme(current: EffectiveTheme): EffectiveTheme {
	return current === "light" ? "dark" : "light";
}

export function applyHtmlTheme(theme: EffectiveTheme): void {
	document.documentElement.classList.toggle("dark", theme === "dark");
}

export function prefersDarkScheme(): boolean {
	return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
