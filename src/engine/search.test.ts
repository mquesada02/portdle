import { expect, test } from "vitest";
import applicationsJson from "../test/fixtures/applications.json";
import protocolsJson from "../test/fixtures/protocols.json";
import { catalogFor } from "./catalog";
import { buildSearchIndex, searchNames } from "./search";
import { chargen, http, telnet } from "./test-fixtures";
import type { CatalogEntry } from "./types";

const protocols = protocolsJson as CatalogEntry[];
const applications = applicationsJson as CatalogEntry[];
const fixture = catalogFor("mixed", protocols, applications);

const https: CatalogEntry = {
	id: "https",
	name: "HTTPS",
	aliases: ["ssl"],
	port: 443,
	transport: "tcp",
	description: "HTTP over TLS",
	answerEligible: true,
};

test("search matches name and alias by fragment, not description or blurb", () => {
	const idx = buildSearchIndex([https, http]);
	expect(searchNames(idx, "ht").map((hit) => hit.id)).toEqual([
		"http",
		"https",
	]);
	expect(searchNames(idx, "ssl").map((hit) => hit.id)).toEqual(["https"]);
	expect(searchNames(idx, "tls")).toEqual([]);
	expect(searchNames(idx, "HTTP over")).toEqual([]);
	expect(searchNames(idx, "")).toEqual([]);
	expect(searchNames(idx, "   ")).toEqual([]);
	expect(searchNames(idx, "HTTPS").map((hit) => hit.id)).toEqual([
		"https",
		"http",
	]);
});

test("alias hit shows canonical name", () => {
	const idx = buildSearchIndex([https]);
	expect(searchNames(idx, "ssl")).toEqual([{ id: "https", name: "HTTPS" }]);
});

test("search includes miss-only and retired", () => {
	const idx = buildSearchIndex([http, chargen, telnet]);
	expect(searchNames(idx, "cha").map((hit) => hit.id)).toEqual(["chargen"]);
	expect(searchNames(idx, "tel").map((hit) => hit.id)).toEqual(["telnet"]);
});

test("search caps at 20", () => {
	const catalog: CatalogEntry[] = Array.from({ length: 21 }, (_, index) => ({
		id: `n${String(index).padStart(2, "0")}`,
		name: `Name${String(index).padStart(2, "0")}`,
		port: index,
		transport: "tcp",
		description: "x",
		answerEligible: true,
	}));
	expect(searchNames(buildSearchIndex(catalog), "name")).toHaveLength(20);
});

test("fuzzy fragment: sql finds PostgreSQL and MySQL, nothing unrelated", () => {
	const idx = buildSearchIndex(fixture);
	expect(
		searchNames(idx, "sql")
			.map((hit) => hit.id)
			.sort(),
	).toEqual(["mysql", "postgresql"]);
});

test("fuzzy typo: postgers finds PostgreSQL first", () => {
	const idx = buildSearchIndex(fixture);
	const hits = searchNames(idx, "postgers");
	expect(hits[0]?.id).toBe("postgresql");
});

test("alias postgres finds PostgreSQL", () => {
	const idx = buildSearchIndex(fixture);
	expect(searchNames(idx, "postgres").map((hit) => hit.id)).toEqual([
		"postgresql",
	]);
});

test("nonsense query finds nothing", () => {
	const idx = buildSearchIndex(fixture);
	expect(searchNames(idx, "zzzz")).toEqual([]);
});

test("description text never matches", () => {
	const idx = buildSearchIndex([http]);
	expect(searchNames(idx, "Hypertext")).toEqual([]);
	expect(searchNames(idx, "Transfer Protocol")).toEqual([]);
});

test("equally good matches are tie-broken by locale-aware name order", () => {
	const cat: CatalogEntry = {
		id: "cat",
		name: "Cat",
		port: 1,
		transport: "tcp",
		description: "x",
		answerEligible: true,
	};
	const bat: CatalogEntry = {
		id: "bat",
		name: "bat",
		port: 2,
		transport: "tcp",
		description: "x",
		answerEligible: true,
	};
	// "Cat" and "bat" match "at" identically (same length, same position),
	// so the result order depends entirely on the tie-break. Plain code-unit
	// comparison would put "Cat" first (uppercase "C" < lowercase "b"); a
	// locale-aware comparison puts "bat" first, matching "bat".localeCompare(
	// "Cat") < 0.
	const idx = buildSearchIndex([cat, bat]);
	expect(searchNames(idx, "at").map((hit) => hit.id)).toEqual(["bat", "cat"]);
});
