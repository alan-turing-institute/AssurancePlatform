import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
	createElement,
	deleteElement,
	updateElement,
} from "@/lib/services/element-service";
import { expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

const PLAIN_FLAT = /^P\d+$/;
const DEFEATER_FLAT = /^CP\d+$/;
const PLAIN_ANY = /^P\d+(\.\d+)*$/;
const DEFEATER_ANY = /^CP\d+(\.\d+)*$/;
const ANY_FLAT = /^C?P\d+$/;

/** Parent names that are not `P<n>(.<n>)*`. */
const MALFORMED_PLAIN_NAMES = [
	"Property claim",
	"PNaN",
	"PNaN.1",
	"P",
	"P.1",
	"P1.",
	"P1..1",
	"P1.a",
	"P-1",
	"p1",
	" P1",
	"P1 ",
	"P1\n",
	"P١",
	"CP1",
	"G1",
	"claim P1",
	"1",
	"P1.1.",
];

/** Defeater parent names that are not `CP<n>(.<n>)*`. */
const MALFORMED_DEFEATER_NAMES = [
	"Counter claim",
	"CPNaN",
	"CPNaN.1",
	"CP",
	"CP.1",
	"CP1.",
	"cp1",
	"P1",
	"P1.1",
	" CP1",
	"CP1 ",
	"C1",
];

async function newCase() {
	const user = await createTestUser();
	const testCase = await createTestCase(user.id);
	const goal = expectSuccess(
		await createElement(user.id, {
			caseId: testCase.id,
			elementType: "goal",
		})
	);
	return { user, testCase, goal };
}

type Context = Awaited<ReturnType<typeof newCase>>;
interface Created {
	id: string;
	name: string;
}

/** A claim made by the service, so it is named by the naming rules. */
async function addClaim(context: Context, parentId: string) {
	return expectSuccess(
		await createElement(context.user.id, {
			caseId: context.testCase.id,
			elementType: "property_claim",
			parentId,
		})
	);
}

/** A defeater made by the service; it attacks its parent. */
async function addDefeater(context: Context, parentId: string) {
	return expectSuccess(
		await createElement(context.user.id, {
			caseId: context.testCase.id,
			elementType: "property_claim",
			parentId,
			isDefeater: true,
			defeatsElementId: parentId,
		})
	);
}

async function addStrategy(context: Context, parentId: string) {
	return expectSuccess(
		await createElement(context.user.id, {
			caseId: context.testCase.id,
			elementType: "strategy",
			parentId,
		})
	);
}

/** A claim written straight to the table, the way an old or imported case holds one. */
function seedClaim(
	context: Context,
	name: string | null,
	parentId: string,
	options: { isDefeater?: boolean } = {}
) {
	return createTestElement(context.testCase.id, context.user.id, {
		elementType: "PROPERTY_CLAIM",
		name: name as string,
		parentId,
		isDefeater: options.isDefeater ?? false,
		defeatsElementId: options.isDefeater ? parentId : null,
	});
}

async function liveClaimNames(caseId: string): Promise<string[]> {
	const rows = await prisma.assuranceElement.findMany({
		where: { caseId, elementType: "PROPERTY_CLAIM", deletedAt: null },
		select: { name: true },
	});
	return rows.map((row) => row.name ?? "");
}

function duplicates(names: string[]): string[] {
	const seen = new Set<string>();
	const repeated = new Set<string>();
	for (const name of names) {
		if (seen.has(name)) {
			repeated.add(name);
		}
		seen.add(name);
	}
	return [...repeated];
}

describe("auto-naming a plain claim under a parent whose name is not a well-formed identifier", () => {
	it.each(
		MALFORMED_PLAIN_NAMES
	)("gives children of %j flat names, none of them carried by another live claim", async (parentName) => {
		const context = await newCase();
		const parent = await seedClaim(context, parentName, context.goal.id);

		const first = await addClaim(context, parent.id);
		const second = await addClaim(context, parent.id);
		const topLevel = await addClaim(context, context.goal.id);

		for (const element of [first, second, topLevel]) {
			expect(element.name).toMatch(PLAIN_FLAT);
		}
		expect(new Set([first.name, second.name, topLevel.name]).size).toBe(3);
		const names = await liveClaimNames(context.testCase.id);
		expect(duplicates(names)).toEqual([]);
		// What was written is what was returned.
		const stored = await prisma.assuranceElement.findUnique({
			where: { id: first.id },
		});
		expect(stored?.name).toBe(first.name);
	});

	it("gives a claim with no name at all children with flat names too", async () => {
		const context = await newCase();
		const unnamed = await seedClaim(context, null, context.goal.id);

		const first = await addClaim(context, unnamed.id);
		const second = await addClaim(context, unnamed.id);

		expect(first.name).toMatch(PLAIN_FLAT);
		expect(second.name).toMatch(PLAIN_FLAT);
		expect(first.name).not.toBe(second.name);
	});

	it("goes on with dotted names under a flat-named child of a malformed parent", async () => {
		const context = await newCase();
		const parent = await seedClaim(context, "Property claim", context.goal.id);
		const child = await addClaim(context, parent.id);

		const grandchildA = await addClaim(context, child.id);
		const grandchildB = await addClaim(context, child.id);

		expect(grandchildA.name).toBe(`${child.name}.1`);
		expect(grandchildB.name).toBe(`${child.name}.2`);
	});

	it.each(
		MALFORMED_PLAIN_NAMES
	)("names claims under a strategy under a claim named %j flat as well, without repeats", async (parentName) => {
		const context = await newCase();
		const parent = await seedClaim(context, parentName, context.goal.id);
		const strategy = await addStrategy(context, parent.id);

		const underStrategy = await addClaim(context, strategy.id);
		const underStrategyAgain = await addClaim(context, strategy.id);
		const direct = await addClaim(context, parent.id);
		const topLevel = await addClaim(context, context.goal.id);

		const names = [
			underStrategy.name,
			underStrategyAgain.name,
			direct.name,
			topLevel.name,
		];
		for (const name of names) {
			expect(name).toMatch(PLAIN_FLAT);
		}
		expect(new Set(names).size).toBe(4);
		expect(duplicates(await liveClaimNames(context.testCase.id))).toEqual([]);
	});

	it("names the claims of two malformed parents in one case without repeats", async () => {
		const context = await newCase();
		const parentA = await seedClaim(context, "Property claim", context.goal.id);
		const parentB = await seedClaim(context, "PNaN", context.goal.id);

		const made: Created[] = [];
		for (let round = 0; round < 3; round++) {
			made.push(await addClaim(context, parentA.id));
			made.push(await addClaim(context, parentB.id));
			made.push(await addClaim(context, context.goal.id));
		}

		expect(new Set(made.map((element) => element.name)).size).toBe(9);
		expect(duplicates(await liveClaimNames(context.testCase.id))).toEqual([]);
	});

	it("does not let a claim in another case change which name is free", async () => {
		const here = await newCase();
		const there = await newCase();
		const hereParent = await seedClaim(here, "Property claim", here.goal.id);
		const thereParent = await seedClaim(there, "Property claim", there.goal.id);
		// Names in the other case that would collide if cases were mixed up.
		for (let index = 0; index < 4; index++) {
			await addClaim(there, thereParent.id);
		}
		const twin = await newCase();
		const twinParent = await seedClaim(twin, "Property claim", twin.goal.id);

		const withNoise: string[] = [];
		const withoutNoise: string[] = [];
		for (let index = 0; index < 3; index++) {
			withNoise.push((await addClaim(here, hereParent.id)).name);
			withoutNoise.push((await addClaim(twin, twinParent.id)).name);
		}

		expect(withNoise).toEqual(withoutNoise);
	});
});

describe("auto-naming under a well-formed parent keeps dotted names", () => {
	it.each([
		"P1",
		"P12",
		"P0",
		"P007",
		"P1.2",
		"P1.2.3",
		"P10.20.30",
	])("numbers children of %s under it", async (parentName) => {
		const context = await newCase();
		const parent = await seedClaim(context, parentName, context.goal.id);

		const first = await addClaim(context, parent.id);
		const second = await addClaim(context, parent.id);
		const third = await addClaim(context, parent.id);

		expect([first.name, second.name, third.name]).toEqual([
			`${parentName}.1`,
			`${parentName}.2`,
			`${parentName}.3`,
		]);
	});

	it("numbers children of a defeater named CP<n> under it", async () => {
		const context = await newCase();
		const attacked = await addClaim(context, context.goal.id);
		const defeater = await addDefeater(context, attacked.id);
		expect(defeater.name).toBe("CP1");

		const first = await addDefeater(context, defeater.id);
		const second = await addDefeater(context, defeater.id);
		const deeper = await addDefeater(context, first.id);

		expect(first.name).toBe("CP1.1");
		expect(second.name).toBe("CP1.2");
		expect(deeper.name).toBe("CP1.1.1");
	});

	it("numbers a claim under a strategy under a well-formed claim as the claim's own child", async () => {
		const context = await newCase();
		const parent = await seedClaim(context, "P4", context.goal.id);
		const strategy = await addStrategy(context, parent.id);

		const first = await addClaim(context, strategy.id);
		const second = await addClaim(context, parent.id);

		expect(first.name).toBe("P4.1");
		expect(second.name).toMatch(PLAIN_ANY);
		expect(second.name.startsWith("P4.")).toBe(true);
	});

	it("keeps the plain and defeater sequences apart", async () => {
		const context = await newCase();
		const p1 = await addClaim(context, context.goal.id);
		const p2 = await addClaim(context, context.goal.id);
		const cp1 = await addDefeater(context, context.goal.id);
		const cp2 = await addDefeater(context, p1.id);
		const p3 = await addClaim(context, context.goal.id);

		expect([p1.name, p2.name, cp1.name, cp2.name, p3.name]).toEqual([
			"P1",
			"P2",
			"CP1",
			"CP2",
			"P3",
		]);
	});

	it("does not treat a plain claim as the dotted parent of a defeater, or a defeater of a plain claim", async () => {
		const context = await newCase();
		const plain = await seedClaim(context, "P1", context.goal.id);
		const defeater = await seedClaim(context, "CP1", context.goal.id, {
			isDefeater: true,
		});

		const defeaterUnderPlain = await addDefeater(context, plain.id);
		const plainUnderDefeater = await addClaim(context, defeater.id);

		expect(defeaterUnderPlain.name).toMatch(DEFEATER_FLAT);
		expect(plainUnderDefeater.name).toMatch(PLAIN_FLAT);
	});
});

describe("auto-naming a defeater under a defeater whose name is not a well-formed identifier", () => {
	it.each(
		MALFORMED_DEFEATER_NAMES
	)("gives counters to %j flat CP names, none carried by another live claim", async (parentName) => {
		const context = await newCase();
		const parent = await seedClaim(context, parentName, context.goal.id, {
			isDefeater: true,
		});

		const first = await addDefeater(context, parent.id);
		const second = await addDefeater(context, parent.id);
		const other = await addDefeater(context, context.goal.id);

		for (const element of [first, second, other]) {
			expect(element.name).toMatch(DEFEATER_FLAT);
		}
		expect(new Set([first.name, second.name, other.name]).size).toBe(3);
		expect(duplicates(await liveClaimNames(context.testCase.id))).toEqual([]);
	});

	it("gives an ordinary child of such a defeater a flat P name", async () => {
		const context = await newCase();
		const parent = await seedClaim(context, "Counter claim", context.goal.id, {
			isDefeater: true,
		});

		const first = await addClaim(context, parent.id);
		const second = await addClaim(context, parent.id);

		expect(first.name).toMatch(PLAIN_FLAT);
		expect(second.name).toMatch(PLAIN_FLAT);
		expect(first.name).not.toBe(second.name);
	});

	it("goes on with dotted names under a flat-named counter", async () => {
		const context = await newCase();
		const parent = await seedClaim(context, "Counter claim", context.goal.id, {
			isDefeater: true,
		});
		const counter = await addDefeater(context, parent.id);

		const next = await addDefeater(context, counter.id);

		expect(next.name).toBe(`${counter.name}.1`);
	});

	it("keeps a counter of a malformed plain claim on the flat CP sequence", async () => {
		const context = await newCase();
		const plain = await seedClaim(context, "Property claim", context.goal.id);

		const first = await addDefeater(context, plain.id);
		const second = await addDefeater(context, plain.id);

		expect(first.name).toMatch(DEFEATER_FLAT);
		expect(second.name).toMatch(DEFEATER_FLAT);
		expect(first.name).not.toBe(second.name);
	});
});

describe("gaps left by deletions", () => {
	it("do not hand out a flat name a live claim still carries", async () => {
		const context = await newCase();
		const p1 = await addClaim(context, context.goal.id);
		const p2 = await addClaim(context, context.goal.id);
		const p3 = await addClaim(context, context.goal.id);
		expect([p1.name, p2.name, p3.name]).toEqual(["P1", "P2", "P3"]);

		expectSuccess(await deleteElement(context.user.id, p2.id));
		const next = await addClaim(context, context.goal.id);
		const after = await addClaim(context, context.goal.id);

		expect(next.name).toMatch(PLAIN_FLAT);
		expect(next.name).not.toBe("P1");
		expect(next.name).not.toBe("P3");
		expect(new Set([next.name, after.name, "P1", "P3"]).size).toBe(4);
		expect(duplicates(await liveClaimNames(context.testCase.id))).toEqual([]);
	});

	it("do not hand out a flat defeater name a live defeater still carries", async () => {
		const context = await newCase();
		const target = await addClaim(context, context.goal.id);
		const cp1 = await addDefeater(context, target.id);
		const cp2 = await addDefeater(context, target.id);
		const cp3 = await addDefeater(context, target.id);
		expect([cp1.name, cp2.name, cp3.name]).toEqual(["CP1", "CP2", "CP3"]);

		expectSuccess(await deleteElement(context.user.id, cp1.id));
		const next = await addDefeater(context, target.id);

		expect(next.name).toMatch(DEFEATER_FLAT);
		expect([cp2.name, cp3.name]).not.toContain(next.name);
		expect(duplicates(await liveClaimNames(context.testCase.id))).toEqual([]);
	});

	it("do not repeat a name under a malformed parent after a middle child is deleted", async () => {
		const context = await newCase();
		const parent = await seedClaim(context, "Property claim", context.goal.id);
		const made: Created[] = [];
		for (let index = 0; index < 4; index++) {
			made.push(await addClaim(context, parent.id));
		}

		expectSuccess(await deleteElement(context.user.id, made[1]?.id ?? ""));
		expectSuccess(await deleteElement(context.user.id, made[2]?.id ?? ""));
		const again = await addClaim(context, parent.id);
		const topLevel = await addClaim(context, context.goal.id);

		expect(again.name).toMatch(PLAIN_FLAT);
		expect(topLevel.name).toMatch(PLAIN_FLAT);
		expect(duplicates(await liveClaimNames(context.testCase.id))).toEqual([]);
	});

	it("do not repeat a flat name after the first claim is deleted", async () => {
		const context = await newCase();
		const p1 = await addClaim(context, context.goal.id);
		await addClaim(context, context.goal.id);
		await addClaim(context, context.goal.id);

		expectSuccess(await deleteElement(context.user.id, p1.id));
		await addClaim(context, context.goal.id);
		await addClaim(context, context.goal.id);

		expect(duplicates(await liveClaimNames(context.testCase.id))).toEqual([]);
	});

	it("leave a name used by a deleted claim free for any claim, never one a live claim holds", async () => {
		const context = await newCase();
		const parent = await seedClaim(context, "Property claim", context.goal.id);
		const first = await addClaim(context, parent.id);
		expectSuccess(await deleteElement(context.user.id, first.id));

		const next = await addClaim(context, parent.id);

		expect(next.name).toMatch(PLAIN_FLAT);
		expect(duplicates(await liveClaimNames(context.testCase.id))).toEqual([]);
	});
});

describe("changing whether a claim is a defeater under a malformed parent", () => {
	it("renames it flat in its new class, without a repeat", async () => {
		const context = await newCase();
		const parent = await seedClaim(context, "Property claim", context.goal.id);
		const other = await addDefeater(context, parent.id);
		const claim = await addClaim(context, parent.id);
		expect(other.name).toMatch(DEFEATER_FLAT);
		expect(claim.name).toMatch(PLAIN_FLAT);

		const flipped = expectSuccess(
			await updateElement(context.user.id, claim.id, {
				isDefeater: true,
				defeatsElementId: parent.id,
			})
		);

		expect(flipped.name).toMatch(DEFEATER_FLAT);
		expect(flipped.name).not.toBe(other.name);
		expect(duplicates(await liveClaimNames(context.testCase.id))).toEqual([]);

		const back = expectSuccess(
			await updateElement(context.user.id, claim.id, {
				isDefeater: false,
			})
		);
		expect(back.name).toMatch(PLAIN_FLAT);
		expect(duplicates(await liveClaimNames(context.testCase.id))).toEqual([]);
	});
});

/** A small seeded generator, so a failing sequence can be run again. */
function generator(seed: number) {
	const modulus = 4_294_967_296;
	let state = seed % modulus;
	return () => {
		state = (state * 1_664_525 + 1_013_904_223) % modulus;
		return state / modulus;
	};
}

interface Live {
	id: string;
	isDefeater: boolean;
	kind: "claim" | "goal" | "strategy";
	name: string;
	parentId: string | null;
}

describe("a long mixed run of creations and deletions", () => {
	it.each([
		1, 2, 3, 4, 5,
	])("never gives a new claim a name another live claim carries (seed %i)", async (seed) => {
		const random = generator(seed);
		const pick = <T>(items: T[]): T =>
			items[Math.floor(random() * items.length)] as T;
		const context = await newCase();
		const live: Live[] = [
			{
				id: context.goal.id,
				kind: "goal",
				name: context.goal.name ?? "",
				isDefeater: false,
				parentId: null,
			},
		];
		for (const [name, isDefeater] of [
			["Property claim", false],
			["PNaN", false],
			["Counter claim", true],
		] as const) {
			const seeded = await seedClaim(context, name, context.goal.id, {
				isDefeater,
			});
			live.push({
				id: seeded.id,
				kind: "claim",
				name,
				isDefeater,
				parentId: context.goal.id,
			});
		}
		const claimsOf = (isDefeater: boolean) =>
			live.filter((e) => e.kind === "claim" && e.isDefeater === isDefeater);
		const namesInClass = (isDefeater: boolean) =>
			claimsOf(isDefeater).map((e) => e.name);
		const problems: string[] = [];

		for (let step = 0; step < 60; step++) {
			const roll = random();
			if (roll < 0.4) {
				const parent = pick(
					live.filter(
						(e) =>
							e.kind === "goal" || e.kind === "strategy" || e.kind === "claim"
					)
				);
				const taken = namesInClass(false);
				const made = await addClaim(context, parent.id);
				if (!PLAIN_ANY.test(made.name) || taken.includes(made.name)) {
					problems.push(
						`step ${step}: plain ${made.name} under ${parent.name}`
					);
				}
				live.push({
					id: made.id,
					kind: "claim",
					name: made.name,
					isDefeater: false,
					parentId: parent.id,
				});
			} else if (roll < 0.6) {
				const target = pick(live.filter((e) => e.kind !== "strategy"));
				const taken = namesInClass(true);
				const made = await addDefeater(context, target.id);
				if (!DEFEATER_ANY.test(made.name) || taken.includes(made.name)) {
					problems.push(
						`step ${step}: defeater ${made.name} under ${target.name}`
					);
				}
				live.push({
					id: made.id,
					kind: "claim",
					name: made.name,
					isDefeater: true,
					parentId: target.id,
				});
			} else if (roll < 0.7) {
				const parent = context.goal;
				const made = await addStrategy(context, parent.id);
				live.push({
					id: made.id,
					kind: "strategy",
					name: made.name ?? "",
					isDefeater: false,
					parentId: parent.id,
				});
			} else {
				// Only a flat-named claim goes: the dotted names under a live
				// parent are not renumbered when one of them leaves.
				const removable = live.filter(
					(e) => e.kind === "claim" && ANY_FLAT.test(e.name)
				);
				if (removable.length === 0) {
					continue;
				}
				const gone = pick(removable);
				expectSuccess(await deleteElement(context.user.id, gone.id));
				const removed = new Set([gone.id]);
				let grew = true;
				while (grew) {
					grew = false;
					for (const e of live) {
						if (!removed.has(e.id) && e.parentId && removed.has(e.parentId)) {
							removed.add(e.id);
							grew = true;
						}
					}
				}
				for (let index = live.length - 1; index >= 0; index--) {
					if (removed.has(live[index]?.id ?? "")) {
						live.splice(index, 1);
					}
				}
			}
		}

		expect(problems).toEqual([]);
		expect(duplicates(await liveClaimNames(context.testCase.id))).toEqual([]);
	});
});
