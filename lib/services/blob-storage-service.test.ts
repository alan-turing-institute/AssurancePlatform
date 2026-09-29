import {
	existsSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

/**
 * `UPLOADS_DIR` is read once at import time by `blob-storage-service.ts`
 * (same ordering constraint noted in `src/__tests__/setup.integration.tsx`),
 * so this worktree's own `uploads/` directory must never be touched by this
 * file. Setting the env var before the dynamic import below gives this unit
 * test its own throwaway root, the way each integration worker gets one.
 */
const uploadsDir = mkdtempSync(join(tmpdir(), "tea-blob-storage-service-"));
process.env.UPLOADS_DIR = uploadsDir;

const { uploadToLocalStorage } = await import("./blob-storage-service");

afterAll(async () => {
	await rm(uploadsDir, { recursive: true, force: true });
});

describe("uploadToLocalStorage", () => {
	it("writes a valid key under the uploads root and returns it", () => {
		const buffer = Buffer.from("hello");

		const result = uploadToLocalStorage(buffer, "images/a.png");

		expect(result).toEqual({ success: true, key: "images/a.png" });
		expect(readFileSync(join(uploadsDir, "images/a.png")).equals(buffer)).toBe(
			true
		);
	});

	it.each([
		"../x.png",
		"/abs.png",
		"a//b.png",
	])("refuses an invalid key (%s) and writes nothing", (key) => {
		const before = readdirSync(uploadsDir);

		const result = uploadToLocalStorage(Buffer.from("x"), key);

		expect(result).toEqual({
			success: false,
			error: "Invalid storage key",
		});
		expect(readdirSync(uploadsDir)).toEqual(before);
	});

	it("returns a failure result when the write itself fails", () => {
		// A plain file where a later path segment needs to be a directory
		// forces a real ENOTDIR from `writeFileSync` — no `node:fs` mock needed.
		writeFileSync(join(uploadsDir, "blocker"), "not a directory");

		const result = uploadToLocalStorage(Buffer.from("x"), "blocker/file.png");

		expect(result.success).toBe(false);
		expect(existsSync(join(uploadsDir, "blocker/file.png"))).toBe(false);
	});
});
