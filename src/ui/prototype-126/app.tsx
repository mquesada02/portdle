// PROTOTYPE — throwaway. Reads ?variant, ?screen, ?signedIn from the URL so
// headless-Chrome screenshots can navigate straight to a state with no click
// automation. See issue #126.
import { useSyncExternalStore } from "react";
import { PrototypeSwitcher } from "./shell";
import { VariantA } from "./variant-a";
import { VariantB } from "./variant-b";
import { VariantC } from "./variant-c";

function subscribe(callback: () => void) {
	window.addEventListener("popstate", callback);
	return () => window.removeEventListener("popstate", callback);
}

function useSearchParams(): URLSearchParams {
	const search = useSyncExternalStore(
		subscribe,
		() => window.location.search,
		() => "",
	);
	return new URLSearchParams(search);
}

export function PrototypeApp() {
	const params = useSearchParams();
	const variant = params.get("variant") ?? "A";
	const screen = params.get("screen") ?? "idle";
	const signedIn = params.get("signedIn") === "1" || screen === "name-confirm";

	return (
		<>
			{variant === "B" ? (
				<VariantB screen={screen} signedIn={signedIn} />
			) : variant === "C" ? (
				<VariantC screen={screen} signedIn={signedIn} />
			) : (
				<VariantA screen={screen} signedIn={signedIn} />
			)}
			<PrototypeSwitcher variant={variant} />
		</>
	);
}
