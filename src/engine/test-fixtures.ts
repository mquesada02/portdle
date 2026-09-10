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

export const jenkins: CatalogEntry = {
	id: "jenkins",
	name: "Jenkins",
	port: 8080,
	transport: "tcp",
	description: "CI.",
	blurb: "CI server",
	answerEligible: true,
};

export const tomcat: CatalogEntry = {
	id: "tomcat",
	name: "Tomcat",
	port: 8080,
	transport: "tcp",
	description: "Servlet.",
	blurb: "Java servlet container",
	answerEligible: true,
};
