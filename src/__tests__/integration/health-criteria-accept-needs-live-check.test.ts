import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { publishHealthCheckList } from "@/lib/services/health-check-catalogue-service";
import {
	buildHealthCheckList,
	ITEM_CHECK_NAME,
} from "../fixtures/health-checks";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	callCriteriaPut,
	callRetirement,
	itemSettings,
	saveBody,
	setupCriteriaCase,
} from "../utils/health-criteria-kit";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/lib/services/sse-connection-manager")
		>();
	return { ...actual, emitSSEEvent: vi.fn() };
});

const NOT_OFFERED = "Check not offered for this case";

beforeEach(async () => {
	await mockNoAuth();
});

async function setup() {
	const context = await setupCriteriaCase();
	await mockAuth(context.owner.id, context.owner.username, context.owner.email);
	return context;
}

type Context = Awaited<ReturnType<typeof setup>>;

/** Publishes the demo list again, without the named check (or with it at another version). */
async function republish(
	context: Context,
	change: (check: { name: string; version: string }) => boolean | "bump"
) {
	const list = buildHealthCheckList();
	const checks = list.checks.flatMap((check) => {
		const verdict = change(check);
		if (verdict === false) {
			return [];
		}
		return [verdict === "bump" ? { ...check, version: "9.9" } : check];
	});
	expectSuccess(
		await publishHealthCheckList(
			{
				integrationId: context.integration.id,
				systemUserId: context.systemUserId,
			},
			{ ...list, checks } as never
		)
	);
}

const withoutItemCheck = (check: { name: string }) =>
	check.name !== ITEM_CHECK_NAME;

async function put(
	context: Context,
	accept: boolean,
	settings: Record<string, unknown> = itemSettings()
) {
	return await callCriteriaPut(
		context.claim.id,
		saveBody(context.integration.id, settings, accept)
	);
}

async function row(context: Context) {
	return await prisma.pluginHealthCriteria.findUnique({
		where: { claimId: context.claim.id },
	});
}

const REFUSED = { status: 400, notOffered: NOT_OFFERED };

async function refusalOf(response: Response) {
	const body = await response.json();
	return {
		status: response.status,
		notOffered: body.fieldErrors?.["settings.check.name"],
	};
}

describe("accepting settings needs the check in the pipeline's published list", () => {
	it("refuses accepting a suggestion whose check has left the list, naming the field, and leaves the suggestion as it was", async () => {
		const context = await setup();
		expect((await put(context, false)).status).toBe(200);
		const before = await row(context);
		await republish(context, withoutItemCheck);
		expect(await refusalOf(await put(context, true))).toEqual(REFUSED);
		const after = await row(context);
		expect(after?.state).toBe("SUGGESTED");
		expect(after?.revision).toBe(before?.revision);
		expect(after?.acceptedAt).toBeNull();
	});

	it("refuses accepting from nothing when the check is not in the list", async () => {
		const context = await setup();
		await republish(context, withoutItemCheck);
		expect(await refusalOf(await put(context, true))).toEqual(REFUSED);
		expect(await row(context)).toBeNull();
	});

	it("refuses accepting from inactive settings when the check has left the list", async () => {
		const context = await setup();
		expect((await put(context, true)).status).toBe(200);
		expect((await callRetirement(context.claim.id)).status).toBe(200);
		expect((await row(context))?.state).toBe("INACTIVE");
		await republish(context, withoutItemCheck);
		expect(await refusalOf(await put(context, true))).toEqual(REFUSED);
		expect((await row(context))?.state).toBe("INACTIVE");
	});

	it("refuses accepting a suggestion when the list now holds the check only at another version", async () => {
		const context = await setup();
		expect((await put(context, false)).status).toBe(200);
		await republish(context, (check) =>
			check.name === ITEM_CHECK_NAME ? "bump" : true
		);
		expect(await refusalOf(await put(context, true))).toEqual(REFUSED);
		expect((await row(context))?.state).toBe("SUGGESTED");
	});

	it("still accepts a suggestion while its check is in the list", async () => {
		const context = await setup();
		expect((await put(context, false)).status).toBe(200);
		expect((await put(context, true)).status).toBe(200);
		const accepted = await row(context);
		expect(accepted?.state).toBe("ACCEPTED");
		expect(accepted?.acceptedAt).not.toBeNull();
	});

	it("still lets accepted settings be edited after the check has left the list", async () => {
		const context = await setup();
		expect((await put(context, true)).status).toBe(200);
		const before = await row(context);
		await republish(context, withoutItemCheck);
		const edited = itemSettings({ window: "PT2M" });
		const response = await put(context, true, edited);
		expect(response.status).toBe(200);
		const after = await row(context);
		expect(after?.state).toBe("ACCEPTED");
		expect(after?.revision).toBe((before?.revision ?? 0) + 1);
		expect((after?.settings as { window?: string }).window).toBe("PT2M");
	});

	it("still refuses changing which check accepted settings name once it has left the list", async () => {
		const context = await setup();
		expect((await put(context, true)).status).toBe(200);
		await republish(context, withoutItemCheck);
		const other = itemSettings();
		const response = await put(context, true, {
			...other,
			check: { ...(other.check as object), version: "0.9" },
		});
		expect(await refusalOf(response)).toEqual(REFUSED);
	});

	it("still lets a suggestion be saved again after its check has left the list", async () => {
		const context = await setup();
		expect((await put(context, false)).status).toBe(200);
		await republish(context, withoutItemCheck);
		const response = await put(
			context,
			false,
			itemSettings({ window: "PT3M" })
		);
		expect(response.status).toBe(200);
		const after = await row(context);
		expect(after?.state).toBe("SUGGESTED");
		expect((after?.settings as { window?: string }).window).toBe("PT3M");
	});
});
