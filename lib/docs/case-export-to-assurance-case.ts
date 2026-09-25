/**
 * Adapts a curriculum case file (`CaseExportNested`, the same v1.0 tree
 * format the real export/import pipeline uses) into the
 * `AssuranceCaseResponse` shape `convertAssuranceCase` (the real case
 * canvas's data-to-ReactFlow-nodes converter, `lib/case/convert-case.ts`)
 * expects: typed arrays keyed by field name (`strategies`,
 * `propertyClaims`, `evidence`) rather than the export format's generic
 * `children`.
 *
 * Curriculum case files only ever use GOAL -> STRATEGY -> PROPERTY_CLAIM
 * (nestable) -> EVIDENCE (leaf); AWAY_GOAL, MODULE and CONTEXT-as-a-child
 * never appear in them, so this adapter does not handle those — it throws
 * on an element type it cannot place, rather than silently dropping it.
 */

import type { CaseExportNested, TreeNode } from "@/lib/schemas/case-export";
import type {
	AssuranceCaseResponse,
	EvidenceResponse,
	GoalResponse,
	PropertyClaimResponse,
	StrategyResponse,
} from "@/lib/services/case-response-types";

function buildEvidence(node: TreeNode): EvidenceResponse {
	return {
		id: node.id,
		type: "evidence",
		name: node.name ?? "",
		description: node.description,
		URL: node.url ?? "",
		propertyClaimId: [],
	};
}

function buildPropertyClaim(node: TreeNode): PropertyClaimResponse {
	const evidence: EvidenceResponse[] = [];
	const propertyClaims: PropertyClaimResponse[] = [];

	for (const child of node.children) {
		if (child.type === "EVIDENCE") {
			evidence.push(buildEvidence(child));
		} else if (child.type === "PROPERTY_CLAIM") {
			propertyClaims.push(buildPropertyClaim(child));
		} else {
			throw new Error(
				`Unsupported child type "${child.type}" under property claim "${node.id}"`
			);
		}
	}

	return {
		id: node.id,
		type: "property",
		claimType: "PROJECT",
		name: node.name ?? "",
		description: node.description,
		context: node.context,
		assumption: node.assumption ?? undefined,
		justification: node.justification ?? undefined,
		level: node.level ?? 1,
		goalId: null,
		strategyId: null,
		propertyClaimId: null,
		propertyClaims,
		evidence,
	};
}

function buildStrategy(node: TreeNode): StrategyResponse {
	const propertyClaims: PropertyClaimResponse[] = [];

	for (const child of node.children) {
		if (child.type === "PROPERTY_CLAIM") {
			propertyClaims.push(buildPropertyClaim(child));
		} else {
			throw new Error(
				`Unsupported child type "${child.type}" under strategy "${node.id}"`
			);
		}
	}

	return {
		id: node.id,
		type: "strategy",
		name: node.name ?? "",
		description: node.description,
		context: node.context,
		assumption: node.assumption ?? undefined,
		justification: node.justification ?? undefined,
		goalId: null,
		propertyClaims,
	};
}

function buildGoal(node: TreeNode): GoalResponse {
	const strategies: StrategyResponse[] = [];
	const propertyClaims: PropertyClaimResponse[] = [];

	for (const child of node.children) {
		if (child.type === "STRATEGY") {
			strategies.push(buildStrategy(child));
		} else if (child.type === "PROPERTY_CLAIM") {
			propertyClaims.push(buildPropertyClaim(child));
		} else {
			throw new Error(
				`Unsupported child type "${child.type}" under goal "${node.id}"`
			);
		}
	}

	return {
		id: node.id,
		type: "goal",
		name: node.name ?? "",
		description: node.description,
		context: node.context,
		assumption: node.assumption ?? undefined,
		justification: node.justification ?? undefined,
		keywords: "",
		assuranceCaseId: node.id,
		strategies,
		propertyClaims,
		comments: [],
	};
}

/**
 * Converts a curriculum case export into a read-only `AssuranceCaseResponse`
 * stub. `permissions: "view"` drives the real node/toolbar components'
 * existing view-only behaviour (hides Add/Options/Export/Share/Delete —
 * see `NodeActionGroup`, `ActionButtons`) without any component changes.
 */
export function caseExportToAssuranceCase(
	data: CaseExportNested
): AssuranceCaseResponse {
	if (data.tree.type !== "GOAL") {
		throw new Error(
			`Expected a GOAL at the root of the case tree, got "${data.tree.type}"`
		);
	}

	const goal = buildGoal(data.tree);

	return {
		id: data.tree.id,
		type: "assurance_case",
		name: data.case.name,
		description: data.case.description,
		permissions: "view",
		createdDate: data.exportedAt,
		comments: [],
		goals: [goal],
	};
}
