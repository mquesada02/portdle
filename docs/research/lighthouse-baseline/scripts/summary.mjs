// Summarizes a folder of Lighthouse JSON runs: per page audit, the median and
// range of each category, the median metrics, and the failed audits.
// Usage: node summary.mjs <dir> > out.md
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2];
const groups = new Map();
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
	const id = f.replace(/-run\d+\.json$/, "");
	const r = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
	if (r.runtimeError) continue;
	if (!groups.has(id)) groups.set(id, []);
	groups.get(id).push(r);
}
const med = (xs) => {
	const s = [...xs].sort((a, b) => a - b);
	return s[Math.floor(s.length / 2)];
};
const CATS = ["performance", "accessibility", "best-practices", "seo"];
const METRICS = [
	["first-contentful-paint", "FCP", 1],
	["largest-contentful-paint", "LCP", 1],
	["total-blocking-time", "TBT", 1],
	["cumulative-layout-shift", "CLS", 1000],
	["speed-index", "SI", 1],
];
console.log("| Page audit | n | Perf | A11y | BP | SEO | FCP ms | LCP ms | TBT ms | CLS ×1000 | SI ms |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|");
const fails = new Map();
for (const [id, runs] of groups) {
	const cats = CATS.map((c) => {
		const xs = runs.map((r) => Math.round(r.categories[c].score * 100));
		const m = med(xs);
		const lo = Math.min(...xs);
		const hi = Math.max(...xs);
		return lo === hi ? `${m}` : `${m} (${lo}–${hi})`;
	});
	const mets = METRICS.map(([k, , f]) => Math.round(med(runs.map((r) => r.audits[k].numericValue)) * f));
	console.log(`| ${id} | ${runs.length} | ${cats.join(" | ")} | ${mets.join(" | ")} |`);
	for (const r of runs) {
		for (const [cid, cat] of Object.entries(r.categories)) {
			for (const ref of cat.auditRefs) {
				const a = r.audits[ref.id];
				if (ref.weight > 0 && a.score !== null && a.score < 0.9 && !["numeric"].includes(a.scoreDisplayMode)) {
					const key = `${cid}: ${ref.id}`;
					if (!fails.has(key)) fails.set(key, new Set());
					fails.get(key).add(id);
				}
			}
		}
	}
}
console.log("\nFailed audits (score < 0.9, weighted, not a metric), with the page audits where at least one run failed:\n");
for (const [k, ids] of [...fails].sort()) console.log(`- ${k}: ${ids.size === groups.size ? "all" : [...ids].join(", ")}`);
