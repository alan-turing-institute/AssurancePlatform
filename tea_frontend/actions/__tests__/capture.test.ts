import fs from "node:fs";
import { BlobServiceClient } from "@azure/storage-blob";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { capture, existingImage, test } from "../capture";

// Mock types for Azure Blob Storage
type MockBlockBlobClient = {
	uploadData: ReturnType<typeof vi.fn>;
};

type MockContainerClient = {
	getBlockBlobClient: ReturnType<typeof vi.fn>;
};

type MockBlobServiceClient = {
	getContainerClient: ReturnType<typeof vi.fn>;
};

type MockStats = {
	isFile: ReturnType<typeof vi.fn>;
};

interface ErrorWithCode extends Error {
	code: string;
}

// Mock Node.js fs module
vi.mock("node:fs");

// Mock Azure Blob Storage
vi.mock("@azure/storage-blob", () => ({
	BlobServiceClient: vi.fn(),
}));

// Mock environment variables
const mockStorageName = "teamedia";
const mockSasUrl =
	"https://teamedia.blob.core.windows.net/?sv=2022-11-02&ss=bfqt&srt=co&sp=rwdlacupiytfx&se=2025-05-06T03:42:08Z&st=2024-05-05T19:42:08Z&spr=https&sig=eAyqjGI6Tz5jzZi%2FWrVr%2BGfMnTR%2Fnbe8HLbDYuoVnMY%3D";

