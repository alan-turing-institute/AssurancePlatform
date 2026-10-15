import { tool } from "ai";
import { z } from "zod";
import type { CaseExportNested } from "@/lib/schemas/case-export";
import {
	type HealthStatus,
	readHealthStatusesForCase,
} from "@/lib/services/health-status-service";
import type { ClaimHealthAvailability } from "./claim-health-availability";
import type { ToolCallLimit } from "./tool-call-limit";

/** The most claims listed, and the most labels of claims without results listed; each is counted past it separately. */
const MAX_LISTED = 100;
/** A claim's text, and each value of a settings difference, is cut to this many characters. */
const MAX_FIELD_CHARS = 200;
/** The first half of a character outside the basic plane, when nothing follows it. */
const TRAILING_HIGH_SURROGATE = /[\uD800-\uDBFF]$/u;

const UNAVAILABLE = {
	found: false,
	message: "Claim health is not available for this case.",
} as const;

interface ClaimNode {
	children?: ClaimNode[];
	description?: string;
	id: string;
	name?: string | null;
	type?: string;
}

/** The property claims under `node`, the node included, depth first, in the order the case shows them. */
function propertyClaims(node: ClaimNode): ClaimNode[] {
	const own = node.type === "PROPERTY_CLAIM" ? [node] : [];
	return own.concat((node.children ?? []).flatMap(propertyClaims));
}

/**
 * `text` cut to the field limit, counted in UTF-16 units. A cut that falls
 * between the two halves of a character outside the basic plane would leave
 * the first half alone, which is not valid text, so that half is dropped.
 */
function cutField(text: string): string {
	return text.slice(0, MAX_FIELD_CHARS).replace(TRAILING_HIGH_SURROGATE, "");
}

/** A value as JSON text, cut to the field limit. */
function jsonCut(value: unknown): string {
	return cutField(JSON.stringify(value) ?? "null");
}

