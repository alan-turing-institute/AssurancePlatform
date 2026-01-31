"use client";

import { useTheme } from "next-themes";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { themePresets } from "@/lib/theme-presets";
import type { ThemePreset, ThemeVariable } from "@/types/theme-preset";

const STORAGE_KEY = "tea-theme-preset";

/** All CSS variables a preset may override */
const ALL_VARIABLES: ThemeVariable[] = [
	"--background",
	"--foreground",
	"--card",
	"--card-foreground",
	"--popover",
	"--popover-foreground",
	"--primary",
	"--primary-foreground",
	"--secondary",
	"--secondary-foreground",
	"--muted",
	"--muted-foreground",
	"--accent",
	"--accent-foreground",
	"--destructive",
	"--destructive-foreground",
	"--border",
	"--input",
	"--ring",
	"--sidebar",
	"--sidebar-foreground",
	"--sidebar-accent",
	"--sidebar-accent-foreground",
	"--sidebar-border",
	"--sidebar-muted",
];

type ThemePresetContextValue = {
	preset: ThemePreset;
	setPreset: (id: string) => void;
	availablePresets: ThemePreset[];
};

const ThemePresetContext = createContext<ThemePresetContextValue | null>(null);

function getDefaultPreset(): ThemePreset {
	return themePresets[0];
}

function findPreset(id: string): ThemePreset {
	return themePresets.find((p) => p.id === id) ?? getDefaultPreset();
}

function loadSavedPresetId(): string {
	if (typeof window === "undefined") {
		return "default";
	}

	try {
		return localStorage.getItem(STORAGE_KEY) ?? "default";
	} catch {
		return "default";
	}
}

function savePresetId(id: string): void {
	try {
		if (id === "default") {
			localStorage.removeItem(STORAGE_KEY);
		} else {
			localStorage.setItem(STORAGE_KEY, id);
		}
	} catch {
		// localStorage unavailable — silently ignore
	}
}

function applyPreset(preset: ThemePreset, resolvedTheme: string): void {
	const root = document.documentElement;
	const variableSet = resolvedTheme === "dark" ? preset.dark : preset.light;

	for (const variable of ALL_VARIABLES) {
		const value = variableSet[variable];
		if (value) {
			root.style.setProperty(variable, value);
		} else {
			root.style.removeProperty(variable);
		}
	}
}

export function ThemePresetProvider({ children }: { children: ReactNode }) {
	const { resolvedTheme } = useTheme();
	const [preset, setPresetState] = useState<ThemePreset>(getDefaultPreset);

	// Initialise from localStorage on mount
	useEffect(() => {
		const savedId = loadSavedPresetId();
		setPresetState(findPreset(savedId));
	}, []);

	// Apply CSS variables whenever preset or resolved theme changes
	useEffect(() => {
		if (!resolvedTheme) {
			return;
		}

		applyPreset(preset, resolvedTheme);
	}, [preset, resolvedTheme]);

	const setPreset = useCallback((id: string) => {
		const next = findPreset(id);
		setPresetState(next);
		savePresetId(id);
	}, []);

	return (
		<ThemePresetContext.Provider
			value={{ preset, setPreset, availablePresets: themePresets }}
		>
			{children}
		</ThemePresetContext.Provider>
	);
}

export function useThemePreset(): ThemePresetContextValue {
	const ctx = useContext(ThemePresetContext);
	if (!ctx) {
		throw new Error("useThemePreset must be used within a ThemePresetProvider");
	}
	return ctx;
}
