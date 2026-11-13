import { DEFAULT_TITLE, type Head } from "./head";

// The attribute of the canonical link that an Archive board adds for its own
// params. The route sync leaves that link alone.
export const BOARD_CANONICAL_ATTRIBUTE = "data-board-canonical";

const DESCRIPTION = 'meta[name="description"]';
const PAGE_CANONICAL = `link[rel="canonical"]:not([${BOARD_CANONICAL_ATTRIBUTE}])`;

// Puts the head of the shown route in the document, as the prerender wrote it
// into the route's file: the title, one meta description, and the route's
// canonical link. A route with no entry (the not-found screen) has the default
// title and neither of the other two. The first call after hydration changes
// nothing, because the prerender wrote the same values.
export function syncHead(entry: Head | undefined): void {
	document.title = entry?.title ?? DEFAULT_TITLE;
	syncTag(
		DESCRIPTION,
		"meta",
		entry && { name: "description", content: entry.description },
	);
	syncTag(
		PAGE_CANONICAL,
		"link",
		entry?.canonical ? { rel: "canonical", href: entry.canonical } : undefined,
	);
}

// Keeps one element that matches `selector` with the given attributes, or none
// when `attributes` is undefined.
function syncTag(
	selector: string,
	tagName: string,
	attributes: Record<string, string> | undefined,
): void {
	const [first, ...extra] = document.head.querySelectorAll(selector);
	for (const tag of extra) {
		tag.remove();
	}
	if (attributes === undefined) {
		first?.remove();
		return;
	}
	const tag =
		first ?? document.head.appendChild(document.createElement(tagName));
	for (const [name, value] of Object.entries(attributes)) {
		tag.setAttribute(name, value);
	}
}
