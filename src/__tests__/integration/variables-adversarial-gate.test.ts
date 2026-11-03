import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { createCaseFromPattern } from "@/lib/services/case-from-pattern-service";
import { convertCaseKind } from "@/lib/services/case-kind-service";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	openWorld,
	putElement,
	seedElement,
	seedPlaceholderClaim,
} from "../utils/placeholder-kit";
import {
	createTestCaseInformation,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";
import {
	MORE,
	OTHER,
	PUBLISH_ROUTES,
	publishCase,
	publishStatusOf,
	putContext,
	ref,
	SYS,
	setContext,
	setStatus,
	setText,
	snapshotCount,
	storedContext,
	type VariableWorld,
	variableEntry,
	variableWorld,
} from "../utils/variables-kit";

/**
 * The publish gate and variables: a case that mentions a variable with no
 * value cannot be published or republished, on either route; a variable that
 * is defined and not mentioned does not hold it back, and neither does any
 * variable hold back a pattern.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(async () => {
	await mockNoAuth();
});

async function errorOf(response: Response): Promise<string> {
	return (await response.json()).error;
}

const ONE = "1 variable with no value";

/** Where a mention of the variable can sit, each as a way to write it on the world. */
const MENTIONS: [string, (world: VariableWorld) => Promise<void>][] = [
	[
		"the top goal's description",
		(w) =>
			setText(w.goalId, { description: `The ${ref("system", SYS)} works` }),
	],
	[
		"a strategy's description",
		(w) => setText(w.strategyId, { description: `Over ${ref("system", SYS)}` }),
	],
	[
		"a strategy's assumption",
		(w) =>
			setText(w.strategyId, { assumption: `Assumes ${ref("system", SYS)}` }),
	],
	[
		"a strategy's justification",
		(w) =>
			setText(w.strategyId, { justification: `Because ${ref("system", SYS)}` }),
	],
	[
		"a claim's description",
		(w) => setText(w.claimId, { description: `Claim ${ref("system", SYS)}` }),
	],
	[
		"a claim's justification",
		(w) => setText(w.claimId, { justification: `Why ${ref("system", SYS)}` }),
	],
	[
		"a piece of evidence",
		(w) =>
			setText(w.evidenceId, { description: `Tested ${ref("system", SYS)}` }),
	],
	[
		"a plain line of a claim's context",
		(w) => setContext(w.claimId, [`see ${ref("system", SYS)}`]),
	],
	[
		"the meaning of another named entry",
		(w) =>
			setContext(w.claimId, [
				{ id: OTHER, name: "window", text: `uses ${ref("system", SYS)}` },
			]),
	],
	[
		"the meaning of the variable itself",
		(w) =>
			setContext(w.goalId, [
				variableEntry(undefined, "system", SYS, `the ${ref("system", SYS)}`),
			]),
	],
];

describe.each(
	PUBLISH_ROUTES
)("publishing a case through %s", (_label, publish) => {
	it.each(
		MENTIONS
	)("refuses a variable with no value mentioned in %s, saying how many, and publishes nothing", async (_where, mention) => {
		const world = await variableWorld();
		await mention(world);

		const response = await publish(world.caseId);

		expect(response.status).toBe(400);
		expect(await errorOf(response)).toBe(ONE);
		expect(await snapshotCount(world.caseId)).toBe(0);
		expect(await publishStatusOf(world.caseId)).toBe("DRAFT");
	});

	it("publishes a case that defines a variable with no value and mentions it nowhere", async () => {
		const world = await variableWorld();

		const response = await publish(world.caseId);

		expect(response.status).toBe(200);
		expect(await snapshotCount(world.caseId)).toBe(1);
	});

	it("publishes once the variable has a value, and refuses again when the value is taken away", async () => {
		const world = await variableWorld();
		await setText(world.claimId, {
			description: `Claim ${ref("system", SYS)}`,
		});
		expect((await publish(world.caseId)).status).toBe(400);

		expect(
			(await putContext(world.goalId, [variableEntry("AcmeBot")])).status
		).toBe(200);
		const published = await publish(world.caseId);
		expect(published.status).toBe(200);
	});

	it.each([
		["spaces", "   "],
		["a newline", "\n"],
		["a tab", "\t"],
	])("treats a value of %s as no value", async (_what, value) => {
		const world = await variableWorld("CASE");
		await setText(world.claimId, {
			description: `Claim ${ref("system", SYS)}`,
		});
		await setContext(world.goalId, [variableEntry(value)]);

		const response = await publish(world.caseId);

		expect(response.status).toBe(400);
		expect(await errorOf(response)).toBe(ONE);
	});

	it.each([
		["a plain word", "AcmeBot"],
		["a value that looks like a reference", `{system#${SYS}}`],
		["a value that looks like another unset variable", `{other#${OTHER}}`],
		["a value of [system]", "[system]"],
		["a value of (not set)", "(not set)"],
		["the longest allowed value", "v".repeat(500)],
	])("accepts %s as a value", async (_what, value) => {
		const world = await variableWorld("CASE", value);
		await setText(world.claimId, {
			description: `Claim ${ref("system", SYS)}`,
		});

		const response = await publish(world.caseId);

		expect(response.status).toBe(200);
	});

	it("does not count a value that names an unset variable as a mention of it", async () => {
		const world = await variableWorld("CASE", `{other#${OTHER}}`);
		await setContext(world.claimId, [variableEntry(undefined, "other", OTHER)]);
		await setText(world.claimId, {
			description: `Claim ${ref("system", SYS)}`,
		});

		const response = await publish(world.caseId);

		expect(response.status).toBe(200);
	});

	it("counts a variable once however many places mention it", async () => {
		const world = await variableWorld();
		await setText(world.goalId, { description: `A ${ref("system", SYS)}` });
		await setText(world.strategyId, {
			description: `B ${ref("system", SYS)}`,
			assumption: `C ${ref("system", SYS)}`,
		});
		await setText(world.claimId, { description: `D ${ref("system", SYS)}` });
		await setText(world.evidenceId, { description: `E ${ref("system", SYS)}` });

		const response = await publish(world.caseId);

		expect(await errorOf(response)).toBe(ONE);
	});

	it("counts two variables as two, in the plural", async () => {
		const world = await variableWorld();
		await setContext(world.goalId, [
			variableEntry(undefined, "system", SYS),
			variableEntry(undefined, "operator", MORE),
		]);
		await setText(world.claimId, {
			description: `${ref("system", SYS)} and ${ref("operator", MORE)}`,
		});

		const response = await publish(world.caseId);

		expect(response.status).toBe(400);
		expect(await errorOf(response)).toBe("2 variables with no value");
	});

	it("counts two variables that share a name as two", async () => {
		const world = await variableWorld();
		await setContext(world.strategyId, [
			variableEntry(undefined, "system", MORE),
		]);
		await setText(world.goalId, { description: `A ${ref("system", SYS)}` });
		await setText(world.claimId, { description: `B ${ref("system", MORE)}` });

		expect(await errorOf(await publish(world.caseId))).toBe(
			"2 variables with no value"
		);
	});

	it("counts only the variables that have no value", async () => {
		const world = await variableWorld();
		await setContext(world.goalId, [
			variableEntry("AcmeBot", "system", SYS),
			variableEntry(undefined, "operator", MORE),
		]);
		await setText(world.claimId, {
			description: `${ref("system", SYS)} and ${ref("operator", MORE)}`,
		});

		expect(await errorOf(await publish(world.caseId))).toBe(ONE);
	});

	it("does not count an ordinary term with no value", async () => {
		const world = await variableWorld();
		await setContext(world.goalId, [
			{ id: SYS, name: "system", text: "the system under test" },
		]);
		await setText(world.claimId, {
			description: `Claim ${ref("system", SYS)}`,
		});

		expect((await publish(world.caseId)).status).toBe(200);
	});

	it("does not count a mention where the definition is out of reach: above it or beside it", async () => {
		const world = await variableWorld();
		await setContext(world.goalId, []);
		await setContext(world.strategyId, [
			variableEntry(undefined, "system", SYS),
		]);
		// The goal is above the definition; the second branch is beside it.
		await setText(world.goalId, { description: `Above ${ref("system", SYS)}` });
		const other = await seedElement({
			caseId: world.caseId,
			createdById: world.ownerId,
			elementType: "STRATEGY",
			name: "S2",
			parentId: world.goalId,
			description: `Beside ${ref("system", SYS)}`,
		});
		await seedElement({
			caseId: world.caseId,
			createdById: world.ownerId,
			elementType: "PROPERTY_CLAIM",
			name: "P2",
			parentId: other.id,
			description: `Beneath it ${ref("system", SYS)}`,
		});

		expect((await publish(world.caseId)).status).toBe(200);

		// The same words below the definition do count.
		await setText(world.claimId, {
			description: `Below ${ref("system", SYS)}`,
		});
		expect(await errorOf(await publish(world.caseId))).toBe(ONE);
	});

	it("does not count evidence whose claim cannot reach the definition, and counts it where it can", async () => {
		const world = await variableWorld();
		await setContext(world.goalId, []);
		await setContext(world.claimId, [variableEntry(undefined, "system", SYS)]);
		const second = await seedElement({
			caseId: world.caseId,
			createdById: world.ownerId,
			elementType: "PROPERTY_CLAIM",
			name: "P2",
			parentId: world.strategyId,
			description: "A sibling claim",
		});
		const stray = await seedElement({
			caseId: world.caseId,
			createdById: world.ownerId,
			elementType: "EVIDENCE",
			name: "E2",
			description: `Only under the sibling ${ref("system", SYS)}`,
		});
		await prisma.evidenceLink.create({
			data: { evidenceId: stray.id, claimId: second.id },
		});

		expect((await publish(world.caseId)).status).toBe(200);

		await setText(world.evidenceId, {
			description: `E1 ${ref("system", SYS)}`,
		});
		expect(await errorOf(await publish(world.caseId))).toBe(ONE);
	});

	it("counts evidence shared by two claims once", async () => {
		const world = await variableWorld();
		const second = await seedElement({
			caseId: world.caseId,
			createdById: world.ownerId,
			elementType: "PROPERTY_CLAIM",
			name: "P2",
			parentId: world.strategyId,
			description: "A sibling claim",
		});
		await prisma.evidenceLink.create({
			data: { evidenceId: world.evidenceId, claimId: second.id },
		});
		await setText(world.evidenceId, {
			description: `E1 ${ref("system", SYS)}`,
		});

		expect(await errorOf(await publish(world.caseId))).toBe(ONE);
	});

	it("does not count a mention in the sandbox, which is not published", async () => {
		const world = await variableWorld();
		await seedElement({
			caseId: world.caseId,
			createdById: world.ownerId,
			elementType: "PROPERTY_CLAIM",
			name: "P9",
			description: `Loose ${ref("system", SYS)}`,
			inSandbox: true,
		});

		expect((await publish(world.caseId)).status).toBe(200);
	});

	it("does not count a mention in an element that has been deleted", async () => {
		const world = await variableWorld();
		await setText(world.claimId, {
			description: `Claim ${ref("system", SYS)}`,
		});
		await prisma.assuranceElement.update({
			where: { id: world.claimId },
			data: { deletedAt: new Date() },
		});

		expect((await publish(world.caseId)).status).toBe(200);
	});

	it("does not count a variable whose element has been deleted, since the mention is then out of reach", async () => {
		const world = await variableWorld();
		await setContext(world.goalId, []);
		const holder = await seedElement({
			caseId: world.caseId,
			createdById: world.ownerId,
			elementType: "STRATEGY",
			name: "S2",
			parentId: world.goalId,
			description: "Holds the definition",
		});
		await setContext(holder.id, [variableEntry(undefined, "system", SYS)]);
		await setText(world.strategyId, {
			description: `Mention ${ref("system", SYS)}`,
		});
		await prisma.assuranceElement.update({
			where: { id: holder.id },
			data: { deletedAt: new Date() },
		});

		expect((await publish(world.caseId)).status).toBe(200);
	});

	it("says both counts in one message when elements are still to fill in as well", async () => {
		const world = await variableWorld();
		await setText(world.claimId, {
			description: `Claim ${ref("system", SYS)}`,
		});
		await seedPlaceholderClaim(world, { name: "P7" });

		const response = await publish(world.caseId);

		expect(response.status).toBe(400);
		expect(await errorOf(response)).toBe(`1 element still to fill in; ${ONE}`);
	});

	it("says the plural of each in the combined message", async () => {
		const world = await variableWorld();
		await setContext(world.goalId, [
			variableEntry(undefined, "system", SYS),
			variableEntry(undefined, "operator", MORE),
		]);
		await setText(world.claimId, {
			description: `${ref("system", SYS)} ${ref("operator", MORE)}`,
		});
		await seedPlaceholderClaim(world, { name: "P7" });
		await seedPlaceholderClaim(world, { name: "P8" });

		expect(await errorOf(await publish(world.caseId))).toBe(
			"2 elements still to fill in; 2 variables with no value"
		);
	});

	it("says only the placeholders when no variable is left, and only the variables when no placeholder is", async () => {
		const world = await variableWorld("CASE", "AcmeBot");
		await setText(world.claimId, {
			description: `Claim ${ref("system", SYS)}`,
		});
		await seedPlaceholderClaim(world, { name: "P7" });
		expect(await errorOf(await publish(world.caseId))).toBe(
			"1 element still to fill in"
		);
	});

	it("reports missing case information before anything to fill in, with its field errors", async () => {
		const world = await openWorld("CASE");
		await setContext(world.goalId, [variableEntry()]);
		await setText(world.goalId, { description: `A ${ref("system", SYS)}` });

		const response = await publish(world.caseId);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.fieldErrors).toBeDefined();
		expect(body.error).not.toContain("variable");
	});

	it("publishes a pattern that mentions a variable with no value", async () => {
		const world = await variableWorld("PATTERN");
		await setText(world.claimId, {
			description: `Claim ${ref("system", SYS)}`,
		});
		await setText(world.evidenceId, {
			description: `Ev ${ref("system", SYS)}`,
		});

		const response = await publish(world.caseId);

		expect(response.status).toBe(200);
		expect(await snapshotCount(world.caseId)).toBe(1);
	});

	it("keeps the unset variable in the published copy of a pattern", async () => {
		const world = await variableWorld("PATTERN");
		await setText(world.claimId, {
			description: `Claim ${ref("system", SYS)}`,
		});
		expect((await publish(world.caseId)).status).toBe(200);

		const snapshot = await prisma.publishedAssuranceCase.findFirstOrThrow({
			where: { assuranceCaseId: world.caseId },
		});
		const tree = (snapshot.content as { tree: { context: unknown[] } }).tree;
		expect(tree.context).toEqual([variableEntry()]);
	});

	it("keeps the variable's flag and value in the published copy of a case", async () => {
		const world = await variableWorld("CASE", "AcmeBot");
		await setText(world.claimId, {
			description: `Claim ${ref("system", SYS)}`,
		});
		expect((await publish(world.caseId)).status).toBe(200);

		const snapshot = await prisma.publishedAssuranceCase.findFirstOrThrow({
			where: { assuranceCaseId: world.caseId },
		});
		const tree = (snapshot.content as { tree: { context: unknown[] } }).tree;
		expect(tree.context).toEqual([variableEntry("AcmeBot")]);
	});

	it.each([
		["an empty variable", undefined],
		["a variable with a value", "AcmeBot"],
	])("refuses a user with only VIEW access, whether the case has %s, and publishes nothing", async (_what, value) => {
		const world = await variableWorld("CASE", value);
		await setText(world.claimId, {
			description: `Claim ${ref("system", SYS)}`,
		});
		const viewer = await createTestUser();
		await createTestPermission(world.caseId, viewer.id, world.ownerId, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email);

		const response = await publish(world.caseId);
		const body = JSON.stringify(await response.json());

		expect(response.status).not.toBe(200);
		expect(body).not.toContain(SYS);
		expect(body).not.toContain("AcmeBot");
		expect(await snapshotCount(world.caseId)).toBe(0);
		expect(await publishStatusOf(world.caseId)).toBe("DRAFT");
	});

	it("gives a user with no access the answer for a case that does not exist", async () => {
		const world = await variableWorld();
		await setText(world.claimId, {
			description: `Claim ${ref("system", SYS)}`,
		});
		const stranger = await createTestUser();
		await mockAuth(stranger.id, stranger.username, stranger.email);

		const response = await publish(world.caseId);

		expect(response.status).not.toBe(200);
		expect(JSON.stringify(await response.json())).not.toContain("variable");
	});

	it("refuses a case with an empty variable after it was a pattern, and publishes it as a pattern", async () => {
		const world = await variableWorld();
		await setText(world.claimId, {
			description: `Claim ${ref("system", SYS)}`,
		});

		expect(
			"data" in (await convertCaseKind(world.ownerId, world.caseId, "PATTERN"))
		).toBe(true);
		expect(await storedContext(world.goalId)).toEqual([variableEntry()]);
		expect((await publish(world.caseId)).status).toBe(200);
	});
});

