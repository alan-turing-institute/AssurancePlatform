import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit coverage for the one file that calls the `@azure/storage-blob` SDK
 * directly — every other test in the repo mocks this module wholesale, so
 * nothing else exercises its branches. `@azure/storage-blob` itself is the
 * one permitted mocked boundary; everything below it (the container/blob
 * client chain) is a hand-built stand-in, and everything above it
 * (`azureDownloadBlob`/`azureUploadBlob`/`azureDeleteBlob`) runs for real.
 */

const { blobClient, blobServiceClientCtor } = vi.hoisted(() => {
	const client = {
		download: vi.fn(),
		uploadData: vi.fn(),
		delete: vi.fn(),
	};
	const getBlockBlobClient = vi.fn(() => client);
	const getContainerClient = vi.fn(() => ({ getBlockBlobClient }));
	// A real `function`, not an arrow function — `azure-blob-adapter.ts` calls
	// `new BlobServiceClient(...)`, and only a `function`/`class` mock can
	// stand in as a constructor.
	const ctor = vi.fn(function MockBlobServiceClient() {
		return { getContainerClient };
	});
	return { blobClient: client, blobServiceClientCtor: ctor };
});

vi.mock("@azure/storage-blob", () => ({
	BlobServiceClient: blobServiceClientCtor,
	StorageSharedKeyCredential: vi.fn(),
}));

const { azureDeleteBlob, azureDownloadBlob, azureUploadBlob } = await import(
	"./azure-blob-adapter"
);

const VALID_KEY = "cases/case-1/case-information/a.png";
const TRAVERSAL_KEY = "../etc/passwd";

function configureAzureEnv() {
	vi.stubEnv("AZURE_STORAGE_ACCOUNT_NAME", "testaccount");
	vi.stubEnv("AZURE_STORAGE_ACCOUNT_KEY", "dGVzdGtleQ==");
}

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("azureDownloadBlob", () => {
	it("returns null without constructing a client when Azure isn't configured", async () => {
		expect(await azureDownloadBlob(VALID_KEY)).toBeNull();
		expect(blobServiceClientCtor).not.toHaveBeenCalled();
	});

	it("returns the bytes and content type on success", async () => {
		configureAzureEnv();
		blobClient.download.mockResolvedValue({
			readableStreamBody: [Buffer.from("hello")],
			contentType: "image/png",
		});

		const result = await azureDownloadBlob(VALID_KEY);

		expect(result).toEqual({
			data: Buffer.from("hello"),
			contentType: "image/png",
		});
	});

	it("returns null for a not-found blob", async () => {
		configureAzureEnv();
		blobClient.download.mockRejectedValue({ statusCode: 404 });

		expect(await azureDownloadBlob(VALID_KEY)).toBeNull();
	});

	it("returns null for any other download error", async () => {
		configureAzureEnv();
		blobClient.download.mockRejectedValue(new Error("boom"));

		expect(await azureDownloadBlob(VALID_KEY)).toBeNull();
	});

	it("refuses a traversal key before ever constructing a client", async () => {
		configureAzureEnv();

		expect(await azureDownloadBlob(TRAVERSAL_KEY)).toBeNull();
		expect(blobServiceClientCtor).not.toHaveBeenCalled();
	});
});

describe("azureUploadBlob", () => {
	it("returns false without constructing a client when Azure isn't configured", async () => {
		expect(
			await azureUploadBlob(VALID_KEY, Buffer.from("x"), "image/png")
		).toBe(false);
		expect(blobServiceClientCtor).not.toHaveBeenCalled();
	});

	it("returns true on success", async () => {
		configureAzureEnv();
		blobClient.uploadData.mockResolvedValue(undefined);

		expect(
			await azureUploadBlob(VALID_KEY, Buffer.from("x"), "image/png")
		).toBe(true);
	});

	it("returns false when the upload throws", async () => {
		configureAzureEnv();
		blobClient.uploadData.mockRejectedValue(new Error("boom"));

		expect(
			await azureUploadBlob(VALID_KEY, Buffer.from("x"), "image/png")
		).toBe(false);
	});

	it("refuses a traversal key before ever constructing a client", async () => {
		configureAzureEnv();

		expect(
			await azureUploadBlob(TRAVERSAL_KEY, Buffer.from("x"), "image/png")
		).toBe(false);
		expect(blobServiceClientCtor).not.toHaveBeenCalled();
	});
});

describe("azureDeleteBlob", () => {
	it("returns false without constructing a client when Azure isn't configured", async () => {
		expect(await azureDeleteBlob(VALID_KEY)).toBe(false);
		expect(blobServiceClientCtor).not.toHaveBeenCalled();
	});

	it("returns true on success", async () => {
		configureAzureEnv();
		blobClient.delete.mockResolvedValue(undefined);

		expect(await azureDeleteBlob(VALID_KEY)).toBe(true);
	});

	it("returns true for an already-absent blob", async () => {
		configureAzureEnv();
		blobClient.delete.mockRejectedValue({ statusCode: 404 });

		expect(await azureDeleteBlob(VALID_KEY)).toBe(true);
	});

	it("returns false for any other delete error", async () => {
		configureAzureEnv();
		blobClient.delete.mockRejectedValue(new Error("boom"));

		expect(await azureDeleteBlob(VALID_KEY)).toBe(false);
	});

	it("refuses a traversal key before ever constructing a client", async () => {
		configureAzureEnv();

		expect(await azureDeleteBlob(TRAVERSAL_KEY)).toBe(false);
		expect(blobServiceClientCtor).not.toHaveBeenCalled();
	});
});
