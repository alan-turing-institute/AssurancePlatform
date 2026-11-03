"use client";

import { Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PatternVariable } from "@/lib/case/pattern-variables";
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

/** A value this long or longer gets a count by its field, so a cut-off paste is not silent. */
const COUNT_FROM = Math.floor(CONTEXT_ENTRY_VALUE_MAX_LENGTH * 0.9);

/**
 * The count shown by a field that is near the limit or at it, so a longer
 * paste that the field cut off is not silent; nothing for a shorter value.
 */
function limitNote(length: number): string | undefined {
	if (length >= CONTEXT_ENTRY_VALUE_MAX_LENGTH) {
		return `${CONTEXT_ENTRY_VALUE_MAX_LENGTH} of ${CONTEXT_ENTRY_VALUE_MAX_LENGTH} characters, the most a value can hold. Longer text is cut off.`;
	}
	return length >= COUNT_FROM
		? `${length} of ${CONTEXT_ENTRY_VALUE_MAX_LENGTH} characters.`
		: undefined;
}

interface VariableFieldProps {
	disabled: boolean;
	onChange: (id: string, value: string) => void;
	/** What the field holds: what the user typed, or the pattern's value. */
	value: string;
	variable: PatternVariable;
}

/**
 * One variable's field, labelled with its name and described by its meaning
 * and, near the limit, by the count of characters.
 */
function VariableField({
	disabled,
	onChange,
	value,
	variable,
}: VariableFieldProps) {
	const meaningId = `variable-meaning-${variable.id}`;
	const noteId = `variable-limit-${variable.id}`;
	const note = limitNote(value.length);
	const described = [variable.meaning ? meaningId : "", note ? noteId : ""]
		.filter(Boolean)
		.join(" ");
	return (
		<div className="space-y-1">
			<Label htmlFor={`variable-value-${variable.id}`}>{variable.name}</Label>
			{variable.meaning && (
				<p
					className="wrap-anywhere whitespace-pre-line text-muted-foreground text-xs"
					id={meaningId}
				>
					{variable.meaning}
				</p>
			)}
			<Input
				aria-describedby={described || undefined}
				disabled={disabled}
				id={`variable-value-${variable.id}`}
				maxLength={CONTEXT_ENTRY_VALUE_MAX_LENGTH}
				onChange={(event) => onChange(variable.id, event.target.value)}
				value={value}
			/>
			{note && (
				<output className="block text-muted-foreground text-xs" id={noteId}>
					{note}
				</output>
			)}
		</div>
	);
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
			<output className="flex items-center gap-2 text-muted-foreground text-sm">
				<Loader className="h-4 w-4 animate-spin" />
				Loading variables
			</output>
		);
	}
	if (state.status === "failed") {
		return (
			<div className="flex items-center gap-2 text-sm">
				<output className="text-destructive">
					Variables could not be loaded.
				</output>
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
				<VariableField
					disabled={disabled}
					key={variable.id}
					onChange={onChange}
					value={typed.get(variable.id) ?? variable.value ?? ""}
					variable={variable}
				/>
			))}
		</fieldset>
	);
}
