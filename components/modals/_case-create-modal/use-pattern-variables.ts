import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPatternVariables } from "@/actions/case-from-pattern";
import type { PatternVariable } from "@/lib/case/pattern-variables";
import {
	NOT_A_VARIABLE_MESSAGE,
	type PatternSource,
} from "@/lib/schemas/case-from-pattern";
import type { ViewablePattern } from "@/lib/services/case-from-pattern-service";

/** The chosen pattern's variables, and whether they have been fetched yet. */
export type VariablesState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "failed" }
	| { status: "ready"; variables: PatternVariable[] };

const IDLE: VariablesState = { status: "idle" };
const LOADING: VariablesState = { status: "loading" };

const PATTERN_CHANGED =
	"The pattern has changed since its variables were shown. They have been reloaded: check the fields, then submit again.";

/** The variables of a pattern, or a failed load. */
async function loadVariables(source: PatternSource): Promise<VariablesState> {
	try {
		const variables = await fetchPatternVariables(source);
		return variables ? { status: "ready", variables } : { status: "failed" };
	} catch {
		return { status: "failed" };
	}
}

/**
 * Names the pattern itself, which can be read in two ways: as the published
 * snapshot, and as the pattern case that was published. Both give the same
 * identity, so a change from one to the other is not a change of pattern.
 */
function patternIdentity({ publishedSlug, source }: ViewablePattern): string {
	if (publishedSlug) {
		return `published:${publishedSlug}`;
	}
	return "publishedSlug" in source
		? `published:${source.publishedSlug}`
		: `case:${source.patternCaseId}`;
}

/**
 * The values to send: what the user typed for each of the pattern's variables
 * as it is now. A value typed for a variable the pattern no longer has is left
 * out.
 */
function typedValues(
	state: VariablesState,
	typed: ReadonlyMap<string, string>
): Record<string, string> {
	if (state.status !== "ready") {
		return {};
	}
	return Object.fromEntries(
		state.variables.flatMap((variable): [string, string][] => {
			const value = typed.get(variable.id);
			return value === undefined ? [] : [[variable.id, value]];
		})
	);
}

/**
 * The variables of the pattern the new-case dialog has chosen, and the values
 * the user types for them. Variables are fetched whenever the pattern's
 * `source` changes, and only the latest fetch is used. The values typed
 * belong to one pattern: they are dropped when another pattern is chosen, or
 * none is. When only the source changes, because the list of patterns replaced
 * a published pattern with the case it was published from, it is still the
 * same pattern: the fields on screen stay, with what the user has typed and
 * the focus they hold, until the new variables arrive. A variable the user has
 * not typed in keeps the value the pattern gives it, and one cleared by the
 * user is sent empty so that the new case leaves it unset.
 */
export function usePatternVariables(pattern: ViewablePattern | undefined) {
	const source = pattern?.source;
	const identity = pattern && patternIdentity(pattern);
	const [state, setState] = useState<VariablesState>(IDLE);
	const [typed, setTyped] = useState<ReadonlyMap<string, string>>(new Map());
	const latestLoad = useRef(0);
	// The pattern whose fields are on screen, if any.
	const shownFor = useRef<string | undefined>(undefined);
	// The pattern the typed values belong to.
	const typedFor = useRef<string | undefined>(undefined);

	const load = useCallback(
		async (
			next: PatternSource | undefined,
			nextIdentity: string | undefined
		) => {
			latestLoad.current += 1;
			const thisLoad = latestLoad.current;
			if (nextIdentity !== typedFor.current) {
				typedFor.current = nextIdentity;
				setTyped(new Map());
			}
			if (!next) {
				shownFor.current = undefined;
				setState(IDLE);
				return;
			}
			const keepFields =
				nextIdentity !== undefined && nextIdentity === shownFor.current;
			if (!keepFields) {
				shownFor.current = undefined;
				setState(LOADING);
			}
			const result = await loadVariables(next);
			if (thisLoad !== latestLoad.current) {
				return;
			}
			if (result.status === "ready") {
				shownFor.current = nextIdentity;
				setState(result);
			} else if (!keepFields) {
				setState(result);
			}
		},
		[]
	);

	useEffect(() => {
		load(source, identity);
	}, [source, identity, load]);

	return {
		state,
		typed,
		change: (id: string, value: string) =>
			setTyped((before) => new Map(before).set(id, value)),
		retry: () => load(source, identity),
		/**
		 * What to tell the user about a refusal. A value given to something that
		 * is no longer one of the pattern's variables means the pattern changed
		 * since the fields were shown: its variables are read again, and what was
		 * typed for those that remain is kept.
		 */
		explainRefusal: (message: string): string[] => {
			if (message !== NOT_A_VARIABLE_MESSAGE) {
				return [message];
			}
			load(source, identity);
			return [message, PATTERN_CHANGED];
		},
		valuesToSend: () => typedValues(state, typed),
	};
}
