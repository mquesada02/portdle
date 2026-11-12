// Spread of Lighthouse category scores over workflow attempts.
// Layout: <root>/<attempt>/<artifact>/<id>-runN.json. Usage: node spread.mjs <root>
// Per page audit and category: single runs (min, max, SD), median-of-3 (runs
// 1-3 of each attempt) and median-of-5 (all 5 runs of an attempt) across
// attempts, plus the runner benchmarkIndex range.
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2];
const CATS = [["performance", "Perf"], ["accessibility", "A11y"], ["best-practices", "BP"], ["seo", "SEO"]];
const data = new Map(); // id -> attempt -> [{run, scores, bench}]
function walk(dir, attempt) {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) walk(p, attempt ?? e.name);
		else if (e.name.endsWith(".json")) {
			const m = e.name.match(/^(.*)-run(\d+)\.json$/);
			const r = JSON.parse(fs.readFileSync(p, "utf8"));
			if (r.runtimeError) continue;
			const scores = Object.fromEntries(CATS.map(([c]) => [c, Math.round(r.categories[c].score * 100)]));
			const id = m[1];
			if (!data.has(id)) data.set(id, new Map());
			const a = data.get(id);
			if (!a.has(attempt)) a.set(attempt, []);
			a.get(attempt).push({ run: Number(m[2]), scores, bench: r.environment.benchmarkIndex });
		}
	}
}
walk(root);
const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const sd = (xs) => {
	const m = xs.reduce((s, x) => s + x, 0) / xs.length;
	return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
};
const fmt = (xs) => (xs.length ? `${Math.min(...xs)}–${Math.max(...xs)} (SD ${sd(xs).toFixed(1)})` : "-");
const attempts = new Set();
for (const a of data.values()) for (const k of a.keys()) attempts.add(k);
console.log(`Attempts: ${[...attempts].sort().join(", ")}\n`);
for (const [c, label] of CATS) {
	console.log(`### ${label}\n`);
	console.log("| Page audit | single runs | median-of-3 | median-of-5 |");
	console.log("|---|---|---|---|");
	for (const [id, byAttempt] of [...data].sort()) {
		const single = [];
		const m3 = [];
		const m5 = [];
		for (const runs of byAttempt.values()) {
			runs.sort((x, y) => x.run - y.run);
			const xs = runs.map((r) => r.scores[c]);
			single.push(...xs);
			if (xs.length >= 3) m3.push(med(xs.slice(0, 3)));
			if (xs.length >= 5) m5.push(med(xs));
		}
		if (Math.min(...single) === 100 && Math.max(...single) === 100) continue;
		console.log(`| ${id} | ${fmt(single)} | ${fmt(m3)} | ${fmt(m5)} |`);
	}
	console.log("");
}
const benches = [];
for (const a of data.values()) for (const runs of a.values()) for (const r of runs) benches.push(r.bench);
console.log(`benchmarkIndex over all runs: ${Math.min(...benches)}–${Math.max(...benches)} (median ${med(benches)})`);
console.log("Rows where every single run scored 100 are left out.");
