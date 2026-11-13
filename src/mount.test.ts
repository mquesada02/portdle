import { createElement } from "react";
import { afterEach, expect, test, vi } from "vitest";

const hydrateRoot = vi.fn();
const render = vi.fn();
const createRoot = vi.fn(() => ({ render }));
vi.mock("react-dom/client", () => ({ hydrateRoot, createRoot }));

const { mount } = await import("./mount");

afterEach(() => {
	vi.clearAllMocks();
});

const tree = createElement("p", null, "app");

test("a root with prerendered markup is hydrated", () => {
	const root = document.createElement("div");
	root.innerHTML = "<p>frame</p>";
	mount(root, tree);
	expect(hydrateRoot).toHaveBeenCalledWith(root, tree);
	expect(createRoot).not.toHaveBeenCalled();
});

test("an empty root renders fresh", () => {
	const root = document.createElement("div");
	mount(root, tree);
	expect(createRoot).toHaveBeenCalledWith(root);
	expect(render).toHaveBeenCalledWith(tree);
	expect(hydrateRoot).not.toHaveBeenCalled();
});