describe("a case converted to a pattern and back", () => {
	it("keeps its variable, so it is still refused publication", async () => {
		const world = await variableWorld();
		await setText(world.claimId, {
			description: `Claim ${ref("system", SYS)}`,
		});

		await convertCaseKind(world.ownerId, world.caseId, "PATTERN");
		await convertCaseKind(world.ownerId, world.caseId, "CASE");
		const response = await publishCase(world.caseId);

		expect(await storedContext(world.goalId)).toEqual([variableEntry()]);
		expect(response.status).toBe(400);
		expect(await errorOf(response)).toBe(ONE);
	});

	it("keeps a variable's value through both conversions", async () => {
		const world = await variableWorld("CASE", "AcmeBot");
		await convertCaseKind(world.ownerId, world.caseId, "PATTERN");
		await convertCaseKind(world.ownerId, world.caseId, "CASE");

		expect(await storedContext(world.goalId)).toEqual([
			variableEntry("AcmeBot"),
		]);
	});
});

describe("republishing a published case", () => {
	async function publishedWorld(value = "AcmeBot"): Promise<VariableWorld> {
		const world = await variableWorld("CASE", value);
		await setText(world.claimId, {
			description: `Claim ${ref("system", SYS)}`,
		});
		const first = await publishCase(world.caseId);
		if (first.status !== 200) {
			throw new Error(`The first publish failed with ${first.status}`);
		}
		return world;
	}

	it.each(
		PUBLISH_ROUTES
	)("refuses on %s once the value has been taken away, and keeps the published copy as it was", async (_label, publish) => {
		const world = await publishedWorld();
		const before = await snapshotCount(world.caseId);
		expect((await putContext(world.goalId, [variableEntry()])).status).toBe(
			200
		);

		const response = await publish(world.caseId);

		expect(response.status).toBe(400);
		expect(await errorOf(response)).toBe(ONE);
		expect(await snapshotCount(world.caseId)).toBe(before);
	});

	it.each(
		PUBLISH_ROUTES
	)("refuses on %s once a new mention of an empty variable is written", async (_label, publish) => {
		const world = await publishedWorld();
		await setContext(world.goalId, [
			variableEntry(undefined, "operator", MORE),
		]);
		await setText(world.strategyId, {
			description: `New ${ref("operator", MORE)}`,
		});

		const response = await publish(world.caseId);

		expect(response.status).toBe(400);
		expect(await errorOf(response)).toBe(ONE);
	});

	it("republishes through the status route once the value is given again, with the new value in the copy", async () => {
		const world = await publishedWorld();
		await putContext(world.goalId, [variableEntry()]);
		expect((await setStatus(world.caseId, "PUBLISHED")).status).toBe(400);

		await putContext(world.goalId, [variableEntry("BetaBot")]);
		const response = await setStatus(world.caseId, "PUBLISHED");

		expect(response.status).toBe(200);
		const current = await prisma.publishedAssuranceCase.findFirstOrThrow({
			where: { assuranceCaseId: world.caseId, isCurrent: true },
		});
		const tree = (current.content as { tree: { context: unknown[] } }).tree;
		expect(tree.context).toEqual([variableEntry("BetaBot")]);
	});

	it("republishes with a changed value though no element's text changed", async () => {
		const world = await publishedWorld();
		const before = await snapshotCount(world.caseId);
		await putContext(world.goalId, [variableEntry("BetaBot")]);

		const response = await setStatus(world.caseId, "PUBLISHED");

		expect(response.status).toBe(200);
		expect(await snapshotCount(world.caseId)).toBe(before + 1);
	});

	it("still unpublishes a published case that has an empty variable", async () => {
		const world = await publishedWorld();
		await putContext(world.goalId, [variableEntry()]);

		const response = await setStatus(world.caseId, "DRAFT");

		expect(response.status).toBe(200);
		expect(await publishStatusOf(world.caseId)).toBe("DRAFT");
	});

	it("does not hold back the republishing of a pattern with an empty variable", async () => {
		const world = await variableWorld("PATTERN", "AcmeBot");
		await setText(world.claimId, {
			description: `Claim ${ref("system", SYS)}`,
		});
		expect((await publishCase(world.caseId)).status).toBe(200);
		await putContext(world.goalId, [variableEntry()]);

		const response = await setStatus(world.caseId, "PUBLISHED");

		expect(response.status).toBe(200);
	});
});

