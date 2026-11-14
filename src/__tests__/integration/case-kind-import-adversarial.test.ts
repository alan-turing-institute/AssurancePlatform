import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { exportCase } from "@/lib/services/case-export-service";
import {
	importCase,
	validateImportData,
} from "@/lib/services/case-import-service";
import { expectSuccess } from "../utils/assertion-helpers";
import {
	createStoredCase,
	createStoredPattern,
	FILE_FORMATS,
	importOk,
	NODE,
	patternFlags,
	RICH_ELEMENT_COUNT,
	richFlatFile,
	richNestedFile,
	storedCase,
} from "../utils/case-kind-kit";
import { createTestUser } from "../utils/prisma-factories";

/**
 * Importing a case file: the kind the file names, the options that override
 * it, the pattern flags the import can set on every element, and the keys a
 * file can never use to link its case to a pattern.
 */

const REFUSED_KINDS: unknown[] = [
	"TEMPLATE",
	"pattern",
	"Pattern",
	"case",
	"",
	null,
	0,
	1,
	true,
	["PATTERN"],
	{},
];

async function counts() {
	return {
		cases: await prisma.assuranceCase.count(),
		elements: await prisma.assuranceElement.count(),
	};
}

/** A nested "1.0" file cannot mark the case as a pattern; every other format can. */
function cannotNamePattern(label: string) {
	return label === "nested 1.0";
}

/** What an import of a nested "1.0" file that names kind PATTERN gives: a refusal at `case.kind` and nothing created. */
const REFUSED_AT_KIND = {
	error: "Invalid import data",
	namesKind: true,
	created: { cases: 0, elements: 0 },
};

/** Imports `file` and reports the error, whether it names `case.kind`, and what was created. */
async function refusalOf(
	userId: string,
	file: unknown,
	options?: Parameters<typeof importCase>[2]
) {
	const before = await counts();

	const result = await importCase(userId, file, options);

	const after = await counts();
	const errors = "validationErrors" in result ? result.validationErrors : [];
	return {
		error: "error" in result ? result.error : undefined,
		namesKind: errors?.some((message) => message.startsWith("case.kind")),
		created: {
			cases: after.cases - before.cases,
			elements: after.elements - before.elements,
		},
	};
}

