import { useRouteContext } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type { ScheduleRow } from "../engine/types";
import type { Remote } from "../remote/remote";
import { useServerData } from "./server-data";
import {
	allReady,
	attachRetryTriggers,
	type Loadable,
	settle,
} from "./server-store";

// The past Schedule rows, read when its screen mounts and read again by the
// returned `retry` when the read has failed. With no remote the read counts as
// failed.
function useScheduleRows(remote: Remote | undefined): {
	rows: Loadable<ScheduleRow[]>;
	retry: () => void;
} {
	const [state, setState] = useState<{
		rows: Loadable<ScheduleRow[]>;
		attempt: number;
	}>({
		rows: remote ? { status: "loading" } : { status: "failed" },
		attempt: 0,
	});
	// biome-ignore lint/correctness/useExhaustiveDependencies: `state.attempt` changes on a retry, which must read again.
	useEffect(() => {
		if (!remote) {
			return;
		}
		return settle(remote.readSchedule(), (rows) =>
			setState((current) => ({ ...current, rows })),
		);
	}, [remote, state.attempt]);
	const retry = useCallback(() => {
		setState((current) =>
			remote && current.rows.status === "failed"
				? { rows: { status: "loading" }, attempt: current.attempt + 1 }
				: current,
		);
	}, [remote]);
	return { rows: state.rows, retry };
}

// The three reads History and the Archive need: the catalog, the current
// Dailies, and the past Schedule rows. On mount it retries failed store reads,
// and `online`, focus, and visibility retry a failed past-rows read. `retry`
// reloads every read that has failed.
export function useScheduleReads() {
	const { backend, serverStore } = useRouteContext({ from: "__root__" });
	const { catalog, dailies } = useServerData();
	const { rows: schedule, retry: retrySchedule } = useScheduleRows(
		backend?.remote,
	);
	useEffect(() => {
		serverStore.retry();
		return attachRetryTriggers(retrySchedule);
	}, [serverStore, retrySchedule]);
	const retry = useCallback(() => {
		serverStore.retry();
		retrySchedule();
	}, [serverStore, retrySchedule]);
	return { data: allReady(catalog, dailies, schedule), retry };
}
