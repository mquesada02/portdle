import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createFakeRemote } from "../test/fake-remote";
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

test("settle fails a read that does not settle in time, and drops its late result", async () => {
	const states: Loadable<number>[] = [];
	let resolve: (value: number) => void = () => {};
	settle(new Promise<number>((r) => (resolve = r)), (state) =>
		states.push(state),
	);
	await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS - 1);
	expect(states).toEqual([]);
	await vi.advanceTimersByTimeAsync(1);
	expect(states).toEqual([{ status: "failed" }]);
	resolve(1);
	await vi.advanceTimersByTimeAsync(0);
	expect(states).toEqual([{ status: "failed" }]);
});

test("settle's cancel drops the result and the timeout", async () => {
	const states: Loadable<number>[] = [];
	const cancel = settle(new Promise<number>(() => {}), (state) =>
		states.push(state),
	);
	cancel();
	await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
	expect(states).toEqual([]);
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
