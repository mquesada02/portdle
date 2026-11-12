import { expect, test } from "vitest";
import html from "../../privacy.html?raw";
import { SITE_URL } from "./head";

const page = new DOMParser().parseFromString(html, "text/html");
const text = page.body.textContent?.replace(/\s+/g, " ") ?? "";

test("page is English, mobile-ready, and self-contained", () => {
	expect(page.documentElement.lang).toBe("en");
	expect(page.querySelector('meta[name="viewport"]')).toBeTruthy();
	expect(page.querySelector("script[src]")).toBeNull();
	expect(page.querySelector('link[rel="stylesheet"]')).toBeNull();
});

test("page has a meta description and its canonical link", () => {
	const description = page.querySelector('meta[name="description"]');
	expect(description?.getAttribute("content")?.trim()).toBeTruthy();
	expect(
		page.querySelector('link[rel="canonical"]')?.getAttribute("href"),
	).toBe(`${SITE_URL}/privacy`);
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
	expect(page.querySelector('time[datetime="2026-10-02"]')).toBeTruthy();
	expect(text).toContain("Last updated: October 2, 2026");
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
	expect(text).toContain(
		"Your Daily results also count, without your name, in public per-Daily totals: how many players finished a Daily and how many tries they needed.",
	);
	expect(text).toContain("Supabase");
	expect(text).toContain("São Paulo");
	expect(text).toContain("no ads, no tracking, and no selling of data");
});

test("page explains how to delete data", () => {
	expect(text).toContain("Delete account");
	expect(text).toContain("leaderboard rows");
	expect(text).toContain("clear the site's data");
});
