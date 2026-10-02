import { expect, test } from "vitest";
import { localConnection } from "./fill-local-schedule.ts";

test("reads a local URL into connection parts, decoding user and password", () => {
	expect(
		localConnection("postgresql://postgres:p%40ss@127.0.0.1:54322/postgres"),
	).toEqual({
		user: "postgres",
		password: "p@ss",
		host: "127.0.0.1",
		port: 54322,
		database: "postgres",
	});
	expect(localConnection("postgresql://u:p@[::1]/db").host).toBe("::1");
	expect(localConnection("postgresql://u:p@localhost/db").port).toBe(5432);
});

test.each([
	["a remote host", "postgresql://u:p@db.example.com:5432/postgres"],
	["a userinfo trick", "postgresql://127.0.0.1:x@db.example.com/postgres"],
	["a multi-host string", "postgresql://localhost,db.example.com/postgres"],
	["a host override", "postgresql://u:p@127.0.0.1/db?host=db.example.com"],
	["a hostaddr override", "postgresql://u:p@127.0.0.1/db?hostaddr=1.2.3.4"],
])("refuses %s", (_, url) => {
	expect(() => localConnection(url)).toThrow("Refusing");
});
