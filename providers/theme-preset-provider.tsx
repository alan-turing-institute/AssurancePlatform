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
import { useGoogleFonts } from "@/hooks/use-google-fonts";
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
	"--chart-1",
	"--chart-2",
	"--chart-3",
	"--chart-4",
	"--chart-5",
	"--sidebar",
	"--sidebar-foreground",
	"--sidebar-primary",
	"--sidebar-primary-foreground",
	"--sidebar-accent",
	"--sidebar-accent-foreground",
	"--sidebar-border",
	"--sidebar-ring",
	"--sidebar-muted",
	"--radius",
	"--font-sans",
	"--font-serif",
	"--font-mono",
	"--shadow-2xs",
	"--shadow-xs",
	"--shadow-sm",
	"--shadow",
	"--shadow-md",
	"--shadow-lg",
	"--shadow-xl",
	"--shadow-2xl",
	"--tracking-normal",
	"--spacing",
];

interface ThemePresetContextValue {
	availablePresets: ThemePreset[];
	preset: ThemePreset;
	setPreset: (id: string) => void;
}

const ThemePresetContext = createContext<ThemePresetContextValue | null>(null);

function getDefaultPreset(): ThemePreset {
	const first = themePresets[0];
	if (!first) {
		throw new Error("themePresets must not be empty");
	}
	return first;
}

function findPreset(id: string): ThemePreset {
	return themePresets.find((p) => p.id === id) ?? getDefaultPreset();
}

function loadSavedPresetId(): string {
	const fallback = getDefaultPreset().id;

	if (typeof window === "undefined") {
		return fallback;
	}

	try {
		return localStorage.getItem(STORAGE_KEY) ?? fallback;
	} catch {
		return fallback;
	}
}

function savePresetId(id: string): void {
	try {
		if (id === getDefaultPreset().id) {
			localStorage.removeItem(STORAGE_KEY);
		} else {
			localStorage.setItem(STORAGE_KEY, id);
		}
	} catch {
		// localStorage unavailable — silently ignore
	}
}

/**
 * CSS variables that must be applied on `document.body` rather than the root.
 * `next/font/google` sets `--font-sans` via a class on `<body>`, so an inherited
 * value from `<html>` is overridden. Inline styles on body win over class styles.
 */
const BODY_VARIABLES = new Set<ThemeVariable>([
	"--font-sans",
	"--font-serif",
	"--font-mono",
]);

function applyPreset(preset: ThemePreset, resolvedTheme: string): void {
	const root = document.documentElement;
	const { body } = document;
	const variableSet = resolvedTheme === "dark" ? preset.dark : preset.light;

	for (const variable of ALL_VARIABLES) {
		const value = variableSet[variable];
		const target = BODY_VARIABLES.has(variable) ? body : root;

		if (value) {
			target.style.setProperty(variable, value);
		} else {
			target.style.removeProperty(variable);
		}
	}
}

export function ThemePresetProvider({ children }: { children: ReactNode }) {
	const { resolvedTheme } = useTheme();
	const [preset, setPresetState] = useState<ThemePreset>(getDefaultPreset);

	// Load Google Fonts required by the active preset
	useGoogleFonts(preset);

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
