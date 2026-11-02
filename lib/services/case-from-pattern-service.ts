import { logger } from "@/lib/logger";
import { viewableCaseWhere } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
	type PatternSource,
	startedCaseDescriptionSchema,
	startedCaseNameSchema,
} from "@/lib/schemas/case-from-pattern";
import { exportCase } from "@/lib/services/case-export-service";
import { importCase } from "@/lib/services/case-import-service";
import { stripComments } from "@/lib/services/discover-transforms";
import type { ServiceResult } from "@/types/service";

const log = logger.child({ component: "case-from-pattern-service" });

/**
 * One pattern a user can start a case from: where it comes from, which
 * source to name when starting the case, and how to show it in a picker.
 */
export interface ViewablePattern {
	description: string;
	/** Stable per pattern and per origin; for list keys and picker values. */
	key: string;
	name: string;
	/** Own pattern, shared with the user, or published on Discover. */
	origin: "own" | "shared" | "published";
	source: PatternSource;
}

/**
 * Lists the patterns a user can start a case from: patterns they own, then
 * patterns shared with them directly or through a team, then the current
 * published patterns on Discover. A site with no published patterns lists
 * none; trashed patterns are never listed.
 */
export async function listViewablePatterns(
	userId: string
): ServiceResult<ViewablePattern[]> {
	try {
		const [cases, published] = await Promise.all([
			prisma.assuranceCase.findMany({
				where: { kind: "PATTERN", ...viewableCaseWhere(userId) },
				select: {
					id: true,
					name: true,
					description: true,
					createdById: true,
				},
				orderBy: { name: "asc" },
			}),
			prisma.publishedAssuranceCase.findMany({
				where: { type: "ARGUMENT_PATTERN", isCurrent: true },
				select: { slug: true, title: true, description: true },
				orderBy: { title: "asc" },
			}),
		]);

		const fromCases = cases.map((pattern): ViewablePattern => {
			const own = pattern.createdById === userId;
			return {
				key: `case:${pattern.id}`,
				name: pattern.name,
				description: pattern.description ?? "",
				origin: own ? "own" : "shared",
				source: { patternCaseId: pattern.id },
			};
		});

		return {
			data: [
				...fromCases.filter((pattern) => pattern.origin === "own"),
				...fromCases.filter((pattern) => pattern.origin === "shared"),
				...published.map(
					(pattern): ViewablePattern => ({
						key: `published:${pattern.slug}`,
						name: pattern.title,
						description: pattern.description ?? "",
						origin: "published",
						source: { publishedSlug: pattern.slug },
					})
				),
			],
		};
	} catch (error) {
		log.error("listViewablePatterns", { userId, error });
		return { error: "Failed to fetch patterns" };
	}
}

/** What a source gives the import: the pattern's file and the case it came from. */
interface PatternFile {
	file: unknown;
	/** The PATTERN case the new case records as its source, when there is one. */
	sourcePatternId: string | null;
}

/**
 * One message for a pattern that does not exist, that the user cannot view
 * and that is in the trash, so the answer does not reveal which.
 */
const PATTERN_NOT_FOUND = "Pattern not found";

/**
 * Reads a pattern case the user can view. Refuses a case that is not a
 * pattern, and does not copy comments: an import would attribute them to the
 * user who copies the pattern.
 */
async function readPatternCase(
	userId: string,
	patternCaseId: string
): ServiceResult<PatternFile> {
	const pattern = await prisma.assuranceCase.findFirst({
		where: { id: patternCaseId, ...viewableCaseWhere(userId) },
		select: { kind: true },
	});
	if (!pattern) {
		return { error: PATTERN_NOT_FOUND };
	}
	if (pattern.kind !== "PATTERN") {
		return { error: "That case is not a pattern" };
	}

	const exported = await exportCase(userId, patternCaseId, {
		includeComments: false,
	});
	if ("error" in exported) {
		return { error: "Could not read that pattern" };
	}
	return { data: { file: exported.data, sourcePatternId: patternCaseId } };
}

/**
 * Reads the current published copy of a pattern. Only a row of type
 * ARGUMENT_PATTERN is read: the slug of a published case is refused, so this
 * cannot be used to copy any published case. An archived copy is still the
 * current row and is read like any other; its source case may be gone.
 * Comments that an older snapshot still holds are dropped.
 */
async function readPublishedPattern(
	publishedSlug: string
): ServiceResult<PatternFile> {
	const row = await prisma.publishedAssuranceCase.findFirst({
		where: { slug: publishedSlug, isCurrent: true, type: "ARGUMENT_PATTERN" },
		select: {
			content: true,
			assuranceCaseId: true,
			assuranceCase: { select: { kind: true } },
		},
	});
	if (!row) {
		return { error: PATTERN_NOT_FOUND };
	}
	return {
		data: {
			file: stripComments(row.content),
			sourcePatternId:
				row.assuranceCase?.kind === "PATTERN" ? row.assuranceCaseId : null,
		},
	};
}

/**
 * Starts a new case, owned by the user, from a pattern: a copy of the
 * pattern's elements with every element marked as coming from the pattern, no
 * comments, and a link back to the pattern when it still exists.
 *
 * The name and description are checked here, with the rules for any new case,
 * because the import does not check the ones it is given. The pattern is read
 * only if the user may view it (or it is published) and it really is a
 * pattern. References in the pattern to cases the user cannot view are
 * cleared by the import and named in `warnings`.
 */
export async function createCaseFromPattern(
	userId: string,
	source: PatternSource,
	name: string,
	description: string
): ServiceResult<{ id: string; warnings: string[] }> {
	const parsedName = startedCaseNameSchema.safeParse(name);
	if (!parsedName.success) {
		return { error: parsedName.error.issues[0]?.message ?? "Invalid name" };
	}
	const parsedDescription = startedCaseDescriptionSchema.safeParse(description);
	if (!parsedDescription.success) {
		return {
			error:
				parsedDescription.error.issues[0]?.message ?? "Invalid description",
		};
	}

	try {
		const pattern =
			"patternCaseId" in source
				? await readPatternCase(userId, source.patternCaseId)
				: await readPublishedPattern(source.publishedSlug);
		if ("error" in pattern) {
			return pattern;
		}

		const imported = await importCase(userId, pattern.data.file, {
			kind: "CASE",
			name: parsedName.data,
			description: parsedDescription.data,
			sourcePatternId: pattern.data.sourcePatternId ?? undefined,
			markFromPattern: true,
		});
		if ("error" in imported) {
			log.error("createCaseFromPattern import", {
				userId,
				error: imported.error,
				validationErrors: imported.validationErrors,
			});
			return { error: imported.error };
		}

		return {
			data: { id: imported.data.caseId, warnings: imported.data.warnings },
		};
	} catch (error) {
		log.error("createCaseFromPattern", { userId, error });
		return { error: "Failed to create case from pattern" };
	}
}
