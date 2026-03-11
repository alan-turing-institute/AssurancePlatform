import { cn } from "@/lib/utils";

/** Resolve a colour value for inline styles — OKLCH passthrough, HSL legacy wrap */
export function resolveColour(value: string): string {
	if (value.startsWith("oklch(")) {
		return value;
	}
	return `hsl(${value})`;
}

type PresetSwatchProps = {
	primary: string;
	background: string;
	sidebar: string;
	className?: string;
};

/** Swatch showing the primary + background + sidebar colours for a preset */
export function PresetSwatch({
	primary,
	background,
	sidebar,
	className,
}: PresetSwatchProps) {
	return (
		<div
			className={cn(
				"flex h-10 w-16 overflow-hidden rounded-md border border-border",
				className
			)}
		>
			<div
				className="w-1/3"
				style={{ backgroundColor: resolveColour(sidebar) }}
			/>
			<div
				className="flex w-2/3 items-center justify-center"
				style={{ backgroundColor: resolveColour(background) }}
			>
				<div
					className="h-3 w-3 rounded-full"
					style={{ backgroundColor: resolveColour(primary) }}
				/>
			</div>
		</div>
	);
}
