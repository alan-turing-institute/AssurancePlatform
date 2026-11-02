import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createAssuranceCase } from "@/actions/assurance-cases";
import {
	createCaseFromPattern,
	fetchViewablePatterns,
} from "@/actions/case-from-pattern";
import type { PublishedPatternPreset } from "@/hooks/modal-hooks";
import type { ActionResult } from "@/lib/errors";
import type { ViewablePattern } from "@/lib/services/case-from-pattern-service";
import type {
	PatternChoices,
	PatternError,
	StartFrom,
} from "./start-from-section";

const GENERIC_ERROR = "An error occurred, please try again later";
const CHOOSE_A_PATTERN = "Choose a pattern to start from";

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
	if (start === "pattern") {
		return chosen
			? await createCaseFromPattern(chosen.source, name, description)
			: { success: false, error: CHOOSE_A_PATTERN };
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

/** The picker entry for a published pattern the dialog was opened with. */
function presetPattern(preset: PublishedPatternPreset): ViewablePattern {
	return {
		key: `published:${preset.slug}`,
		name: preset.title,
		description: preset.description,
		origin: "published",
		source: { publishedSlug: preset.slug },
	};
}

/**
 * The picker's choices with the preset pattern among them. Before the list
 * has loaded, or when it cannot be loaded, the preset is the only choice; once
 * it has loaded, the list's own entry for the pattern is used when it has one.
 */
function withPreset(
	choices: PatternChoices,
	preset: ViewablePattern | undefined
): PatternChoices {
	if (!preset) {
		return choices;
	}
	if (choices.status !== "ready") {
		return { status: "ready", patterns: [preset] };
	}
	return choices.patterns.some((pattern) => pattern.key === preset.key)
		? choices
		: { status: "ready", patterns: [...choices.patterns, preset] };
}

async function submitNewCase(
	start: StartFrom,
	chosen: ViewablePattern | undefined,
	name: string,
	description: string
): Promise<Outcome> {
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
 * dialog; the hook clears its own state whenever the dialog closes. A
 * `preset` is a published pattern the dialog opens with chosen: it starts from
 * "a pattern" with that pattern picked, until the user changes either.
 */
export function useCaseCreate({
	onClose,
	preset,
}: {
	onClose: () => void;
	preset?: PublishedPatternPreset;
}) {
	const router = useRouter();
	const { data: session } = useSession();

	const [loading, setLoading] = useState(false);
	const [errors, setErrors] = useState<string[]>([]);
	// Shown by the picker rather than with the other errors, because it is the
	// picker that needs attention.
	const [patternError, setPatternError] = useState<PatternError | null>(null);
	// What the user has chosen; until they choose, the preset (if any) decides.
	const [pickedStart, setStart] = useState<StartFrom>();
	const [loaded, setChoices] = useState<PatternChoices>({ status: "idle" });
	const [pickedKey, setPatternKey] = useState<string>();
	// A case started from a pattern that had to leave references out stops
	// here, so the user sees what was left out before opening the case.
	const [pending, setPending] = useState<PendingCase | null>(null);

	const presetChoice = useMemo(
		() => (preset ? presetPattern(preset) : undefined),
		[preset]
	);
	const start = pickedStart ?? (preset ? "pattern" : "blank-case");
	const choices = withPreset(loaded, presetChoice);
	const patternKey = pickedKey ?? presetChoice?.key;

	const loadPatterns = useCallback(async () => {
		setChoices({ status: "loading" });
		try {
			const patterns = await fetchViewablePatterns();
			setChoices(
				patterns ? { status: "ready", patterns } : { status: "failed" }
			);
		} catch {
			setChoices({ status: "failed" });
		}
	}, []);

	// The preset is shown at once; the rest of the list follows.
	useEffect(() => {
		if (preset) {
			loadPatterns();
		}
	}, [preset, loadPatterns]);

	const changeStart = (next: StartFrom) => {
		setStart(next);
		setErrors([]);
		setPatternError(null);
		if (next === "pattern" && loaded.status !== "ready") {
			loadPatterns();
		}
	};

	const reset = () => {
		setStart(undefined);
		setChoices({ status: "idle" });
		setPatternKey(undefined);
		setPending(null);
		setErrors([]);
		setPatternError(null);
	};

	const selectPattern = (key: string) => {
		setPatternKey(key);
		setPatternError(null);
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

		const chosen = chosenPattern(choices, patternKey);
		if (start === "pattern" && !chosen) {
			setPatternError({ message: CHOOSE_A_PATTERN });
			return;
		}

		setLoading(true);
		const outcome = await submitNewCase(start, chosen, name, description);
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
		patternError,
		patternKey,
		pending,
		selectPattern,
		start,
	};
}
