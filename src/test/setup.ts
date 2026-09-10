// jsdom implements neither HTMLDialogElement.showModal/close nor window.scrollTo.
// Stub them so tests can open and close a native dialog and assert scroll calls.
HTMLDialogElement.prototype.showModal = function showModal(
	this: HTMLDialogElement,
) {
	this.setAttribute("open", "");
};

HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
	this.removeAttribute("open");
};

window.scrollTo = () => {};
