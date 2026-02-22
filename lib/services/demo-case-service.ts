/**
 * Demo case creation service
 *
 * Creates a pre-built "Tutorial: Safe Chatbot Deployment" case for new users
 * to demonstrate TEA methodology. Idempotent — only creates if no demo case
 * exists and user hasn't dismissed it.
 */

import { prismaNew } from "@/lib/prisma";

/**
 * Ensures a demo assurance case exists for the given user.
 *
 * Skips creation if:
 * - User already has an active (non-deleted) demo case
 * - User has "demo-case" in their completedTours (previously dismissed/deleted)
 */
export async function ensureDemoCaseExists(userId: string): Promise<void> {
	// Check if user already has an active demo case
	const existingDemo = await prismaNew.assuranceCase.findFirst({
		where: {
			createdById: userId,
			isDemo: true,
			deletedAt: null,
		},
		select: { id: true },
	});

	if (existingDemo) {
		return;
	}

	// Check if user has already seen/dismissed the demo
	const user = await prismaNew.user.findUnique({
		where: { id: userId },
		select: { completedTours: true },
	});

	if (user?.completedTours.includes("demo-case")) {
		return;
	}

	// Create the demo case with all elements in a single transaction
	await prismaNew.$transaction(async (tx) => {
		// Double-check inside transaction to prevent races
		const raceCheck = await tx.assuranceCase.findFirst({
			where: {
				createdById: userId,
				isDemo: true,
				deletedAt: null,
			},
			select: { id: true },
		});

		if (raceCheck) {
			return;
		}

		const demoCase = await tx.assuranceCase.create({
			data: {
				name: "Tutorial: Safe Chatbot Deployment",
				description:
					"A walkthrough of Trustworthy and Ethical Assurance (TEA) methodology using a customer support chatbot safety case. This demo case shows how goals decompose into strategies, claims, and evidence.",
				createdById: userId,
				mode: "STANDARD",
				isDemo: true,
			},
		});

		// G1: Top-level goal
		const g1 = await tx.assuranceElement.create({
			data: {
				caseId: demoCase.id,
				elementType: "GOAL",
				role: "TOP_LEVEL",
				name: "G1",
				description:
					"The customer support chatbot is safe and trustworthy for deployment",
				context: ["Customer support domain", "Cloud-hosted deployment"],
				createdById: userId,
			},
		});

		// S1: Strategy for response quality and safety
		const s1 = await tx.assuranceElement.create({
			data: {
				caseId: demoCase.id,
				elementType: "STRATEGY",
				role: "SUPPORTING",
				parentId: g1.id,
				name: "S1",
				description: "Argue over response quality and safety",
				justification:
					"Decomposing safety into content quality and accuracy ensures both harmful outputs and factual errors are addressed separately.",
				createdById: userId,
			},
		});

		// S2: Strategy for data privacy and security
		const s2 = await tx.assuranceElement.create({
			data: {
				caseId: demoCase.id,
				elementType: "STRATEGY",
				role: "SUPPORTING",
				parentId: g1.id,
				name: "S2",
				description: "Argue over data privacy and security",
				justification:
					"Privacy and security are distinct from functional safety — they require separate evidence from compliance and governance processes.",
				createdById: userId,
			},
		});

		// C1: Claim under S1
		const c1 = await tx.assuranceElement.create({
			data: {
				caseId: demoCase.id,
				elementType: "PROPERTY_CLAIM",
				role: "SUPPORTING",
				parentId: s1.id,
				name: "C1",
				description:
					"The chatbot does not generate harmful or misleading content",
				level: 1,
				createdById: userId,
			},
		});

		// C2: Claim under S1
		const c2 = await tx.assuranceElement.create({
			data: {
				caseId: demoCase.id,
				elementType: "PROPERTY_CLAIM",
				role: "SUPPORTING",
				parentId: s1.id,
				name: "C2",
				description:
					"Responses are accurate and grounded in approved knowledge",
				level: 1,
				createdById: userId,
			},
		});

		// C3: Claim under S2
		const c3 = await tx.assuranceElement.create({
			data: {
				caseId: demoCase.id,
				elementType: "PROPERTY_CLAIM",
				role: "SUPPORTING",
				parentId: s2.id,
				name: "C3",
				description:
					"User data is handled in compliance with privacy regulations",
				level: 1,
				createdById: userId,
			},
		});

		// C4: Claim under S2
		const c4 = await tx.assuranceElement.create({
			data: {
				caseId: demoCase.id,
				elementType: "PROPERTY_CLAIM",
				role: "SUPPORTING",
				parentId: s2.id,
				name: "C4",
				description: "Conversations are not used for unauthorised purposes",
				level: 1,
				createdById: userId,
			},
		});

		// E1: Evidence for C1
		const e1 = await tx.assuranceElement.create({
			data: {
				caseId: demoCase.id,
				elementType: "EVIDENCE",
				role: "SUPPORTING",
				name: "E1",
				description: "Content safety evaluation report",
				url: "https://example.com/reports/content-safety-evaluation",
				createdById: userId,
			},
		});

		// E2: Evidence for C2
		const e2 = await tx.assuranceElement.create({
			data: {
				caseId: demoCase.id,
				elementType: "EVIDENCE",
				role: "SUPPORTING",
				name: "E2",
				description: "Accuracy benchmark test results",
				url: "https://example.com/reports/accuracy-benchmarks",
				createdById: userId,
			},
		});

		// E3: Evidence for C3
		const e3 = await tx.assuranceElement.create({
			data: {
				caseId: demoCase.id,
				elementType: "EVIDENCE",
				role: "SUPPORTING",
				name: "E3",
				description: "Data protection impact assessment",
				url: "https://example.com/reports/dpia",
				createdById: userId,
			},
		});

		// E4: Evidence for C4
		const e4 = await tx.assuranceElement.create({
			data: {
				caseId: demoCase.id,
				elementType: "EVIDENCE",
				role: "SUPPORTING",
				name: "E4",
				description: "Data governance policy document",
				url: "https://example.com/reports/data-governance-policy",
				createdById: userId,
			},
		});

		// Create evidence links (many-to-many)
		await tx.evidenceLink.createMany({
			data: [
				{ evidenceId: e1.id, claimId: c1.id },
				{ evidenceId: e2.id, claimId: c2.id },
				{ evidenceId: e3.id, claimId: c3.id },
				{ evidenceId: e4.id, claimId: c4.id },
			],
		});
	});
}
