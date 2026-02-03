import { renderHook } from "@testing-library/react";
import { act, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock next-themes
const mockResolvedTheme = vi.fn<() => string>(() => "light");
vi.mock("next-themes", () => ({
	useTheme: () => ({
		resolvedTheme: mockResolvedTheme(),
	}),
}));

// Import after mocks
import {
	ThemePresetProvider,
	useThemePreset,
} from "../theme-preset-provider";

// Provide a working localStorage mock (Node v22+ localStorage requires --localstorage-file)
const storageMap = new Map<string, string>();
const storageMock: Storage = {
	getItem: (key: string) => storageMap.get(key) ?? null,
	setItem: (key: string, value: string) => {
		storageMap.set(key, value);
	},
	removeItem: (key: string) => {
		storageMap.delete(key);
	},
	clear: () => {
		storageMap.clear();
	},
	get length() {
		return storageMap.size;
	},
	key: (index: number) => [...storageMap.keys()][index] ?? null,
};

Object.defineProperty(globalThis, "localStorage", {
	value: storageMock,
	writable: true,
	configurable: true,
});

function wrapper({ children }: { children: ReactNode }) {
	return <ThemePresetProvider>{children}</ThemePresetProvider>;
}

describe("ThemePresetProvider", () => {
	beforeEach(() => {
		storageMap.clear();
		mockResolvedTheme.mockReturnValue("light");
		// Clear inline styles from previous tests
		const root = document.documentElement;
		root.style.cssText = "";
	});

	afterEach(() => {
		cleanup();
	});

	describe("Context", () => {
		it("should provide preset, setPreset, and availablePresets", () => {
			const { result } = renderHook(() => useThemePreset(), { wrapper });

			expect(result.current.preset).toBeDefined();
			expect(result.current.setPreset).toBeInstanceOf(Function);
			expect(result.current.availablePresets).toBeInstanceOf(Array);
			expect(result.current.availablePresets.length).toBeGreaterThan(0);
		});

		it("should throw when used outside provider", () => {
			expect(() => {
				renderHook(() => useThemePreset());
			}).toThrow("useThemePreset must be used within a ThemePresetProvider");
		});

		it("should default to 'modern-minimal' preset", () => {
			const { result } = renderHook(() => useThemePreset(), { wrapper });

			expect(result.current.preset.id).toBe("modern-minimal");
			expect(result.current.preset.name).toBe("Modern Minimal");
		});
	});

	describe("Preset switching", () => {
		it("should switch presets", () => {
			const { result } = renderHook(() => useThemePreset(), { wrapper });

			act(() => {
				result.current.setPreset("high-contrast");
			});

			expect(result.current.preset.id).toBe("high-contrast");
			expect(result.current.preset.name).toBe("High Contrast");
		});

		it("should fall back to default for unknown preset id", () => {
			const { result } = renderHook(() => useThemePreset(), { wrapper });

			act(() => {
				result.current.setPreset("nonexistent");
			});

			expect(result.current.preset.id).toBe("modern-minimal");
		});
	});

	describe("localStorage persistence", () => {
		it("should save preset to localStorage when changed", () => {
			const { result } = renderHook(() => useThemePreset(), { wrapper });

			act(() => {
				result.current.setPreset("high-contrast");
			});

			expect(localStorage.getItem("tea-theme-preset")).toBe("high-contrast");
		});

		it("should remove localStorage key when default preset is selected", () => {
			const { result } = renderHook(() => useThemePreset(), { wrapper });

			act(() => {
				result.current.setPreset("high-contrast");
			});
			expect(localStorage.getItem("tea-theme-preset")).toBe("high-contrast");

			act(() => {
				result.current.setPreset("modern-minimal");
			});
			expect(localStorage.getItem("tea-theme-preset")).toBeNull();
		});

		it("should restore preset from localStorage on mount", () => {
			localStorage.setItem("tea-theme-preset", "high-contrast");

			const { result } = renderHook(() => useThemePreset(), { wrapper });

			// After effect runs
			expect(result.current.preset.id).toBe("high-contrast");
		});

		it("should handle invalid localStorage value gracefully", () => {
			localStorage.setItem("tea-theme-preset", "invalid-preset-id");

			const { result } = renderHook(() => useThemePreset(), { wrapper });

			expect(result.current.preset.id).toBe("modern-minimal");
		});
	});

	describe("CSS variable application", () => {
		it("should apply CSS variables for non-default preset in light mode", () => {
			mockResolvedTheme.mockReturnValue("light");

			const { result } = renderHook(() => useThemePreset(), { wrapper });

			act(() => {
				result.current.setPreset("high-contrast");
			});

			const root = document.documentElement;
			expect(root.style.getPropertyValue("--primary")).toBeTruthy();
			expect(root.style.getPropertyValue("--background")).toBeTruthy();
		});

		it("should apply dark variables when resolvedTheme is dark", () => {
			mockResolvedTheme.mockReturnValue("dark");

			const { result } = renderHook(() => useThemePreset(), { wrapper });

			act(() => {
				result.current.setPreset("high-contrast");
			});

			const root = document.documentElement;
			// Dark variant should have different background value
			expect(root.style.getPropertyValue("--background")).toBeTruthy();
		});

		it("should apply default CSS variables when default preset is reapplied", () => {
			mockResolvedTheme.mockReturnValue("light");

			const { result } = renderHook(() => useThemePreset(), { wrapper });

			// Apply a different preset first
			act(() => {
				result.current.setPreset("high-contrast");
			});

			const root = document.documentElement;
			expect(root.style.getPropertyValue("--primary")).toBeTruthy();

			// Switch back to Modern Minimal (the default)
			act(() => {
				result.current.setPreset("modern-minimal");
			});

			// Modern Minimal has its own variable values
			expect(root.style.getPropertyValue("--primary")).toBeTruthy();
			expect(root.style.getPropertyValue("--background")).toBeTruthy();
		});
	});

	describe("Available presets", () => {
		it("should include all expected presets", () => {
			const { result } = renderHook(() => useThemePreset(), { wrapper });

			const ids = result.current.availablePresets.map((p) => p.id);
			expect(ids).toContain("catpuccin");
			expect(ids).toContain("high-contrast");
			expect(ids).toContain("amber");
			expect(ids).toContain("caffeine");
			expect(ids).toContain("darkmatter");
			expect(ids).toContain("ghibli");
			expect(ids).toContain("modern-minimal");
			expect(ids).toContain("retro-arcade");
			expect(ids).toContain("sunset-horizon");
			expect(ids).toHaveLength(9);
		});

		it("should have both light and dark variable sets for each preset", () => {
			const { result } = renderHook(() => useThemePreset(), { wrapper });

			for (const preset of result.current.availablePresets) {
				expect(preset.light).toBeDefined();
				expect(preset.dark).toBeDefined();
			}
		});
	});
});
