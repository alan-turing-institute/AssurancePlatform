import { expect, type Page, test } from "@playwright/test";
import { modernMinimalPreset } from "../lib/theme-presets/modern-minimal";
import { teaPreset } from "../lib/theme-presets/tea";
import {
	oklchToRgb,
	type Rgb,
	ratio,
} from "../src/__tests__/utils/colour-contrast-kit";

// Signed-out visitors only: no stored theme unless a test sets one.
test.use({ storageState: { cookies: [], origins: [] } });

const PAGES = ["/login", "/docs/platform-guide/reference/02-element-types"];
const PRESET_KEY = "tea-theme-preset";
const SETTLE_MS = 1500;

/** Reads a custom property from `<html>` as the browser resolves it. */
function property(page: Page, name: string): Promise<string> {
	return page.evaluate(
		(variable) =>
			getComputedStyle(document.documentElement)
				.getPropertyValue(variable)
				.trim(),
		name
	);
}

/**
 * Paints `colour` (optionally at `alpha`, over `backdrop`) on a canvas and
 * returns the 8-bit channels the browser produces.
 */
function painted(
	page: Page,
	colour: string,
	alpha = 1,
	backdrop = "rgb(255 255 255)"
): Promise<Rgb> {
	return page.evaluate(
		([top, opacity, under]) => {
			const canvas = document.createElement("canvas");
			canvas.width = 1;
			canvas.height = 1;
			const context = canvas.getContext("2d", { willReadFrequently: true });
			if (!context) {
				throw new Error("No 2d context");
			}
			context.fillStyle = under as string;
			context.fillRect(0, 0, 1, 1);
			context.globalAlpha = opacity as number;
			context.fillStyle = top as string;
			context.fillRect(0, 0, 1, 1);
			const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
			return [(r ?? 0) / 255, (g ?? 0) / 255, (b ?? 0) / 255];
		},
		[colour, alpha, backdrop] as const
	) as Promise<Rgb>;
}

function stylesheetPurple(page: Page): Promise<Rgb> {
	return painted(page, teaPreset.light["--primary"] as string);
}

async function usedPrimary(page: Page): Promise<Rgb> {
	return painted(page, await property(page, "--primary"));
}

async function open(page: Page, path: string, scheme: "light" | "dark") {
	await page.emulateMedia({ colorScheme: scheme });
	await page.goto(path);
	await page.waitForLoadState("load");
	await page.waitForTimeout(SETTLE_MS);
}

function expectClose(actual: Rgb, expected: Rgb) {
	for (const [i, channel] of actual.entries()) {
		expect(Math.abs(channel - (expected[i] ?? 0))).toBeLessThanOrEqual(
			1 / 255 + 1e-9
		);
	}
}

for (const path of PAGES) {
	test.describe(path, () => {
		test("the computed primary is purple at first paint and after hydration, with no change", async ({
			page,
		}) => {
			// With the app's scripts blocked, only the stylesheet can colour the page.
			await page.emulateMedia({ colorScheme: "light" });
			await page.route("**/*.js", (route) => route.abort());
			await page.goto(path);
			const beforeScripts = await usedPrimary(page);
			await page.unroute("**/*.js");

			await open(page, path, "light");
			const afterLoad = await usedPrimary(page);

			expectClose(beforeScripts, await stylesheetPurple(page));
			expectClose(afterLoad, beforeScripts);
		});

		test("requests nothing from fonts.googleapis.com by default", async ({
			page,
		}) => {
			const hosts: string[] = [];
			page.on("request", (request) => hosts.push(new URL(request.url()).host));
			await open(page, path, "light");
			expect(hosts.filter((host) => host.includes("googleapis"))).toEqual([]);
		});

		test("an id that no longer exists leaves the purple in place", async ({
			page,
		}) => {
			await page.addInitScript(
				([key]) => localStorage.setItem(key as string, "removed-preset"),
				[PRESET_KEY]
			);
			await open(page, path, "light");
			expectClose(await usedPrimary(page), await stylesheetPurple(page));
		});

		test("the dark class on html gives the dark purple", async ({ page }) => {
			await page.addInitScript(() => localStorage.setItem("theme", "dark"));
			await open(page, path, "dark");
			const dark = await page.evaluate(() =>
				document.documentElement.classList.contains("dark")
			);
			expect(dark).toBe(true);
			expectClose(
				await usedPrimary(page),
				await painted(page, teaPreset.dark["--primary"] as string)
			);
		});
	});
}

test.describe("Modern Minimal stays selectable", () => {
	test("a stored Modern Minimal choice applies its colours, and clearing it restores the purple", async ({
		page,
	}) => {
		await page.addInitScript(
			([key, id]) => localStorage.setItem(key as string, id as string),
			[PRESET_KEY, modernMinimalPreset.id]
		);
		await open(page, "/login", "light");
		expectClose(
			await usedPrimary(page),
			await painted(page, modernMinimalPreset.light["--primary"] as string)
		);

		await page.evaluate((key) => localStorage.removeItem(key), PRESET_KEY);
		await page.addInitScript(
			([key]) => localStorage.removeItem(key as string),
			[PRESET_KEY]
		);
		await page.reload();
		await page.waitForTimeout(SETTLE_MS);
		expectClose(await usedPrimary(page), await stylesheetPurple(page));
	});
});

const PAIRS = [
	["--primary-foreground", "--primary", 1],
	["--muted-foreground", "--card", 1],
	["--accent-foreground", "--accent", 1],
	["--foreground", "--card", 0.7],
	["--foreground", "--background", 0.8],
] as const;

for (const [scheme, set] of [
	["light", teaPreset.light],
	["dark", teaPreset.dark],
] as const) {
	test(`the contrast arithmetic agrees with what the browser paints in ${scheme} mode`, async ({
		page,
	}) => {
		await page.addInitScript(
			([mode]) => localStorage.setItem("theme", mode as string),
			[scheme]
		);
		await open(page, "/login", scheme);
		for (const [front, back, alpha] of PAIRS) {
			const backColour = await painted(page, await property(page, back));
			const frontColour = await painted(
				page,
				await property(page, front),
				alpha,
				`rgb(${backColour.map((c) => Math.round(c * 255)).join(" ")})`
			);
			const mine = ratio(
				oklchToRgb(set[front] as string),
				oklchToRgb(set[back] as string)
			);
			const browser = ratio(frontColour, backColour);
			if (alpha === 1) {
				expect(Math.abs(browser - mine)).toBeLessThan(0.05);
			}
			expect(browser).toBeGreaterThanOrEqual(4.5);
		}
	});
}