describe.each(FILE_FORMATS)("the kind a %s file names", (label, build) => {
	it("makes a pattern from kind PATTERN (a nested 1.0 file refuses it), a case from kind CASE, and a case from no kind", async () => {
		const user = await createTestUser();

		if (cannotNamePattern(label)) {
			expect(
				await refusalOf(user.id, build({ caseFields: { kind: "PATTERN" } }))
			).toEqual(REFUSED_AT_KIND);
		} else {
			const pattern = await importOk(
				user.id,
				build({ caseFields: { kind: "PATTERN" } })
			);
			expect((await storedCase(pattern.caseId)).kind).toBe("PATTERN");
		}
		const named = await importOk(
			user.id,
			build({ caseFields: { kind: "CASE" } })
		);
		const silent = await importOk(user.id, build());

		expect((await storedCase(named.caseId)).kind).toBe("CASE");
		expect((await storedCase(silent.caseId)).kind).toBe("CASE");
	});

	it("makes a pattern the importing user owns, with every element of the file (a nested 1.0 file refuses it)", async () => {
		const user = await createTestUser();
		if (cannotNamePattern(label)) {
			expect(
				await refusalOf(user.id, build({ caseFields: { kind: "PATTERN" } }))
			).toEqual(REFUSED_AT_KIND);
			return;
		}

		const imported = await importOk(
			user.id,
			build({ caseFields: { kind: "PATTERN" } })
		);

		const stored = await storedCase(imported.caseId);
		expect(stored.createdById).toBe(user.id);
		expect(stored.sourcePatternId).toBeNull();
		expect(imported.elementCount).toBe(RICH_ELEMENT_COUNT);
		expect((await patternFlags(imported.caseId)).length).toBe(
			RICH_ELEMENT_COUNT
		);
	});

	it("is overridden by the kind option in both directions (a nested 1.0 file that names PATTERN is refused whatever the option says)", async () => {
		const user = await createTestUser();

		const toPattern = await importOk(
			user.id,
			build({ caseFields: { kind: "CASE" } }),
			{ kind: "PATTERN" }
		);
		const fromSilence = await importOk(user.id, build(), { kind: "PATTERN" });
		expect((await storedCase(toPattern.caseId)).kind).toBe("PATTERN");
		expect((await storedCase(fromSilence.caseId)).kind).toBe("PATTERN");
		if (cannotNamePattern(label)) {
			for (const kind of ["CASE", "PATTERN"] as const) {
				expect(
					await refusalOf(user.id, build({ caseFields: { kind: "PATTERN" } }), {
						kind,
					})
				).toEqual(REFUSED_AT_KIND);
			}
			return;
		}

		const toCase = await importOk(
			user.id,
			build({ caseFields: { kind: "PATTERN" } }),
			{ kind: "CASE" }
		);
		const same = await importOk(
			user.id,
			build({ caseFields: { kind: "PATTERN" } }),
			{ kind: "PATTERN" }
		);
		expect((await storedCase(toCase.caseId)).kind).toBe("CASE");
		expect((await storedCase(same.caseId)).kind).toBe("PATTERN");
	});

	it("is used when the kind option is present but undefined (a nested 1.0 file that names PATTERN is refused)", async () => {
		const user = await createTestUser();
		if (cannotNamePattern(label)) {
			expect(
				await refusalOf(user.id, build({ caseFields: { kind: "PATTERN" } }), {
					kind: undefined,
					name: undefined,
					description: undefined,
				})
			).toEqual(REFUSED_AT_KIND);
			return;
		}

		const imported = await importOk(
			user.id,
			build({ caseFields: { kind: "PATTERN" } }),
			{ kind: undefined, name: undefined, description: undefined }
		);

		const stored = await storedCase(imported.caseId);
		expect(stored.kind).toBe("PATTERN");
		expect(stored.name).toBe("File case name");
		expect(stored.description).toBe("File case description");
	});

	it("is refused when invalid, with a validation error naming case.kind, and creates nothing", async () => {
		const user = await createTestUser();
		const before = await counts();

		for (const kind of REFUSED_KINDS) {
			const result = await importCase(user.id, build({ caseFields: { kind } }));

			expect(result).toMatchObject({ error: "Invalid import data" });
			const errors =
				"validationErrors" in result ? result.validationErrors : [];
			expect(errors?.some((message) => message.startsWith("case.kind"))).toBe(
				true
			);
		}

		expect(await counts()).toEqual(before);
	});

	it("is refused when invalid even if the call asks for a kind itself", async () => {
		const user = await createTestUser();
		const before = await counts();

		for (const options of [
			{ kind: "CASE" as const },
			{ kind: "PATTERN" as const },
		]) {
			const result = await importCase(
				user.id,
				build({ caseFields: { kind: "TEMPLATE" } }),
				options
			);

			expect(result).toMatchObject({ error: "Invalid import data" });
		}

		expect(await counts()).toEqual(before);
	});

	it("is reported by the validation preview: a pattern file is valid (not in a nested 1.0 file), an invalid kind is not", async () => {
		const valid = await validateImportData(
			build({ caseFields: { kind: "PATTERN" } })
		);
		const invalid = await validateImportData(
			build({ caseFields: { kind: "pattern" } })
		);

		if (cannotNamePattern(label)) {
			expect(valid.isValid).toBe(false);
			expect(
				valid.errors?.some((message) => message.startsWith("case.kind"))
			).toBe(true);
		} else {
			expect(valid.isValid).toBe(true);
			expect(valid.caseName).toBe("File case name");
		}
		expect(invalid.isValid).toBe(false);
		expect(
			invalid.errors?.some((message) => message.startsWith("case.kind"))
		).toBe(true);
	});
});

