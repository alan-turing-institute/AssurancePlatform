"use client";

import {
	ArrowDown,
	ArrowRight,
	Check,
	Monitor,
	Moon,
	Settings,
	Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { PresetSwatch } from "@/components/ui/preset-swatch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import useStore from "@/store/store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useThemePreset } from "@/providers/theme-preset-provider";
import ActionTooltip from "../ui/action-tooltip";

const modeOptions = [
	{ id: "light", label: "Light", icon: Sun },
	{ id: "dark", label: "Dark", icon: Moon },
	{ id: "system", label: "System", icon: Monitor },
] as const;

const directionOptions = [
	{ id: "TB", label: "Top-down", icon: ArrowDown },
	{ id: "LR", label: "Left-right", icon: ArrowRight },
] as const;

export function CaseSettingsPopover() {
	const { theme, setTheme, resolvedTheme } = useTheme();
	const { preset, setPreset, availablePresets } = useThemePreset();
	const { assuranceCase, layoutDirection, setLayoutDirection, triggerLayout } =
		useStore();
	const [mounted, setMounted] = useState(false);

	const handleDirectionChange = async (dir: "TB" | "LR") => {
		if (dir === layoutDirection) {
			return;
		}
		setLayoutDirection(dir);

		// Re-layout with new direction (triggerLayout reads from store)
		// Small delay to allow state to settle before layout
		await new Promise<void>((resolve) => {
			setTimeout(async () => {
				await triggerLayout();
				resolve();
			}, 0);
		});

		// Persist to API
		if (assuranceCase?.id) {
			fetch(`/api/cases/${assuranceCase.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ layout_direction: dir }),
			}).catch(() => {
				toast({
					variant: "destructive",
					title: "Error",
					description: "Failed to save layout direction",
				});
			});
		}
	};

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return (
			<ActionTooltip label="Settings">
				<Button className="rounded-full p-3" disabled size="icon" type="button">
					<Settings className="h-5 w-5" />
					<span className="sr-only">Settings</span>
				</Button>
			</ActionTooltip>
		);
	}

	return (
		<Popover>
			<ActionTooltip label="Settings">
				<PopoverTrigger asChild>
					<Button className="rounded-full p-3" size="icon" type="button">
						<Settings className="h-5 w-5" />
						<span className="sr-only">Settings</span>
					</Button>
				</PopoverTrigger>
			</ActionTooltip>
			<PopoverContent className="w-80" side="top" sideOffset={12}>
				<div className="space-y-4">
					{/* Mode selector */}
					<section>
						<h4 className="mb-2 font-medium text-foreground text-sm">Mode</h4>
						<div className="flex gap-2">
							{modeOptions.map((option) => (
								<Button
									className={cn(
										"flex items-center gap-1.5",
										theme === option.id &&
											"ring-2 ring-primary ring-offset-2 ring-offset-background"
									)}
									key={option.id}
									onClick={() => setTheme(option.id)}
									size="sm"
									variant={theme === option.id ? "default" : "outline"}
								>
									<option.icon className="h-3.5 w-3.5" />
									{option.label}
								</Button>
							))}
						</div>
					</section>

					<Separator />

					{/* Layout direction */}
					<section>
						<h4 className="mb-2 font-medium text-foreground text-sm">
							Layout direction
						</h4>
						<div className="flex gap-2">
							{directionOptions.map((option) => (
								<Button
									className={cn(
										"flex items-center gap-1.5",
										layoutDirection === option.id &&
											"ring-2 ring-primary ring-offset-2 ring-offset-background"
									)}
									key={option.id}
									onClick={() => handleDirectionChange(option.id)}
									size="sm"
									variant={
										layoutDirection === option.id ? "default" : "outline"
									}
								>
									<option.icon className="h-3.5 w-3.5" />
									{option.label}
								</Button>
							))}
						</div>
					</section>

					<Separator />

					{/* Colour preset picker */}
					<section>
						<h4 className="mb-2 font-medium text-foreground text-sm">
							Colour preset
						</h4>
						<ScrollArea className="max-h-64">
							<div className="grid grid-cols-2 gap-2">
								{availablePresets.map((p) => {
									const isActive = preset.id === p.id;
									const vars = resolvedTheme === "dark" ? p.dark : p.light;
									const primary =
										vars["--primary"] ?? "oklch(0.5547 0.2503 297.0156)";
									const background =
										vars["--background"] ?? "oklch(0.9578 0.0058 264.5321)";
									const sidebar =
										vars["--sidebar"] ?? "oklch(0.9335 0.0087 264.5206)";

									return (
										<button
											className={cn(
												"flex items-center gap-2 rounded-lg border p-2 text-left transition-colors",
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
												className="h-8 w-12"
												primary={primary}
												sidebar={sidebar}
											/>
											<div className="flex flex-1 items-center justify-between">
												<span className="font-medium text-foreground text-xs">
													{p.name}
												</span>
												{isActive && (
													<Check className="h-3.5 w-3.5 text-primary" />
												)}
											</div>
										</button>
									);
								})}
							</div>
						</ScrollArea>
					</section>
				</div>
			</PopoverContent>
		</Popover>
	);
}
