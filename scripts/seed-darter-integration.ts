/**
 * Registers the DARTER pipeline as a machine integration (ADR 0002 v2 §2.4)
 * and grants it case-level access so it can call `/api/machine/*` end to
 * end. Idempotent — safe to re-run:
 *   - reuses the existing `darter-pipeline` integration/system user if one
 *     already exists, reconciling its scopes to the current expected set
 *   - upserts the case permission grant
 *   - only issues a new token if the integration has no currently-active
 *     one (a plaintext secret is shown exactly once at issuance and never
 *     again, so a re-run cannot reprint an old one — it also never
 *     silently issues a surplus token on every run)
 *
 * Usage:
 *   npx tsx scripts/seed-darter-integration.ts <caseId> --owner-email=<email> [--permission=EDIT]
 *
 * `--owner-email` must be an existing human user — the ADR requires a real
 * accountable owner, so this script never invents one.
 */

import { sameScopes } from "../lib/auth/scopes";
import { prisma } from "../lib/prisma";
import {
	issueToken,
	registerIntegration,
	updateIntegrationScopes,
} from "../lib/services/integration-registry-service";
import type { PermissionLevel } from "../src/generated/prisma";

const INTEGRATION_NAME = "darter-pipeline";
const EXPECTED_SCOPES = ["case:read", "health:evidence:write"] as const;
const VALID_PERMISSIONS: PermissionLevel[] = [
	"VIEW",
	"COMMENT",
	"EDIT",
	"ADMIN",
];

interface Args {
	caseId: string;
	ownerEmail: string;
	permission: PermissionLevel;
}

function parseArgs(): Args {
	const [caseId, ...flags] = process.argv.slice(2);
	if (!caseId) {
		usageError("Missing required <caseId> argument.");
	}

	let ownerEmail: string | undefined;
	let permission: PermissionLevel = "EDIT";

	for (const flag of flags) {
		if (flag.startsWith("--owner-email=")) {
			ownerEmail = flag.slice("--owner-email=".length);
		} else if (flag.startsWith("--permission=")) {
			const value = flag.slice("--permission=".length).toUpperCase();
			if (!VALID_PERMISSIONS.includes(value as PermissionLevel)) {
				usageError(
					`Invalid --permission="${value}". Must be one of ${VALID_PERMISSIONS.join(", ")}.`
				);
			}
			permission = value as PermissionLevel;
		}
	}

	if (!ownerEmail) {
		usageError("Missing required --owner-email=<email> flag.");
	}

	return { caseId, ownerEmail, permission };
}

function usageError(message: string): never {
	console.error(`Error: ${message}`);
	console.error(
		"Usage: npx tsx scripts/seed-darter-integration.ts <caseId> --owner-email=<email> [--permission=EDIT]"
	);
	process.exit(1);
}

async function main() {
	const { caseId, ownerEmail, permission } = parseArgs();

	const owner = await prisma.user.findUnique({ where: { email: ownerEmail } });
	if (!owner) {
		usageError(`No user found with email "${ownerEmail}".`);
		return;
	}

	const targetCase = await prisma.assuranceCase.findUnique({
		where: { id: caseId },
		select: { id: true, name: true },
	});
	if (!targetCase) {
		usageError(`No assurance case found with id "${caseId}".`);
		return;
	}

	let integrationId: string;
	let systemUserId: string;

	const existing = await prisma.integration.findUnique({
		where: { name: INTEGRATION_NAME },
	});

	if (existing) {
		integrationId = existing.id;
		systemUserId = existing.systemUserId;
		console.log(
			`Integration "${INTEGRATION_NAME}" already registered (${existing.id}).`
		);

		if (!sameScopes(existing.scopes, EXPECTED_SCOPES)) {
			const result = await updateIntegrationScopes(
				existing.id,
				[...EXPECTED_SCOPES],
				owner.id
			);
			if ("error" in result) {
				console.error(`Failed to reconcile scopes: ${result.error}`);
				process.exit(1);
			}
			console.log(`Reconciled scopes to: ${EXPECTED_SCOPES.join(", ")}`);
		}
	} else {
		const result = await registerIntegration(
			{
				name: INTEGRATION_NAME,
				description:
					"DARTER evidence pipeline — machine client for the health plugin",
				ownerId: owner.id,
				scopes: [...EXPECTED_SCOPES],
			},
			owner.id
		);
		if ("error" in result) {
			console.error(`Failed to register integration: ${result.error}`);
			process.exit(1);
			return;
		}
		integrationId = result.data.integration.id;
		systemUserId = result.data.systemUserId;
		console.log(
			`Registered integration "${INTEGRATION_NAME}" (${integrationId}).`
		);
	}

	await prisma.casePermission.upsert({
		where: { caseId_userId: { caseId, userId: systemUserId } },
		create: { caseId, userId: systemUserId, permission, grantedById: owner.id },
		update: { permission, grantedById: owner.id },
	});
	console.log(
		`Granted ${permission} on case "${targetCase.name}" (${caseId}) to the DARTER system user.`
	);

	const now = new Date();
	const activeTokens = await prisma.apiToken.findMany({
		where: {
			integrationId,
			revokedAt: null,
			OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
		},
		select: { tokenPrefix: true },
	});

	if (activeTokens.length > 0) {
		console.log(
			`Integration already has ${activeTokens.length} active token(s): ${activeTokens
				.map((t) => t.tokenPrefix)
				.join(
					", "
				)}. Not issuing a new one — rotate explicitly if a fresh secret is needed.`
		);
		return;
	}

	const issued = await issueToken(integrationId, owner.id);
	if ("error" in issued) {
		console.error(`Failed to issue token: ${issued.error}`);
		process.exit(1);
		return;
	}

	console.log("");
	console.log("Token issued — shown once, will not be retrievable again:");
	console.log(`  ${issued.data.secret}`);
	console.log("");
	console.log(`  Token ID:     ${issued.data.apiToken.id}`);
	console.log(`  Token prefix: ${issued.data.apiToken.tokenPrefix}`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