describe.each(FILE_FORMATS)("markFromPattern on a %s file", (_label, build) => {
	it("sets fromPattern on every element, including nested claims, defeaters, side-attached elements and evidence", async () => {
		const user = await createTestUser();
		const cited = await createStoredCase(user.id);

		const imported = await importOk(user.id, build({ citedCaseId: cited.id }), {
			markFromPattern: true,
		});

		const flags = await patternFlags(imported.caseId);
		expect(flags.map((row) => row.name).sort()).toEqual(
			[
				"A1",
				"AG1",
				"CG1",
				"CP1",
				"E1",
				"G1",
				"J1",
				"M1",
				"P1",
				"P1.1",
				"S1",
			].sort()
		);
		expect(flags.every((row) => row.fromPattern)).toBe(true);
		expect(flags.every((row) => !row.modifiedFromPattern)).toBe(true);
	});

	it("sets it whatever the file says, including an explicit false", async () => {
		const user = await createTestUser();
		const everyoneOff = Object.fromEntries(
			Object.keys(NODE).map((key) => [key, false])
		);

		const imported = await importOk(
			user.id,
			build({ fromPattern: everyoneOff }),
			{
				markFromPattern: true,
			}
		);

		const flags = await patternFlags(imported.caseId);
		expect(flags).toHaveLength(RICH_ELEMENT_COUNT);
		expect(flags.every((row) => row.fromPattern)).toBe(true);
	});

	it("clears the modified flag on every element, whatever the file says", async () => {
		const user = await createTestUser();

		const imported = await importOk(
			user.id,
			build({ everyElement: { modifiedFromPattern: true } }),
			{ markFromPattern: true }
		);

		const flags = await patternFlags(imported.caseId);
		expect(flags).toHaveLength(RICH_ELEMENT_COUNT);
		expect(flags.every((row) => row.fromPattern)).toBe(true);
		expect(flags.every((row) => row.modifiedFromPattern === false)).toBe(true);
	});

	it("leaves the modified flag as the file has it when the option is absent", async () => {
		const user = await createTestUser();

		const imported = await importOk(
			user.id,
			build({ everyElement: { modifiedFromPattern: true } })
		);

		const modified = await prisma.assuranceElement.count({
			where: { caseId: imported.caseId, modifiedFromPattern: true },
		});
		expect(modified).toBe(RICH_ELEMENT_COUNT);
	});

	it("leaves fromPattern as the file has it when the option is absent", async () => {
		const user = await createTestUser();
		const marked = {
			goal: true,
			claim: true,
			evidence: true,
			claimDefeater: true,
			counterGoal: true,
			strategy: false,
		};

		const imported = await importOk(user.id, build({ fromPattern: marked }));

		const flags = await patternFlags(imported.caseId);
		expect(
			flags
				.filter((row) => row.fromPattern)
				.map((row) => row.name)
				.sort()
		).toEqual(["CG1", "CP1", "E1", "G1", "P1"]);
	});

	it("leaves fromPattern as the file has it when the option is false or undefined", async () => {
		const user = await createTestUser();
		const marked = { goal: true, subClaim: true };

		for (const markFromPattern of [false, undefined]) {
			const imported = await importOk(user.id, build({ fromPattern: marked }), {
				markFromPattern,
			});

			const flags = await patternFlags(imported.caseId);
			expect(
				flags
					.filter((row) => row.fromPattern)
					.map((row) => row.name)
					.sort()
			).toEqual(["G1", "P1.1"]);
		}
	});

	it("does not change the kind or the source link", async () => {
		const user = await createTestUser();

		const imported = await importOk(user.id, build(), {
			markFromPattern: true,
		});

		const stored = await storedCase(imported.caseId);
		expect(stored.kind).toBe("CASE");
		expect(stored.sourcePatternId).toBeNull();
	});
});