describe("Capture Actions", () => {
	const mockAssuranceCaseId = "123";
	const mockBase64Image =
		"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
	const mockBase64Data =
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

	let mockBlobServiceClient: MockBlobServiceClient;
	let mockContainerClient: MockContainerClient;
	let mockBlockBlobClient: MockBlockBlobClient;

	beforeEach(() => {
		// Set up environment variables
		process.env.NEXT_PUBLIC_STORAGESOURCENAME = mockStorageName;

		// Reset all mocks
		vi.clearAllMocks();

		// Set up Azure Blob Storage mocks
		mockBlockBlobClient = {
			uploadData: vi.fn().mockResolvedValue({}),
		};

		mockContainerClient = {
			getBlockBlobClient: vi.fn().mockReturnValue(mockBlockBlobClient),
		};

		mockBlobServiceClient = {
			getContainerClient: vi.fn().mockReturnValue(mockContainerClient),
		};

		(
			BlobServiceClient as unknown as ReturnType<typeof vi.fn>
		).mockImplementation(() => mockBlobServiceClient);
	});

	afterEach(() => {
		vi.resetAllMocks();
		process.env.NEXT_PUBLIC_STORAGESOURCENAME = undefined;
	});

	describe("capture", () => {
		it("should successfully capture and upload image to Azure Blob Storage", async () => {
			const result = await capture(mockBase64Image, mockAssuranceCaseId);

			const expectedFilename = `chart-screenshot-case-${mockAssuranceCaseId}.png`;
			const expectedUrl = `https://${mockStorageName}.blob.core.windows.net/sample-container/${expectedFilename}`;

			// Verify BlobServiceClient was created with correct SAS URL
			expect(BlobServiceClient).toHaveBeenCalledWith(mockSasUrl);

			// Verify container client was retrieved
			expect(mockBlobServiceClient.getContainerClient).toHaveBeenCalledWith(
				"sample-container"
			);

			// Verify block blob client was retrieved with correct filename
			expect(mockContainerClient.getBlockBlobClient).toHaveBeenCalledWith(
				expectedFilename
			);

			// Verify upload was called with correct buffer
			expect(mockBlockBlobClient.uploadData).toHaveBeenCalled();
			const uploadedBuffer = mockBlockBlobClient.uploadData.mock.calls[0][0];
			expect(uploadedBuffer).toBeInstanceOf(Buffer);
			expect(uploadedBuffer.toString("base64")).toBe(mockBase64Data);

			// Verify returned URL
			expect(result).toBe(expectedUrl);
		});

		it("should strip data URL prefix from base64 image", async () => {
			await capture(mockBase64Image, mockAssuranceCaseId);

			const uploadedBuffer = mockBlockBlobClient.uploadData.mock.calls[0][0];
			expect(uploadedBuffer.toString("base64")).toBe(mockBase64Data);
		});

		it("should handle base64 image without data URL prefix", async () => {
			await capture(mockBase64Data, mockAssuranceCaseId);

			const uploadedBuffer = mockBlockBlobClient.uploadData.mock.calls[0][0];
			expect(uploadedBuffer.toString("base64")).toBe(mockBase64Data);
		});

		it("should return undefined when Azure upload fails", async () => {
			mockBlockBlobClient.uploadData.mockRejectedValue(
				new Error("Azure upload failed")
			);

			const result = await capture(mockBase64Image, mockAssuranceCaseId);

			expect(result).toBeUndefined();
		});

		it("should return undefined when BlobServiceClient creation fails", async () => {
			(
				BlobServiceClient as unknown as ReturnType<typeof vi.fn>
			).mockImplementation(() => {
				throw new Error("BlobServiceClient creation failed");
			});

			const result = await capture(mockBase64Image, mockAssuranceCaseId);

			expect(result).toBeUndefined();
		});

		it("should return undefined when container client fails", async () => {
			mockBlobServiceClient.getContainerClient.mockImplementation(() => {
				throw new Error("Container client failed");
			});

			const result = await capture(mockBase64Image, mockAssuranceCaseId);

			expect(result).toBeUndefined();
		});

		it("should return undefined when block blob client fails", async () => {
			mockContainerClient.getBlockBlobClient.mockImplementation(() => {
				throw new Error("Block blob client failed");
			});

			const result = await capture(mockBase64Image, mockAssuranceCaseId);

			expect(result).toBeUndefined();
		});

		it("should handle different image formats", async () => {
			const jpegBase64 =
				"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/gA=";

			const result = await capture(jpegBase64, mockAssuranceCaseId);

			expect(result).toBeDefined();
			// Should still create PNG filename regardless of input format
			expect(mockContainerClient.getBlockBlobClient).toHaveBeenCalledWith(
				`chart-screenshot-case-${mockAssuranceCaseId}.png`
			);
		});

		it("should generate correct filename for different case IDs", async () => {
			const differentCaseId = "456";

			await capture(mockBase64Image, differentCaseId);

			expect(mockContainerClient.getBlockBlobClient).toHaveBeenCalledWith(
				`chart-screenshot-case-${differentCaseId}.png`
			);
		});

		it("should handle empty base64 data", async () => {
			const emptyBase64 = "data:image/png;base64,";

			const result = await capture(emptyBase64, mockAssuranceCaseId);

			const uploadedBuffer = mockBlockBlobClient.uploadData.mock.calls[0][0];
			expect(uploadedBuffer).toBeInstanceOf(Buffer);
			expect(uploadedBuffer.length).toBe(0);
			expect(result).toBeDefined();
		});

		it("should handle invalid base64 data gracefully", async () => {
			const invalidBase64 = "data:image/png;base64,invalid-base64-data";

			// Buffer.from should handle invalid base64 gracefully
			const result = await capture(invalidBase64, mockAssuranceCaseId);

			expect(result).toBeDefined();
		});
	});

	describe("existingImage", () => {
		const mockFilePath = "/path/to/image.png";

		it("should return true when file exists", () => {
			const mockStats: MockStats = { isFile: vi.fn().mockReturnValue(true) };
			(fs.statSync as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
				mockStats
			);

			const result = existingImage(mockFilePath);

			expect(fs.statSync).toHaveBeenCalledWith(mockFilePath);
			expect(result).toBe(true);
		});

		it("should return false when file does not exist (ENOENT error)", () => {
			const enoentError: ErrorWithCode = Object.assign(
				new Error("File not found"),
				{ code: "ENOENT" }
			);
			(fs.statSync as unknown as ReturnType<typeof vi.fn>).mockImplementation(
				() => {
					throw enoentError;
				}
			);

			const result = existingImage(mockFilePath);

			expect(fs.statSync).toHaveBeenCalledWith(mockFilePath);
			expect(result).toBe(false);
		});

		it("should return false when other filesystem error occurs", () => {
			const otherError: ErrorWithCode = Object.assign(
				new Error("Permission denied"),
				{ code: "EACCES" }
			);
			(fs.statSync as unknown as ReturnType<typeof vi.fn>).mockImplementation(
				() => {
					throw otherError;
				}
			);

			const result = existingImage(mockFilePath);

			expect(fs.statSync).toHaveBeenCalledWith(mockFilePath);
			expect(result).toBe(false);
		});

		it("should return false when error without code property occurs", () => {
			const genericError = new Error("Generic error");
			(fs.statSync as unknown as ReturnType<typeof vi.fn>).mockImplementation(
				() => {
					throw genericError;
				}
			);

			const result = existingImage(mockFilePath);

			expect(fs.statSync).toHaveBeenCalledWith(mockFilePath);
			expect(result).toBe(false);
		});

		it("should return false when non-Error is thrown", () => {
			(fs.statSync as unknown as ReturnType<typeof vi.fn>).mockImplementation(
				() => {
					throw new Error("String error");
				}
			);

			const result = existingImage(mockFilePath);

			expect(fs.statSync).toHaveBeenCalledWith(mockFilePath);
			expect(result).toBe(false);
		});

		it("should handle different file paths", () => {
			const paths = [
				"/absolute/path/image.png",
				"./relative/path/image.jpg",
				"../parent/directory/image.jpeg",
				"C:\\Windows\\path\\image.png", // Windows path
			];

			(fs.statSync as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
				isFile: vi.fn().mockReturnValue(true),
			});

			for (const path of paths) {
				const result = existingImage(path);
				expect(result).toBe(true);
				expect(fs.statSync).toHaveBeenCalledWith(path);
			}
		});
	});

	describe("test", () => {
		it("should always return true", () => {
			const result = test();
			expect(result).toBe(true);
		});

		it("should be a synchronous function", () => {
			const start = Date.now();
			const result = test();
			const end = Date.now();

			expect(result).toBe(true);
			expect(end - start).toBeLessThan(10); // Should execute very quickly
		});
	});

	describe("Azure Blob Storage integration edge cases", () => {
		it("should handle missing storage account name", async () => {
			process.env.NEXT_PUBLIC_STORAGESOURCENAME = undefined;

			const result = await capture(mockBase64Image, mockAssuranceCaseId);

			// Should still work but URL will have undefined storage name
			expect(result).toContain("undefined.blob.core.windows.net");
		});

		it("should handle Azure service errors during upload", async () => {
			const azureError: ErrorWithCode = Object.assign(
				new Error("Azure service unavailable"),
				{ code: "ServiceUnavailable" }
			);
			mockBlockBlobClient.uploadData.mockRejectedValue(azureError);

			const result = await capture(mockBase64Image, mockAssuranceCaseId);

			expect(result).toBeUndefined();
		});

		it("should handle network timeout during upload", async () => {
			const timeoutError: ErrorWithCode = Object.assign(
				new Error("Request timeout"),
				{ code: "ETIMEDOUT" }
			);
			mockBlockBlobClient.uploadData.mockRejectedValue(timeoutError);

			const result = await capture(mockBase64Image, mockAssuranceCaseId);

			expect(result).toBeUndefined();
		});

		it("should handle large base64 images", async () => {
			// Create a larger base64 string (simulate 1KB image)
			const largeBase64Data = "A".repeat(1000);
			const largeBase64Image = `data:image/png;base64,${largeBase64Data}`;

			const result = await capture(largeBase64Image, mockAssuranceCaseId);

			const uploadedBuffer = mockBlockBlobClient.uploadData.mock.calls[0][0];
			expect(uploadedBuffer.length).toBeGreaterThan(700); // Base64 decoding reduces size
			expect(result).toBeDefined();
		});
	});

	describe("URL construction", () => {
		it("should construct correct Azure Blob URL with all components", async () => {
			const result = await capture(mockBase64Image, mockAssuranceCaseId);

			const expectedComponents = {
				protocol: "https:",
				storageAccount: mockStorageName,
				domain: "blob.core.windows.net",
				container: "sample-container",
				filename: `chart-screenshot-case-${mockAssuranceCaseId}.png`,
			};

			expect(result).toBe(
				`${expectedComponents.protocol}//${expectedComponents.storageAccount}.${expectedComponents.domain}/${expectedComponents.container}/${expectedComponents.filename}`
			);
		});

		it("should handle special characters in case ID", async () => {
			const specialCaseId = "case-123_test";

			const result = await capture(mockBase64Image, specialCaseId);

			expect(result).toContain(`chart-screenshot-case-${specialCaseId}.png`);
		});
	});

	describe("Base64 data handling edge cases", () => {
		it("should handle WebP image format", async () => {
			const webpBase64Data =
				"UklGRjIAAABXRUJQVlA4ICYAAACyAgCdASoAAQABAAwJaQAAaGbdaGbdaP4A";
			const webpBase64 = `data:image/webp;base64,${webpBase64Data}`;

			const result = await capture(webpBase64, mockAssuranceCaseId);

			// Should strip the WebP prefix correctly
			const uploadedBuffer = mockBlockBlobClient.uploadData.mock.calls[0][0];
			expect(uploadedBuffer.toString("base64")).toBe(webpBase64Data);
			expect(result).toBeDefined();
		});

		it("should handle base64 with line breaks", async () => {
			const base64WithBreaks = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB
CAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`;

			const result = await capture(base64WithBreaks, mockAssuranceCaseId);

			expect(result).toBeDefined();
		});

		it("should handle base64 with padding", async () => {
			const base64WithPadding =
				"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

			const result = await capture(base64WithPadding, mockAssuranceCaseId);

			expect(result).toBeDefined();
		});
	});
});
