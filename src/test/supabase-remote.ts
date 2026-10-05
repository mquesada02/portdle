import { createSupabaseRemote } from "../remote/supabase";

// A Supabase `Remote` for the public reads: injected `fetch`, and a library
// that must stay lazy. `loadLibrary` is injectable so a test can spy on it.
export function createRemoteOnFetch(
	fetch: typeof globalThis.fetch,
	options: {
		url?: string;
		loadLibrary?: () => Promise<never>;
	} = {},
) {
	return createSupabaseRemote(
		{ url: options.url ?? "https://x.supabase.test", anonKey: "anon" },
		{
			storage: { getItem: () => null, removeItem: () => {} },
			location: {
				pathname: "/",
				search: "",
				hash: "",
				origin: "https://x.example",
			},
			history: { replaceState: () => {} },
			baseUrl: "/",
			loadLibrary:
				options.loadLibrary ??
				(async () => {
					throw new Error("the library must stay lazy");
				}),
			fetch,
		},
	);
}
