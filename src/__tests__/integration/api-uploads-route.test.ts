import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

const UPLOAD_ROOT = join(process.cwd(), "public", "uploads");

// Subdirectory scoped to this test file so cleanup can't collide with a
// concurrent worker or leftover files from other suites.
const TEST_SUBDIR = `route-test-${randomUUID()}`;
const TEST_DIR = join(UPLOAD_ROOT, TEST_SUBDIR);

async function writeUploadedFile(
	filename: string,
	contents: Buffer
): Promise<string> {
	await mkdir(TEST_DIR, { recursive: true });
	await writeFile(join(TEST_DIR, filename), contents);
	return `/uploads/${TEST_SUBDIR}/${filename}`;
}

function buildRequest(urlPath: string) {
	return new NextRequest(`http://localhost:3000${urlPath}`);
}

afterEach(async () => {
	await rm(TEST_DIR, { recursive: true, force: true });
});

describe("GET /uploads/[...path]", () => {
	it("streams a file written to disk at runtime, with the correct bytes and content type", async () => {
		const contents = Buffer.from([1, 2, 3, 4, 5]);
		const url = await writeUploadedFile("runtime.png", contents);

		const { GET } = await import("@/app/uploads/[...path]/route");
		const response = await GET(buildRequest(url), {
			params: Promise.resolve({ path: [TEST_SUBDIR, "runtime.png"] }),
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("image/png");

		const body = Buffer.from(await response.arrayBuffer());
		expect(body.equals(contents)).toBe(true);
	});

	it("sets the content type from the extension for a non-PNG upload", async () => {
		const contents = Buffer.from([9, 9, 9]);
		const url = await writeUploadedFile("runtime.webp", contents);

		const { GET } = await import("@/app/uploads/[...path]/route");
		const response = await GET(buildRequest(url), {
			params: Promise.resolve({ path: [TEST_SUBDIR, "runtime.webp"] }),
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("image/webp");
	});

	it("returns 404 for a file that does not exist", async () => {
		const { GET } = await import("@/app/uploads/[...path]/route");
		const response = await GET(
			buildRequest(`/uploads/${TEST_SUBDIR}/does-not-exist.png`),
			{
				params: Promise.resolve({
					path: [TEST_SUBDIR, "does-not-exist.png"],
				}),
			}
		);

		expect(response.status).toBe(404);
	});

	it("returns 404 for an empty path", async () => {
		const { GET } = await import("@/app/uploads/[...path]/route");
		const response = await GET(buildRequest("/uploads/"), {
			params: Promise.resolve({ path: [] }),
		});

		expect(response.status).toBe(404);
	});

	it("rejects a traversal attempt via a literal '..' segment", async () => {
		const { GET } = await import("@/app/uploads/[...path]/route");
		const response = await GET(buildRequest("/uploads/../../etc/passwd"), {
			params: Promise.resolve({ path: ["..", "..", "etc", "passwd"] }),
		});

		expect(response.status).toBe(404);
	});

	it("rejects a traversal attempt smuggled inside a single segment", async () => {
		const { GET } = await import("@/app/uploads/[...path]/route");
		const response = await GET(
			buildRequest("/uploads/..%2f..%2fetc%2fpasswd"),
			{
				params: Promise.resolve({ path: ["../../etc/passwd"] }),
			}
		);

		expect(response.status).toBe(404);
	});

	it("rejects an absolute-path segment", async () => {
		const { GET } = await import("@/app/uploads/[...path]/route");
		const response = await GET(buildRequest("/uploads//etc/passwd"), {
			params: Promise.resolve({ path: ["/etc/passwd"] }),
		});

		expect(response.status).toBe(404);
	});

	it("does not serve a directory", async () => {
		await mkdir(TEST_DIR, { recursive: true });

		const { GET } = await import("@/app/uploads/[...path]/route");
		const response = await GET(buildRequest(`/uploads/${TEST_SUBDIR}`), {
			params: Promise.resolve({ path: [TEST_SUBDIR] }),
		});

		expect(response.status).toBe(404);
	});
});
