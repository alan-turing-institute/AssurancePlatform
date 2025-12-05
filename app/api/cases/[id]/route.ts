import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

// Type definitions for Prisma elements
type PrismaElement = {
	id: string;
	elementType: string;
	parentId: string | null;
	name: string | null;
	description: string;
	assumption: string | null;
	justification: string | null;
	url: string | null;
	level: number | null;
	claimType: string | null;
	keywords: string | null;
	caseId: string;
	createdAt: Date;
	inSandbox: boolean;
	comments: unknown[];
	// Evidence links TO this element (when this is a claim)
	evidenceLinksTo?: Array<{
		evidence: PrismaElement;
	}>;
};

type CaseResult = {
	data?: unknown;
	error?: string;
	status: number;
};

/**
 * Maps Prisma permission levels to frontend format.
 */
function mapPermissionToFrontend(
	permission: string | null,
	isOwner: boolean
): string {
	if (isOwner) {
		return "manage";
	}
	switch (permission) {
		case "ADMIN":
			return "manage";
		case "EDIT":
			return "edit";
		case "COMMENT":
			return "comment";
		default:
			return "view";
	}
}

async function fetchCaseFromPrisma(
	caseId: string,
	refreshToken: string
): Promise<CaseResult> {
	const { validateRefreshToken } = await import(
		"@/lib/auth/refresh-token-service"
	);
	const { prismaNew } = await import("@/lib/prisma-new");
	const { getCasePermission } = await import("@/lib/permissions");

	const validation = await validateRefreshToken(refreshToken);
	if (!validation.valid) {
		return { error: "Unauthorised", status: 401 };
	}

	// Check if user has access to this case (handles owner, direct, and team permissions)
	const permissionResult = await getCasePermission({
		userId: validation.userId,
		caseId,
	});

	if (!permissionResult.hasAccess) {
		return { error: "Not found", status: 404 };
	}

	// Fetch the case data
	const caseData = await prismaNew.assuranceCase.findUnique({
		where: { id: caseId },
		include: {
			elements: {
				include: {
					children: true,
					comments: true,
					// Include evidence linked TO this element (for claims)
					evidenceLinksTo: {
						include: {
							evidence: true,
						},
					},
				},
			},
			createdBy: {
				select: {
					id: true,
					username: true,
				},
			},
		},
	});

	if (!caseData) {
		return { error: "Not found", status: 404 };
	}

	// Transform Prisma data to the expected format
	// Build the nested structure from flat elements
	const elements = caseData.elements as unknown as PrismaElement[];
	const goals = elements
		.filter((el) => el.elementType === "GOAL" && el.parentId === null)
		.map((goal) => buildGoalStructure(goal, elements));

	const permissions = mapPermissionToFrontend(
		permissionResult.permission,
		permissionResult.isOwner
	);

	return {
		data: {
			id: caseData.id,
			name: caseData.name,
			description: caseData.description,
			created_date: caseData.createdAt.toISOString(),
			lock_uuid: caseData.lockUuid,
			color_profile: caseData.colorProfile,
			owner: caseData.createdById,
			goals,
			permissions,
			// Publish status fields
			published: caseData.publishStatus === "PUBLISHED",
			publishStatus: caseData.publishStatus,
			publishedAt: caseData.publishedAt?.toISOString() ?? null,
			markedReadyAt: caseData.markedReadyAt?.toISOString() ?? null,
		},
		status: 200,
	};
}

function buildGoalStructure(
	goal: PrismaElement,
	allElements: PrismaElement[]
): Record<string, unknown> {
	const children = allElements.filter((el) => el.parentId === goal.id);

	const contexts = children
		.filter((el) => el.elementType === "CONTEXT")
		.map((ctx) => ({
			id: ctx.id,
			type: "context",
			name: ctx.name,
			short_description: ctx.description || "",
			long_description: ctx.description || "",
			created_date: ctx.createdAt.toISOString(),
			goal_id: goal.id,
			comments: ctx.comments || [],
			assumption: ctx.assumption || "",
			in_sandbox: ctx.inSandbox,
		}));

	const strategies = children
		.filter((el) => el.elementType === "STRATEGY")
		.map((strategy) => buildStrategyStructure(strategy, allElements, goal.id));

	const propertyClaims = children
		.filter((el) => el.elementType === "PROPERTY_CLAIM")
		.map((claim) =>
			buildPropertyClaimStructure(claim, allElements, goal.id, null)
		);

	return {
		id: goal.id,
		type: "goal",
		name: goal.name,
		short_description: goal.description || "",
		long_description: goal.description || "",
		keywords: goal.keywords || "",
		created_date: goal.createdAt.toISOString(),
		assurance_case_id: goal.caseId,
		context: contexts,
		strategies,
		property_claims: propertyClaims,
		comments: goal.comments || [],
		assumption: goal.assumption || "",
		in_sandbox: goal.inSandbox,
	};
}

function buildStrategyStructure(
	strategy: PrismaElement,
	allElements: PrismaElement[],
	goalId: string
): Record<string, unknown> {
	const children = allElements.filter((el) => el.parentId === strategy.id);

	const propertyClaims = children
		.filter((el) => el.elementType === "PROPERTY_CLAIM")
		.map((claim) =>
			buildPropertyClaimStructure(claim, allElements, null, strategy.id)
		);

	return {
		id: strategy.id,
		type: "strategy",
		name: strategy.name,
		short_description: strategy.description || "",
		long_description: strategy.description || "",
		created_date: strategy.createdAt.toISOString(),
		goal_id: goalId,
		property_claims: propertyClaims,
		comments: strategy.comments || [],
		assumption: strategy.assumption || "",
		justification: strategy.justification || "",
		in_sandbox: strategy.inSandbox,
	};
}

