"use client";

import { Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { ViewablePattern } from "@/lib/services/case-from-pattern-service";

export type StartFrom = "blank-case" | "blank-pattern" | "pattern";

/** The patterns the picker offers, and whether they have been fetched yet. */
export type PatternChoices =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "failed" }
	| { patterns: ViewablePattern[]; status: "ready" };

interface StartFromSectionProps {
	choices: PatternChoices;
	disabled: boolean;
	onPatternChange: (key: string) => void;
	onStartChange: (start: StartFrom) => void;
	patternKey: string | undefined;
	start: StartFrom;
}

const STARTS: { hint: string; label: string; value: StartFrom }[] = [
	{
		value: "blank-case",
		label: "A blank case",
		hint: "One top-level goal to build on.",
	},
	{
		value: "blank-pattern",
		label: "A blank pattern",
		hint: "A reusable argument that cases can be started from.",
	},
	{
		value: "pattern",
		label: "A pattern",
		hint: "A copy of a pattern you can view.",
	},
];

const ORIGIN_HEADINGS: Record<ViewablePattern["origin"], string> = {
	own: "Your patterns",
	shared: "Shared with you",
	published: "Published on Discover",
};

const ORIGINS = ["own", "shared", "published"] as const;

function PatternPicker({
	choices,
	disabled,
	onPatternChange,
	onRetry,
	patternKey,
}: {
	choices: PatternChoices;
	disabled: boolean;
	onPatternChange: (key: string) => void;
	onRetry: () => void;
	patternKey: string | undefined;
}) {
	if (choices.status === "idle" || choices.status === "loading") {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Loader className="h-4 w-4 animate-spin" />
				Loading patterns
			</p>
		);
	}
	if (choices.status === "failed") {
		return (
			<div className="flex items-center gap-2 text-sm">
				<p className="text-destructive">Patterns could not be loaded.</p>
				<Button onClick={onRetry} size="sm" type="button" variant="outline">
					Try again
				</Button>
			</div>
		);
	}
	if (choices.patterns.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				You have no patterns to start from yet.
			</p>
		);
	}

	const chosen = choices.patterns.find((pattern) => pattern.key === patternKey);
	return (
		<div className="space-y-2">
			<Label htmlFor="start-from-pattern-picker">Pattern</Label>
			<Select
				disabled={disabled}
				onValueChange={onPatternChange}
				value={patternKey}
			>
				<SelectTrigger id="start-from-pattern-picker">
					<SelectValue placeholder="Choose a pattern" />
				</SelectTrigger>
				<SelectContent>
					{ORIGINS.map((origin) => {
						const patterns = choices.patterns.filter(
							(pattern) => pattern.origin === origin
						);
						if (patterns.length === 0) {
							return null;
						}
						return (
							<SelectGroup key={origin}>
								<SelectLabel>{ORIGIN_HEADINGS[origin]}</SelectLabel>
								{patterns.map((pattern) => (
									<SelectItem key={pattern.key} value={pattern.key}>
										{pattern.name}
									</SelectItem>
								))}
							</SelectGroup>
						);
					})}
				</SelectContent>
			</Select>
			{chosen && (
				<p className="whitespace-pre-line text-muted-foreground text-sm">
					{chosen.description || "This pattern has no description."}
				</p>
			)}
		</div>
	);
}

/**
 * The "Start from" choice in the new-case dialog: a blank case, a blank
 * pattern, or a copy of a pattern picked from those the user can view.
 */
export function StartFromSection({
	choices,
	disabled,
	onPatternChange,
	onStartChange,
	patternKey,
	start,
}: StartFromSectionProps) {
	return (
		<div className="space-y-3">
			<Label id="start-from-label">Start from</Label>
			<RadioGroup
				aria-labelledby="start-from-label"
				disabled={disabled}
				onValueChange={(value) => {
					const chosen = STARTS.find((option) => option.value === value);
					if (chosen) {
						onStartChange(chosen.value);
					}
				}}
				value={start}
			>
				{STARTS.map((option) => (
					<div className="flex items-start space-x-2" key={option.value}>
						<RadioGroupItem
							className="mt-0.5"
							id={`start-from-${option.value}`}
							value={option.value}
						/>
						<Label
							className="space-y-1 font-normal"
							htmlFor={`start-from-${option.value}`}
						>
							<span className="block">{option.label}</span>
							<span className="block text-muted-foreground text-xs">
								{option.hint}
							</span>
						</Label>
					</div>
				))}
			</RadioGroup>
			{start === "pattern" && (
				<PatternPicker
					choices={choices}
					disabled={disabled}
					onPatternChange={onPatternChange}
					onRetry={() => onStartChange("pattern")}
					patternKey={patternKey}
				/>
			)}
		</div>
	);
}
