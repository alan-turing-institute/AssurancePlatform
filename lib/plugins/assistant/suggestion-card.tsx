"use client";

import { getToolName, isToolUIPart, type UIMessage } from "ai";
import { type RefObject, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { applySuggestion } from "./apply-suggestion";
import {
	type EditSuggestion,
	type NewElementSuggestion,
	parseSuggestionResult,
	type Refusal,
	SUGGESTION_TOOL_NAMES,
	type Suggestion,
	type SuggestionOutcome,
	typeLabel,
} from "./suggestion";

type MessagePart = UIMessage["parts"][number];

const FIELD_NAMES = {
	description: "Description",
	assumption: "Assumption",
	justification: "Justification",
	context: "Context",
} as const;

const CHANGED_TEXT: Record<Suggestion["kind"], string> = {
	edit: "This element has changed since the suggestion was made, so nothing was saved. Ask the assistant again.",
	new: "The element it would go beneath has changed since the suggestion was made, so nothing was saved. Ask the assistant again.",
};

const OUTCOME_TEXT: Record<Exclude<SuggestionOutcome, "changed">, string> = {
	applied: "Applied",
	dismissed: "Dismissed",
};

function Empty() {
	return <span className="text-muted-foreground">(empty)</span>;
}

/** Case text, shown as plain text and never as markdown, so that it cannot turn into a link or an image. */
function PlainText({ children }: { children: string }) {
	return (
		<p className="whitespace-pre-wrap break-words">
			{children === "" ? <Empty /> : children}
		</p>
	);
}

function PlainList({ items }: { items: string[] }) {
	if (items.length === 0) {
		return (
			<p>
				<Empty />
			</p>
		);
	}
	const keyed = items.map((item, position) => ({
		item,
		key: `${position}-${item}`,
	}));
	return (
		<ul className="ml-4 list-disc">
			{keyed.map(({ item, key }) => (
				<li className="whitespace-pre-wrap break-words" key={key}>
					{item}
				</li>
			))}
		</ul>
	);
}

function Side({
	heading,
	children,
}: {
	children: React.ReactNode;
	heading: string;
}) {
	return (
		<div>
			<p className="text-muted-foreground text-xs">{heading}</p>
			{children}
		</div>
	);
}

function EditChange({
	field,
	change,
}: {
	change: { after: string | string[]; before: string | string[] };
	field: keyof typeof FIELD_NAMES;
}) {
	const show = (value: string | string[]) =>
		Array.isArray(value) ? (
			<PlainList items={value} />
		) : (
			<PlainText>{value}</PlainText>
		);
	return (
		<div className="space-y-1" data-testid="assistant-suggestion-change">
			<p className="font-medium">{FIELD_NAMES[field]}</p>
			<Side heading="Current">{show(change.before)}</Side>
			<Side heading="Suggested">{show(change.after)}</Side>
		</div>
	);
}

function EditBody({ suggestion }: { suggestion: EditSuggestion }) {
	const { changes } = suggestion;
	return (
		<>
			{(Object.keys(FIELD_NAMES) as (keyof typeof FIELD_NAMES)[]).map(
				(field) => {
					const change = changes[field];
					return change ? (
						<EditChange change={change} field={field} key={field} />
					) : null;
				}
			)}
		</>
	);
}

function NewBody({ suggestion }: { suggestion: NewElementSuggestion }) {
	return (
		<div className="space-y-1">
			<p>
				New {typeLabel(suggestion.childType)} beneath{" "}
				{suggestion.parentLabel || `this ${typeLabel(suggestion.parentType)}`}
			</p>
			<Side heading="Text">
				<PlainText>{suggestion.description}</PlainText>
			</Side>
		</div>
	);
}

function heading(suggestion: Suggestion): string {
	if (suggestion.kind === "edit") {
		return `Suggested change to ${suggestion.label || `this ${typeLabel(suggestion.elementType)}`}`;
	}
	return `Suggested new ${typeLabel(suggestion.childType)}`;
}

interface ActionsProps {
	canEdit: boolean;
	onApply: () => void;
	onDismiss: () => void;
	outcome: SuggestionOutcome | undefined;
	/** Where the line saying what became of the suggestion is kept, so that focus can be moved to it. */
	outcomeLine: RefObject<HTMLOutputElement | null>;
	pending: boolean;
	suggestion: Suggestion;
}

/** The Apply and Dismiss buttons, or what became of the suggestion once the user has decided. */
function Actions({
	canEdit,
	onApply,
	onDismiss,
	outcome,
	outcomeLine,
	pending,
	suggestion,
}: ActionsProps) {
	if (outcome) {
		return (
			<output
				className="block outline-offset-2"
				ref={outcomeLine}
				tabIndex={-1}
			>
				{outcome === "changed"
					? CHANGED_TEXT[suggestion.kind]
					: OUTCOME_TEXT[outcome]}
			</output>
		);
	}
	if (!canEdit) {
		return (
			<p className="text-muted-foreground">
				Applying a suggestion needs permission to edit this case.
			</p>
		);
	}
	return (
		<div className="flex gap-2">
			<Button disabled={pending} onClick={onApply} size="sm" type="button">
				Apply
			</Button>
			<Button
				disabled={pending}
				onClick={onDismiss}
				size="sm"
				type="button"
				variant="outline"
			>
				Dismiss
			</Button>
		</div>
	);
}

interface SuggestionCardProps {
	canEdit: boolean;
	caseId: string;
	onOutcome: (outcome: SuggestionOutcome) => void;
	outcome: SuggestionOutcome | undefined;
	suggestion: Suggestion;
}

/**
 * A suggested change, shown in the open beside its collapsed tool row. Nothing
 * in the case changes until Apply is chosen. Apply saves it as if the user had
 * typed it into the element's form, or refuses and says why; Dismiss leaves
 * the case as it was.
 */
function SuggestionCard({
	canEdit,
	caseId,
	onOutcome,
	outcome,
	suggestion,
}: SuggestionCardProps) {
	const headingId = useId();
	const claimed = useRef(false);
	const card = useRef<HTMLElement>(null);
	const outcomeLine = useRef<HTMLOutputElement>(null);
	const previousOutcome = useRef(outcome);
	const [pending, setPending] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);

	// The buttons are gone once the user has decided, and focus would fall to
	// the page. Move it to the line that says what became of the suggestion,
	// unless the user has already moved on to something else.
	useEffect(() => {
		const wasUndecided = previousOutcome.current === undefined;
		previousOutcome.current = outcome;
		if (!wasUndecided || outcome === undefined) {
			return;
		}
		const focused = document.activeElement;
		if (
			!focused ||
			focused === document.body ||
			card.current?.contains(focused)
		) {
			outcomeLine.current?.focus();
		}
	}, [outcome]);

	async function apply() {
		if (claimed.current) {
			return;
		}
		claimed.current = true;
		setPending(true);
		setFailure(null);
		const result = await applySuggestion(caseId, suggestion);
		claimed.current = false;
		setPending(false);
		if (result.status === "failed") {
			setFailure(result.message);
			return;
		}
		onOutcome(result.status);
	}

	return (
		<article
			aria-labelledby={headingId}
			className="not-prose mb-4 w-full space-y-3 rounded-md border p-3 text-sm"
			data-testid="assistant-suggestion"
			ref={card}
		>
			<h3 className="break-words font-semibold" id={headingId}>
				{heading(suggestion)}
			</h3>
			{suggestion.kind === "edit" ? (
				<EditBody suggestion={suggestion} />
			) : (
				<NewBody suggestion={suggestion} />
			)}
			<Actions
				canEdit={canEdit}
				onApply={apply}
				onDismiss={() => onOutcome("dismissed")}
				outcome={outcome}
				outcomeLine={outcomeLine}
				pending={pending}
				suggestion={suggestion}
			/>
			{failure && (
				<p className="text-destructive" role="alert">
					{failure}
				</p>
			)}
		</article>
	);
}

