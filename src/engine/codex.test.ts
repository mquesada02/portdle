import { expect, test } from "vitest";
import {
	applyCodexEncounter,
	clearCodexFresh,
	codexCounts,
	codexGroups,
} from "./codex";
import { chargen } from "./test-fixtures";
import type { CatalogEntry, CodexMap } from "./types";

function entry(
	overrides: Partial<CatalogEntry> & { id: string },
): CatalogEntry {
	return {
		name: overrides.id,
		port: 1,
		transport: "tcp",
		description: "d",
		answerEligible: true,
		...overrides,
	};
}

test("identified on an unseen id gives Identified with fresh true", () => {
	const next = applyCodexEncounter({}, { state: "identified", id: "a" });
	expect(next).toEqual({ a: { state: "identified", fresh: true } });
});

test("missed on an unseen id gives Missed with fresh true", () => {
	const next = applyCodexEncounter({}, { state: "missed", id: "a" });
	expect(next).toEqual({ a: { state: "missed", fresh: true } });
});

test("correct on an unseen id gives Correct with fresh true", () => {
	const next = applyCodexEncounter({}, { state: "correct", id: "a" });
	expect(next).toEqual({ a: { state: "correct", fresh: true } });
});

test("missed on Identified gives Missed keeping fresh true", () => {
	const map: CodexMap = { a: { state: "identified", fresh: true } };
	const next = applyCodexEncounter(map, { state: "missed", id: "a" });
	expect(next).toEqual({ a: { state: "missed", fresh: true } });
});

test("missed on Identified gives Missed keeping fresh false", () => {
	const map: CodexMap = { a: { state: "identified", fresh: false } };
	const next = applyCodexEncounter(map, { state: "missed", id: "a" });
	expect(next).toEqual({ a: { state: "missed", fresh: false } });
});

test("correct on Missed gives Correct keeping fresh as it was", () => {
	const map: CodexMap = { a: { state: "missed", fresh: false } };
	const next = applyCodexEncounter(map, { state: "correct", id: "a" });
	expect(next).toEqual({ a: { state: "correct", fresh: false } });
});

test("correct on Identified gives Correct keeping fresh as it was", () => {
	const map: CodexMap = { a: { state: "identified", fresh: true } };
	const next = applyCodexEncounter(map, { state: "correct", id: "a" });
	expect(next).toEqual({ a: { state: "correct", fresh: true } });
});

test("identified on Identified, Missed, or Correct leaves the map unchanged", () => {
	for (const state of ["identified", "missed", "correct"] as const) {
		const map: CodexMap = { a: { state, fresh: false } };
		const next = applyCodexEncounter(map, { state: "identified", id: "a" });
		expect(next).toBe(map);
	}
});

test("missed on Missed or Correct leaves the map unchanged", () => {
	for (const state of ["missed", "correct"] as const) {
		const map: CodexMap = { a: { state, fresh: false } };
		const next = applyCodexEncounter(map, { state: "missed", id: "a" });
		expect(next).toBe(map);
	}
});

test("correct on Correct leaves the map unchanged", () => {
	const map: CodexMap = { a: { state: "correct", fresh: false } };
	const next = applyCodexEncounter(map, { state: "correct", id: "a" });
	expect(next).toBe(map);
});

test("clearCodexFresh clears every fresh flag and leaves state intact", () => {
	const map: CodexMap = {
		a: { state: "correct", fresh: true },
		b: { state: "missed", fresh: false },
		c: { state: "identified", fresh: true },
	};
	expect(clearCodexFresh(map)).toEqual({
		a: { state: "correct", fresh: false },
		b: { state: "missed", fresh: false },
		c: { state: "identified", fresh: false },
	});
});

test("codexCounts reads seen 3 and correct 1 for a map with one of each state", () => {
	const p1 = entry({ id: "p1" });
	const p2 = entry({ id: "p2" });
	const a1 = entry({ id: "a1" });
	const map: CodexMap = {
		p1: { state: "identified", fresh: false },
		p2: { state: "missed", fresh: false },
		a1: { state: "correct", fresh: false },
	};
	const counts = codexCounts({ map, protocols: [p1, p2], applications: [a1] });
	expect(counts.seen).toBe(3);
	expect(counts.correct).toBe(1);
});

