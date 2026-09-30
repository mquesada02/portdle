import type { SyncClock } from "../sync/sync";

export type FakeClock = SyncClock & {
	advance(ms: number): void;
	pending(): number;
};

export function createFakeClock(): FakeClock {
	let now = 0;
	let nextId = 1;
	const timers = new Map<number, { at: number; callback: () => void }>();
	return {
		setTimeout(callback, ms) {
			const id = nextId++;
			timers.set(id, { at: now + ms, callback });
			return id;
		},
		clearTimeout(handle) {
			timers.delete(handle as number);
		},
		advance(ms) {
			const target = now + ms;
			for (;;) {
				const due = [...timers.entries()]
					.filter(([, timer]) => timer.at <= target)
					.sort(([, a], [, b]) => a.at - b.at)[0];
				if (!due) {
					break;
				}
				timers.delete(due[0]);
				now = due[1].at;
				due[1].callback();
			}
			now = target;
		},
		now: () => now,
		pending: () => timers.size,
	};
}
