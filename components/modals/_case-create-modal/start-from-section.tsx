"use client";

import { Loader } from "lucide-react";
import { useEffect, useRef } from "react";
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

/**
 * Why no pattern could be used. Each failed submit makes a new object, so the
 * picker takes focus again even when the message is the same as before.
 */
export interface PatternError {
	message: string;
}

interface StartFromSectionProps {
	choices: PatternChoices;
	disabled: boolean;
	onPatternChange: (key: string) => void;
	onStartChange: (start: StartFrom) => void;
	patternError: PatternError | null;
	patternKey: string | undefined;
	start: StartFrom;
}

const PATTERN_ERROR_ID = "start-from-pattern-error";

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
	patternError,
	patternKey,
}: {
	choices: PatternChoices;
	disabled: boolean;
	onPatternChange: (key: string) => void;
	onRetry: () => void;
	patternError: PatternError | null;
	patternKey: string | undefined;
}) {
	const triggerRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		if (patternError) {
			triggerRef.current?.focus();
		}
	}, [patternError]);

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
				<SelectTrigger
					aria-describedby={patternError ? PATTERN_ERROR_ID : undefined}
					aria-invalid={patternError ? true : undefined}
					className="aria-invalid:border-destructive"
					id="start-from-pattern-picker"
					ref={triggerRef}
				>
					<SelectValue placeholder="Choose a pattern" />
				</SelectTrigger>
				<SelectContent className="w-(--radix-select-trigger-width)">
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
									<SelectItem
										className="[&>span:last-child]:min-w-0"
										key={pattern.key}
										title={pattern.name}
										value={pattern.key}
									>
										<span className="flex items-baseline gap-2">
											<span className="truncate">{pattern.name}</span>{" "}
											{pattern.archived && (
												<span className="shrink-0 text-muted-foreground text-xs">
													Archived
												</span>
											)}
										</span>
									</SelectItem>
								))}
							</SelectGroup>
						);
					})}
				</SelectContent>
			</Select>
			{chosen && (
				<p
					className="wrap-anywhere max-h-24 overflow-y-auto whitespace-pre-line text-muted-foreground text-sm"
					// biome-ignore lint/a11y/noNoninteractiveTabindex: a long description scrolls, and a scrolling region has to take focus to be reachable by keyboard
					tabIndex={0}
				>
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
	patternError,
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
				<div className="space-y-2">
					<PatternPicker
						choices={choices}
						disabled={disabled}
						onPatternChange={onPatternChange}
						onRetry={() => onStartChange("pattern")}
						patternError={patternError}
						patternKey={patternKey}
					/>
					{patternError && (
						<p className="text-destructive text-sm" id={PATTERN_ERROR_ID}>
							{patternError.message}
						</p>
					)}
				</div>
			)}
		</div>
	);
}
