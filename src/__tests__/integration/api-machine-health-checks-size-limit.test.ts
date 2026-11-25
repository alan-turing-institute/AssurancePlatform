import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	callPublishChecks,
	setupCriteriaCase,
} from "../utils/health-criteria-kit";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

const LIMIT_BYTES = 256 * 1024;
const DESCRIPTION_MAX = 2000;
const CHECK_COUNT = 150;

beforeEach(async () => {
	await mockNoAuth();
});

function paddedCheck(index: number, padding: number) {
	return {
		name: `Padded check ${index}`,
		version: "1",
		description: "x".repeat(1 + padding),
		scope: "item",
		value: { type: "boolean" },
	};
}

/** A well-formed list whose JSON text is exactly `targetBytes` long. */
function buildListOfBytes(targetBytes: number) {
	const checks = Array.from({ length: CHECK_COUNT }, (_, i) =>
		paddedCheck(i, 0)
	);
	let remaining =
		targetBytes - JSON.stringify({ pipeline: "Sized", checks }).length;
	const filled = checks.map((_, i) => {
		const padding = Math.min(DESCRIPTION_MAX - 1, remaining);
		remaining -= padding;
		return paddedCheck(i, padding);
	});
	const list = { pipeline: "Sized", checks: filled };
	if (JSON.stringify(list).length !== targetBytes) {
		throw new Error("could not size the list");
	}
	return list;
}

async function catalogueRows(integrationId: string) {
	return await prisma.pluginHealthCheckCatalogue.findMany({
		where: { integrationId },
	});
}

describe("PUT /api/machine/health/checks — size limit", () => {
	it("refuses a list one byte over 256 KiB with 413 and leaves the stored list untouched", async () => {
		const context = await setupCriteriaCase();
		const before = await catalogueRows(context.integration.id);
		expect(before).toHaveLength(1);

		const response = await callPublishChecks(
			buildListOfBytes(LIMIT_BYTES + 1),
			context.secret
		);

		expect(response.status).toBe(413);
		expect(await response.json()).toMatchObject({
			error: "Request body too large",
			code: "PAYLOAD_TOO_LARGE",
		});
		expect(await catalogueRows(context.integration.id)).toEqual(before);
	});

	it("accepts a list of exactly 256 KiB and stores it", async () => {
		const context = await setupCriteriaCase({ publish: false });
		const list = buildListOfBytes(LIMIT_BYTES);

		const response = await callPublishChecks(list, context.secret);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			checks: CHECK_COUNT,
			warnings: [],
		});
		const rows = await catalogueRows(context.integration.id);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.pipeline).toBe("Sized");
		expect(rows[0]?.checks).toHaveLength(CHECK_COUNT);
	});
});