describe.each(
	FILE_FORMATS
)("sourcePatternId and a %s file", (_label, build) => {
	it("is set through the option and nowhere else", async () => {
		const user = await createTestUser();
		const pattern = await createStoredPattern(user.id);

		const linked = await importOk(user.id, build(), {
			sourcePatternId: pattern.id,
		});
		const unlinked = await importOk(user.id, build());

		expect((await storedCase(linked.caseId)).sourcePatternId).toBe(pattern.id);
		expect((await storedCase(unlinked.caseId)).sourcePatternId).toBeNull();
	});

	it("is never taken from the file: not from the case object, the top level or any element", async () => {
		const user = await createTestUser();
		const pattern = await createStoredPattern(user.id);
		const planted = { sourcePatternId: pattern.id };
		const hostile = [
			build({ caseFields: planted }),
			build({ topLevel: planted }),
			build({ everyElement: planted }),
			build({ topLevel: { options: planted } }),
			build({
				caseFields: planted,
				topLevel: planted,
				everyElement: planted,
				fromPattern: { goal: true },
			}),
		];

		for (const file of hostile) {
			const imported = await importOk(user.id, file);

			expect((await storedCase(imported.caseId)).sourcePatternId).toBeNull();
		}
	});

	it("is never taken from a __proto__ key in the file", async () => {
		const user = await createTestUser();
		const pattern = await createStoredPattern(user.id);
		const text = JSON.stringify(build());
		const file = JSON.parse(
			`{"__proto__":{"sourcePatternId":"${pattern.id}","kind":"PATTERN","markFromPattern":true},${text.slice(1)}`
		);

		const imported = await importOk(user.id, file);

		const stored = await storedCase(imported.caseId);
		expect(stored.sourcePatternId).toBeNull();
		expect(stored.kind).toBe("CASE");
		expect(
			(await patternFlags(imported.caseId)).some((row) => row.fromPattern)
		).toBe(false);
	});

	it("takes the option over a different pattern named in the file", async () => {
		const user = await createTestUser();
		const fromFile = await createStoredPattern(user.id);
		const fromOption = await createStoredPattern(user.id);

		const imported = await importOk(
			user.id,
			build({ caseFields: { sourcePatternId: fromFile.id } }),
			{ sourcePatternId: fromOption.id }
		);

		expect((await storedCase(imported.caseId)).sourcePatternId).toBe(
			fromOption.id
		);
	});

	it("refuses a source that does not exist and leaves no case, element or link behind", async () => {
		const user = await createTestUser();
		const before = await counts();

		const result = await importCase(user.id, build(), {
			sourcePatternId: "99999999-9999-4999-8999-999999999999",
		});

		expect("error" in result).toBe(true);
		expect(await counts()).toEqual(before);
		expect(await prisma.evidenceLink.count()).toBe(0);
	});

	it("ignores option-like keys in the file: a top-level kind, markFromPattern, name and description", async () => {
		const user = await createTestUser();

		const imported = await importOk(
			user.id,
			build({
				topLevel: {
					kind: "PATTERN",
					markFromPattern: true,
					name: "Hijacked name",
					description: "Hijacked description",
					options: { kind: "PATTERN", markFromPattern: true },
				},
			})
		);

		const stored = await storedCase(imported.caseId);
		expect(stored.kind).toBe("CASE");
		expect(stored.name).toBe("File case name");
		expect(stored.description).toBe("File case description");
		expect(
			(await patternFlags(imported.caseId)).some((row) => row.fromPattern)
		).toBe(false);
	});
});

