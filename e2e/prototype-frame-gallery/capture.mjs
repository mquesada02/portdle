// PROTOTYPE — throwaway (ticket "Prototype: frame gallery", #217). Not part of
// the e2e suite. Captures frozen frames of two interactions with stubbed data
// and writes them plus a manifest for gallery.html.
// Run: pnpm proto:gallery   (builds dist-proto, serves it, captures, writes out/)

import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const OUT = join(HERE, "out");
const STUB = "http://stub.test";
const PORT = 4180;
const TODAY = "2026-10-10";

// --- fixtures: the old bundle catalog mapped to catalog_entries rows ---
const toRow = (kind) => (e) => ({
	id: e.id,
	kind,
	name: e.name,
	aliases: e.aliases ?? [],
	port: e.port,
	transport: e.transport,
	description: e.description,
	blurb: e.blurb ?? null,
	answer_eligible: e.answerEligible,
	retired: e.retired ?? false,
	sources: e.sources ?? [],
});
const fx = (f) => JSON.parse(readFileSync(join(ROOT, "src/test/fixtures", f), "utf8"));
const catalog = [
	...fx("protocols.json").map(toRow("protocol")),
	...fx("applications.json").map(toRow("application")),
];
const appId = catalog.find((r) => r.kind === "application" && r.answer_eligible).id;
const dailies = { mixed: "ssh", protocols: "ftp", applications: appId };
const current = Object.entries(dailies).map(([category, entry_id]) => ({
	server_time: `${TODAY}T12:00:00Z`,
	utc_date: TODAY,
	category,
	entry_id,
}));
const schedule = Object.entries(dailies).map(([category, entry_id]) => ({
	category,
	day: TODAY,
	entry_id,
}));

async function stubNetwork(page, unstubbed) {
	await page.route("**/*", (route) => {
		const url = new URL(route.request().url());
		if (url.origin === `http://127.0.0.1:${PORT}`) return route.continue();
		if (url.origin !== STUB) {
			unstubbed.push(url.href);
			return route.abort();
		}
		const json = (body) =>
			route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
		const p = url.pathname;
		if (p === "/rest/v1/rpc/current_dailies") return json(current);
		if (p === "/rest/v1/catalog_entries")
			return json(url.searchParams.get("offset") === "0" ? catalog : []);
		if (p === "/rest/v1/schedule")
			return json(url.searchParams.get("offset") === "0" ? schedule : []);
		if (p === "/rest/v1/daily_global_stats") return json([]);
		unstubbed.push(url.href);
		return route.abort();
	});
}

// Seeded Math.random and the stored How-to flag and theme, before any script.
function initScript(theme) {
	return `
		(() => {
			let s = 42;
			Math.random = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
			localStorage.setItem("portdle:v1:howToSeen", "true");
			localStorage.setItem("portdle:v1:theme", JSON.stringify("${theme}"));
		})();`;
}

// In the page: wait (setTimeout polling, not rAF) until running animations
// exist, then pause them all. Returns their names and longest end time.
const PAUSE_WHEN_STARTED = (target) =>
	new Promise((resolve) => {
		const t0 = performance.now();
		const isTarget = (a) =>
			target === "view-transition"
				? (a.effect?.pseudoElement ?? "").startsWith("::view-transition")
				: a.animationName === target;
		const tick = () => {
			const all = document.getAnimations().filter((a) => a.playState !== "finished");
			const anims = all.filter((a) => a.animationName || (a.effect?.pseudoElement ?? "").startsWith("::view-transition"));
			if (anims.some(isTarget)) {
				for (const a of anims) a.pause();
				resolve({
					names: anims.map((a) => `${a.animationName}${a.effect?.pseudoElement ?? ""}`),
					end: Math.max(...anims.map((a) => a.effect.getComputedTiming().endTime)),
					latency: Math.round(performance.now() - t0),
				});
			} else if (performance.now() - t0 > 2000) resolve({ names: [], end: 0, latency: -1 });
			else setTimeout(tick, 0);
		};
		tick();
	});

