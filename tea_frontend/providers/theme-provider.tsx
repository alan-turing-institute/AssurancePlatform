"use client";

import {
	type ThemeProviderProps as NextThemeProviderProps,
	ThemeProvider as NextThemesProvider,
} from "next-themes";

export function ThemeProvider({ children, ...props }: NextThemeProviderProps) {
	return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
