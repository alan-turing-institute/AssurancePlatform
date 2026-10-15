import { createCaseTools } from "@/lib/plugins/assistant/tools";
import prisma from "@/lib/prisma";
import { changeBoundCheck } from "@/lib/services/health-evidence-service";
import { expectSuccess } from "./assertion-helpers";
import {
	createTestCase,
	createTestElement,
	createTestPluginState,
	createTestUser,
} from "./prisma-factories";

export const ASSISTANT_PLUGIN_ID = "tea.assistant";
export const HEALTH_PLUGIN_ID = "tea.health";
export const TOOL_OPTIONS = { toolCallId: "t", messages: [] };
export const DEFAULT_CHECK = "Sensor Range Checker";

export type User = Awaited<ReturnType<typeof createTestUser>>;

/** A time as the tool shows it: `YYYY-MM-DD HH:MM:SS UTC`, to the whole second. */
export function shownTime(time: Date | number | string): string {
	return `${new Date(time).toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

/** An owner with the assistant on, and a case with a top-level goal. */
export async function healthWorld() {
	const owner = await createTestUser();
	await createTestPluginState(owner.id, { pluginId: ASSISTANT_PLUGIN_ID });
	const kase = await createTestCase(owner.id);
	const root = await createTestElement(kase.id, owner.id, {
		elementType: "GOAL",
		name: "G1",
		description: "The top goal",
		role: "TOP_LEVEL",
	});
	return { owner, kase, root };
}

export type HealthWorld = Awaited<ReturnType<typeof healthWorld>>;

/** A property claim under the case's top-level goal, or under `parentId`. A null name leaves the claim with no label. */
export async function claimIn(
	world: HealthWorld,
	name: string | null = "P1",
	extra: { description?: string; parentId?: string } = {}
) {
	const claim = await createTestElement(world.kase.id, world.owner.id, {
		elementType: "PROPERTY_CLAIM",
		...(name === null ? {} : { name }),
		description: extra.description ?? `Text of ${name}`,
		parentId: extra.parentId ?? world.root.id,
	});
	if (name !== null) {
		return claim;
	}
	return await prisma.assuranceElement.update({
		where: { id: claim.id },
		data: { name: null },
	});
}

/** Binds a claim to a check as a person would, before any record arrives. */
export async function bindClaim(
	owner: User,
	claimId: string,
	name: string = DEFAULT_CHECK
) {
	expectSuccess(
		await changeBoundCheck(owner.id, claimId, {
			name,
			reason: "Bind ahead of the first record",
		})
	);
}

export function softDeleteClaim(claimId: string) {
	return prisma.assuranceElement.update({
		where: { id: claimId },
		data: { deletedAt: new Date() },
	});
}

interface ClaimHealthResult {
	checkedAt?: string;
	claims: Record<string, unknown>[];
	claimsNotInTree?: number;
	claimsTruncated: number;
	claimsWithoutResults: string[];
	claimsWithoutResultsTruncated: number;
	found: boolean;
	[key: string]: unknown;
}

/** One reply's tools, with `read_claim_health` registered. */
export function replyTools(userId: string, caseId: string) {
	return createCaseTools(userId, caseId, null, undefined, undefined, true);
}

/** The tool of one new reply, as a function that calls it. */
export function claimHealthCaller(userId: string, caseId: string) {
	const tools = replyTools(userId, caseId);
	return async () =>
		(await tools.read_claim_health?.execute?.(
			{},
			TOOL_OPTIONS
		)) as ClaimHealthResult;
}
