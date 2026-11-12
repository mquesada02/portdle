import theme from "tailwindcss/theme.css?raw";
import { expect, test } from "vitest";
import { classContrast, parsePalette } from "./contrast";

const palette = parsePalette(theme);

test("Tailwind's theme file gives the palette", () => {
	expect(palette.has("emerald-500")).toBe(true);
	expect(palette.has("zinc-50")).toBe(true);
	expect(palette.has("white")).toBe(true);
});

test("black on white is 21:1", () => {
	expect(classContrast("bg-white text-black", "light", palette)).toBeCloseTo(
		21,
		2,
	);
});

test("white on bg-emerald-500 is 2.47:1, the failing pair of the ticket", () => {
	expect(
		Math.abs(
			classContrast("bg-emerald-500 text-white", "light", palette) - 2.47,
		),
	).toBeLessThan(0.02);
});

test("a dark: class changes the dark ratio and leaves the light ratio", () => {
	const classes = "bg-white text-white dark:text-black";
	expect(classContrast(classes, "light", palette)).toBeCloseTo(1, 2);
	expect(classContrast(classes, "dark", palette)).toBeCloseTo(21, 2);
});

test("classes that are not colors do not matter", () => {
	expect(
		classContrast(
			"mt-6 w-full text-base font-semibold bg-white text-black",
			"light",
			palette,
		),
	).toBeCloseTo(21, 2);
	expect(
		classContrast("bg-white text-base/6 text-black", "light", palette),
	).toBeCloseTo(21, 2);
});

test("variants other than dark: are ignored", () => {
	expect(
		classContrast("bg-white text-black hover:bg-black", "light", palette),
	).toBeCloseTo(21, 2);
});

test("the last class of a utility wins", () => {
	expect(
		classContrast("bg-white bg-black text-white", "light", palette),
	).toBeCloseTo(21, 2);
});

test("it throws on a color it cannot measure", () => {
	expect(() =>
		classContrast("bg-[#fff] text-black", "light", palette),
	).toThrow();
	expect(() =>
		classContrast("bg-white/50 text-black", "light", palette),
	).toThrow();
	expect(() =>
		classContrast("bg-white text-[14px] text-black", "light", palette),
	).toThrow();
});

test("it throws when the background or the text color does not resolve", () => {
	expect(() => classContrast("bg-white", "light", palette)).toThrow();
	expect(() =>
		classContrast("bg-white text-zinc-950x", "light", palette),
	).toThrow();
	expect(() =>
		classContrast("bg-white dark:text-black", "light", palette),
	).toThrow();
});
