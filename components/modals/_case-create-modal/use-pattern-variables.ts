import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPatternVariables } from "@/actions/case-from-pattern";
import type { PatternVariable } from "@/lib/case/pattern-variables";
import type { PatternSource } from "@/lib/schemas/case-from-pattern";

/** The chosen pattern's variables, and whether they have been fetched yet. */
export type VariablesState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "failed" }
	| { status: "ready"; variables: PatternVariable[] };

const IDLE: VariablesState = { status: "idle" };

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
 * as it is now. A value typed for a pattern chosen earlier is left out.
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
 * and only the latest fetch is used. A variable the user has not typed in
 * keeps the value the pattern gives it, and one cleared by the user is sent
 * empty so that the new case leaves it unset.
 */
export function usePatternVariables(source: PatternSource | undefined) {
	const [state, setState] = useState<VariablesState>(IDLE);
	const [typed, setTyped] = useState<ReadonlyMap<string, string>>(new Map());
	const latestLoad = useRef(0);

	const load = useCallback(async (next: PatternSource | undefined) => {
		latestLoad.current += 1;
		const thisLoad = latestLoad.current;
		if (!next) {
			setState(IDLE);
			return;
		}
		setState({ status: "loading" });
		const result = await loadVariables(next);
		if (thisLoad === latestLoad.current) {
			setState(result);
		}
	}, []);

	useEffect(() => {
		load(source);
	}, [source, load]);

	return {
		state,
		typed,
		change: (id: string, value: string) =>
			setTyped((before) => new Map(before).set(id, value)),
		forget: () => setTyped(new Map()),
		retry: () => load(source),
		valuesToSend: () => typedValues(state, typed),
	};
}
