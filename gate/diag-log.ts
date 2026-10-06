// DIAG #249 round 2, branch diag/249 only. Logs the state of every nav link
// at the view-transition start, at its events, and before each frame. The log
// goes to diag-logs/<tag>-<project>.json (DIAG_TAG names the run).
import { mkdirSync, writeFileSync } from "node:fs";
import type { Page, TestInfo } from "@playwright/test";

export async function installNavLog(page: Page): Promise<void> {
	await page.evaluate(() => {
		const w = window as unknown as {
			__log: unknown[];
			__snap: (label: string) => void;
		};
		w.__log = [];
		const links = () => Array.from(document.querySelectorAll("nav a"));
		const stateOf = (el: Element) => {
			const cs = getComputedStyle(el);
			return {
				t: (el.textContent ?? "").slice(0, 8),
				cur: el.getAttribute("aria-current"),
				color: cs.color,
				bg: cs.backgroundColor,
				hover: el.matches(":hover"),
				fv: el.matches(":focus-visible"),
				anims: el.getAnimations().map((a) => [
					(a as CSSTransition).transitionProperty,
					a.playState,
					Math.round(Number(a.currentTime) * 10) / 10,
					a.playbackRate,
				]),
			};
		};
		w.__snap = (label) =>
			w.__log.push({ label, now: Date.now(), links: links().map(stateOf) });
		new MutationObserver((records) => {
			for (const r of records) {
				w.__log.push({
					label: "mutation",
					now: Date.now(),
					t: ((r.target as Element).textContent ?? "").slice(0, 8),
					attr: r.attributeName,
				});
			}
		}).observe(document.querySelector("nav") as Element, {
			attributes: true,
			subtree: true,
		});
		const start = document.startViewTransition.bind(document);
		document.startViewTransition = (...args: Parameters<typeof start>) => {
			w.__snap("vt-start");
			const vt = start(...args);
			vt.updateCallbackDone.then(() => w.__snap("cb-done"), () => {});
			vt.ready.then(() => w.__snap("vt-ready"), () => {});
			return vt;
		};
		for (const type of [
			"transitionrun",
			"transitionstart",
			"transitionend",
			"transitioncancel",
		]) {
			document.addEventListener(
				type,
				(event) => {
					const e = event as TransitionEvent;
					const el = e.target as Element;
					if (!el.closest?.("nav")) {
						return;
					}
					const anims = el
						.getAnimations()
						.filter(
							(a) => (a as CSSTransition).transitionProperty === e.propertyName,
						);
					w.__log.push({
						label: type,
						now: Date.now(),
						t: (el.textContent ?? "").slice(0, 8),
						prop: e.propertyName,
						anims: anims.map((a) => [a.playState, a.currentTime]),
					});
				},
				true,
			);
		}
	});
}

export async function dumpNavLog(
	page: Page,
	testInfo: TestInfo,
): Promise<void> {
	const log = await page
		.evaluate(() => (window as unknown as { __log: unknown[] }).__log)
		.catch(() => []);
	mkdirSync("diag-logs", { recursive: true });
	writeFileSync(
		`diag-logs/${process.env.DIAG_TAG ?? "x"}-${testInfo.project.name}.json`,
		JSON.stringify(log),
	);
}
