import type { Remote } from "./remote";
import { createSupabaseRemote } from "./supabase";

// The remote of this build: absent on a build with no hosted backend. The
// client entry and the server entry both call it, because the first render
// differs with and without a remote, so the prerendered markup and its client
// must agree.
export function remoteFromEnv(): Remote | undefined {
	const url = import.meta.env.VITE_SUPABASE_URL;
	const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
	return url && anonKey ? createSupabaseRemote({ url, anonKey }) : undefined;
}
