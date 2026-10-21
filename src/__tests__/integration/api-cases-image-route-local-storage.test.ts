import { existsSync, readdirSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { createTestCase, createTestUser } from "../utils/prisma-factories";

/**
 * Screenshot capture through the real storage service, in the modes a
 * self-hosted install runs in. Nothing about storage is mocked: the file
 * either lands under the uploads root or it does not.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

const PNG_BYTES = Buffer.from("iVBORw0KGgo=", "base64");
const IMAGE = "data:image/png;base64,iVBORw0KGgo=";

beforeEach(async () => {
	await mockNoAuth();
});

afterEach(async () => {
	vi.unstubAllEnvs();
	for (const entry of readdirSync(uploadsRoot())) {
		await rm(join(uploadsRoot(), entry), { recursive: true, force: true });
	}
});

function uploadsRoot(): string {
	return process.env.UPLOADS_DIR ?? "";
}

function filesUnderUploads(): string[] {
	if (!existsSync(uploadsRoot())) {
		return [];
	}
	return readdirSync(uploadsRoot(), { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => join(entry.parentPath, entry.name));
}

async function ownerWithCase() {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	await mockAuth(owner.id, owner.username, owner.email);
	return { owner, testCase };
}

async function postScreenshot(caseId: string) {
	const { POST } = await import("@/app/api/cases/[id]/image/route");
	// Load the services under the test mode before the mode is changed.
	await import("@/lib/services/blob-storage-service");
	const request = new NextRequest(
		`http://localhost:3000/api/cases/${caseId}/image`,
		{
			method: "POST",
			body: JSON.stringify({ image: IMAGE }),
		}
	);
	return await POST(request, { params: Promise.resolve({ id: caseId }) });
}

describe("POST /api/cases/[id]/image on a production build with local storage", () => {
	it("stores the screenshot under the uploads root and serves the same bytes back", async () => {
		const { owner, testCase } = await ownerWithCase();
		const { getCaseScreenshotMedia } = await import(
			"@/lib/services/case-image-service"
		);
		await import("@/app/api/cases/[id]/image/route");
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("USE_LOCAL_STORAGE", "true");

		const response = await postScreenshot(testCase.id);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.success).toBe(true);
		const row = await prisma.caseImage.findUnique({
			where: { caseId: testCase.id },
		});
		expect(row).not.toBeNull();
		const key = row?.imageUrl ?? "";
		expect(key).toContain(testCase.id);
		const stored = await readFile(join(uploadsRoot(), key));
		expect(stored.equals(PNG_BYTES)).toBe(true);

		const media = await getCaseScreenshotMedia(owner.id, testCase.id);
		expect(media.status).toBe("ok");
		if (media.status === "ok") {
			expect(media.data.equals(PNG_BYTES)).toBe(true);
		}
	});

	it("fails without writing a file or a row when local storage is not switched on", async () => {
		const { testCase } = await ownerWithCase();
		await import("@/app/api/cases/[id]/image/route");
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("USE_LOCAL_STORAGE", undefined);

		const response = await postScreenshot(testCase.id);

		expect(response.status).toBe(500);
		expect(await response.json()).toMatchObject({
			error: "Storage not configured",
		});
		expect(filesUnderUploads()).toEqual([]);
		expect(
			await prisma.caseImage.findUnique({ where: { caseId: testCase.id } })
		).toBeNull();
	});

	it("does not take local storage from a value other than the exact word true", async () => {
		const { testCase } = await ownerWithCase();
		await import("@/app/api/cases/[id]/image/route");
		vi.stubEnv("NODE_ENV", "production");

		for (const value of ["TRUE", "1", "yes", "false", ""]) {
			vi.stubEnv("USE_LOCAL_STORAGE", value);

			const response = await postScreenshot(testCase.id);

			expect(response.status, value).toBe(500);
		}
		expect(filesUnderUploads()).toEqual([]);
	});

	it("still stores the screenshot locally in development without the setting", async () => {
		const { testCase } = await ownerWithCase();
		await import("@/app/api/cases/[id]/image/route");
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("USE_LOCAL_STORAGE", undefined);

		const response = await postScreenshot(testCase.id);

		expect(response.status).toBe(200);
		expect(filesUnderUploads()).toHaveLength(1);
	});
});
