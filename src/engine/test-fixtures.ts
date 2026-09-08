import type { CatalogEntry } from "./types";

export const http: CatalogEntry = {
	id: "http",
	name: "HTTP",
	port: 80,
	transport: "tcp",
	description: "Hypertext Transfer Protocol.",
	answerEligible: true,
};

export const vite: CatalogEntry = {
	id: "vite",
	name: "Vite",
	port: 5173,
	transport: "tcp",
	description: "Vite default development server.",
	answerEligible: true,
};

export const chargen: CatalogEntry = {
	id: "chargen",
	name: "chargen",
	port: 19,
	transport: "tcp",
	description: "Character generator protocol.",
	answerEligible: false,
};

export const telnet: CatalogEntry = {
	id: "telnet",
	name: "Telnet",
	port: 23,
	transport: "tcp",
	description: "Telnet protocol.",
	answerEligible: true,
	retired: true,
};
