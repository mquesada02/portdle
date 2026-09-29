import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
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

createRoot(root).render(
	<StrictMode>
		<App persist={createPersist(window.localStorage)} remote={remote} />
	</StrictMode>,
);
