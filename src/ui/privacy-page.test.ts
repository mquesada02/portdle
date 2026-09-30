import { afterEach, expect, test } from "vitest";
import html from "../../public/privacy.html?raw";
import { stubMatchMedia } from "../test/helpers";

const page = new DOMParser().parseFromString(html, "text/html");
const text = page.body.textContent?.replace(/\s+/g, " ") ?? "";

const themeScript = page.querySelector("script:not([src])")?.textContent ?? "";

function pageThemeKey(): string {
	return /getItem\("([^"]+)"\)/.exec(themeScript)?.[1] ?? "";
}

function runThemeScript(stored: string | null, prefersDark: boolean) {
	stubMatchMedia(prefersDark, false);
	localStorage.clear();
	if (stored !== null) {
		localStorage.setItem(pageThemeKey(), stored);
	}
	document.documentElement.className = "";
	new Function(themeScript)();
	return document.documentElement.classList.contains("dark");
}

afterEach(() => {
	localStorage.clear();
	document.documentElement.className = "";
});

test("page is English, mobile-ready, and self-contained", () => {
	expect(page.documentElement.lang).toBe("en");
	expect(page.querySelector('meta[name="viewport"]')).toBeTruthy();
	expect(page.querySelector("script[src]")).toBeNull();
	expect(page.querySelector('link[rel="stylesheet"]')).toBeNull();
});

test("page links back to the game and shows the contact email", () => {
	expect(page.querySelector('a[href="./"]')).toBeTruthy();
	expect(
		page.querySelector('a[href="mailto:mquesada@itba.edu.ar"]'),
	).toBeTruthy();
	expect(text).toContain("Email mquesada@itba.edu.ar.");
	for (const link of page.querySelectorAll("a[href]")) {
		expect(link.getAttribute("href")).not.toContain("github.com/mquesada02");
	}
});

test("page shows a last updated date", () => {
	expect(page.querySelector('time[datetime="2026-09-30"]')).toBeTruthy();
	expect(text).toContain("Last updated: September 30, 2026");
});

test("page states what Portdle stores and who can see it", () => {
	expect(text).toContain("Signing in is optional");
	expect(text).toContain("only in your browser");
	expect(text).toContain("Google or GitHub");
	expect(text).toContain("only to sign you in and to link");
	expect(text).toContain("never shown");
	expect(text).toContain("Portdle also stores a display name. It is public.");
	expect(text).toContain(
		"Codex, Blitz Bests, Blitz runs, Dailies, and preferences",
	);
	expect(text).toContain("Other players cannot see them");
	expect(text).toContain("display name, score, time to score, and rank");
	expect(text).toContain("Supabase");
	expect(text).toContain("São Paulo");
	expect(text).toContain("no ads, no tracking, and no selling of data");
});

test("page explains how to delete data", () => {
	expect(text).toContain("Delete account");
	expect(text).toContain("leaderboard rows");
	expect(text).toContain("clear the site's data");
});

test("theme script reads the app's stored theme key", () => {
	expect(pageThemeKey()).toBe("portdle:v1:theme");
});

test("theme script follows a stored dark theme", () => {
	expect(runThemeScript('"dark"', false)).toBe(true);
});

test("theme script keeps a stored light theme on a dark system", () => {
	expect(runThemeScript('"light"', true)).toBe(false);
});

test("theme script follows the system when the theme is system or absent", () => {
	expect(runThemeScript('"system"', true)).toBe(true);
	expect(runThemeScript(null, true)).toBe(true);
	expect(runThemeScript(null, false)).toBe(false);
});

test("theme script falls back to the system when the stored value is unreadable", () => {
	expect(runThemeScript("not json", true)).toBe(true);
});
