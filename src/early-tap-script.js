(() => {
	const state = { stopped: false, tap: null };
	window.__portdleEarlyTap = state;
	addEventListener(
		"click",
		(event) => {
			if (state.stopped || !(event.target instanceof Element)) {
				return;
			}
			const button = event.target.closest("button");
			if (button) {
				event.preventDefault();
				state.tap = { button, text: button.textContent };
			}
		},
		true,
	);
})();
