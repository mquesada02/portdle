import { expect, test } from "vitest";
import {
	answerPool,
	catalogFor,
	invertedBlurb,
	isCrowdedPort,
	validateCatalog,
} from "./catalog";
import { chargen, http, jenkins, telnet, tomcat, vite } from "./test-fixtures";

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

test("validateCatalog accepts a valid source", () => {
	expect(
		validateCatalog([
			{ ...http, sources: [{ label: "RFC 9110", url: "https://example.com" }] },
		]),
	).toEqual([]);
});

test("validateCatalog flags a source with an empty label", () => {
	expect(
		validateCatalog([
			{ ...http, sources: [{ label: "", url: "https://example.com" }] },
		]),
	).toEqual([{ kind: "invalid-source", id: "http" }]);
});

test("validateCatalog flags a source with a non-https URL", () => {
	expect(
		validateCatalog([
			{ ...http, sources: [{ label: "RFC 9110", url: "http://example.com" }] },
		]),
	).toEqual([{ kind: "invalid-source", id: "http" }]);
});

test("crowded non-retired ports need blurbs that do not leak name", () => {
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

test("crowded non-retired ports are crowded and unique ports are not", () => {
	expect(isCrowdedPort([jenkins, tomcat], 8080)).toBe(true);
	expect(isCrowdedPort([http, vite], 80)).toBe(false);
	expect(isCrowdedPort([http, { ...telnet, port: 80 }], 80)).toBe(false);
	expect(isCrowdedPort([http], 80)).toBe(false);
});

test("mixed union is crowded when each kind has one occupant", () => {
	expect(isCrowdedPort([http, { ...vite, port: 80 }], 80)).toBe(true);
	expect(isCrowdedPort([http], 80)).toBe(false);
});

test("invertedBlurb is that entry's blurb when crowded else null", () => {
	expect(invertedBlurb(jenkins, [jenkins, tomcat])).toBe("CI server");
	expect(invertedBlurb(tomcat, [jenkins, tomcat])).toBe(
		"Java servlet container",
	);
	expect(invertedBlurb(http, [http, vite])).toBeNull();
});
