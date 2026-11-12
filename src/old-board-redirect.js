(() => {
	const match = /^\/portdle\/archive\/([^/]+)\/([^/]+)$/.exec(
		location.pathname,
	);
	if (match) {
		location.replace(
			`/portdle/archive/board?category=${match[1]}&date=${match[2]}`,
		);
	}
})();