function buildPropertyClaimStructure(
	claim: PrismaElement,
	allElements: PrismaElement[],
	goalId: string | null,
	strategyId: string | null
): Record<string, unknown> {
	const children = allElements.filter((el) => el.parentId === claim.id);

	// Get evidence from direct children (parentId relationship)
	const childEvidence = children.filter((el) => el.elementType === "EVIDENCE");

	// Get evidence from EvidenceLink table (imported evidence)
	const linkedEvidence =
		claim.evidenceLinksTo?.map((link) => link.evidence) ?? [];

	// Combine and deduplicate by ID
	const evidenceSet = new Map<string, PrismaElement>();
	for (const ev of childEvidence) {
		evidenceSet.set(ev.id, ev);
	}
	for (const ev of linkedEvidence) {
		if (!evidenceSet.has(ev.id)) {
			evidenceSet.set(ev.id, ev);
		}
	}

	const evidence = Array.from(evidenceSet.values()).map((ev) => ({
		id: ev.id,
		type: "evidence",
		name: ev.name,
		short_description: ev.description || "",
		long_description: ev.description || "",
		created_date: ev.createdAt.toISOString(),
		URL: ev.url || "",
		property_claim_id: [claim.id],
		comments: ev.comments || [],
		in_sandbox: ev.inSandbox,
	}));

	const nestedClaims = children
		.filter((el) => el.elementType === "PROPERTY_CLAIM")
		.map((nested) =>
			buildPropertyClaimStructure(nested, allElements, null, null)
		);

	return {
		id: claim.id,
		type: "property_claim",
		name: claim.name,
		short_description: claim.description || "",
		long_description: claim.description || "",
		created_date: claim.createdAt.toISOString(),
		goal_id: goalId,
		strategy_id: strategyId,
		property_claim_id: claim.parentId,
		level: claim.level || 1,
		claim_type: claim.claimType || "Project claim",
		property_claims: nestedClaims,
		evidence,
		comments: claim.comments || [],
		assumption: claim.assumption || "",
		in_sandbox: claim.inSandbox,
	};
}

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const session = await getServerSession(authOptions);

	if (!session?.key) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const { id } = await params;

	const result: CaseResult = await fetchCaseFromPrisma(id, session.key);

	if (result.error) {
		return NextResponse.json(
			{ error: result.error },
			{ status: result.status }
		);
	}

	return NextResponse.json(result.data);
}

/**
 * Builds update data from request body
 */
function buildCaseUpdateData(
	body: Record<string, unknown>
): Record<string, unknown> {
	const updateData: Record<string, unknown> = {};
	if (body.name !== undefined) {
		updateData.name = body.name;
	}
	if (body.description !== undefined) {
		updateData.description = body.description;
	}
	if (body.color_profile !== undefined) {
		updateData.colorProfile = body.color_profile;
	}
	if (body.lock_uuid !== undefined) {
		updateData.lockUuid = body.lock_uuid;
	}
	return updateData;
}

/**
 * Handles Prisma-based case update
 */
async function updateCaseWithPrisma(
	id: string,
	sessionKey: string,
	body: Record<string, unknown>
): Promise<NextResponse> {
	const { validateRefreshToken } = await import(
		"@/lib/auth/refresh-token-service"
	);
	const { prismaNew } = await import("@/lib/prisma-new");
	const { getCasePermission, hasPermissionLevel } = await import(
		"@/lib/permissions"
	);

	const validation = await validateRefreshToken(sessionKey);
	if (!(validation.valid && validation.userId)) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	// Check permission
	const permissionResult = await getCasePermission({
		userId: validation.userId,
		caseId: id,
	});
	const hasEditAccess =
		permissionResult.hasAccess &&
		permissionResult.permission &&
		hasPermissionLevel(permissionResult.permission, "EDIT");

	if (!hasEditAccess) {
		return NextResponse.json({ error: "Permission denied" }, { status: 403 });
	}

	const updateData = buildCaseUpdateData(body);
	const updated = await prismaNew.assuranceCase.update({
		where: { id },
		data: updateData,
	});

	return NextResponse.json({
		id: updated.id,
		name: updated.name,
		description: updated.description,
		created_date: updated.createdAt.toISOString(),
		lock_uuid: updated.lockUuid,
		color_profile: updated.colorProfile,
	});
}

/**
 * PUT /api/cases/[id]
 * Updates case metadata
 */
export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const session = await getServerSession(authOptions);

	if (!session?.key) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const { id } = await params;

	try {
		const body = await request.json();
		return await updateCaseWithPrisma(id, session.key, body);
	} catch (error) {
		console.error("Error updating case:", error);
		return NextResponse.json(
			{ error: "Failed to update case" },
			{ status: 500 }
		);
	}
}

/**
 * DELETE /api/cases/[id]
 * Deletes a case and all its elements
 */
export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const session = await getServerSession(authOptions);

	if (!session?.key) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const { id } = await params;

	const { validateRefreshToken } = await import(
		"@/lib/auth/refresh-token-service"
	);
	const { prismaNew } = await import("@/lib/prisma-new");
	const { getCasePermission } = await import("@/lib/permissions");

	const validation = await validateRefreshToken(session.key);
	if (!(validation.valid && validation.userId)) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	// Check permission - only ADMIN can delete
	const permissionResult = await getCasePermission({
		userId: validation.userId,
		caseId: id,
	});
	if (!permissionResult.hasAccess || permissionResult.permission !== "ADMIN") {
		return NextResponse.json({ error: "Permission denied" }, { status: 403 });
	}

	try {
		// Delete case (elements cascade)
		await prismaNew.assuranceCase.delete({
			where: { id },
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error deleting case:", error);
		return NextResponse.json(
			{ error: "Failed to delete case" },
			{ status: 500 }
		);
	}
}
