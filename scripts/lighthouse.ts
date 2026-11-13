// `pnpm lighthouse:guard [--page <name>] [--out <folder>]`: the Lighthouse
// guard. It builds the site against the stub server (gate fixtures), serves the
// build the way GitHub Pages does, and runs the page audits of
// lighthouse/floors.json on the Lighthouse API: one discarded warm-up run, then
// 3 runs per audit, and the median of each category score. It prints one log
// line per audit and writes the report of every measured run to the out folder
// (default lighthouse-reports). It exits 1 when a median is below its floor or
// a run fails, 0 otherwise.
//
// `--page` runs one page (the CI job of a page). One Chrome and one Lighthouse
// run at a time; a Chrome launch failure is tried again up to 2 more times.
// The audited pages run with "today" at 2026-10-10: the app takes its day from
// the stub's `rpc/current_dailies` answer.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import * as chromeLauncher from "chrome-launcher";
import lighthouse, { desktopConfig } from "lighthouse";
import { STUB_KEY } from "../gate/stub.ts";
import {
	type Audit,
	formatAudit,
	guardExitCode,
	launchWithRetry,
	parseConfig,
	planAudits,
	type RunResult,
	readRun,
	runAudits,
} from "./lighthouse-core.ts";
import { returningSeed } from "./lighthouse-seed.ts";
import { createPagesServer } from "./pages-server.ts";
import { createStubServer, STUB_PORT } from "./stub-server.ts";

const PAGES_PORT = 4176;
const HOST = "127.0.0.1";
const BASE = "/portdle/";
const BUILD_DIR = "dist-lighthouse";
const FLOORS_FILE = join(
	import.meta.dirname,
	"..",
	"lighthouse",
	"floors.json",
);

function option(name: string): string | undefined {
	const at = process.argv.indexOf(name);
	return at === -1 ? undefined : process.argv[at + 1];
}

function listen(server: Server, port: number): Promise<void> {
	return new Promise((done, fail) => {
		server.once("error", fail);
		server.listen(port, HOST, () => done());
	});
}

// No `tsc -b` here: `pnpm typecheck` runs it. The build points the site at the
// stub server, as scripts/gate.ts does for the gate's stub host.
function build(): void {
	execFileSync(
		"pnpm",
		["exec", "vite", "build", "--outDir", resolve(BUILD_DIR), "--emptyOutDir"],
		{
			stdio: "inherit",
			env: {
				...process.env,
				VITE_SUPABASE_URL: `http://${HOST}:${STUB_PORT}`,
				VITE_SUPABASE_ANON_KEY: STUB_KEY,
			},
		},
	);
}

// Writes the returning-player seed into the Chrome at `port`, on the origin
// that Lighthouse audits (`localStorage` is per origin). The privacy page sends
// no backend read.
async function seedStorage(port: number, origin: string): Promise<void> {
	const browser = await chromium.connectOverCDP(`http://${HOST}:${port}`);
	try {
		const context = browser.contexts()[0] ?? (await browser.newContext());
		const page = await context.newPage();
		await page.goto(`${origin}${BASE}privacy.html`, { waitUntil: "load" });
		await page.evaluate((entries) => {
			localStorage.clear();
			for (const [key, value] of Object.entries(entries)) {
				localStorage.setItem(key, value);
			}
		}, returningSeed());
		await page.close();
	} finally {
		await browser.close();
	}
}

async function measure(audit: Audit, origin: string): Promise<RunResult> {
	const chrome = await launchWithRetry(() =>
		chromeLauncher.launch({
			chromeFlags: ["--headless=new", "--no-first-run"],
		}),
	);
	try {
		const returning = audit.state === "returning";
		if (returning) {
			await seedStorage(chrome.port, origin);
		}
		const result = await lighthouse(
			`${origin}${BASE}${audit.page.path.replace(/^\//, "")}`,
			{
				port: chrome.port,
				output: "json",
				logLevel: "error",
				disableStorageReset: returning,
			},
			audit.formFactor === "desktop" ? desktopConfig : undefined,
		);
		if (!result) {
			throw new Error(`Lighthouse returned no result for ${audit.id}.`);
		}
		const report = Array.isArray(result.report)
			? (result.report[0] ?? "")
			: result.report;
		return readRun(audit.id, result.lhr, report);
	} finally {
		await chrome.kill();
	}
}

async function main(): Promise<number> {
	const config = parseConfig(JSON.parse(readFileSync(FLOORS_FILE, "utf8")));
	const plan = planAudits(config.pages, option("--page"));
	const out = resolve(option("--out") ?? "lighthouse-reports");
	mkdirSync(out, { recursive: true });

	build();
	const stubServer = createStubServer();
	const pagesServer = createPagesServer(BUILD_DIR, BASE);
	const servers = [stubServer, pagesServer];
	await listen(stubServer, STUB_PORT);
	await listen(pagesServer, PAGES_PORT);
	const origin = `http://${HOST}:${PAGES_PORT}`;
	try {
		const results = await runAudits(
			plan,
			config.floors,
			(audit) => measure(audit, origin),
			(result) => {
				console.log(formatAudit(result));
				result.runs.forEach((run, index) => {
					writeFileSync(
						join(out, `${result.audit.id}-run${index + 1}.json`),
						run.report,
					);
				});
			},
		);
		return guardExitCode(results);
	} finally {
		for (const server of servers) {
			server.close();
		}
	}
}

try {
	process.exit(await main());
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
