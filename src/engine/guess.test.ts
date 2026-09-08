import { expect, test } from "vitest";
import {
	applyCommittedGuess,
	digitLength,
	evaluateDefaultGuess,
} from "./guess";
import type { CatalogEntry } from "./types";

const vite: CatalogEntry = {
	id: "vite",
	name: "Vite",
	port: 5173,
	transport: "tcp",
	description: "Vite default development server.",
	answerEligible: true,
};
const http: CatalogEntry = {
	id: "http",
	name: "HTTP",
	port: 80,
	transport: "tcp",
	description: "Hypertext Transfer Protocol.",
	answerEligible: true,
};
const chargen: CatalogEntry = {
	id: "chargen",
	name: "chargen",
	port: 19,
	transport: "tcp",
	description: "Character generator protocol.",
	answerEligible: false,
};
const telnet: CatalogEntry = {
	id: "telnet",
	name: "Telnet",
	port: 23,
	transport: "tcp",
	description: "Telnet protocol.",
	answerEligible: true,
	retired: true,
};
const ssh: CatalogEntry = {
	id: "ssh",
	name: "SSH",
	port: 80,
	transport: "tcp",
	description: "Secure Shell.",
	answerEligible: true,
};

const catalog = [http, chargen, telnet, vite];

test("digitLength is decimal digits without leading zeros", () => {
	expect(digitLength(80)).toBe(2);
	expect(digitLength(0)).toBe(1);
	expect(digitLength(5173)).toBe(4);
});

test("correct port wins", () => {
	expect(
		evaluateDefaultGuess({
			digits: "5173",
			answer: vite,
			previousPorts: [],
			catalog,
		}),
	).toEqual({ status: "correct", port: 5173 });
});

test("miss in catalog is identified by name", () => {
	expect(
		evaluateDefaultGuess({
			digits: "0080",
			answer: vite,
			previousPorts: [],
			catalog,
		}),
	).toEqual({
		status: "miss",
		port: 80,
		identified: { id: "http", name: "HTTP", port: 80 },
	});
});

test("miss-only chargen still names the miss", () => {
	expect(
		evaluateDefaultGuess({
			digits: "0019",
			answer: vite,
			previousPorts: [],
			catalog,
		}),
	).toEqual({
		status: "miss",
		port: 19,
		identified: { id: "chargen", name: "chargen", port: 19 },
	});
});

test("retired Telnet still names the miss", () => {
	expect(
		evaluateDefaultGuess({
			digits: "0023",
			answer: vite,
			previousPorts: [],
			catalog,
		}),
	).toEqual({
		status: "miss",
		port: 23,
		identified: { id: "telnet", name: "Telnet", port: 23 },
	});
});

test("unknown port is unidentified", () => {
	expect(
		evaluateDefaultGuess({
			digits: "0001",
			answer: vite,
			previousPorts: [],
			catalog,
		}),
	).toEqual({ status: "miss", port: 1, identified: null });
});

test("crowded port uses lexicographically smallest id", () => {
	expect(
		evaluateDefaultGuess({
			digits: "0080",
			answer: vite,
			previousPorts: [],
			catalog: [ssh, http, vite],
		}),
	).toEqual({
		status: "miss",
		port: 80,
		identified: { id: "http", name: "HTTP", port: 80 },
	});
});

test("incomplete empty and non-digits are invalid", () => {
	expect(
		evaluateDefaultGuess({
			digits: "",
			answer: vite,
			previousPorts: [],
			catalog,
		}).status,
	).toBe("invalid");
	expect(
		evaluateDefaultGuess({
			digits: "51",
			answer: vite,
			previousPorts: [],
			catalog,
		}).status,
	).toBe("invalid");
	expect(
		evaluateDefaultGuess({
			digits: "51ab",
			answer: vite,
			previousPorts: [],
			catalog,
		}).status,
	).toBe("invalid");
});

test("integer greater than 65535 is invalid", () => {
	const fiveDigit: CatalogEntry = { ...vite, port: 10000 };
	expect(
		evaluateDefaultGuess({
			digits: "65536",
			answer: fiveDigit,
			previousPorts: [],
			catalog,
		}).status,
	).toBe("invalid");
});

test("duplicate of an earlier integer does not spend a try", () => {
	expect(
		evaluateDefaultGuess({
			digits: "0080",
			answer: vite,
			previousPorts: [80],
			catalog,
		}).status,
	).toBe("duplicate");
});

test("leading zeros collapse to the same integer", () => {
	expect(
		evaluateDefaultGuess({
			digits: "0080",
			answer: vite,
			previousPorts: [],
			catalog,
		}),
	).toMatchObject({ status: "miss", port: 80, identified: { id: "http" } });
});

test("win on try 1 commits won", () => {
	const result = evaluateDefaultGuess({
		digits: "5173",
		answer: vite,
		previousPorts: [],
		catalog,
	});
	expect(applyCommittedGuess(null, result)).toEqual({
		status: "won",
		guesses: [{ port: 5173, result: "correct", identified: null }],
	});
});

test("win on try 6 commits won", () => {
	const misses = [80, 19, 23, 1, 2].map((port) => ({
		port,
		result: "miss" as const,
		identified: null,
	}));
	const current = { status: "playing" as const, guesses: misses };
	const result = evaluateDefaultGuess({
		digits: "5173",
		answer: vite,
		previousPorts: [80, 19, 23, 1, 2],
		catalog,
	});
	const next = applyCommittedGuess(current, result);
	expect(next).toMatchObject({ status: "won" });
	if ("guesses" in next) {
		expect(next.guesses).toHaveLength(6);
	}
});

test("lose on sixth miss commits lost", () => {
	const misses = [80, 19, 23, 1, 2].map((port) => ({
		port,
		result: "miss" as const,
		identified: null,
	}));
	const current = { status: "playing" as const, guesses: misses };
	const result = evaluateDefaultGuess({
		digits: "0003",
		answer: vite,
		previousPorts: [80, 19, 23, 1, 2],
		catalog,
	});
	expect(applyCommittedGuess(current, result)).toMatchObject({
		status: "lost",
		guesses: expect.arrayContaining([
			{ port: 3, result: "miss", identified: null },
		]),
	});
});

test("invalid and duplicate do not produce persist", () => {
	expect(applyCommittedGuess(null, { status: "invalid" })).toEqual({
		status: "invalid",
	});
	expect(applyCommittedGuess(null, { status: "duplicate" })).toEqual({
		status: "duplicate",
	});
});
