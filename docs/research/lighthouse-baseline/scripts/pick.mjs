// Copies the median-performance run of each page audit to <out>/<id>.json.
// Usage: node pick.mjs <runsDir> <outDir>
import fs from "node:fs";
import path from "node:path";

const [dir, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const groups = new Map();
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
	const id = f.replace(/-run\d+\.json$/, "");
	const score = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).categories.performance.score;
	if (!groups.has(id)) groups.set(id, []);
	groups.get(id).push([score, f]);
}
for (const [id, runs] of groups) {
	runs.sort((a, b) => a[0] - b[0]);
	const [, f] = runs[Math.floor(runs.length / 2)];
	fs.copyFileSync(path.join(dir, f), path.join(out, `${id}.json`));
}
console.log(groups.size);