describe.each(
	FILE_FORMATS
)("the name and description options on a %s file", (_label, build) => {
	it("replace the file's name and description, in the result and in the database", async () => {
		const user = await createTestUser();

		const imported = await importOk(user.id, build(), {
			name: "Chosen name",
			description: "Chosen description",
		});

		expect(imported.caseName).toBe("Chosen name");
		const stored = await storedCase(imported.caseId);
		expect(stored.name).toBe("Chosen name");
		expect(stored.description).toBe("Chosen description");
	});

	it("replace one without the other", async () => {
		const user = await createTestUser();

		const nameOnly = await importOk(user.id, build(), { name: "Chosen name" });
		const descriptionOnly = await importOk(user.id, build(), {
			description: "Chosen description",
		});

		const first = await storedCase(nameOnly.caseId);
		expect(first.name).toBe("Chosen name");
		expect(first.description).toBe("File case description");
		const second = await storedCase(descriptionOnly.caseId);
		expect(second.name).toBe("File case name");
		expect(second.description).toBe("Chosen description");
		expect(descriptionOnly.caseName).toBe("File case name");
	});

	it("let an empty description replace the file's description", async () => {
		const user = await createTestUser();

		const imported = await importOk(user.id, build(), { description: "" });

		expect((await storedCase(imported.caseId)).description).toBe("");
	});

	it("do not touch the file's own name when no option is given", async () => {
		const user = await createTestUser();

		const imported = await importOk(user.id, build());

		expect(imported.caseName).toBe("File case name");
	});
});

describe("starting a case from an exported pattern", () => {
	it("makes an ordinary case linked to the pattern, with every element marked, and leaves the pattern as it was", async () => {
		const user = await createTestUser();
		const cited = await createStoredCase(user.id);
		const made = await importOk(
			user.id,
			richNestedFile({
				caseFields: { kind: "PATTERN" },
				citedCaseId: cited.id,
				version: "1.1",
			})
		);
		const patternFile = expectSuccess(await exportCase(user.id, made.caseId));

		const derived = await importOk(
			user.id,
			JSON.parse(JSON.stringify(patternFile)),
			{
				kind: "CASE",
				markFromPattern: true,
				sourcePatternId: made.caseId,
				name: "Started from the pattern",
				description: "My own description",
			}
		);

		const started = await storedCase(derived.caseId);
		expect(started).toMatchObject({
			kind: "CASE",
			sourcePatternId: made.caseId,
			name: "Started from the pattern",
			description: "My own description",
		});
		const flags = await patternFlags(derived.caseId);
		expect(flags).toHaveLength(RICH_ELEMENT_COUNT);
		expect(flags.every((row) => row.fromPattern)).toBe(true);
		const pattern = await storedCase(made.caseId);
		expect(pattern.kind).toBe("PATTERN");
		expect(pattern.sourcePatternId).toBeNull();
		expect(
			(await patternFlags(made.caseId)).some((row) => row.fromPattern)
		).toBe(false);
	});

	it("can start a case from another case started from a pattern, one link each", async () => {
		const user = await createTestUser();
		const pattern = await createStoredPattern(user.id);
		const first = await importOk(user.id, richFlatFile(), {
			sourcePatternId: pattern.id,
		});

		const second = await importOk(user.id, richFlatFile(), {
			sourcePatternId: first.caseId,
		});

		expect((await storedCase(first.caseId)).sourcePatternId).toBe(pattern.id);
		expect((await storedCase(second.caseId)).sourcePatternId).toBe(
			first.caseId
		);
	});
});

describe("importing with no options", () => {
	it("gives the result the same fields as before and an ordinary, unlinked case", async () => {
		const user = await createTestUser();

		const imported = await importOk(user.id, richNestedFile());

		expect(Object.keys(imported).sort()).toEqual([
			"caseId",
			"caseName",
			"commentCount",
			"elementCount",
			"evidenceLinkCount",
			"warnings",
		]);
		expect(imported.elementCount).toBe(RICH_ELEMENT_COUNT);
		expect(imported.evidenceLinkCount).toBe(1);
		expect(await storedCase(imported.caseId)).toMatchObject({
			kind: "CASE",
			sourcePatternId: null,
			name: "File case name",
			description: "File case description",
		});
	});

	it("gives the same case with an empty options object", async () => {
		const user = await createTestUser();

		const imported = await importOk(user.id, richFlatFile(), {});

		expect(await storedCase(imported.caseId)).toMatchObject({
			kind: "CASE",
			sourcePatternId: null,
		});
		expect(
			(await patternFlags(imported.caseId)).some((row) => row.fromPattern)
		).toBe(false);
	});
});
