import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/**
 * The pattern the user picked: from the list of patterns once it has loaded,
 * or the preset pattern, which can be chosen without the list.
 */
function chosenPattern(
	choices: PatternChoices,
	patternKey: string | undefined,
	preset: ViewablePattern | undefined
): ViewablePattern | undefined {
	const listed =
		choices.status === "ready"
			? choices.patterns.find((pattern) => pattern.key === patternKey)
			: undefined;
	return listed ?? (preset?.key === patternKey ? preset : undefined);
}

/** The picker key of a published pattern's own entry. */
function presetKey(preset: PublishedPatternPreset): string {
	return `published:${preset.slug}`;
}

/** The picker entry for a published pattern the dialog was opened with. */
function presetPattern(preset: PublishedPatternPreset): ViewablePattern {
	return {
		key: presetKey(preset),
		name: preset.title,
		description: preset.description,
		origin: "published",
		source: { publishedSlug: preset.slug },
	};
}

/**
 * The entry in the loaded list that stands for the preset pattern: the
 * published entry itself, or the pattern case it was published from when the
 * user can view that case.
 */
function listedPreset(
	choices: PatternChoices,
	preset: PublishedPatternPreset | undefined
): ViewablePattern | undefined {
	if (!preset || choices.status !== "ready") {
		return undefined;
	}
	return choices.patterns.find(
		(pattern) =>
			pattern.key === presetKey(preset) || pattern.publishedSlug === preset.slug
	);
}

/**
 * The picker's choices with the preset pattern among them. Before the list
 * has loaded the preset is the only choice; once it has loaded, the list's
 * own entry for the pattern is used when it has one, so the pattern appears
 * once. A list that could not be loaded stays failed, and the preset stays
 * chosen.
 */
function withPreset(
	choices: PatternChoices,
	preset: ViewablePattern | undefined,
	listed: ViewablePattern | undefined
): PatternChoices {
	if (!preset || choices.status === "failed") {
		return choices;
	}
	if (choices.status !== "ready") {
		return { status: "ready", patterns: [preset] };
	}
	return listed
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
	const listed = listedPreset(loaded, preset);
	const choices = withPreset(loaded, presetChoice, listed);
	const patternKey = pickedKey ?? listed?.key ?? presetChoice?.key;

	// Counts the loads started, so that only the latest one is used: a load
	// that finishes after the dialog closed, or after a later load began, is
	// ignored.
	const latestLoad = useRef(0);

	const loadPatterns = useCallback(async () => {
		latestLoad.current += 1;
		const thisLoad = latestLoad.current;
		setChoices({ status: "loading" });
		let result: PatternChoices;
		try {
			const patterns = await fetchViewablePatterns();
			result = patterns ? { status: "ready", patterns } : { status: "failed" };
		} catch {
			result = { status: "failed" };
		}
		if (thisLoad === latestLoad.current) {
			setChoices(result);
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
		latestLoad.current += 1;
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

		const chosen = chosenPattern(choices, patternKey, presetChoice);
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
