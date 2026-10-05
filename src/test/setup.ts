import { configure } from "@testing-library/react";

// A Testing Library wait ends on machine load, not on a real delay.
configure({ asyncUtilTimeout: 10_000 });

// jsdom implements neither HTMLDialogElement.showModal/close nor window.scrollTo.
// Stub them so tests can open and close a native dialog and assert scroll calls.
// showModal/close also capture and restore focus, mirroring enough of native
// <dialog> behavior for tests to verify focus returns to the triggering element.
let previouslyFocused: HTMLElement | null = null;

HTMLDialogElement.prototype.showModal = function showModal(
	this: HTMLDialogElement,
) {
	previouslyFocused =
		document.activeElement instanceof HTMLElement
			? document.activeElement
			: null;
	this.setAttribute("open", "");
	this.focus();
};

HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
	this.removeAttribute("open");
	previouslyFocused?.focus();
	previouslyFocused = null;
};

window.scrollTo = () => {};
