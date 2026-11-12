(() => {
	let dark;
	try {
		const stored = JSON.parse(localStorage.getItem("portdle:v1:theme"));
		if (stored === "dark" || stored === "light") {
			dark = stored === "dark";
		}
	} catch {}
	if (dark === undefined) {
		try {
			dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
		} catch {
			dark = false;
		}
	}
	document.documentElement.classList.toggle("dark", dark);
})();