test("codexCounts reads Protocols 2 and Applications 1 for two protocol entries and one application entry seen", () => {
	const p1 = entry({ id: "p1" });
	const p2 = entry({ id: "p2" });
	const p3 = entry({ id: "p3" });
	const a1 = entry({ id: "a1" });
	const a2 = entry({ id: "a2" });
	const map: CodexMap = {
		p1: { state: "identified", fresh: false },
		p2: { state: "missed", fresh: false },
		a1: { state: "correct", fresh: false },
	};
	const counts = codexCounts({
		map,
		protocols: [p1, p2, p3],
		applications: [a1, a2],
	});
	expect(counts.byKind.protocol.seen).toBe(2);
	expect(counts.byKind.application.seen).toBe(1);
});

test("codexGroups puts the Protocols group before the Applications group", () => {
	const groups = codexGroups({
		map: {},
		protocols: [entry({ id: "p1" })],
		applications: [entry({ id: "a1" })],
		sort: "name",
	});
	expect(groups.map((group) => group.kind)).toEqual([
		"protocol",
		"application",
	]);
});

test("name sort (case-folded) sorts chargen between BGP and Daytime", () => {
	const bgp = entry({ id: "bgp", name: "BGP", port: 179 });
	const daytime = entry({ id: "daytime", name: "Daytime", port: 13 });
	const map: CodexMap = {
		bgp: { state: "identified", fresh: false },
		daytime: { state: "identified", fresh: false },
		chargen: { state: "identified", fresh: false },
	};
	const groups = codexGroups({
		map,
		protocols: [bgp, daytime, chargen],
		applications: [],
		sort: "name",
	});
	const names = groups[0]?.cards.map((card) => card.entry.name);
	expect(names).toEqual(["BGP", "chargen", "Daytime"]);
});

test("port sort breaks ties by case-folded name", () => {
	const zeta = entry({ id: "zeta", name: "Zeta", port: 500 });
	const alpha = entry({ id: "alpha", name: "alpha", port: 500 });
	const low = entry({ id: "low", name: "Low", port: 100 });
	const map: CodexMap = {
		zeta: { state: "identified", fresh: false },
		alpha: { state: "identified", fresh: false },
		low: { state: "identified", fresh: false },
	};
	const groups = codexGroups({
		map,
		protocols: [zeta, alpha, low],
		applications: [],
		sort: "port",
	});
	const names = groups[0]?.cards.map((card) => card.entry.name);
	expect(names).toEqual(["Low", "alpha", "Zeta"]);
});

test("an unseen entry keeps its original catalog-array index in both the name sort and the port sort", () => {
	const s1 = entry({ id: "s1", name: "Bravo", port: 100 });
	const u1 = entry({ id: "u1", name: "Unseen One", port: 999 });
	const s2 = entry({ id: "s2", name: "Alpha", port: 300 });
	const map: CodexMap = {
		s1: { state: "identified", fresh: false },
		s2: { state: "missed", fresh: false },
	};

	const byName = codexGroups({
		map,
		protocols: [s1, u1, s2],
		applications: [],
		sort: "name",
	});
	expect(byName[0]?.cards.map((card) => card.entry.id)).toEqual([
		"s2",
		"u1",
		"s1",
	]);
	expect(byName[0]?.cards[1]).toEqual({ status: "unseen", entry: u1 });

	const byPort = codexGroups({
		map,
		protocols: [s1, u1, s2],
		applications: [],
		sort: "port",
	});
	expect(byPort[0]?.cards.map((card) => card.entry.id)).toEqual([
		"s1",
		"u1",
		"s2",
	]);
	expect(byPort[0]?.cards[1]).toEqual({ status: "unseen", entry: u1 });
});
