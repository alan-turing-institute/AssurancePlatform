import { describe, expect, it } from "vitest";
import { detectImageFormat } from "../file-storage-service";

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG_BYTES = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);
const GIF87_BYTES = Buffer.from("GIF87a123", "ascii");
const GIF89_BYTES = Buffer.from("GIF89a123", "ascii");
const WEBP_BYTES = Buffer.concat([
	Buffer.from("RIFF", "ascii"),
	Buffer.from([0x00, 0x00, 0x00, 0x00]),
	Buffer.from("WEBP", "ascii"),
]);

describe("detectImageFormat", () => {
	it("detects a JPEG from its magic bytes", () => {
		expect(detectImageFormat(JPEG_BYTES)).toEqual({
			mimeType: "image/jpeg",
			extension: ".jpg",
		});
	});

	it("detects a PNG from its magic bytes", () => {
		expect(detectImageFormat(PNG_BYTES)).toEqual({
			mimeType: "image/png",
			extension: ".png",
		});
	});

	it("detects a GIF from either GIF87a or GIF89a", () => {
		expect(detectImageFormat(GIF87_BYTES)).toEqual({
			mimeType: "image/gif",
			extension: ".gif",
		});
		expect(detectImageFormat(GIF89_BYTES)).toEqual({
			mimeType: "image/gif",
			extension: ".gif",
		});
	});

	it("detects a WebP from its RIFF....WEBP container", () => {
		expect(detectImageFormat(WEBP_BYTES)).toEqual({
			mimeType: "image/webp",
			extension: ".webp",
		});
	});

	it("returns null for a RIFF container that isn't WebP (a near-miss, not a real match)", () => {
		const riffWave = Buffer.concat([
			Buffer.from("RIFF", "ascii"),
			Buffer.from([0x00, 0x00, 0x00, 0x00]),
			Buffer.from("WAVE", "ascii"),
		]);
		expect(detectImageFormat(riffWave)).toBeNull();
	});

	it("returns null for content with no recognised signature", () => {
		expect(detectImageFormat(Buffer.from("not an image", "ascii"))).toBeNull();
	});
});
