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
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { azureUploadBlob } from "./azure-blob-adapter";

vi.mock("./azure-blob-adapter", () => ({
	azureUploadBlob: vi.fn(),
}));

/**
 * `UPLOADS_DIR` is read once at import time by `blob-storage-service.ts`
 * (same ordering constraint noted in `src/__tests__/setup.integration.tsx`),
 * so this worktree's own `uploads/` directory must never be touched by this
 * file. Setting the env var before the dynamic import below gives this unit
 * test its own throwaway root, the way each integration worker gets one.
 */
const SCREENSHOT_KEY_PATTERN = /^screenshots\/.+\.png$/;

const uploadsDir = mkdtempSync(join(tmpdir(), "tea-blob-storage-service-"));
process.env.UPLOADS_DIR = uploadsDir;

const { uploadToBlob, uploadToLocalStorage } = await import(
	"./blob-storage-service"
);

const { saveFile } = await import("./file-storage-service");

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

afterEach(() => {
	vi.unstubAllEnvs();
	vi.clearAllMocks();
});

describe("uploadToBlob backend selection", () => {
	it.each([
		"development",
		"production",
	])("uses local storage in %s when enabled and Azure is absent", async (environment) => {
		vi.stubEnv("NODE_ENV", environment);
		vi.stubEnv(
			"USE_LOCAL_STORAGE",
			environment === "production" ? "true" : undefined
		);
		vi.stubEnv("AZURE_STORAGE_ACCOUNT_NAME", undefined);
		vi.stubEnv("AZURE_STORAGE_ACCOUNT_KEY", undefined);
		const buffer = Buffer.from("screenshot");
		const key = `images/${environment}.png`;

		expect(await uploadToBlob(buffer, key)).toEqual({ data: { key } });
		expect(readFileSync(join(uploadsDir, key))).toEqual(buffer);
		expect(azureUploadBlob).not.toHaveBeenCalled();
	});

	it("uses configured Azure in production with local storage unset", async () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("USE_LOCAL_STORAGE", undefined);
		vi.stubEnv("AZURE_STORAGE_ACCOUNT_NAME", "test-account");
		vi.stubEnv("AZURE_STORAGE_ACCOUNT_KEY", "test-key");
		vi.mocked(azureUploadBlob).mockResolvedValue(true);
		const buffer = Buffer.from("screenshot");
		const key = "images/azure.png";

		expect(await uploadToBlob(buffer, key)).toEqual({ data: { key } });
		expect(azureUploadBlob).toHaveBeenCalledExactlyOnceWith(
			key,
			buffer,
			"image/png"
		);
		expect(existsSync(join(uploadsDir, key))).toBe(false);
	});

	it("still refuses unconfigured production storage when local storage is unset", async () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("USE_LOCAL_STORAGE", undefined);
		vi.stubEnv("AZURE_STORAGE_ACCOUNT_NAME", undefined);
		vi.stubEnv("AZURE_STORAGE_ACCOUNT_KEY", undefined);

		expect(await uploadToBlob(Buffer.from("x"), "images/refused.png")).toEqual({
			error: "Storage not configured",
		});
		expect(existsSync(join(uploadsDir, "images/refused.png"))).toBe(false);
		expect(azureUploadBlob).not.toHaveBeenCalled();
	});
});

describe("saveFile backend selection", () => {
	const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

	it.each([
		"development",
		"production",
	])("saves locally in %s when enabled and Azure is absent", async (environment) => {
		vi.stubEnv("NODE_ENV", environment);
		vi.stubEnv(
			"USE_LOCAL_STORAGE",
			environment === "production" ? "true" : undefined
		);
		vi.stubEnv("AZURE_STORAGE_ACCOUNT_NAME", undefined);
		vi.stubEnv("AZURE_STORAGE_ACCOUNT_KEY", undefined);
		const file = new File([Uint8Array.from(png)], "screenshot.png", {
			type: "image/png",
		});
		file.arrayBuffer = async () => Uint8Array.from(png).buffer;

		const result = await saveFile(file, "screenshots");
		expect(result).toHaveProperty("data.key");
		if (!("data" in result)) {
			throw new Error(result.error);
		}
		expect(readFileSync(join(uploadsDir, result.data.key))).toEqual(png);
		expect(azureUploadBlob).not.toHaveBeenCalled();
	});

	it("saves to configured Azure in production when local storage is unset", async () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("USE_LOCAL_STORAGE", undefined);
		vi.stubEnv("AZURE_STORAGE_ACCOUNT_NAME", "test-account");
		vi.stubEnv("AZURE_STORAGE_ACCOUNT_KEY", "test-key");
		vi.mocked(azureUploadBlob).mockResolvedValue(true);
		const file = new File([Uint8Array.from(png)], "screenshot.png", {
			type: "image/png",
		});
		file.arrayBuffer = async () => Uint8Array.from(png).buffer;

		const result = await saveFile(file, "screenshots");
		expect(result).toHaveProperty("data.key");
		expect(azureUploadBlob).toHaveBeenCalledExactlyOnceWith(
			expect.stringMatching(SCREENSHOT_KEY_PATTERN),
			png,
			"image/png"
		);
	});
});
