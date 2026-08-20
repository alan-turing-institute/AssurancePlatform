import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs/promises")>();
	return {
		...actual,
		// Wrapping (not replacing) the real implementation keeps every other
		// test in this file exercising real disk I/O; only the one test that
		// overrides this with `mockImplementationOnce` sees different
		// behaviour.
		stat: vi.fn(actual.stat),
	};
});

const { stat: mockedStat } = await import("node:fs/promises");
const { stat: actualStat } =
	await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");

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

	// Next's router collapses literal and percent-encoded dot-segments
	// before a request ever reaches this handler, so this exact input is
	// unreachable over real HTTP on the Next version this app runs. This
	// test guards `resolveSafePath`'s own defensive contract (it must not
	// rely on the router for safety), not an exploit that is actually
	// reachable in production.
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

	it("streams a file nested at realistic production path depth (caseId/case-information/file)", async () => {
		const contents = Buffer.from([7, 7, 7, 7]);
		const caseId = randomUUID();
		const nestedDir = join(TEST_DIR, caseId, "case-information");
		await mkdir(nestedDir, { recursive: true });
		await writeFile(join(nestedDir, "evidence.png"), contents);

		const { GET } = await import("@/app/uploads/[...path]/route");
		const response = await GET(
			buildRequest(
				`/uploads/${TEST_SUBDIR}/${caseId}/case-information/evidence.png`
			),
			{
				params: Promise.resolve({
					path: [TEST_SUBDIR, caseId, "case-information", "evidence.png"],
				}),
			}
		);

		expect(response.status).toBe(200);
		const body = Buffer.from(await response.arrayBuffer());
		expect(body.equals(contents)).toBe(true);
	});

	it("returns 404, not an unhandled stream error, if the file is deleted between stat() and the read starting", async () => {
		const contents = Buffer.from([1, 2, 3]);
		const url = await writeUploadedFile("race.png", contents);
		const filePath = join(TEST_DIR, "race.png");

		// stat() still sees the file (so the route proceeds past the
		// existence check), but the file is gone by the time the route
		// opens a read stream — reproducing the stat-then-read race a
		// concurrent delete could cause.
		vi.mocked(mockedStat).mockImplementationOnce(async (target) => {
			const result = await actualStat(
				target as Parameters<typeof actualStat>[0]
			);
			await rm(filePath);
			return result;
		});

		const { GET } = await import("@/app/uploads/[...path]/route");
		const response = await GET(buildRequest(url), {
			params: Promise.resolve({ path: [TEST_SUBDIR, "race.png"] }),
		});

		expect(response.status).toBe(404);
	});
});
