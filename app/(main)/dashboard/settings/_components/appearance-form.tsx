"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PresetSwatch } from "@/components/ui/preset-swatch";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useThemePreset } from "@/providers/theme-preset-provider";

const modeOptions = [
	{ id: "light", label: "Light", icon: Sun },
	{ id: "dark", label: "Dark", icon: Moon },
	{ id: "system", label: "System", icon: Monitor },
] as const;

export function AppearanceForm() {
	const { theme, setTheme, resolvedTheme } = useTheme();
	const { preset, setPreset, availablePresets } = useThemePreset();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return (
			<div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
				<div>
					<Skeleton className="h-5 w-28" />
					<Skeleton className="mt-2 h-4 w-48" />
				</div>
				<div className="space-y-8 md:col-span-2">
					<div>
						<Skeleton className="mb-3 h-4 w-12" />
						<div className="flex gap-3">
							<Skeleton className="h-8 w-20" />
							<Skeleton className="h-8 w-20" />
							<Skeleton className="h-8 w-20" />
						</div>
					</div>
					<div>
						<Skeleton className="mb-3 h-4 w-28" />
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
							{["skel-1", "skel-2", "skel-3", "skel-4", "skel-5", "skel-6"].map(
								(id) => (
									<Skeleton className="h-14 rounded-lg" key={id} />
								)
							)}
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
			<div>
				<h2 className="font-semibold text-base text-foreground leading-7">
					Appearance
				</h2>
				<p className="mt-1 text-muted-foreground text-sm leading-6">
					Customise how the platform looks. Changes are saved to your browser
					and apply immediately.
				</p>
			</div>

			<div className="space-y-8 md:col-span-2">
				{/* Mode selector */}
				<div>
					<h3 className="mb-3 font-medium text-foreground text-sm">Mode</h3>
					<div className="flex gap-3">
						{modeOptions.map((option) => (
							<Button
								className={cn(
									"flex items-center gap-2",
									theme === option.id &&
										"ring-2 ring-primary ring-offset-2 ring-offset-background"
								)}
								key={option.id}
								onClick={() => setTheme(option.id)}
								size="sm"
								variant={theme === option.id ? "default" : "outline"}
							>
								<option.icon className="h-4 w-4" />
								{option.label}
							</Button>
						))}
					</div>
				</div>

				{/* Colour preset picker */}
				<div>
					<h3 className="mb-3 font-medium text-foreground text-sm">
						Colour preset
					</h3>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
						{availablePresets.map((p) => {
							const isActive = preset.id === p.id;
							const lightVars = p.light;
							const darkVars = p.dark;
							// Use whichever mode the user currently has
							const vars = resolvedTheme === "dark" ? darkVars : lightVars;
							const primary =
								vars["--primary"] ?? "oklch(0.5547 0.2503 297.0156)";
							const background =
								vars["--background"] ?? "oklch(0.9578 0.0058 264.5321)";
							const sidebar =
								vars["--sidebar"] ?? "oklch(0.9335 0.0087 264.5206)";

							return (
								<button
									className={cn(
										"flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
										isActive
											? "border-primary bg-primary/5"
											: "border-border hover:border-primary/50"
									)}
									key={p.id}
									onClick={() => setPreset(p.id)}
									type="button"
								>
									<PresetSwatch
										background={background}
										primary={primary}
										sidebar={sidebar}
									/>
									<div className="flex flex-1 items-center justify-between">
										<span className="font-medium text-foreground text-sm">
											{p.name}
										</span>
										{isActive && <Check className="h-4 w-4 text-primary" />}
									</div>
								</button>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}
