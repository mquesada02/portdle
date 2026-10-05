import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createFakeRemote } from "../test/fake-remote";
import { createRemoteOnFetch } from "../test/supabase-remote";
import {
	createServerStore,
	type Loadable,
	READ_TIMEOUT_MS,
	settle,
} from "./server-store";

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

// A read function that records its signal and answers when the test says.
function pendingRead<T>() {
	let signal: AbortSignal | undefined;
	let resolve: (value: T) => void = () => {};
	let reject: (error: Error) => void = () => {};
	const read = (given: AbortSignal) => {
		signal = given;
		return new Promise<T>((res, rej) => {
			resolve = res;
			reject = rej;
		});
	};
	return {
		read,
		signal: () => signal as AbortSignal,
		resolve: (value: T) => resolve(value),
		reject: (error: Error) => reject(error),
	};
}

test("settle fails a read that does not settle in time, aborts its request, and drops its late result", async () => {
	const states: Loadable<number>[] = [];
	const request = pendingRead<number>();
	settle(request.read, (state) => states.push(state));
	await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS - 1);
	expect(states).toEqual([]);
	expect(request.signal().aborted).toBe(false);
	await vi.advanceTimersByTimeAsync(1);
	expect(states).toEqual([{ status: "failed" }]);
	expect(request.signal().aborted).toBe(true);
	request.resolve(1);
	await vi.advanceTimersByTimeAsync(0);
	expect(states).toEqual([{ status: "failed" }]);
});

test("settle's cancel aborts the request and drops the result and the timeout", async () => {
	const states: Loadable<number>[] = [];
	const request = pendingRead<number>();
	const cancel = settle(request.read, (state) => states.push(state));
	cancel();
	expect(request.signal().aborted).toBe(true);
	request.resolve(1);
	await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
	expect(states).toEqual([]);
});

test("settle's cancel after the read settled does not abort", async () => {
	const states: Loadable<number>[] = [];
	const request = pendingRead<number>();
	const cancel = settle(request.read, (state) => states.push(state));
	request.resolve(1);
	await vi.advanceTimersByTimeAsync(0);
	cancel();
	expect(request.signal().aborted).toBe(false);
	expect(states).toEqual([{ status: "ready", value: 1 }]);
});

test("the rejection that an abort causes sets no second state", async () => {
	const states: Loadable<number>[] = [];
	const request = pendingRead<number>();
	settle(request.read, (state) => states.push(state));
	await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
	request.reject(new Error("aborted"));
	await vi.advanceTimersByTimeAsync(0);
	expect(states).toEqual([{ status: "failed" }]);
});

test("settle counts a synchronous throw from the read as failed", async () => {
	const states: Loadable<number>[] = [];
	settle<number>(
		() => {
			throw new Error("boom");
		},
		(state) => states.push(state),
	);
	expect(states).toEqual([{ status: "failed" }]);
	await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
	expect(states).toEqual([{ status: "failed" }]);
});

test("retry reloads only the failed reads and ignores one in flight", async () => {
	const remote = createFakeRemote();
	remote.failDailies = true;
	const store = createServerStore(remote);
	store.load();
	await vi.advanceTimersByTimeAsync(0);
	expect(store.getSnapshot().catalog.status).toBe("ready");
	expect(store.getSnapshot().dailies.status).toBe("failed");
	remote.failDailies = false;
	const release = remote.holdDailies();
	store.retry();
	store.retry();
	expect(store.getSnapshot().dailies.status).toBe("loading");
	expect(remote.catalogCalls).toBe(1);
	expect(remote.dailiesCalls).toBe(2);
	release();
	await vi.advanceTimersByTimeAsync(0);
	expect(store.getSnapshot().dailies.status).toBe("ready");
	store.retry();
	expect(remote.dailiesCalls).toBe(2);
});

test("rejectCatalog fails only a ready catalog, and a retry reloads it", async () => {
	const remote = createFakeRemote();
	const release = remote.holdCatalog();
	const store = createServerStore(remote);
	store.load();
	store.rejectCatalog();
	expect(store.getSnapshot().catalog.status).toBe("loading");
	release();
	await vi.advanceTimersByTimeAsync(0);
	expect(store.getSnapshot().catalog.status).toBe("ready");
	store.rejectCatalog();
	expect(store.getSnapshot().catalog.status).toBe("failed");
	expect(store.getSnapshot().dailies.status).toBe("ready");
	store.retry();
	expect(store.getSnapshot().catalog.status).toBe("loading");
	expect(remote.catalogCalls).toBe(2);
	expect(remote.dailiesCalls).toBe(1);
});

// The store on the Supabase adapter with a fake `fetch` that never answers by
// itself, records each request's signal, and answers later without looking at
// the signal.
function storeOnFetch() {
	const requests: Array<{
		url: string;
		signal: AbortSignal | undefined;
		answer(body: unknown): void;
	}> = [];
	const fetch = ((url: string, init?: RequestInit) =>
		new Promise<Response>((resolve) => {
			requests.push({
				url,
				signal: init?.signal ?? undefined,
				answer: (body) =>
					resolve({
						ok: true,
						status: 200,
						json: async () => body,
					} as Response),
			});
		})) as unknown as typeof globalThis.fetch;
	const remote = createRemoteOnFetch(fetch);
	const store = createServerStore(remote);
	const dailiesRequests = () =>
		requests.filter((request) => request.url.includes("current_dailies"));
	return { store, requests, dailiesRequests };
}

function dailiesBody(day: string) {
	return ["mixed", "protocols", "applications"].map((category) => ({
		server_time: `${day}T12:00:00Z`,
		utc_date: day,
		category,
		entry_id: "a",
	}));
}

test("a read held past 10 seconds aborts its request, fails, and ignores a late answer", async () => {
	const { store, requests } = storeOnFetch();
	store.load();
	expect(requests).toHaveLength(2);
	await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
	expect(requests.map((request) => request.signal?.aborted)).toEqual([
		true,
		true,
	]);
	expect(store.getSnapshot().catalog.status).toBe("failed");
	expect(store.getSnapshot().dailies.status).toBe("failed");
	for (const request of requests) {
		request.answer(
			request.url.includes("current_dailies") ? dailiesBody("2026-10-02") : [],
		);
	}
	await vi.advanceTimersByTimeAsync(0);
	expect(store.getSnapshot().catalog.status).toBe("failed");
	expect(store.getSnapshot().dailies.status).toBe("failed");
});

test("a newer Dailies read aborts the older request and ignores its late answer", async () => {
	const { store, dailiesRequests } = storeOnFetch();
	const older = store.refreshDailies();
	const [first] = dailiesRequests();
	expect(first?.signal?.aborted).toBe(false);
	void store.refreshDailies();
	const [, second] = dailiesRequests();
	expect(first?.signal?.aborted).toBe(true);
	expect(second?.signal?.aborted).toBe(false);
	await older;
	first?.answer(dailiesBody("2026-10-01"));
	await vi.advanceTimersByTimeAsync(0);
	expect(store.getSnapshot().dailies.status).toBe("loading");
});
