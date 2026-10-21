import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

/**
 * `UPLOADS_DIR` is read once when the blob service is first imported, so the
 * variable is set, and the services imported, only after it holds this
 * file's own throwaway directory.
 */
const uploadsDir = mkdtempSync(join(tmpdir(), "tea-storage-condition-"));
process.env.UPLOADS_DIR = uploadsDir;

const azure = vi.hoisted(() => ({
	upload: vi.fn(),
	download: vi.fn(),
	remove: vi.fn(),
}));

vi.mock("./azure-blob-adapter", () => ({
	azureUploadBlob: azure.upload,
	azureDownloadBlob: azure.download,
	azureDeleteBlob: azure.remove,
}));

const { uploadToBlob, isAzureStorageConfigured } = await import(
	"./blob-storage-service"
);
const { saveFile } = await import("./file-storage-service");

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);

/** A backend, or a description of anything else that happened. */
type Backend = "azure" | "local" | "refused" | string;

type AzureState = "unset" | "name only" | "key only" | "name and key";

function setAzure(state: AzureState) {
	vi.stubEnv(
		"AZURE_STORAGE_ACCOUNT_NAME",
		state === "name only" || state === "name and key" ? "account" : undefined
	);
	vi.stubEnv(
		"AZURE_STORAGE_ACCOUNT_KEY",
		state === "key only" || state === "name and key" ? "secret" : undefined
	);
}

function setEnvironment(nodeEnv: string, useLocalStorage: string | undefined) {
	vi.stubEnv("NODE_ENV", nodeEnv);
	vi.stubEnv("USE_LOCAL_STORAGE", useLocalStorage);
}

function filesOnDisk(): string[] {
	return readdirSync(uploadsDir, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => join(entry.parentPath, entry.name));
}

/** Which backend an upload through `uploadToBlob` ended up on. */
async function backendOfUploadToBlob(): Promise<Backend> {
	const result = await uploadToBlob(PNG, `images/probe-${randomUUID()}.png`);
	return classify(result);
}

/** Which backend a `saveFile` call ended up on. */
async function backendOfSaveFile(): Promise<Backend> {
	const file = new File([PNG], "probe.png", { type: "image/png" });
	return classify(await saveFile(file, "probes"));
}

function classify(
	result: { data: { key: string } } | { error: string }
): Backend {
	const files = filesOnDisk();
	if (azure.upload.mock.calls.length > 0) {
		return files.length === 0 ? "azure" : `azure and ${files.length} file(s)`;
	}
	if ("data" in result) {
		return existsSync(join(uploadsDir, result.data.key))
			? "local"
			: "a key with no file";
	}
	if (result.error === "Storage not configured" && files.length === 0) {
		return "refused";
	}
	return `unexpected ${JSON.stringify(result)} with ${files.length} file(s)`;
}

function expectedBackend(
	azureState: AzureState,
	nodeEnv: string,
	useLocalStorage: string | undefined
): Backend {
	if (azureState === "name and key") {
		return "azure";
	}
	if (nodeEnv === "development" || useLocalStorage === "true") {
		return "local";
	}
	return "refused";
}

beforeEach(() => {
	azure.upload.mockReset();
	azure.upload.mockResolvedValue(true);
	azure.download.mockReset();
	azure.remove.mockReset();
});

/** Empties the uploads root and forgets earlier Azure calls, so the next probe starts clean. */
async function startAgain() {
	azure.upload.mockClear();
	for (const entry of readdirSync(uploadsDir)) {
		await rm(join(uploadsDir, entry), { recursive: true, force: true });
	}
}

afterEach(async () => {
	vi.unstubAllEnvs();
	await startAgain();
});

afterAll(async () => {
	await rm(uploadsDir, { recursive: true, force: true });
});

const NODE_ENVS = ["development", "production", "test"];
const LOCAL_SETTINGS: (string | undefined)[] = [
	undefined,
	"true",
	"false",
	"TRUE",
	"True",
	"1",
	"yes",
	"",
	" true",
	"true ",
];
const AZURE_STATES: AzureState[] = [
	"unset",
	"name only",
	"key only",
	"name and key",
];