describe("starting a case from a pattern that has a variable", () => {
	it("copies the empty variable, so the new case cannot be published until it has a value", async () => {
		const pattern = await variableWorld("PATTERN");
		await setText(pattern.claimId, {
			description: `Claim ${ref("system", SYS)}`,
		});
		await setText(pattern.evidenceId, {
			description: `Ev ${ref("system", SYS)}`,
		});

		const started = await createCaseFromPattern(
			pattern.ownerId,
			{ patternCaseId: pattern.caseId },
			"My case",
			"Started from a pattern"
		);
		if (!("data" in started)) {
			throw new Error(started.error);
		}
		const caseId = started.data.id;
		await createTestCaseInformation(caseId);
		await mockAuth(pattern.ownerId, "owner", "owner@example.com");

		const refused = await publishCase(caseId);
		expect(refused.status).toBe(400);
		expect(await errorOf(refused)).toBe(ONE);

		const goal = await prisma.assuranceElement.findFirstOrThrow({
			where: { caseId, elementType: "GOAL" },
		});
		expect(await storedContext(goal.id)).toEqual([variableEntry()]);
		expect(
			(await putElement(goal.id, { context: [variableEntry("AcmeBot")] }))
				.status
		).toBe(200);

		const published = await publishCase(caseId);
		expect(published.status).toBe(200);
	});

	it("copies the empty variable from a published pattern for another person, who must give it a value before publishing", async () => {
		const pattern = await variableWorld("PATTERN");
		await setText(pattern.claimId, {
			description: `Claim ${ref("system", SYS)}`,
		});
		expect((await publishCase(pattern.caseId)).status).toBe(200);
		const published = await prisma.publishedAssuranceCase.findFirstOrThrow({
			where: { assuranceCaseId: pattern.caseId, isCurrent: true },
		});
		await prisma.publishedAssuranceCase.update({
			where: { id: published.id },
			data: { type: "ARGUMENT_PATTERN" },
		});
		const other = await createTestUser();

		const started = await createCaseFromPattern(
			other.id,
			{ publishedSlug: published.slug },
			"Their case",
			"Started from a published pattern"
		);
		if (!("data" in started)) {
			throw new Error(started.error);
		}
		const caseId = started.data.id;
		await createTestCaseInformation(caseId);
		await mockAuth(other.id, other.username, other.email);

		const refused = await publishCase(caseId);
		expect(refused.status).toBe(400);
		expect(await errorOf(refused)).toBe(ONE);
		const goal = await prisma.assuranceElement.findFirstOrThrow({
			where: { caseId, elementType: "GOAL" },
		});
		expect(await storedContext(goal.id)).toEqual([variableEntry()]);
	});

	it("copies a variable's value and flag", async () => {
		const pattern = await variableWorld("PATTERN", "AcmeBot");

		const started = await createCaseFromPattern(
			pattern.ownerId,
			{ patternCaseId: pattern.caseId },
			"My case",
			"Started from a pattern"
		);
		if (!("data" in started)) {
			throw new Error(started.error);
		}
		const goal = await prisma.assuranceElement.findFirstOrThrow({
			where: { caseId: started.data.id, elementType: "GOAL" },
		});

		expect(await storedContext(goal.id)).toEqual([variableEntry("AcmeBot")]);
	});
});
