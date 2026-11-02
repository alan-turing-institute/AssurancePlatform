import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useState } from "react";
import { createAssuranceCase } from "@/actions/assurance-cases";
import {
	createCaseFromPattern,
	fetchViewablePatterns,
} from "@/actions/case-from-pattern";
import type { ActionResult } from "@/lib/errors";
import type { ViewablePattern } from "@/lib/services/case-from-pattern-service";
import type { PatternChoices, StartFrom } from "./start-from-section";

const GENERIC_ERROR = "An error occurred, please try again later";

/** A case that was created but is held on screen until the user opens it. */
interface PendingCase {
	id: string;
	warnings: string[];
}

type Outcome =
	| { status: "error"; message: string }
	| { status: "created"; id: string; warnings: string[] };

/**
 * Creates the case the dialog describes: a copy of the chosen pattern, a blank
 * pattern, or a blank case. Only a copy of a pattern can come back with
 * warnings.
 */
async function requestCase(
	start: StartFrom,
	chosen: ViewablePattern | undefined,
	name: string,
	description: string
): Promise<ActionResult<{ id: string; warnings: string[] }>> {
	if (start === "pattern" && chosen) {
		return await createCaseFromPattern(chosen.source, name, description);
	}
	const created = await createAssuranceCase({
		name,
		description,
		kind: start === "blank-pattern" ? "PATTERN" : "CASE",
	});
	return created.success
		? { success: true, data: { id: created.data.id, warnings: [] } }
		: created;
}

/** The pattern the user picked, once the list of patterns has loaded. */
function chosenPattern(
	choices: PatternChoices,
	patternKey: string | undefined
): ViewablePattern | undefined {
	return choices.status === "ready"
		? choices.patterns.find((pattern) => pattern.key === patternKey)
		: undefined;
}

async function submitNewCase(
	start: StartFrom,
	chosen: ViewablePattern | undefined,
	name: string,
	description: string
): Promise<Outcome> {
	if (start === "pattern" && !chosen) {
		return { status: "error", message: "Choose a pattern to start from" };
	}
	try {
		const result = await requestCase(start, chosen, name, description);
		if (!result.success) {
			return { status: "error", message: result.error ?? GENERIC_ERROR };
		}
		return { status: "created", ...result.data };
	} catch (_ex) {
		return { status: "error", message: GENERIC_ERROR };
	}
}

/**
 * State and actions of the new-case dialog: which start is chosen, the
 * patterns the picker offers, and creating the case. `onClose` closes the
 * dialog; the hook clears its own state whenever the dialog closes.
 */
export function useCaseCreate({ onClose }: { onClose: () => void }) {
	const router = useRouter();
	const { data: session } = useSession();

	const [loading, setLoading] = useState(false);
	const [errors, setErrors] = useState<string[]>([]);
	const [start, setStart] = useState<StartFrom>("blank-case");
	const [choices, setChoices] = useState<PatternChoices>({ status: "idle" });
	const [patternKey, setPatternKey] = useState<string>();
	// A case started from a pattern that had to leave references out stops
	// here, so the user sees what was left out before opening the case.
	const [pending, setPending] = useState<PendingCase | null>(null);

	const loadPatterns = useCallback(async () => {
		setChoices({ status: "loading" });
		const patterns = await fetchViewablePatterns();
		setChoices(patterns ? { status: "ready", patterns } : { status: "failed" });
	}, []);

	const changeStart = (next: StartFrom) => {
		setStart(next);
		setErrors([]);
		if (next === "pattern" && choices.status !== "ready") {
			loadPatterns();
		}
	};

	const reset = () => {
		setStart("blank-case");
		setChoices({ status: "idle" });
		setPatternKey(undefined);
		setPending(null);
		setErrors([]);
	};

	const close = () => {
		reset();
		onClose();
	};

	const openCase = (id: string) => {
		close();
		router.push(`/case/${id}`);
	};

	const create = async (name: string, description: string) => {
		// Check user.id for JWT-only mode compatibility (key may not exist in JWT-only mode)
		if (!session?.user?.id) {
			setErrors(["You must be logged in to create a case"]);
			return;
		}

		setLoading(true);
		const outcome = await submitNewCase(
			start,
			chosenPattern(choices, patternKey),
			name,
			description
		);
		setLoading(false);

		if (outcome.status === "error") {
			setErrors([outcome.message]);
		} else if (outcome.warnings.length > 0) {
			setPending({ id: outcome.id, warnings: outcome.warnings });
		} else {
			openCase(outcome.id);
		}
	};

	return {
		changeStart,
		choices,
		close,
		create,
		errors,
		loading,
		openCase,
		patternKey,
		pending,
		setPatternKey,
		start,
	};
}
