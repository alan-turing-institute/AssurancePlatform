"use server";

import fs from "node:fs";
import { BlobServiceClient } from "@azure/storage-blob";
import { captureImageSchema, filePathSchema } from "@/lib/schemas/capture";
import { validateInput } from "@/lib/validation/server-action";
import type { ActionResult } from "@/types";

// Regex pattern for removing base64 data URL prefix
const BASE64_PREFIX_REGEX = /^data:image\/\w+;base64,/;

/**
 * Captures a base64-encoded image, converts it to a buffer, and uploads it to Azure Blob Storage.
 *
 * @param base64Image - The base64 string representation of the image, including the data URL prefix.
 * @param assuranceCaseId - The ID of the assurance case, used to name the image file.
 * @returns An ActionResult containing the URL of the uploaded image or an error.
 */
export const capture = async (
	base64Image: string,
	assuranceCaseId: string
): Promise<ActionResult<{ url: string }>> => {
	// 1. Validate input
	const validation = validateInput(
		{ base64Image, assuranceCaseId },
		captureImageSchema
	);
	if (!validation.success) {
		return {
			success: false,
			error: validation.error,
			fieldErrors: validation.fieldErrors,
		};
	}

	// 2. Business logic
	try {
		const filename = `chart-screenshot-case-${validation.data.assuranceCaseId}.png`;
		// Remove header from base64 string
		const base64Data = validation.data.base64Image.replace(
			BASE64_PREFIX_REGEX,
			""
		);

		// Create buffer from base64 string
		const buffer = Buffer.from(base64Data, "base64");

		// Save image buffer to Azure Blob Storage
		const imageUrl = await saveToStorage(buffer, filename);

		if (!imageUrl) {
			return { success: false, error: "Failed to upload image to storage" };
		}

		return { success: true, data: { url: imageUrl } };
	} catch (error) {
		console.error("Capture failed:", error);
		return { success: false, error: "Failed to capture image" };
	}
};

/**
 * Checks if a file already exists on the file system at the specified file path.
 *
 * @param filePath - The path of the file to check for existence.
 * @returns An ActionResult containing true if the file exists, false otherwise.
 */
export const existingImage = (
	filePath: string
): ActionResult<{ exists: boolean }> => {
	// 1. Validate input
	const validation = validateInput({ filePath }, filePathSchema);
	if (!validation.success) {
		return {
			success: false,
			error: validation.error,
			fieldErrors: validation.fieldErrors,
		};
	}

	// 2. Business logic
	try {
		// Check if the file exists by trying to read its stats
		fs.statSync(validation.data.filePath);
		return { success: true, data: { exists: true } };
	} catch (error: unknown) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			// File does not exist
			return { success: true, data: { exists: false } };
		}
		return { success: false, error: "Failed to check file existence" };
	}
};

/**
 * Saves a buffer as a file in Azure Blob Storage under a specified filename.
 *
 * @param buffer - The buffer containing the image data.
 * @param filename - The name of the file to be saved in the Azure container.
 * @returns The URL of the uploaded image, or `undefined` if there is an error.
 */
const saveToStorage = async (
	buffer: Buffer,
	filename: string
): Promise<string | undefined> => {
	try {
		const containerName = "sample-container";
		const account = process.env.NEXT_PUBLIC_STORAGESOURCENAME;

		const blobSasUrl =
			"https://teamedia.blob.core.windows.net/?sv=2022-11-02&ss=bfqt&srt=co&sp=rwdlacupiytfx&se=2025-05-06T03:42:08Z&st=2024-05-05T19:42:08Z&spr=https&sig=eAyqjGI6Tz5jzZi%2FWrVr%2BGfMnTR%2Fnbe8HLbDYuoVnMY%3D";

		const blobServiceClient = new BlobServiceClient(blobSasUrl);

		// Get a reference to the container
		const containerClient = blobServiceClient.getContainerClient(containerName);

		// Get a block blob client for the file
		const blockBlobClient = containerClient.getBlockBlobClient(filename);

		// Upload the buffer data to the block blob
		await blockBlobClient.uploadData(buffer);

		// Return the URL of the uploaded image
		const imageUrl = `https://${account}.blob.core.windows.net/${containerName}/${filename}`;
		return imageUrl;
	} catch (_error) {
		return;
	}
};

/**
 * A simple test function to validate that the async structure is functioning.
 *
 * @returns Always returns `true`.
 */
export const test = (): boolean => true;
