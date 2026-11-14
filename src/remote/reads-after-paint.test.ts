import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeRemote } from "../test/fake-remote";
import { readsAfterNextPaint } from "./reads-after-paint";

let frames: FrameRequestCallback[] = [];
let visibility: DocumentVisibilityState = "visible";

function paintFrame() {
	const due = frames;
	frames = [];
	for (const frame of due) {
		frame(0);
	}
}

function setVisibility(next: DocumentVisibilityState) {
	visibility = next;
	document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["setTimeout"] });
	frames = [];
	visibility = "visible";
	vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) => {
		frames.push(frame);
		return frames.length;
	});
	vi.spyOn(document, "visibilityState", "get").mockImplementation(
		() => visibility,
	);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

function spiedRemote() {
	const remote = createFakeRemote();
	const readCatalog = vi.spyOn(remote, "readCatalog");
	const readDailyStats = vi.spyOn(remote, "readDailyStats");
	return { remote, readCatalog, readDailyStats };
}

describe("readsAfterNextPaint", () => {
	it("starts a read only after the next frame is shown", async () => {
		const { remote, readCatalog } = spiedRemote();
		const gated = readsAfterNextPaint(remote);

		const read = gated.readCatalog();
		await Promise.resolve();
		expect(readCatalog).not.toHaveBeenCalled();

		paintFrame();
		await vi.runAllTimersAsync();
		expect(readCatalog).not.toHaveBeenCalled();

		paintFrame();
		await Promise.resolve();
		expect(readCatalog).not.toHaveBeenCalled();

		await vi.runAllTimersAsync();
		expect(readCatalog).toHaveBeenCalledTimes(1);
		await expect(read).resolves.toEqual(await remote.readCatalog());
	});

	it("starts a later read at once, without a new frame", async () => {
		const { remote, readCatalog } = spiedRemote();
		const gated = readsAfterNextPaint(remote);
		void gated.readCatalog();
		paintFrame();
		paintFrame();
		await vi.runAllTimersAsync();

		void gated.readCatalog();
		await Promise.resolve();
		await Promise.resolve();
		expect(readCatalog).toHaveBeenCalledTimes(2);
		expect(frames).toHaveLength(0);
	});

	it("starts a read at once on a hidden page", async () => {
		visibility = "hidden";
		const { remote, readCatalog } = spiedRemote();

		void readsAfterNextPaint(remote).readCatalog();
		await Promise.resolve();
		await Promise.resolve();
		expect(readCatalog).toHaveBeenCalledTimes(1);
		expect(frames).toHaveLength(0);
	});

	it("starts a waiting read when the page is hidden", async () => {
		const { remote, readCatalog } = spiedRemote();
		void readsAfterNextPaint(remote).readCatalog();
		await Promise.resolve();
		expect(readCatalog).not.toHaveBeenCalled();

		setVisibility("hidden");
		await Promise.resolve();
		await Promise.resolve();
		expect(readCatalog).toHaveBeenCalledTimes(1);

		paintFrame();
		paintFrame();
		await vi.runAllTimersAsync();
		expect(readCatalog).toHaveBeenCalledTimes(1);
	});

	it("passes the arguments on and keeps the other methods", async () => {
		const { remote, readDailyStats } = spiedRemote();
		const gated = readsAfterNextPaint(remote);
		const signal = new AbortController().signal;

		void gated.readDailyStats("mixed", "2026-10-09", signal);
		paintFrame();
		paintFrame();
		await vi.runAllTimersAsync();
		expect(readDailyStats).toHaveBeenCalledWith("mixed", "2026-10-09", signal);
		expect(gated.preload).toBe(remote.preload);
		expect(gated.pull).toBe(remote.pull);
	});
});
