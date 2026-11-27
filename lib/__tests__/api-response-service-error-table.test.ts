import { describe, expect, it } from "vitest";
import { serviceErrorToAppError } from "../api-response";

function answer(message: string) {
	const error = serviceErrorToAppError(message);
	return { code: error.code, status: error.statusCode };
}

const INTERNAL = { code: "INTERNAL", status: 500 };

/** Messages whose whole text is fixed or counted: nothing may come before or after. */
const CONFLICT_EXACT = [
	"This record is not revoked",
	"This claim's check is set in its evidence settings",
	"Accepted settings cannot be saved as a suggestion",
	"These settings were changed by someone else",
	"These settings are not accepted",
	"The case changed while you were saving. Try again.",
	"The case changed while it was being published. Try again.",
	"Cannot suspend a revoked integration",
	"Cannot reactivate a revoked integration",
	"Cannot issue a token for a non-active integration",
	"Cannot rotate a token for a non-active integration",
	"Cannot grant case access for a suspended integration",
	"Cannot grant case access for a revoked integration",
	"Cannot grant case access for a non-active integration",
	"Cannot rotate a revoked token",
	"Cannot rotate an expired token",
	"Remove your 1 integration before deleting your account",
	"Remove your 12 integrations before deleting your account",
];

/** Conflict messages that also contain a word an earlier entry matches. */
const CONFLICT_WITH_EARLIER_WORD = [
	"These settings are already inactive",
	"This claim already has a live evidence node",
];

const VALIDATION_EXACT = [
	"The top goal cannot be detached",
	"Cannot set element as its own parent",
	"Cannot move element to one of its descendants",
	"1 element still to fill in",
	"2 elements still to fill in",
	"12 elements still to fill in",
	"2 elements still to fill in; 1 variable with no value",
	"12 elements still to fill in; 10 variables with no value",
	"1 variable with no value",
	"3 variables with no value",
	"Invalid or expired reset token",
	"Invalid invite",
	"Invite has expired",
	"Password must be at least 8 characters",
	"Password must contain at least one uppercase letter",
	"Password must contain at least one number",
	"Password must contain at least one special character",
	"Current password is incorrect",
];

const FORBIDDEN_EXACT = [
	"Invite was sent to a different email address",
	"Password change is not available for OAuth accounts",
	"No password set for this account",
	"No plugin that uses models is enabled",
];

const UNPROCESSABLE_EXACT = ["A case can only have one goal claim"];

/** Messages that must start a refusal, and may carry more text after the fixed part. */
const VALIDATION_OPENING = [
	'Context entry id "abc1234567" is used by more than one entry in this case',
	"Context entry names must not be empty",
	"Unknown scope(s): reports:write, cases:fly",
	"Unknown element type 'FOO'",
	"Unknown element type 'FOO': it can no longer be created",
	"assertionStatus cannot be set to AS_CITED: it is reserved for imported cases, not author-declared",
	"citedElementId is only applicable to AWAY_GOAL elements",
	"citedElementId must reference an existing element",
	"citedElementId cannot reference the element itself",
	"moduleReferenceId is only applicable to MODULE and AWAY_GOAL elements",
	"moduleReferenceId is required for MODULE and AWAY_GOAL elements",
	"moduleReferenceId must reference a case you can view",
	"defeatsElementId cannot reference the element itself",
	"defeatsElementId must reference an existing element in this case",
	"parentId is required for a goal defeater",
	"parentId cannot be set on evidence; use move or detach",
	"parentId cannot be a piece of evidence unless the element is a counter-goal",
	"parentId must be a property claim to attach evidence",
	"inSandbox cannot be set on the general edit; use the detach route",
	"inSandbox cannot be cleared on the general edit; use the attach route",
	"inSandbox cannot be changed in a batch; use the detach or attach route (element abc)",
	"assumption is not applicable to EVIDENCE elements",
	"justification is not applicable to EVIDENCE elements",
	"context is not applicable to EVIDENCE elements",
	"url is not applicable to GOAL elements",
	"URL is not applicable to GOAL elements",
	"urls is not applicable to GOAL elements",
	"A batch can change an element only once (element abc)",
	"Circular reference detected when moving element abc",
	"featureImageUrl must be this case's own feature image address, empty, or an external https address",
];

const BOUND_CHECK =
	"This claim is bound to check Fairness. Evidence from another check needs its own evidence claim in the case.";
const STATUS_TRANSITION = "Invalid status transition: DRAFT to DRAFT";
const OTHER_OPENING = [BOUND_CHECK, STATUS_TRANSITION];

const CODE_STATUS: Record<string, number> = {
	CONFLICT: 409,
	VALIDATION: 400,
	FORBIDDEN: 403,
	UNPROCESSABLE: 422,
	PAYLOAD_TOO_LARGE: 413,
};