/** A request the tool refused, with its reason in plain words. There is nothing to apply. */
function SuggestionRefusal({ refusal }: { refusal: Refusal }) {
	return (
		<div
			className="not-prose mb-4 w-full rounded-md border border-dashed p-3 text-sm"
			data-testid="assistant-suggestion-refused"
		>
			<p className="break-words">Not suggested: {refusal.reason}</p>
		</div>
	);
}

interface SuggestionResultProps {
	canEdit: boolean;
	caseId: string;
	onOutcome: (toolCallId: string, outcome: SuggestionOutcome) => void;
	/** What the user has done with this call's card, when anything. */
	outcome: SuggestionOutcome | undefined;
	part: MessagePart;
}

/**
 * The open view of a suggestion tool's result: a card with Apply and Dismiss
 * for a suggestion, a plain line for a refusal. Renders nothing for any other
 * part, for a call still running or failed, and for a result of another shape,
 * which the collapsed tool row still shows.
 */
export function SuggestionResult({
	canEdit,
	caseId,
	onOutcome,
	outcome,
	part,
}: SuggestionResultProps) {
	if (
		!(
			isToolUIPart(part) && SUGGESTION_TOOL_NAMES.includes(getToolName(part))
		) ||
		part.state !== "output-available"
	) {
		return null;
	}
	const result = parseSuggestionResult(part.output);
	if (!result) {
		return null;
	}
	if (!result.suggested) {
		return <SuggestionRefusal refusal={result} />;
	}
	return (
		<SuggestionCard
			canEdit={canEdit}
			caseId={caseId}
			onOutcome={(decision) => onOutcome(part.toolCallId, decision)}
			outcome={outcome}
			suggestion={result}
		/>
	);
}
