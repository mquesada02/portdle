import type { ReactNode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";

// A page that the prerender wrote holds the frame in #root, and the client
// hydrates it. 404.html has an empty #root and renders fresh, so it never
// hydrates a frame that is not its own.
export function isPrerendered(root: HTMLElement): boolean {
	return root.hasChildNodes();
}

export function mount(root: HTMLElement, tree: ReactNode): void {
	if (isPrerendered(root)) {
		hydrateRoot(root, tree);
	} else {
		createRoot(root).render(tree);
	}
}
