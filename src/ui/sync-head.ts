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
		entry?.description,
		(tag, description) => {
			tag.setAttribute("name", "description");
			tag.setAttribute("content", description);
		},
		"meta",
	);
	syncTag(
		PAGE_CANONICAL,
		entry?.canonical ?? undefined,
		(tag, href) => {
			tag.setAttribute("rel", "canonical");
			tag.setAttribute("href", href);
		},
		"link",
	);
}

// Keeps one element that matches `selector` when `value` is set, and none when
// it is not.
function syncTag(
	selector: string,
	value: string | undefined,
	write: (tag: Element, value: string) => void,
	name: string,
): void {
	const [first, ...extra] = document.head.querySelectorAll(selector);
	for (const tag of extra) {
		tag.remove();
	}
	if (value === undefined) {
		first?.remove();
		return;
	}
	const tag = first ?? document.head.appendChild(document.createElement(name));
	write(tag, value);
}
