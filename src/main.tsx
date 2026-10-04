import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SWITCH_OVER_DAY } from "./engine/switch-over";
import { createPersist } from "./persist/storage";
import { createSupabaseRemote } from "./remote/supabase";
import { App } from "./ui/app";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
	throw new Error("Missing #root");
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const remote =
	supabaseUrl && supabaseAnonKey
		? createSupabaseRemote({ url: supabaseUrl, anonKey: supabaseAnonKey })
		: undefined;

const persist = createPersist(window.localStorage);
// Runs before the first render, so no screen mounts on a record the step
// changes or removes. It is idempotent; a failed write retries at next start.
persist.applySwitchOver(SWITCH_OVER_DAY);

createRoot(root).render(
	<StrictMode>
		<App persist={persist} remote={remote} />
	</StrictMode>,
);
