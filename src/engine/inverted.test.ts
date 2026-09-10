import { expect, test } from "vitest";
import { evaluateInvertedGuess } from "./inverted";
import { http, jenkins, tomcat } from "./test-fixtures";
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
test("inverted correct is the target id", () => {
	expect(
		evaluateInvertedGuess({
			id: "https",
			answer: https,
			previousIds: [],
			catalog: [https, http],
		}),
	).toEqual({ status: "correct", id: "https" });
});

test("inverted miss other port identifies the picked row", () => {
	expect(
		evaluateInvertedGuess({
			id: "http",
			answer: https,
			previousIds: [],
			catalog: [https, http],
		}),
	).toEqual({
		status: "miss",
		id: "http",
		identified: { id: "http", name: "HTTP", port: 80 },
		samePort: false,
	});
});

test("inverted miss same port sets samePort", () => {
	expect(
		evaluateInvertedGuess({
			id: "tomcat",
			answer: jenkins,
			previousIds: [],
			catalog: [jenkins, tomcat],
		}),
	).toEqual({
		status: "miss",
		id: "tomcat",
		identified: { id: "tomcat", name: "Tomcat", port: 8080 },
		samePort: true,
	});
});

test("inverted duplicate id spends no life at the guess seam", () => {
	expect(
		evaluateInvertedGuess({
			id: "http",
			answer: https,
			previousIds: ["http"],
			catalog: [https, http],
		}),
	).toEqual({ status: "duplicate" });
});

test("alias is not compared only id is", () => {
	expect(
		evaluateInvertedGuess({
			id: "https",
			answer: https,
			previousIds: [],
			catalog: [https, http],
		}),
	).toEqual({ status: "correct", id: "https" });
});
