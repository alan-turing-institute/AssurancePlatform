import { NextRequest } from "next/server";
import { vi } from "vitest";
import prisma from "@/lib/prisma";
import { publishHealthCheckList } from "@/lib/services/health-check-catalogue-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import {
	buildHealthCheckList,
	HEALTH_CHECK_PIPELINE,
	ITEM_CHECK_NAME,
	NUMERIC_CHECK_NAME,
} from "../fixtures/health-checks";
import { expectSuccess } from "./assertion-helpers";
import { mockAuth } from "./auth-helpers";
import {
	addPipeline,
	callCriteriaGet,
	callCriteriaPut,
	callRetirement,
	itemSettings,
} from "./health-criteria-kit";
import {
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestPluginState,
	createTestUser,
	enableTestPlugin,
} from "./prisma-factories";

const BASE = "http://localhost:3000/api";

/** A description with no closing punctuation, so the sentence the node adds is predictable. */
const ITEM_DESCRIPTION = "the share of items free of visible marks";
const NUMERIC_DESCRIPTION = "how far the edge sits from its position";

export const ITEM_NODE_TEXT = `Results from the ${ITEM_CHECK_NAME} check, run by ${HEALTH_CHECK_PIPELINE}. It measures: ${ITEM_DESCRIPTION}.`;
export const NUMERIC_NODE_TEXT = `Results from the ${NUMERIC_CHECK_NAME} check, run by ${HEALTH_CHECK_PIPELINE}. It measures: ${NUMERIC_DESCRIPTION}.`;

type Person = Awaited<ReturnType<typeof createTestUser>>;

export async function signIn(user: Person) {
	await mockAuth(user.id, user.username, user.email);
}

/** The check list with descriptions that end without punctuation; `mutate` may change it further. */
export function checkList(
	mutate: (list: ReturnType<typeof buildHealthCheckList>) => void = () => {
		/* unchanged */
	}
) {
	const list = buildHealthCheckList();
	for (const check of list.checks) {
		if (check.name === ITEM_CHECK_NAME) {
			check.description = ITEM_DESCRIPTION;
		}
		if (check.name === NUMERIC_CHECK_NAME) {
			check.description = NUMERIC_DESCRIPTION;
		}
	}
	mutate(list);
	return list;
}

export interface NodeWorld {
	claim: Awaited<ReturnType<typeof createTestElement>>;
	goal: Awaited<ReturnType<typeof createTestElement>>;
	integration: { id: string };
	kase: Awaited<ReturnType<typeof createTestCase>>;
	owner: Person;
	secret: string;
	systemUserId: string;
}

/** A case with a goal and a claim P1 under it, an owner (signed in) and a pipeline holding EDIT with the demo check list published. */
export async function nodeWorld(
	options: { list?: ReturnType<typeof checkList> } = {}
): Promise<NodeWorld> {
	const owner = await createTestUser();
	await createTestPluginState(owner.id, { pluginId: "tea.assistant" });
	await enableTestPlugin(owner.id, "tea.health");
	const kase = await createTestCase(owner.id);
	const goal = await createTestElement(kase.id, owner.id, {
		elementType: "GOAL",
		name: "G1",
		description: "The top goal",
		role: "TOP_LEVEL",
	});
	const claim = await createTestElement(kase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
		name: "P1",
		description: "Text of P1",
		parentId: goal.id,
	});
	const pipeline = await addPipeline(owner.id, kase.id, { publish: false });
	const world = { owner, kase, goal, claim, ...pipeline } as NodeWorld;
	await republish(world, options.list ?? checkList());
	await signIn(owner);
	return world;
}

/** Publishes `list` as the world's pipeline's check list, replacing the previous one. */
export async function republish(
	world: Pick<NodeWorld, "integration" | "systemUserId">,
	list: ReturnType<typeof checkList>
) {
	expectSuccess(
		await publishHealthCheckList(
			{
				integrationId: world.integration.id,
				systemUserId: world.systemUserId,
			},
			list as never
		)
	);
}