const INTERACTIONS = [
	{
		id: "daily-guess",
		label: "Daily: a missed guess (tile pop)",
		path: "/portdle/",
		target: "pop",
		times: [0, 25, 50, 75, 100, 150, 200, 300],
		async ready(page) {
			await page.getByLabel("Digit 1 of 2").click();
			await page.keyboard.type("80");
		},
		async act(page) {
			await page.getByRole("button", { name: "Submit" }).click({ noWaitAfter: true });
		},
	},
	{
		id: "screen-change",
		label: "Screen change: Daily to History (view transition)",
		path: "/portdle/",
		target: "view-transition",
		times: [0, 25, 50, 75, 100, 150],
		async ready(page) {
			await page.getByRole("link", { name: "History" }).waitFor();
		},
		async act(page) {
			await page.getByRole("link", { name: "History" }).click({ noWaitAfter: true });
		},
	},
];

const CONFIGS = [
	{ width: 375, height: 812, theme: "light" },
	{ width: 375, height: 812, theme: "dark" },
	{ width: 1024, height: 768, theme: "light" },
	{ width: 1024, height: 768, theme: "dark" },
];

execFileSync("pnpm", ["exec", "vite", "build", "--outDir", "dist-proto", "--emptyOutDir"], {
	cwd: ROOT,
	stdio: "inherit",
	env: { ...process.env, VITE_SUPABASE_URL: STUB, VITE_SUPABASE_ANON_KEY: "stub" },
});
const server = spawn(
	"pnpm",
	["exec", "vite", "preview", "--outDir", "dist-proto", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"],
	{ cwd: ROOT, stdio: "ignore" },
);
await new Promise((r) => setTimeout(r, 2500));

const browser = await chromium.launch();
const manifest = { today: TODAY, interactions: [] };
try {
	for (const it of INTERACTIONS) {
		const entry = { id: it.id, label: it.label, times: it.times, configs: [] };
		for (const c of CONFIGS) {
			const context = await browser.newContext({
				viewport: { width: c.width, height: c.height },
				colorScheme: c.theme,
			});
			const page = await context.newPage();
			const unstubbed = [];
			await stubNetwork(page, unstubbed);
			await page.addInitScript(initScript(c.theme));
			await page.goto(`http://127.0.0.1:${PORT}${it.path}`);
			await it.ready(page);
			const dir = join(OUT, it.id);
			mkdirSync(dir, { recursive: true });
			await page.mouse.move(0, 0);
			await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
			const before = `${c.width}-${c.theme}-before.png`;
			await page.screenshot({ path: join(dir, before) });
			const paused = page.evaluate(PAUSE_WHEN_STARTED, it.target);
			await it.act(page);
			const info = await paused;
			const frames = [];
			for (const t of it.times) {
				await page.evaluate((ms) => {
					for (const a of document.getAnimations())
						if (a.playState === "paused") a.currentTime = ms;
				}, t);
				const file = `${c.width}-${c.theme}-${t}.png`;
				await page.screenshot({ path: join(dir, file), animations: "allow" });
				frames.push({ t, file });
			}
			await page.evaluate(() => {
				for (const a of document.getAnimations()) a.finish();
			});
			await page.waitForTimeout(100);
			const after = `${c.width}-${c.theme}-after.png`;
			await page.screenshot({ path: join(dir, after) });
			entry.configs.push({ ...c, before, after, frames, animations: info, unstubbed });
			console.log(it.id, c.width, c.theme, JSON.stringify(info), unstubbed.length ? unstubbed : "");
			await context.close();
		}
		manifest.interactions.push(entry);
	}
} finally {
	await browser.close();
	server.kill();
}
writeFileSync(join(OUT, "manifest.js"), `window.MANIFEST = ${JSON.stringify(manifest, null, 2)};\n`);
console.log(`Open ${join(HERE, "gallery.html")}`);
