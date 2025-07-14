'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type * as React from 'react';

interface ThemeProviderProps {
  children: React.ReactNode;
  attribute?: 'class' | 'data-theme' | string;
  defaultTheme?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
  [key: string]: any;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...(props as any)}>{children}</NextThemesProvider>
  );
}