describe("the local-storage condition shared by uploadToBlob and saveFile", () => {
	for (const azureState of AZURE_STATES) {
		describe(`with Azure credentials: ${azureState}`, () => {
			for (const nodeEnv of NODE_ENVS) {
				for (const setting of LOCAL_SETTINGS) {
					const label = `NODE_ENV=${nodeEnv}, USE_LOCAL_STORAGE=${
						setting === undefined ? "(unset)" : JSON.stringify(setting)
					}`;

					it(`sends both to the same backend for ${label}`, async () => {
						setAzure(azureState);
						setEnvironment(nodeEnv, setting);
						const expected = expectedBackend(azureState, nodeEnv, setting);

						expect(await backendOfUploadToBlob(), "uploadToBlob").toBe(
							expected
						);

						await startAgain();

						expect(await backendOfSaveFile(), "saveFile").toBe(expected);
					});
				}
			}
		});
	}
});

describe("uploadToBlob in production on a self-hosted install", () => {
	it("writes the bytes under the uploads root when local storage is switched on", async () => {
		setAzure("unset");
		setEnvironment("production", "true");

		const result = await uploadToBlob(PNG, "images/case-screenshot-x-1.png");

		expect(result).toEqual({ data: { key: "images/case-screenshot-x-1.png" } });
		const written = await readFile(
			join(uploadsDir, "images/case-screenshot-x-1.png")
		);
		expect(written.equals(PNG)).toBe(true);
		expect(azure.upload).not.toHaveBeenCalled();
	});

	it("refuses and writes nothing when local storage is not switched on", async () => {
		setAzure("unset");
		setEnvironment("production", undefined);

		const result = await uploadToBlob(PNG, "images/case-screenshot-x-1.png");

		expect(result).toEqual({ error: "Storage not configured" });
		expect(filesOnDisk()).toEqual([]);
		expect(azure.upload).not.toHaveBeenCalled();
	});

	it("still refuses a key that would leave the uploads root when local storage is switched on", async () => {
		setAzure("unset");
		setEnvironment("production", "true");

		for (const key of ["../escape.png", "/absolute.png", "a//b.png"]) {
			const result = await uploadToBlob(PNG, key);
			expect(result, key).toEqual({ error: "Invalid storage key" });
		}
		expect(filesOnDisk()).toEqual([]);
	});
});

describe("when Azure credentials are present", () => {
	it("uses Azure and writes no local file, whatever the environment says", async () => {
		setAzure("name and key");
		expect(isAzureStorageConfigured()).toBe(true);

		for (const [nodeEnv, setting] of [
			["development", "true"],
			["development", undefined],
			["production", "true"],
			["production", undefined],
		] as const) {
			setEnvironment(nodeEnv, setting);
			azure.upload.mockClear();

			const result = await uploadToBlob(PNG, "images/a.png", "image/png");

			expect(result, `${nodeEnv} ${setting}`).toEqual({
				data: { key: "images/a.png" },
			});
			expect(azure.upload).toHaveBeenCalledTimes(1);
			expect(azure.upload).toHaveBeenCalledWith(
				"images/a.png",
				PNG,
				"image/png"
			);
			expect(filesOnDisk()).toEqual([]);
		}
	});

	it("reports a failed Azure upload as a failure and does not fall back to a local file", async () => {
		setAzure("name and key");
		azure.upload.mockResolvedValue(false);

		for (const [nodeEnv, setting] of [
			["development", "true"],
			["production", "true"],
			["production", undefined],
		] as const) {
			setEnvironment(nodeEnv, setting);

			const result = await uploadToBlob(PNG, "images/a.png");

			expect(result, `${nodeEnv} ${setting}`).toEqual({
				error: "Upload failed",
			});
			expect(filesOnDisk()).toEqual([]);
		}
	});

	it("reports a failed Azure upload through saveFile without a local file too", async () => {
		setAzure("name and key");
		azure.upload.mockResolvedValue(false);
		setEnvironment("production", "true");

		const result = await saveFile(
			new File([PNG], "a.png", { type: "image/png" }),
			"probes"
		);

		expect(result).toEqual({ error: "Upload failed" });
		expect(filesOnDisk()).toEqual([]);
	});
});

describe("with USE_LOCAL_STORAGE unset", () => {
	it("keeps development on local storage and every other mode off it", async () => {
		setAzure("unset");

		setEnvironment("development", undefined);
		expect(await backendOfUploadToBlob()).toBe("local");

		for (const nodeEnv of ["production", "test"]) {
			await startAgain();
			setEnvironment(nodeEnv, undefined);
			expect(await backendOfUploadToBlob(), nodeEnv).toBe("refused");
		}
	});
});
