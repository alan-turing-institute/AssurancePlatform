import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPatternVariables } from "@/actions/case-from-pattern";
import type { PatternVariable } from "@/lib/case/pattern-variables";
import {
	NOT_A_VARIABLE_MESSAGE,
	type PatternSource,
} from "@/lib/schemas/case-from-pattern";

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
 * the user types for them. Variables are fetched whenever `source` changes,
 * and only the latest fetch is used. `identity` names the pattern itself, which
 * more than one source can read: when `source` changes but `identity` does
 * not, the fields on screen stay, with what the user has typed and the focus
 * they hold, until the new variables arrive. A variable the user has not typed
 * in keeps the value the pattern gives it, and one cleared by the user is sent
 * empty so that the new case leaves it unset.
 */
export function usePatternVariables(
	source: PatternSource | undefined,
	identity: string | undefined
) {
	const [state, setState] = useState<VariablesState>(IDLE);
	const [typed, setTyped] = useState<ReadonlyMap<string, string>>(new Map());
	const latestLoad = useRef(0);
	// The pattern whose fields are on screen, if any.
	const shownFor = useRef<string | undefined>(undefined);

	const load = useCallback(
		async (
			next: PatternSource | undefined,
			nextIdentity: string | undefined
		) => {
			latestLoad.current += 1;
			const thisLoad = latestLoad.current;
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
		forget: () => setTyped(new Map()),
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
