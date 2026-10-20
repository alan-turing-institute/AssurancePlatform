const ENDS_A_SENTENCE = /[.!?]$/;

/**
 * The description of the evidence element the health plugin adds under a
 * claim when its settings are accepted. It names the check and the pipeline
 * that runs it, and says what the check measures when its entry in the check
 * list has a description. It never carries a result, so it stays true in an
 * export, a report or a published copy where nothing is live.
 *
 * Pure, so the server that writes the text and an interface that previews it
 * build the same words.
 */
export function evidenceNodeText(
	check: { description?: string; name: string },
	pipeline: string
): string {
	const opening = `Results from the ${check.name} check, run by ${pipeline}.`;
	const measures = check.description?.trim();
	if (!measures) {
		return opening;
	}
	const ending = ENDS_A_SENTENCE.test(measures) ? "" : ".";
	return `${opening} It measures: ${measures}${ending}`;
}