/** Another property claim under the goal. */
export function addClaim(world: NodeWorld, name: string) {
	return createTestElement(world.kase.id, world.owner.id, {
		elementType: "PROPERTY_CLAIM",
		name,
		description: `Text of ${name}`,
		parentId: world.goal.id,
	});
}

/** A person holding `permission` on the case, not signed in. */
export async function collaborator(
	world: NodeWorld,
	permission: "VIEW" | "COMMENT" | "EDIT" | "ADMIN"
) {
	const user = await createTestUser();
	await enableTestPlugin(user.id, "tea.health");
	await createTestPermission(
		world.kase.id,
		user.id,
		world.owner.id,
		permission
	);
	return user;
}

/** Settings for the numeric check, as the pipeline recommends them, with `overrides` applied. */
export function numericSettings(overrides: Record<string, unknown> = {}) {
	const check = buildHealthCheckList().checks.find(
		(entry) => entry.name === NUMERIC_CHECK_NAME
	);
	if (!check) {
		throw new Error("fixture check missing");
	}
	return {
		check: {
			name: check.name,
			version: check.version,
			scope: "item",
			params: { tolerance_profile: "standard" },
		},
		...check.recommended,
		...overrides,
	};
}

interface Answer {
	body: any;
	status: number;
}

async function answer(response: Response): Promise<Answer> {
	return { status: response.status, body: await response.json() };
}

export function saveBodyOf(
	world: Pick<NodeWorld, "integration">,
	extra: Record<string, unknown> = {},
	settings: Record<string, unknown> = itemSettings(),
	accept = true
) {
	return {
		integration_id: world.integration.id,
		settings,
		accept,
		...extra,
	};
}

export async function save(
	world: Pick<NodeWorld, "integration">,
	claimId: string,
	extra: Record<string, unknown> = {},
	settings: Record<string, unknown> = itemSettings(),
	accept = true
) {
	return await answer(
		await callCriteriaPut(claimId, saveBodyOf(world, extra, settings, accept))
	);
}

/** Accepts the demo settings with the node and requires success. */
export async function acceptWithNode(world: NodeWorld, claimId?: string) {
	const result = await save(world, claimId ?? world.claim.id, {
		add_evidence_node: true,
	});
	if (result.status !== 200) {
		throw new Error(
			`accept answered ${result.status}: ${JSON.stringify(result.body)}`
		);
	}
	return result.body;
}

export async function retire(
	claimId: string,
	body: Record<string, unknown> = { reason: "Superseded" }
) {
	return await answer(await callRetirement(claimId, body));
}

export async function readView(claimId: string) {
	return await answer(await callCriteriaGet(claimId));
}