/** A time as `YYYY-MM-DD HH:MM:SS UTC`: whole seconds, a space in place of the T and UTC in place of the Z. Null stays null. */
function utcTime(time: Date | string): string;
function utcTime(time: Date | string | null): string | null;
function utcTime(time: Date | string | null): string | null {
	return time === null
		? null
		: `${new Date(time).toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

/** How the result was judged compared with the settings accepted now. Null when there is no result to compare. */
function settingsOf(status: HealthStatus): string | null {
	if (status.verdict === null) {
		return null;
	}
	if (status.mismatch === null) {
		return "as accepted";
	}
	return status.mismatch.state === "undeclared"
		? "none accepted"
		: "different from accepted";
}

/** One claim as the model sees it, from named fields only. */
function claimEntry(claim: ClaimNode, status: HealthStatus) {
	const settings = settingsOf(status);
	const differences =
		settings === "different from accepted" &&
		status.mismatch?.state === "mismatch"
			? status.mismatch.differences
			: [];
	return {
		id: claim.id,
		label: claim.name || null,
		text: cutField(claim.description ?? ""),
		check: status.bound_check,
		result: status.verdict,
		resultAt: utcTime(status.timestamp),
		validUntil: utcTime(status.expires_at),
		outOfDate: status.stale,
		outOfDateReason: status.stale_reason,
		outOfDateSince: utcTime(status.stale_since),
		settings,
		...(differences.length > 0
			? {
					settingsDifferences: differences.map((difference) => ({
						field: difference.field,
						declared: jsonCut(difference.declared),
						used: jsonCut(difference.used),
					})),
				}
			: {}),
		...(status.rejected_since_last_accept > 0
			? { refusedSinceLastAccepted: status.rejected_since_last_accept }
			: {}),
	};
}

/**
 * The tool's result for the claims in the tree, each attached to its status by
 * id. A claim in the tree with no status is named by its label (its id when it
 * has none); a status for a claim that is not in the tree is only counted.
 */
function summarise(
	tree: ClaimNode,
	statuses: { claim_ref: string; status: HealthStatus }[]
) {
	const claims = propertyClaims(tree);
	const statusById = new Map(
		statuses.map(({ claim_ref, status }) => [claim_ref, status])
	);
	const withStatus: [ClaimNode, HealthStatus][] = [];
	const without: string[] = [];
	for (const claim of claims) {
		const status = statusById.get(claim.id);
		if (status) {
			withStatus.push([claim, status]);
		} else {
			without.push(claim.name || claim.id);
		}
	}
	const treeIds = new Set(claims.map((claim) => claim.id));
	const notInTree = statuses.filter(
		({ claim_ref }) => !treeIds.has(claim_ref)
	).length;
	return {
		claims: withStatus
			.slice(0, MAX_LISTED)
			.map(([claim, status]) => claimEntry(claim, status)),
		claimsTruncated: Math.max(0, withStatus.length - MAX_LISTED),
		claimsWithoutResults: without.slice(0, MAX_LISTED),
		claimsWithoutResultsTruncated: Math.max(0, without.length - MAX_LISTED),
		...(notInTree > 0 ? { claimsNotInTree: notInTree } : {}),
	};
}

async function readClaimHealth(
	userId: string,
	caseId: string,
	caseExport: () => Promise<CaseExportNested | null>
) {
	const data = await caseExport();
	if (!data) {
		return UNAVAILABLE;
	}
	const statuses = await readHealthStatusesForCase(userId, caseId);
	if ("error" in statuses) {
		return UNAVAILABLE;
	}
	return {
		found: true,
		checkedAt: utcTime(new Date()),
		...summarise(data.tree as ClaimNode, statuses.data),
	};
}

/**
 * The read_claim_health tool. It closes over the route's `userId` and
 * `caseId`. The case export is the reply's shared one, which gives the labels,
 * text and order of the claims; the statuses are read again for every call,
 * through the health plugin's own service, because they change while the
 * user talks. Calls made while a read is still running share it, so the
 * several calls a model can make in one step cost one read; a call made after
 * it has finished starts a new one. `limited` is the reply's cap on tool
 * calls, and every call counts towards it.
 */
export function createClaimHealthTool(
	userId: string,
	caseId: string,
	caseExport: () => Promise<CaseExportNested | null>,
	limited: ToolCallLimit
) {
	let inFlight: ReturnType<typeof readClaimHealth> | null = null;
	return tool({
		description:
			"Read the latest result each property claim of the open case has received from automated checks, as of now. Takes no input. Returns checkedAt, the time of this read, and claims: for each claim that has a status, in the order the case shows them, its id, label (null when it has none), text, check (the check the claim is bound to now), result (pass, marginal, fail, indeterminate, or null when it has a check but no result, or every result was withdrawn), resultAt (when the reading was taken), validUntil (null when it does not expire), outOfDate with outOfDateReason (expired, condition or all-revoked) and outOfDateSince, and settings (as accepted, different from accepted, none accepted, or null when there is no result). When the settings differ it also returns settingsDifferences, each with the field, the declared value and the value used; when results from another check were refused since the last accepted one, it returns refusedSinceLastAccepted. claimsTruncated is the number of claims left out when there are more than 100. claimsWithoutResults lists the labels of the property claims that receive no automated results, naming a claim by its id when it has no label, with claimsWithoutResultsTruncated for those left out past 100. claimsNotInTree, present only when more than 0, counts claims with a status that are detached from the case tree.",
		inputSchema: z.object({}),
		execute: () =>
			limited(() => {
				inFlight ??= readClaimHealth(userId, caseId, caseExport).finally(() => {
					inFlight = null;
				});
				return inFlight;
			}),
	});
}

const CLAIM_HEALTH_PROMPT: Record<ClaimHealthAvailability, string> = {
	available:
		"\n\nread_claim_health returns the latest result each property claim has received from automated checks, such as a test or monitoring pipeline. These results change while you talk. Whenever the user asks whether claims are passing, valid or current, call read_claim_health again, even if you called it earlier in this conversation, and answer from the new result, giving its checkedAt time. A claim is currently passing only when its result is pass and it is not out of date. A claim whose result is null either has a check but no result yet, or had every result withdrawn, in which case it is out of date with the reason all-revoked; say which. For each claim, give its label, its result in words, the check the claim is bound to and the time of that result. Say plainly when a result is out of date and why, when it was judged with settings different from the accepted ones, and which claims receive no automated results. A result reports what a check found; it does not make a claim true or false. Never say whether the case is adequate.",
	"no-results":
		"\n\nThis case has no claims with automated check results. If asked whether claims pass their checks, say so; do not infer results from the case text.",
	"plugin-off":
		"\n\nAutomated check results are not available to you, because the Claim/Evidence Health plugin is off. If asked, say so; do not infer results from the case text.",
};

/** The paragraph for the system prompt, to follow the techniques paragraph. */
export function claimHealthPrompt(availability: ClaimHealthAvailability) {
	return CLAIM_HEALTH_PROMPT[availability];
}
