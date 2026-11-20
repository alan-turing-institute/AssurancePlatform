import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ThemeVariableSet } from "@/types/theme-preset";
import { themePresets } from "../index";
import { modernMinimalPreset } from "../modern-minimal";
import { teaPreset } from "../tea";

const NON_COLOUR = /^--(font|shadow|spacing|tracking)/;

const stylesheet = readFileSync(
	path.join(process.cwd(), "app", "globals.css"),
	"utf8"
);

/** Returns the `--name: value` declarations of the first block with this selector. */
function declarations(selector: string): Record<string, string> {
	const start = stylesheet.indexOf(`\n${selector} {`);
	if (start < 0) {
		throw new Error(`No ${selector} block in globals.css`);
	}
	const end = stylesheet.indexOf("\n}", start);
	const body = stylesheet.slice(start, end);
	const result: Record<string, string> = {};
	for (const match of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
		result[match[1] as string] = (match[2] as string).replace(/\s+/g, " ");
	}
	return result;
}

const modes = [
	["light", ":root", teaPreset.light],
	["dark", ".dark", teaPreset.dark],
] as const;

function isOklch(value: string | undefined): boolean {
	return value?.startsWith("oklch(") ?? false;
}

function colourVariablesOf(set: ThemeVariableSet): string[] {
	return Object.keys(set);
}

describe("TEA preset and app/globals.css", () => {
	for (const [mode, selector, set] of modes) {
		it(`every ${mode} value equals the stylesheet's`, () => {
			// `.dark` inherits whatever it does not set from `:root`.
			const css = { ...declarations(":root"), ...declarations(selector) };
			const differences = Object.entries(set)
				.filter(([name, value]) => css[name] !== value)
				.map(([name, value]) => `${name}: preset ${value}, css ${css[name]}`);
			expect(differences).toEqual([]);
		});

		it(`covers every colour variable the stylesheet sets in ${mode} mode`, () => {
			const css = declarations(selector);
			const known = new Set(
				colourVariablesOf(modernMinimalPreset[mode]).filter(
					(name) => !name.startsWith("--shadow")
				)
			);
			const missing = Object.entries(css)
				.filter(([name, value]) => known.has(name) && isOklch(value))
				.map(([name]) => name)
				.filter((name) => !(name in set));
			expect(missing).toEqual([]);
		});
	}

	it("is the first preset, so it is the default", () => {
		expect(themePresets[0]).toBe(teaPreset);
	});

	it("leaves Modern Minimal in the list with a distinct id", () => {
		expect(themePresets).toContain(modernMinimalPreset);
		const ids = themePresets.map((p) => p.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(teaPreset.id).not.toBe(modernMinimalPreset.id);
	});

	it("sets no font, shadow, spacing or tracking variable", () => {
		for (const [, , set] of modes) {
			const names = Object.keys(set).filter((name) => NON_COLOUR.test(name));
			expect(names).toEqual([]);
		}
	});
});