function request(url: string, method: string, body?: unknown, token?: string) {
	return new NextRequest(url, {
		method,
		headers: {
			"content-type": "application/json",
			...(token ? { authorization: `Bearer ${token}` } : {}),
		},
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
}

/** POST /api/elements/[id]/health/evidence-node */
export async function postNode(claimId: string, token?: string) {
	const { POST } = await import(
		"@/app/api/elements/[id]/health/evidence-node/route"
	);
	return await answer(
		await POST(
			request(
				`${BASE}/elements/${claimId}/health/evidence-node`,
				"POST",
				undefined,
				token
			),
			{ params: Promise.resolve({ id: claimId }) }
		)
	);
}

/** GET /api/cases/[id]/health/evidence-nodes */
export async function listNodes(caseId: string, token?: string) {
	const { GET } = await import(
		"@/app/api/cases/[id]/health/evidence-nodes/route"
	);
	return await answer(
		await GET(
			request(
				`${BASE}/cases/${caseId}/health/evidence-nodes`,
				"GET",
				undefined,
				token
			),
			{ params: Promise.resolve({ id: caseId }) }
		)
	);
}

/** GET /api/elements/[id]/health */
export async function readStatus(claimId: string) {
	const { GET } = await import("@/app/api/elements/[id]/health/route");
	return await answer(
		await GET(request(`${BASE}/elements/${claimId}/health`, "GET"), {
			params: Promise.resolve({ id: claimId }),
		})
	);
}

// ---------------------------------------------------------------------------
// What is stored
// ---------------------------------------------------------------------------

export function evidenceIn(caseId: string) {
	return prisma.assuranceElement.findMany({
		where: { caseId, elementType: "EVIDENCE" },
		orderBy: { createdAt: "asc" },
	});
}

export async function pointerOf(claimId: string) {
	const row = await prisma.pluginHealthCriteria.findUnique({
		where: { claimId },
		select: { evidenceElementId: true },
	});
	return row?.evidenceElementId ?? null;
}

export function linksTo(claimId: string) {
	return prisma.evidenceLink.findMany({ where: { claimId } });
}

export function linksOf(evidenceId: string) {
	return prisma.evidenceLink.findMany({ where: { evidenceId } });
}

export function element(id: string) {
	return prisma.assuranceElement.findUniqueOrThrow({ where: { id } });
}

export async function revisionCount(claimId: string) {
	return await prisma.pluginHealthCriteriaRevision.count({
		where: { claimId },
	});
}

export async function storedState(claimId: string) {
	const row = await prisma.pluginHealthCriteria.findUnique({
		where: { claimId },
	});
	return row?.state ?? null;
}

/** The ids of the case's live nodes, as the list route answers them. */
export async function liveIds(caseId: string): Promise<string[]> {
	const result = await listNodes(caseId);
	if (result.status !== 200) {
		throw new Error(`list answered ${result.status}`);
	}
	return result.body.map((item: { id: string }) => item.id);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export function eventTypes(): string[] {
	return vi.mocked(emitSSEEvent).mock.calls.map((call) => String(call[0]));
}

// ---------------------------------------------------------------------------
// Faults
// ---------------------------------------------------------------------------

/**
 * Makes every statement matching `when` fail inside Postgres until the
 * returned function is called. The failure is a real database error, raised
 * in the middle of whichever transaction reaches it.
 */
export async function failOn(table: string, when: string, errcode?: string) {
	const name = `live_node_fault_${table}`;
	const using = errcode ? ` USING ERRCODE = '${errcode}'` : "";
	await prisma.$executeRawUnsafe(
		`CREATE OR REPLACE FUNCTION ${name}() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'injected failure'${using}; END; $$ LANGUAGE plpgsql`
	);
	await prisma.$executeRawUnsafe(
		`CREATE TRIGGER ${name} BEFORE INSERT OR UPDATE ON ${table} FOR EACH ROW WHEN (${when}) EXECUTE FUNCTION ${name}()`
	);
	return async () => {
		await prisma.$executeRawUnsafe(
			`DROP TRIGGER IF EXISTS ${name} ON ${table}`
		);
		await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${name}()`);
	};
}

// ---------------------------------------------------------------------------
// The assistant
// ---------------------------------------------------------------------------

const TOOL_OPTIONS = { toolCallId: "t", messages: [] };

interface ToolClaim {
	evidenceNode?: string;
	id: string;
	[key: string]: unknown;
}

/** One reply's tool set for the world's owner. */
export async function assistantTools(world: NodeWorld) {
	const { createCaseTools } = await import("@/lib/plugins/assistant/tools");
	return createCaseTools(
		world.owner.id,
		world.kase.id,
		null,
		undefined,
		undefined,
		true
	);
}

/** What `read_claim_health` reports, as the model gets it. */
export async function readClaimHealth(world: NodeWorld) {
	const tools = await assistantTools(world);
	return (await tools.read_claim_health?.execute?.({}, TOOL_OPTIONS)) as {
		claims: ToolClaim[];
		[key: string]: unknown;
	};
}

/** What `read_case` reports, as the model gets it. */
export async function readCase(world: NodeWorld) {
	const tools = await assistantTools(world);
	return await tools.read_case?.execute?.({}, TOOL_OPTIONS);
}
