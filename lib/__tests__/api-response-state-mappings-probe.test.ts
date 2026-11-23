import { describe, expect, it } from "vitest";
import { serviceErrorToAppError } from "../api-response";

const NOT_PUBLISHED = "Case is not published";
const NO_VERSION = "No published version found";
const TRANSITION = "Invalid status transition: DRAFT to DRAFT";
const INCOMPLETE =
	"Case information is incomplete — add the missing fields before publishing";

function answer(message: string) {
	const error = serviceErrorToAppError(message);
	return { code: error.code, status: error.statusCode, message: error.message };
}

describe("the refusals that name a case's state", () => {
	it.each([
		[NOT_PUBLISHED, "CONFLICT", 409],
		[NO_VERSION, "CONFLICT", 409],
		[TRANSITION, "CONFLICT", 409],
		["Invalid status transition: PUBLISHED to DRAFT", "CONFLICT", 409],
		[INCOMPLETE, "VALIDATION", 400],
	])("answers %s with %s and keeps the message", (message, code, status) => {
		expect(answer(message)).toEqual({ code, status, message });
	});
});

/** Messages that resemble a refusal but are not it, and what each answers. */
const LOOK_ALIKES: [label: string, message: string][] = [
	["a full stop", `${NOT_PUBLISHED}.`],
	["a prefix", `Error: ${NOT_PUBLISHED}`],
	["a suffix", `${NOT_PUBLISHED}: connection reset`],
	["a leading space", ` ${NOT_PUBLISHED}`],
	["a trailing newline", `${NOT_PUBLISHED}\n`],
	["lower case", NOT_PUBLISHED.toLowerCase()],
	["upper case", NOT_PUBLISHED.toUpperCase()],
	["another subject", "Pattern is not published"],
	["no-version prefix", `Upstream: ${NO_VERSION}`],
	["no-version suffix", `${NO_VERSION} for case`],
	["no-version lower case", NO_VERSION.toLowerCase()],
	["no-version full stop", `${NO_VERSION}.`],
	["transition prefix", `Error: ${TRANSITION}`],
	["transition lower case", TRANSITION.toLowerCase()],
	["transition without the colon", "Invalid status transition DRAFT to DRAFT"],
	["transition with a leading space", ` ${TRANSITION}`],
	["incomplete prefix", `Error: ${INCOMPLETE}`],
	["incomplete suffix", `${INCOMPLETE}.`],
	["incomplete lower case", INCOMPLETE.toLowerCase()],
	["incomplete with a hyphen", INCOMPLETE.replace("—", "-")],
	["incomplete from another service", `Import failed: ${INCOMPLETE} (row 3)`],
];

describe("messages that only look like those refusals", () => {
	it.each(LOOK_ALIKES)("leave %s an internal error", (_label, message) => {
		expect(answer(message)).toEqual({
			code: "INTERNAL",
			status: 500,
			message,
		});
	});

	it.each([
		["Permission denied: Case is not published", "FORBIDDEN", 403],
		["Case not found: Case is not published", "NOT_FOUND", 404],
		["Case is not published and already archived", "CONFLICT", 409],
		["Invalid status transition: case not found", "NOT_FOUND", 404],
		["No published version found: Permission denied", "FORBIDDEN", 403],
	])("keep the answer an earlier rule gives %s", (message, code, status) => {
		expect(answer(message)).toMatchObject({ code, status });
	});
});

describe("answers that were already mapped", () => {
	it.each([
		["Permission denied", "FORBIDDEN", 403],
		["Case not found", "NOT_FOUND", 404],
		["Case is already published", "CONFLICT", 409],
		["Failed to publish case", "INTERNAL", 500],
		[
			"The case changed while it was being published. Try again.",
			"CONFLICT",
			409,
		],
		["Something unexpected", "INTERNAL", 500],
	])("%s still answers %s", (message, code, status) => {
		expect(answer(message)).toMatchObject({ code, status });
	});
});
