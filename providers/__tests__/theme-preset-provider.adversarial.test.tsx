import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { modernMinimalPreset } from "@/lib/theme-presets/modern-minimal";
import { teaPreset } from "@/lib/theme-presets/tea";
import { ThemePresetProvider, useThemePreset } from "../theme-preset-provider";

const themeState = vi.hoisted(() => ({ resolvedTheme: "light" }));

vi.mock("next-themes", async (importOriginal) => ({
	...(await importOriginal<typeof import("next-themes")>()),
	useTheme: () => ({ resolvedTheme: themeState.resolvedTheme }),
}));

const STORAGE_KEY = "tea-theme-preset";
const FONT_LINK = "link[data-tea-preset-font]";

/** Some Node versions expose a global `localStorage` that shadows jsdom's. */
function memoryStorage() {
	const items = new Map<string, string>();
	return {
		getItem: (key: string) => items.get(key) ?? null,
		setItem: (key: string, value: string) => {
			items.set(key, value);
		},
		removeItem: (key: string) => {
			items.delete(key);
		},
	};
}

function wrapper({ children }: { children: ReactNode }) {
	return <ThemePresetProvider>{children}</ThemePresetProvider>;
}

function rootValue(name: string): string {
	return document.documentElement.style.getPropertyValue(name);
}

function mountProvider() {
	return renderHook(() => useThemePreset(), { wrapper });
}

beforeEach(() => {
	themeState.resolvedTheme = "light";
	vi.stubGlobal("localStorage", memoryStorage());
	document.documentElement.removeAttribute("style");
	document.body.removeAttribute("style");
	for (const link of document.head.querySelectorAll(FONT_LINK)) {
		link.remove();
	}
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("ThemePresetProvider default and fallbacks", () => {
	it("uses the TEA preset and requests no web font when nothing is stored", () => {
		const { result } = mountProvider();
		expect(result.current.preset.id).toBe(teaPreset.id);
		expect(rootValue("--primary")).toBe(teaPreset.light["--primary"]);
		expect(document.head.querySelector(FONT_LINK)).toBeNull();
		expect(document.body.style.getPropertyValue("--font-sans")).toBe("");
	});

	it("falls back to TEA when the stored id no longer exists", () => {
		localStorage.setItem(STORAGE_KEY, "preset-that-was-removed");
		const { result } = mountProvider();
		expect(result.current.preset.id).toBe(teaPreset.id);
		expect(rootValue("--primary")).toBe(teaPreset.light["--primary"]);
		expect(document.head.querySelector(FONT_LINK)).toBeNull();
	});

	it("falls back to TEA when reading storage throws", () => {
		vi.spyOn(localStorage, "getItem").mockImplementation(() => {
			throw new Error("storage blocked");
		});
		const { result } = mountProvider();
		expect(result.current.preset.id).toBe(teaPreset.id);
	});

	it("applies the TEA dark values when the resolved theme is dark", () => {
		themeState.resolvedTheme = "dark";
		mountProvider();
		expect(rootValue("--primary")).toBe(teaPreset.dark["--primary"]);
		expect(rootValue("--sidebar-muted")).toBe(
			teaPreset.dark["--sidebar-muted"]
		);
	});
});

describe("ThemePresetProvider with Modern Minimal", () => {
	it("keeps a stored Modern Minimal choice, light and dark", () => {
		localStorage.setItem(STORAGE_KEY, modernMinimalPreset.id);
		const light = mountProvider();
		expect(light.result.current.preset.id).toBe(modernMinimalPreset.id);
		expect(rootValue("--primary")).toBe(modernMinimalPreset.light["--primary"]);
		light.unmount();

		themeState.resolvedTheme = "dark";
		mountProvider();
		expect(rootValue("--primary")).toBe(modernMinimalPreset.dark["--primary"]);
	});

	it("returns to TEA cleanly: storage cleared, colours and fonts reset", () => {
		localStorage.setItem(STORAGE_KEY, modernMinimalPreset.id);
		const { result } = mountProvider();
		expect(modernMinimalPreset.light["--font-sans"]).toBeDefined();

		act(() => result.current.setPreset(teaPreset.id));

		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
		expect(result.current.preset.id).toBe(teaPreset.id);
		expect(rootValue("--primary")).toBe(teaPreset.light["--primary"]);
		expect(rootValue("--shadow-md")).toBe("");
		expect(document.body.style.getPropertyValue("--font-sans")).toBe("");
		expect(document.head.querySelector(FONT_LINK)).toBeNull();
	});

	it("treats an unknown id passed to setPreset as TEA", () => {
		localStorage.setItem(STORAGE_KEY, modernMinimalPreset.id);
		const { result } = mountProvider();
		act(() => result.current.setPreset("nonexistent"));
		expect(result.current.preset.id).toBe(teaPreset.id);
		expect(rootValue("--primary")).toBe(teaPreset.light["--primary"]);
	});
});
