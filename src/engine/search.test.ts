import { expect, test } from "vitest";
import { buildSearchIndex, searchNames } from "./search";
import { chargen, http, telnet } from "./test-fixtures";
import type { CatalogEntry } from "./types";

const https: CatalogEntry = {
	id: "https",
	name: "HTTPS",
	aliases: ["ssl"],
	port: 443,
	transport: "tcp",
	description: "HTTP over TLS",
	answerEligible: true,
};

test("search prefix name and alias not description or blurb", () => {
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
	expect(searchNames(idx, "HTTPS").map((hit) => hit.id)).toEqual(["https"]);
});

test("alias hit shows canonical name", () => {
	const idx = buildSearchIndex([https]);
	expect(searchNames(idx, "ssl")).toEqual([{ id: "https", name: "HTTPS" }]);
});

test("name-prefix ranks before alias-prefix then localeCompare", () => {
	const other: CatalogEntry = {
		id: "other",
		name: "Other",
		aliases: ["htfoo"],
		port: 1,
		transport: "tcp",
		description: "x",
		answerEligible: true,
	};
	const idx = buildSearchIndex([other, https, http]);
	expect(searchNames(idx, "ht").map((hit) => hit.id)).toEqual([
		"http",
		"https",
		"other",
	]);
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