const ANSWER_GROUPS: [label: string, messages: string[], code: string][] = [
	[
		"a state conflict",
		[...CONFLICT_EXACT, ...CONFLICT_WITH_EARLIER_WORD],
		"CONFLICT",
	],
	[
		"a rule or input failure",
		[...VALIDATION_EXACT, ...VALIDATION_OPENING],
		"VALIDATION",
	],
	[
		"a refused person or plugin",
		[...FORBIDDEN_EXACT, "Plugin 'tea.health' is not enabled"],
		"FORBIDDEN",
	],
	["a rule refusal", [...UNPROCESSABLE_EXACT, BOUND_CHECK], "UNPROCESSABLE"],
	["a refused status change", [STATUS_TRANSITION], "CONFLICT"],
	[
		"an oversized file",
		["File size exceeds maximum of 5MB"],
		"PAYLOAD_TOO_LARGE",
	],
	[
		"a file of a type that is not allowed",
		[
			"Invalid file type. Allowed types: image/png, image/jpeg",
			"Invalid file type. The file's content does not match an allowed image format.",
		],
		"VALIDATION",
	],
	[
		"an element name that breaks its format",
		[
			"Goal names must look like G1 or G1.1",
			"Property Claim names must look like CP1 or CP1.1",
			"Names must follow this element type's registered format",
		],
		"VALIDATION",
	],
];

describe("serviceErrorToAppError for the refusals services produce", () => {
	it.each(ANSWER_GROUPS)("answers %s", (_label, messages, code) => {
		const actual = messages.map((message) => {
			const result = answer(message);
			return `${message} => ${result.code} ${result.status}`;
		});
		const expected = messages.map(
			(message) => `${message} => ${code} ${CODE_STATUS[code]}`
		);

		expect(actual).toStrictEqual(expected);
	});
});

describe("serviceErrorToAppError keeps the message it was given", () => {
	it.each([
		["This claim's check is set in its evidence settings", "CONFLICT"],
		["Invalid invite", "VALIDATION"],
		["Invite was sent to a different email address", "FORBIDDEN"],
		["A case can only have one goal claim", "UNPROCESSABLE"],
		["File size exceeds maximum of 5MB", "PAYLOAD_TOO_LARGE"],
	])("%s", (message, code) => {
		const error = serviceErrorToAppError(message);

		expect(error.code).toBe(code);
		expect(error.message).toBe(message);
	});
});

describe("serviceErrorToAppError for a fixed message with extra text around it", () => {
	const strict = [
		...CONFLICT_EXACT,
		...VALIDATION_EXACT,
		...FORBIDDEN_EXACT.filter((message) => !message.startsWith("No plugin")),
		...UNPROCESSABLE_EXACT,
	];

	it("treats a message with text before it as unmapped", () => {
		for (const message of strict) {
			expect(answer(`Error: ${message}`), message).toStrictEqual(INTERNAL);
		}
	});

	it("treats a message with text after it as unmapped", () => {
		for (const message of strict) {
			expect(answer(`${message} extra`), message).toStrictEqual(INTERNAL);
		}
	});

	it("treats the reasons that only open with a fixed part as unmapped when text comes before", () => {
		for (const message of [...VALIDATION_OPENING, ...OTHER_OPENING]) {
			expect(answer(`Error: ${message}`), message).toStrictEqual(INTERNAL);
		}
	});

	it("treats the plugin refusals as unmapped when text comes before or after", () => {
		expect(answer("Error: Plugin 'tea.health' is not enabled")).toStrictEqual(
			INTERNAL
		);
		expect(answer("Plugin 'tea.health' is not enabled yet")).toStrictEqual(
			INTERNAL
		);
		expect(answer("Plugin '' is not enabled")).toStrictEqual(INTERNAL);
		expect(
			answer("Error: No plugin that uses models is enabled")
		).toStrictEqual(INTERNAL);
		expect(
			answer("No plugin that uses models is enabled for you")
		).toStrictEqual(INTERNAL);
	});
});

describe("serviceErrorToAppError for the order of the table", () => {
	it("answers a bound-check refusal by its own rule whatever the check is called", () => {
		const message =
			"This claim is bound to check Permission denied audit. Evidence from another check needs its own evidence claim in the case.";

		expect(answer(message)).toStrictEqual({
			code: "UNPROCESSABLE",
			status: 422,
		});
	});

	it("answers a context entry refusal by its own rule whatever the entry is called", () => {
		const message =
			'Context entry id "already" is used by more than one entry in this case';

		expect(answer(message)).toStrictEqual({ code: "VALIDATION", status: 400 });
	});
});
