import { beforeEach, describe, expect, it, vi } from "vitest";
import { detectChanges } from "@/lib/services/change-detection-service";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	MORE,
	OTHER,
	ordinaryEntry,
	publishCase,
	putContext,
	ref,
	SYS,
	setContext,
	setText,
	type VariableWorld,
	variableEntry,
	variableWorld,
} from "../utils/variables-kit";

/**
 * Update Published is offered when the case differs from its published
 * copy. A variable's value is shown wherever it is mentioned, so changing it
 * is a change; a save that changes nothing, and a reordering, are not.
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

async function hasChanges(world: VariableWorld): Promise<boolean> {
	const result = await detectChanges(world.ownerId, world.caseId, true);
	if (!("data" in result)) {
		throw new Error(result.error);
	}
	return result.data.hasChanges;
}

async function summary(world: VariableWorld) {
	const result = await detectChanges(world.ownerId, world.caseId, true);
	if (!("data" in result)) {
		throw new Error(result.error);
	}
	return result.data.changeSummary;
}

/** A published case whose claim mentions the variable `system`, valued AcmeBot. */
async function publishedWorld(value = "AcmeBot"): Promise<VariableWorld> {
	const world = await variableWorld("CASE", value);
	await setText(world.claimId, {
		description: `Operators test the ${ref("system", SYS)}`,
	});
	const response = await publishCase(world.caseId);
	if (response.status !== 200) {
		throw new Error(`The first publish failed with ${response.status}`);
	}
	return world;
}

describe("changes since the published copy, for a case with a variable", () => {
	it("sees none straight after publishing", async () => {
		const world = await publishedWorld();

		expect(await hasChanges(world)).toBe(false);
	});

	it("sees none after a save that writes the same context", async () => {
		const world = await publishedWorld();

		expect(
			(await putContext(world.goalId, [variableEntry("AcmeBot")])).status
		).toBe(200);

		expect(await hasChanges(world)).toBe(false);
	});

	it("sees none after a save that writes the same entry with its keys in another order", async () => {
		const world = await publishedWorld();
		await setContext(world.goalId, [
			{
				variable: true,
				value: "AcmeBot",
				text: "the system under test",
				name: "system",
				id: SYS,
			},
		]);

		expect(await hasChanges(world)).toBe(false);
	});

	it("sees none after a save that writes the same text again", async () => {
		const world = await publishedWorld();
		await setText(world.claimId, {
			description: `Operators test the ${ref("system", SYS)}`,
		});

		expect(await hasChanges(world)).toBe(false);
	});

	it("sees a change of value, though no element's text changed", async () => {
		const world = await publishedWorld();

		await putContext(world.goalId, [variableEntry("BetaBot")]);

		expect(await hasChanges(world)).toBe(true);
		expect((await summary(world))?.modifiedElements).toBe(1);
	});

	it("sees none once the value is changed back", async () => {
		const world = await publishedWorld();
		await putContext(world.goalId, [variableEntry("BetaBot")]);
		await putContext(world.goalId, [variableEntry("AcmeBot")]);

		expect(await hasChanges(world)).toBe(false);
	});

	it.each([
		["taken away", undefined],
		["replaced by spaces", "   "],
		["replaced by a newline", "\n"],
	])("sees a value %s", async (_what, value) => {
		const world = await publishedWorld();
		await setContext(world.goalId, [variableEntry(value)]);

		expect(await hasChanges(world)).toBe(true);
	});

	it("sees none when a save only trims the spaces round a value, which the case shows the same", async () => {
		const world = await variableWorld("CASE", "  AcmeBot  ");
		await setText(world.claimId, {
			description: `Operators test the ${ref("system", SYS)}`,
		});
		expect((await publishCase(world.caseId)).status).toBe(200);

		await setContext(world.goalId, [variableEntry("AcmeBot")]);

		expect(await hasChanges(world)).toBe(false);
	});

	it("sees a variable renamed", async () => {
		const world = await publishedWorld();

		await putContext(world.goalId, [variableEntry("AcmeBot", "machine")]);

		expect(await hasChanges(world)).toBe(true);
	});

	it("sees a name being marked as a variable, and a variable being unmarked", async () => {
		const world = await variableWorld("CASE");
		await setContext(world.goalId, [
			{
				id: SYS,
				name: "system",
				text: "the system under test",
				value: "AcmeBot",
			},
		]);
		await setText(world.claimId, {
			description: `Operators test the ${ref("system", SYS)}`,
		});
		expect((await publishCase(world.caseId)).status).toBe(200);
		expect(await hasChanges(world)).toBe(false);

		await putContext(world.goalId, [variableEntry("AcmeBot")]);
		expect(await hasChanges(world)).toBe(true);

		await putContext(world.goalId, [
			{
				id: SYS,
				name: "system",
				text: "the system under test",
				value: "AcmeBot",
			},
		]);
		expect(await hasChanges(world)).toBe(false);
	});

	it("sees an unmarked variable on a case published with it", async () => {
		const world = await publishedWorld();

		await putContext(world.goalId, [
			{
				id: SYS,
				name: "system",
				text: "the system under test",
				value: "AcmeBot",
			},
		]);

		expect(await hasChanges(world)).toBe(true);
	});

	it("sees a value given to a variable that no text mentions", async () => {
		const world = await variableWorld("CASE");
		expect((await publishCase(world.caseId)).status).toBe(200);

		await putContext(world.goalId, [variableEntry("AcmeBot")]);

		expect(await hasChanges(world)).toBe(true);
	});

	it("sees a value changed on a variable defined lower down", async () => {
		const world = await variableWorld("CASE");
		await setContext(world.goalId, []);
		await setContext(world.strategyId, [variableEntry("AcmeBot")]);
		await setText(world.claimId, {
			description: `Operators test the ${ref("system", SYS)}`,
		});
		expect((await publishCase(world.caseId)).status).toBe(200);
		expect(await hasChanges(world)).toBe(false);

		await putContext(world.strategyId, [variableEntry("BetaBot")]);

		expect(await hasChanges(world)).toBe(true);
	});

	it("sees none when two variables on one element are listed in the other order", async () => {
		const world = await variableWorld("CASE");
		const first = variableEntry("AcmeBot", "system", SYS);
		const second = variableEntry("Ops team", "operator", MORE);
		await setContext(world.goalId, [first, second]);
		expect((await publishCase(world.caseId)).status).toBe(200);

		await setContext(world.goalId, [second, first]);

		expect(await hasChanges(world)).toBe(false);
	});

	it("sees none when a plain line is added before a variable and the variable is unchanged", async () => {
		const world = await publishedWorld();

		await putContext(world.goalId, [
			"a new plain line",
			variableEntry("AcmeBot"),
		]);

		expect(await hasChanges(world)).toBe(false);
	});

	it("keeps counting an element that was added or removed, as before", async () => {
		const world = await publishedWorld();
		await setText(world.claimId, { description: "A different claim" });

		expect(await hasChanges(world)).toBe(true);
	});

	it("leaves a change to an ordinary term's value unseen, as before", async () => {
		const world = await variableWorld("CASE");
		await setContext(world.goalId, [
			variableEntry("AcmeBot"),
			ordinaryEntry("5 minutes", "window", OTHER),
		]);
		expect((await publishCase(world.caseId)).status).toBe(200);

		await setContext(world.goalId, [
			variableEntry("AcmeBot"),
			ordinaryEntry("10 minutes", "window", OTHER),
		]);

		expect(await hasChanges(world)).toBe(false);
	});
});
