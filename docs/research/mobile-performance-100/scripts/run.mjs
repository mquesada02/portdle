// Baseline of the Spec 7 page set on the live site (ticket #270).
// One Chrome and one Lighthouse run at a time. Usage: node run.mjs <outDir> <runs> [page name]
import fs from "node:fs";
import path from "node:path";
import * as chromeLauncher from "chrome-launcher";
import lighthouse, { desktopConfig } from "lighthouse";
import puppeteer from "puppeteer-core";

const [outDir, runsArg, filter] = process.argv.slice(2);
const RUNS = Number(runsArg ?? 3);
const ORIGIN = process.env.LH_ORIGIN ?? "https://mquesada02.github.io";
const BASE = `${ORIGIN}/portdle`;
const BOARD = "/archive/mixed/2026-11-01";

const PAGES = [
	["daily-mixed", "/"],
	["daily-protocols", "/protocols"],
	["daily-applications", "/applications"],
	["archive", "/archive"],
	["board", BOARD],
	["blitz", "/blitz"],
	["history", "/history"],
	["history-blitz", "/history/blitz"],
	["codex", "/codex"],
	["privacy", "/privacy.html"],
];
const RETURNING = new Set(["archive", "board", "history", "history-blitz"]);

// Returning player: 30 days (2026-10-12 to 2026-11-10) of Dailies in all three
// categories, mixed results, 20 Blitz runs, How-to seen. Shapes mirror
// src/persist/storage.ts as used by gate/state.ts and gate/seed.ts.
function returningSeed() {
	const out = { "portdle:v1:howToSeen": "true" };
	const cats = ["mixed", "protocols", "applications"];
	const start = Date.UTC(2026, 9, 12);
	for (let d = 0; d < 30; d++) {
		const date = new Date(start + d * 86400000).toISOString().slice(0, 10);
		cats.forEach((category, c) => {
			const won = (d + c) % 4 !== 0;
			const misses = (d + c) % 5;
			const guesses = [];
			for (let m = 0; m < (won ? misses : 6); m++) {
				guesses.push({ port: 1000 + m * 7 + d, result: "miss", identified: null });
			}
			if (won) guesses.push({ port: 22, result: "correct", identified: null });
			out[`portdle:v1:daily:${category}:${date}`] = JSON.stringify({
				status: won ? "won" : "lost",
				guesses,
				late: false,
			});
		});
	}
	const runs = [];
	for (let r = 0; r < 20; r++) {
		runs.push({
			category: cats[r % 3],
			orientation: "default",
			mode: r % 2 ? "survival" : "sprint",
			ended: "timeout",
			endedAt: new Date(start + r * 3600000 * 30).toISOString(),
			score: 2,
			rounds: [
				{ id: "ssh", name: "SSH", port: 22, outcome: "correct", wrong: null },
				{ id: "http", name: "HTTP", port: 80, outcome: "miss", wrong: { kind: "typed", port: 81, owner: null } },
				{ id: "dns", name: "DNS", port: 53, outcome: "correct", wrong: null },
			],
		});
	}
	out["portdle:v1:blitzRuns"] = JSON.stringify(runs);
	out["portdle:v1:blitzBests"] = JSON.stringify({
		"mixed|default|sprint": { score: 2 },
		"protocols|default|survival": { score: 2 },
	});
	return out;
}

async function seed(port) {
	const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
	const page = await browser.newPage();
	await page.goto(`${BASE}/privacy.html`, { waitUntil: "load" });
	await page.evaluate((entries) => {
		localStorage.clear();
		for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
	}, returningSeed());
	await page.close();
	browser.disconnect();
}

const jobs = [];
for (const [name, route] of PAGES) {
	const states = RETURNING.has(name) ? ["first", "returning"] : ["first"];
	for (const state of states)
		for (const ff of ["mobile", "desktop"]) if (!process.env.LH_FF || process.env.LH_FF === ff) jobs.push({ name, route, state, ff });
}
fs.mkdirSync(outDir, { recursive: true });
const summary = [];
for (const job of jobs) {
	const id = `${job.name}-${job.state}-${job.ff}`;
	if (filter && job.name !== filter) continue;
	for (let run = 1; run <= RUNS; run++) {
		const file = path.join(outDir, `${id}-run${run}.json`);
		if (fs.existsSync(file)) continue;
		const chrome = await chromeLauncher.launch({
			chromePath: "/usr/bin/google-chrome",
			chromeFlags: ["--headless=new", "--no-first-run"],
		});
		try {
			if (job.state === "returning") await seed(chrome.port);
			const config = job.ff === "desktop" ? desktopConfig : undefined;
			const result = await lighthouse(
				`${BASE}${job.route}`,
				{ port: chrome.port, output: "json", logLevel: "error", disableStorageReset: job.state === "returning" },
				config,
			);
			fs.writeFileSync(file, result.report);
			const c = result.lhr.categories;
			const line = `${id} run${run} perf=${Math.round(c.performance.score * 100)} a11y=${Math.round(c.accessibility.score * 100)} bp=${Math.round(c["best-practices"].score * 100)} seo=${Math.round(c.seo.score * 100)} status=${result.lhr.audits["http-status-code"]?.score}`;
			console.log(line);
			summary.push(line);
		} catch (e) {
			console.log(`${id} run${run} ERROR ${e.message}`);
		} finally {
			await chrome.kill();
		}
	}
}
