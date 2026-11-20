import type { Page, Route } from "@playwright/test";
import prisma from "@/lib/prisma";
import {
	issueToken,
	registerIntegration,
} from "@/lib/services/integration-registry-service";

export const INTEGRATIONS_URL = "/dashboard/settings/integrations";
const NAME_PREFIX = "e2e-kb-";

export interface SeededIntegration {
	id: string;
	name: string;
	tokenIds: string[];
}

type IntegrationStatus = "ACTIVE" | "REVOKED" | "SUSPENDED";

const createdCaseNames: string[] = [];
const createdIntegrationIds: string[] = [];

async function ownerId(): Promise<string> {
	const owner = await prisma.user.findUniqueOrThrow({
		where: { username: "chris" },
		select: { id: true },
	});
	return owner.id;
}

async function issueTokens(
	integrationId: string,
	owner: string,
	count: number
): Promise<string[]> {
	const ids: string[] = [];
	for (let i = 0; i < count; i++) {
		const issued = await issueToken(integrationId, owner);
		if ("error" in issued) {
			throw new Error(`Failed to seed token: ${issued.error}`);
		}
		ids.push(issued.data.apiToken.id);
	}
	return ids;
}

/**
 * Registers an integration owned by the seed user, with `tokens` live tokens,
 * then moves it to `status` directly in the database so that a non-active
 * integration still holds live tokens.
 */
export async function seedIntegration(
	label: string,
	options: { status?: IntegrationStatus; tokens?: number } = {}
): Promise<SeededIntegration> {
	const owner = await ownerId();
	const name = `${NAME_PREFIX}${label}-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
	const registered = await registerIntegration(
		{ name, scopes: ["case:read"] },
		owner
	);
	if ("error" in registered) {
		throw new Error(`Failed to seed integration: ${registered.error}`);
	}
	const { id } = registered.data.integration;
	const tokenIds = await issueTokens(id, owner, options.tokens ?? 0);
	if (options.status && options.status !== "ACTIVE") {
		await prisma.integration.update({
			where: { id },
			data: { status: options.status },
		});
	}
	createdIntegrationIds.push(id);
	return { id, name, tokenIds };
}

/** Creates cases the seed user administers. */
export async function seedCases(names: string[]): Promise<void> {
	const owner = await ownerId();
	await prisma.assuranceCase.createMany({
		data: names.map((name) => ({
			name,
			description: "Created by the keyboard end-to-end spec",
			createdById: owner,
		})),
	});
	createdCaseNames.push(...names);
}

/** Removes everything this spec made, including integrations it registered through the page. */
export async function removeSeededData(): Promise<void> {
	// Only this worker's own integrations: other spec files run in parallel
	// workers against the same database. Integrations made through the page
	// carry the page-made prefixes.
	const mine = await prisma.integration.findMany({
		where: {
			OR: [
				{ id: { in: createdIntegrationIds } },
				{ name: { startsWith: `${NAME_PREFIX}registered-` } },
				{ name: { startsWith: `${NAME_PREFIX}refused-` } },
			],
		},
		select: { id: true, systemUserId: true },
	});
	await prisma.integration.deleteMany({
		where: { id: { in: mine.map((i) => i.id) } },
	});
	await prisma.user.deleteMany({
		where: { id: { in: mine.map((i) => i.systemUserId) } },
	});
	await prisma.assuranceCase.deleteMany({
		where: { name: { in: createdCaseNames } },
	});
	await prisma.$disconnect();
}

export function cardOf(page: Page, integration: SeededIntegration) {
	return page.getByTestId(`integration-card-${integration.id}`);
}

/** A description of the focused element: its label, else its text, else its tag. */
export function activeDescription(page: Page): Promise<string> {
	return page.evaluate(() => {
		const el = document.activeElement;
		if (!el || el === document.body) {
			return "BODY";
		}
		const label = el.getAttribute("aria-label") ?? el.textContent ?? "";
		return `${el.tagName}:${label.trim().slice(0, 60)}`;
	});
}

export function failWith500(route: Route) {
	return route.fulfill({
		status: 500,
		contentType: "application/json",
		body: JSON.stringify({ error: "Server said no" }),
	});
}

/** Answers every request matching `url` with the given method after `ms`, passing it on. */
export function delayed(method: string, ms: number) {
	return async (route: Route) => {
		if (route.request().method() !== method) {
			await route.fallback();
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, ms));
		await route.continue();
	};
}
