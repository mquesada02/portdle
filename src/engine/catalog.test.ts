import { expect, test } from "vitest";
import { answerPool, catalogFor, validateCatalog } from "./catalog";
import { chargen, http, telnet, vite } from "./test-fixtures";
import type { CatalogEntry } from "./types";

test("catalogFor mixed unions protocols then applications", () => {
	expect(catalogFor("mixed", [http], [vite]).map((entry) => entry.id)).toEqual([
		"http",
		"vite",
	]);
});

test("catalogFor protocols and applications are the source arrays", () => {
	expect(catalogFor("protocols", [http], [vite])).toEqual([http]);
	expect(catalogFor("applications", [http], [vite])).toEqual([vite]);
});

test("answerPool drops miss-only and retired", () => {
	expect(
		answerPool([http, chargen, telnet, vite]).map((entry) => entry.id),
	).toEqual(["http", "vite"]);
});

test("validateCatalog flags duplicate id", () => {
	expect(validateCatalog([http, { ...vite, id: "http" }])).toEqual([
		{ kind: "duplicate-id", id: "http" },
	]);
});

test("validateCatalog flags duplicate name case-insensitively", () => {
	expect(validateCatalog([http, { ...vite, name: "http" }])).toEqual([
		{ kind: "duplicate-name", name: "http" },
	]);
});

test("validateCatalog flags port outside 0-65535", () => {
	expect(validateCatalog([{ ...http, port: -1 }])).toEqual([
		{ kind: "invalid-port", id: "http" },
	]);
	expect(validateCatalog([{ ...http, port: 65536 }])).toEqual([
		{ kind: "invalid-port", id: "http" },
	]);
});

test("crowded non-retired ports need blurbs that do not leak name", () => {
	const jenkins: CatalogEntry = {
		id: "jenkins",
		name: "Jenkins",
		port: 8080,
		transport: "tcp",
		description: "CI.",
		blurb: "CI server",
		answerEligible: true,
	};
	const tomcat: CatalogEntry = {
		id: "tomcat",
		name: "Tomcat",
		port: 8080,
		transport: "tcp",
		description: "Servlet.",
		blurb: "Java servlet container",
		answerEligible: true,
	};
	expect(validateCatalog([jenkins, tomcat])).toEqual([]);
	expect(
		validateCatalog([jenkins, { ...tomcat, blurb: undefined }]).some(
			(issue) => issue.kind === "missing-blurb" && issue.id === "tomcat",
		),
	).toBe(true);
	expect(
		validateCatalog([jenkins, { ...tomcat, blurb: "Tomcat container" }]).some(
			(issue) => issue.kind === "blurb-leaks-name" && issue.id === "tomcat",
		),
	).toBe(true);
	expect(
		validateCatalog([
			{ ...jenkins, aliases: ["ci"] },
			{ ...tomcat, blurb: "CI server" },
		]).some(
			(issue) => issue.kind === "blurb-leaks-name" && issue.id === "jenkins",
		),
	).toBe(true);
});

test("unique ports need no blurb", () => {
	expect(validateCatalog([http, vite])).toEqual([]);
});
