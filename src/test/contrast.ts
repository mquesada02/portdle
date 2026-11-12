// WCAG contrast of the text and background colors in a Tailwind class string,
// measured with the colors of Tailwind's own theme file, so a test sees what a
// player sees without a second copy of the palette.

export type Theme = "light" | "dark";
type Rgb = readonly [number, number, number];
type Palette = ReadonlyMap<string, Rgb>;

function srgbToLinear(channel: number): number {
	return channel <= 0.04045
		? channel / 12.92
		: ((channel + 0.055) / 1.055) ** 2.4;
}

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}

// A linear-light sRGB color. Colors outside the sRGB gamut are clipped per
// channel, as a browser does for an sRGB screen.
function oklchToLinearRgb(l: number, c: number, hueDegrees: number): Rgb {
	const hue = (hueDegrees * Math.PI) / 180;
	const a = c * Math.cos(hue);
	const b = c * Math.sin(hue);
	const lms = [
		(l + 0.3963377774 * a + 0.2158037573 * b) ** 3,
		(l - 0.1055613458 * a - 0.0638541728 * b) ** 3,
		(l - 0.0894841775 * a - 1.291485548 * b) ** 3,
	] as const;
	return [
		clamp01(
			4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2],
		),
		clamp01(
			-1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2],
		),
		clamp01(
			-0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2],
		),
	];
}

function parseColor(value: string): Rgb | null {
	const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
	if (hex?.[1]) {
		const digits =
			hex[1].length === 3
				? [...hex[1]].map((digit) => digit + digit)
				: (hex[1].match(/../g) ?? []);
		const [r = 0, g = 0, b = 0] = digits.map((pair) =>
			srgbToLinear(Number.parseInt(pair, 16) / 255),
		);
		return [r, g, b];
	}
	const oklch = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+|none)\s*\)$/.exec(
		value,
	);
	if (oklch) {
		const [, lightness = "0", percent, chroma = "0", hue = "0"] = oklch;
		return oklchToLinearRgb(
			percent ? Number(lightness) / 100 : Number(lightness),
			Number(chroma),
			hue === "none" ? 0 : Number(hue),
		);
	}
	return null;
}

// The `--color-<name>: <value>;` lines of Tailwind's theme file.
export function parsePalette(themeCss: string): Palette {
	const palette = new Map<string, Rgb>();
	for (const [, name, value] of themeCss.matchAll(
		/--color-([a-z0-9-]+):\s*([^;]+);/g,
	)) {
		const rgb = name && value ? parseColor(value.trim()) : null;
		if (name && rgb) {
			palette.set(name, rgb);
		}
	}
	return palette;
}

function luminance([r, g, b]: Rgb): number {
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(first: Rgb, second: Rgb): number {
	const [lighter, darker] = [luminance(first), luminance(second)].sort(
		(x, y) => y - x,
	) as [number, number];
	return (lighter + 0.05) / (darker + 0.05);
}

type Utility = "bg" | "text";
type Scope = "plain" | "dark";

// The contrast between the `bg-` and `text-` colors of `classes` in `theme`.
// Only plain and `dark:` classes are read; the last class of a utility wins.
// A color class the helper cannot measure (arbitrary value, opacity) throws,
// and so does a class string without both a background and a text color.
export function classContrast(
	classes: string,
	theme: Theme,
	palette: Palette,
): number {
	const found: Record<Scope, Partial<Record<Utility, Rgb>>> = {
		plain: {},
		dark: {},
	};
	for (const token of classes.split(/\s+/)) {
		const prefixed = token.startsWith("dark:");
		if (!prefixed && token.includes(":")) {
			continue;
		}
		const body = prefixed ? token.slice("dark:".length) : token;
		const utility: Utility | null = body.startsWith("bg-")
			? "bg"
			: body.startsWith("text-")
				? "text"
				: null;
		if (!utility) {
			continue;
		}
		const value = body.slice(utility.length + 1);
		if (value.startsWith("[")) {
			throw new Error(`Cannot measure the arbitrary value in "${token}"`);
		}
		const [name = "", opacity] = value.split("/");
		const color = palette.get(name);
		if (!color) {
			continue;
		}
		if (opacity !== undefined) {
			throw new Error(`Cannot measure the opacity in "${token}"`);
		}
		found[prefixed ? "dark" : "plain"][utility] = color;
	}
	const pick = (utility: Utility): Rgb => {
		const color =
			(theme === "dark" ? found.dark[utility] : undefined) ??
			found.plain[utility];
		if (!color) {
			throw new Error(`No ${utility} color resolves in the ${theme} theme`);
		}
		return color;
	};
	return contrastRatio(pick("bg"), pick("text"));
}
