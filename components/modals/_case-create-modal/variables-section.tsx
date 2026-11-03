"use client";

import { Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CONTEXT_ENTRY_VALUE_MAX_LENGTH } from "@/lib/schemas/context-entry";
import type { VariablesState } from "./use-pattern-variables";

interface VariablesSectionProps {
	disabled: boolean;
	onChange: (id: string, value: string) => void;
	onRetry: () => void;
	state: VariablesState;
	/** What the user has typed, by variable id. */
	typed: ReadonlyMap<string, string>;
}

/**
 * The fields for the chosen pattern's variables in the new-case dialog: one
 * per variable, with its name and meaning, filled in with the value the
 * pattern gives it. Every field is optional. Nothing is shown before a
 * pattern is chosen or when it has no variables.
 */
export function VariablesSection({
	disabled,
	onChange,
	onRetry,
	state,
	typed,
}: VariablesSectionProps) {
	if (state.status === "loading") {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Loader className="h-4 w-4 animate-spin" />
				Loading variables
			</p>
		);
	}
	if (state.status === "failed") {
		return (
			<div className="flex items-center gap-2 text-sm">
				<p className="text-destructive">Variables could not be loaded.</p>
				<Button onClick={onRetry} size="sm" type="button" variant="outline">
					Try again
				</Button>
			</div>
		);
	}
	if (state.status !== "ready" || state.variables.length === 0) {
		return null;
	}

	return (
		<fieldset className="space-y-3">
			<legend className="font-medium text-sm">Variables</legend>
			<p className="text-muted-foreground text-xs">
				Values are optional. A variable you leave empty shows as its name in
				square brackets until you set it in the case.
			</p>
			{state.variables.map((variable) => (
				<div className="space-y-1" key={variable.id}>
					<Label htmlFor={`variable-value-${variable.id}`}>
						{variable.name}
					</Label>
					{variable.meaning && (
						<p
							className="wrap-anywhere whitespace-pre-line text-muted-foreground text-xs"
							id={`variable-meaning-${variable.id}`}
						>
							{variable.meaning}
						</p>
					)}
					<Input
						aria-describedby={
							variable.meaning ? `variable-meaning-${variable.id}` : undefined
						}
						disabled={disabled}
						id={`variable-value-${variable.id}`}
						maxLength={CONTEXT_ENTRY_VALUE_MAX_LENGTH}
						onChange={(event) => onChange(variable.id, event.target.value)}
						value={typed.get(variable.id) ?? variable.value ?? ""}
					/>
				</div>
			))}
		</fieldset>
	);
}
