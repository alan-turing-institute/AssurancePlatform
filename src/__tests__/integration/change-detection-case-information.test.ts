import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { detectChanges } from "@/lib/services/change-detection-service";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	publishCase,
	setStatus,
	type VariableWorld,
	variableWorld,
} from "../utils/variables-kit";

/**
 * Update Published is offered when the case's name or case information
 * (description, authors, sector, feature image) differs from the published
 * copy. The published image is a renamed copy of the live one, so a case
 * that has not been edited must not look changed after publishing.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const PNG_BYTES = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

beforeEach(async () => {
	await mockNoAuth();
});

/** Writes a new image file under the case's own upload folder; returns its key. */
async function newImage(caseId: string): Promise<string> {
	const { UPLOADS_DIR } = await import("@/lib/services/blob-storage-service");
	const key = `cases/${caseId}/case-information/${randomUUID()}.png`;
	await mkdir(join(UPLOADS_DIR, key, ".."), { recursive: true });
	await writeFile(join(UPLOADS_DIR, key), PNG_BYTES);
	return key;
}

function editInformation(
	world: VariableWorld,
	data: {
		authors?: string;
		description?: string;
		featureImageUrl?: string | null;
		sector?: string;
	}
) {
	return prisma.caseInformation.update({
		where: { caseId: world.caseId },
		data,
	});
}

async function hasChanges(world: VariableWorld): Promise<boolean> {
	const result = await detectChanges(world.ownerId, world.caseId);
	if (!("data" in result)) {
		throw new Error(result.error);
	}
	return result.data.hasChanges;
}

/** A published case whose feature image is a real uploaded file. */
async function publishedWorld(externalImage?: string): Promise<VariableWorld> {
	const world = await variableWorld("CASE");
	await editInformation(world, {
		featureImageUrl: externalImage ?? (await newImage(world.caseId)),
	});
	const response = await publishCase(world.caseId);
	if (response.status !== 200) {
		throw new Error(`The first publish failed with ${response.status}`);
	}
	return world;
}

describe("changes since the published copy, for the case's name and information", () => {
	it("sees none straight after publishing with an uploaded image", async () => {
		const world = await publishedWorld();

		expect(await hasChanges(world)).toBe(false);
	});

	it("sees a changed description", async () => {
		const world = await publishedWorld();
		await editInformation(world, { description: "A different description" });

		expect(await hasChanges(world)).toBe(true);
	});

	it("sees changed authors", async () => {
		const world = await publishedWorld();
		await editInformation(world, { authors: "Someone Else" });

		expect(await hasChanges(world)).toBe(true);
	});

	it("sees a changed sector", async () => {
		const world = await publishedWorld();
		await editInformation(world, { sector: "Transport" });

		expect(await hasChanges(world)).toBe(true);
	});

	it("sees a renamed case", async () => {
		const world = await publishedWorld();
		await prisma.assuranceCase.update({
			where: { id: world.caseId },
			data: { name: "A new name" },
		});

		expect(await hasChanges(world)).toBe(true);
	});

	it("sees a new image", async () => {
		const world = await publishedWorld();
		await editInformation(world, {
			featureImageUrl: await newImage(world.caseId),
		});

		expect(await hasChanges(world)).toBe(true);
	});

	it("sees a removed image", async () => {
		const world = await publishedWorld();
		await editInformation(world, { featureImageUrl: null });

		expect(await hasChanges(world)).toBe(true);
	});

	it("sees none again after the update is published", async () => {
		const world = await publishedWorld();
		await editInformation(world, {
			featureImageUrl: await newImage(world.caseId),
		});
		expect(await hasChanges(world)).toBe(true);

		const response = await publishCase(world.caseId);
		expect(response.status).toBe(200);

		expect(await hasChanges(world)).toBe(false);
	});

	it("sees none for an external image address left as it was", async () => {
		const world = await publishedWorld("https://example.com/picture.png");

		expect(await hasChanges(world)).toBe(false);
	});

	it("sees a changed external image address", async () => {
		const world = await publishedWorld("https://example.com/picture.png");
		await editInformation(world, {
			featureImageUrl: "https://example.com/other.png",
		});

		expect(await hasChanges(world)).toBe(true);
	});

	it("sees case information on a case whose published copy holds none", async () => {
		const world = await publishedWorld();
		const row = await prisma.publishedAssuranceCase.findFirstOrThrow({
			where: { assuranceCaseId: world.caseId },
		});
		const { caseInformation: _removed, ...withoutInformation } =
			row.content as Record<string, unknown>;
		await prisma.publishedAssuranceCase.update({
			where: { id: row.id },
			data: { content: withoutInformation as object },
		});

		expect(await hasChanges(world)).toBe(true);
	});
});

describe("the routes after an image-only edit", () => {
	async function getJson(
		route: "changes" | "status",
		caseId: string
	): Promise<{ hasChanges: boolean }> {
		const { GET } =
			route === "changes"
				? await import("@/app/api/cases/[id]/changes/route")
				: await import("@/app/api/cases/[id]/status/route");
		const response = await GET(
			new NextRequest(`http://localhost:3000/api/cases/${caseId}/${route}`),
			{ params: Promise.resolve({ id: caseId }) }
		);
		if (response.status !== 200) {
			throw new Error(`${route} answered ${response.status}`);
		}
		return await response.json();
	}

	it("report a change, and none once the status route republishes", async () => {
		const world = await publishedWorld();
		await editInformation(world, {
			featureImageUrl: await newImage(world.caseId),
		});

		expect((await getJson("changes", world.caseId)).hasChanges).toBe(true);
		expect((await getJson("status", world.caseId)).hasChanges).toBe(true);

		const response = await setStatus(world.caseId, "PUBLISHED");
		expect(response.status).toBe(200);

		expect((await getJson("changes", world.caseId)).hasChanges).toBe(false);
		expect((await getJson("status", world.caseId)).hasChanges).toBe(false);
	});
});
