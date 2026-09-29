import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureLogs } from "@/src/__tests__/helpers/capture-logs";
import {
	decryptToken,
	encryptForStorage,
	encryptIfPlaintext,
	encryptToken,
	isEncrypted,
	TokenEncryptionUnavailableError,
} from "../token-encryption";

const TEST_KEY = Buffer.alloc(32, 7).toString("base64");
const OTHER_KEY = Buffer.alloc(32, 9).toString("base64");

describe("token-encryption", () => {
	const originalKey = process.env.TOKEN_ENCRYPTION_KEY;

	beforeEach(() => {
		process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
	});

	afterEach(() => {
		if (originalKey === undefined) {
			Reflect.deleteProperty(process.env, "TOKEN_ENCRYPTION_KEY");
		} else {
			process.env.TOKEN_ENCRYPTION_KEY = originalKey;
		}
	});

	describe("encryptToken / decryptToken", () => {
		it("round-trips a value through encrypt and decrypt", () => {
			const plain = "gho_exampletoken1234567890";
			expect(decryptToken(encryptToken(plain))).toBe(plain);
		});

		it("produces different ciphertext for the same input on each call (fresh IV)", () => {
			const plain = "same-value-twice";
			const first = encryptToken(plain);
			const second = encryptToken(plain);
			expect(first).not.toBe(second);
			expect(decryptToken(first)).toBe(plain);
			expect(decryptToken(second)).toBe(plain);
		});

		it("fails to decrypt with the wrong key", () => {
			const encrypted = encryptToken("secret-value");
			process.env.TOKEN_ENCRYPTION_KEY = OTHER_KEY;
			expect(() => decryptToken(encrypted)).toThrow();
		});

		it("fails to decrypt tampered ciphertext", () => {
			const encrypted = encryptToken("secret-value");
			const [version, iv, payload] = encrypted.split(":") as [
				string,
				string,
				string,
			];
			const tamperedChar = payload.at(0) === "A" ? "B" : "A";
			const tampered = `${version}:${iv}:${tamperedChar}${payload.slice(1)}`;
			expect(() => decryptToken(tampered)).toThrow();
		});

		it("throws on an unknown envelope version prefix", () => {
			const encrypted = encryptToken("secret-value");
			const [, iv, payload] = encrypted.split(":") as [string, string, string];
			expect(() => decryptToken(`v99:${iv}:${payload}`)).toThrow();
		});

		it("throws when the payload is too short to contain an auth tag (<=16 bytes)", () => {
			const iv = Buffer.alloc(12, 1).toString("base64url");
			const shortPayload = Buffer.alloc(16, 2).toString("base64url");
			expect(() => decryptToken(`v1:${iv}:${shortPayload}`)).toThrow(
				"Malformed token envelope: ciphertext too short."
			);
		});

		it("returns legacy plaintext unchanged", () => {
			expect(decryptToken("plain-legacy-token")).toBe("plain-legacy-token");
		});

		it("throws TokenEncryptionUnavailableError when no key is configured", () => {
			Reflect.deleteProperty(process.env, "TOKEN_ENCRYPTION_KEY");
			expect(() => encryptToken("secret-value")).toThrow(
				TokenEncryptionUnavailableError
			);
		});

		it("rejects a malformed (non-base64) key without echoing it", () => {
			const badKey = "not-valid-base64-and-wrong-length!!!";
			process.env.TOKEN_ENCRYPTION_KEY = badKey;
			try {
				encryptToken("secret-value");
				throw new Error("expected encryptToken to throw");
			} catch (error) {
				expect(error).toBeInstanceOf(TokenEncryptionUnavailableError);
				expect((error as Error).message).not.toContain(badKey);
			}
		});

		it("rejects a key of the wrong length", () => {
			process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString("base64");
			expect(() => encryptToken("secret-value")).toThrow(
				TokenEncryptionUnavailableError
			);
		});
	});

	describe("isEncrypted", () => {
		it("returns true for an encrypted envelope", () => {
			expect(isEncrypted(encryptToken("secret-value"))).toBe(true);
		});

		it("returns false for legacy plaintext", () => {
			expect(isEncrypted("gho_plaintexttoken")).toBe(false);
			expect(isEncrypted("")).toBe(false);
		});
	});

	describe("encryptForStorage", () => {
		it("returns the encrypted envelope when a key is configured", () => {
			const result = encryptForStorage("plain-value", "githubAccessToken");
			expect(result).toBeDefined();
			expect(decryptToken(result as string)).toBe("plain-value");
		});

		it("in production, swallows a missing key: returns undefined and logs via the token-encryption component", () => {
			Reflect.deleteProperty(process.env, "TOKEN_ENCRYPTION_KEY");
			vi.stubEnv("NODE_ENV", "production");
			const logs = captureLogs();
			try {
				const result = encryptForStorage("plain-value", "googleRefreshToken");
				expect(result).toBeUndefined();

				const errorLog = logs.entries.find(
					(entry) =>
						entry.level === "error" && entry.component === "token-encryption"
				);
				expect(errorLog).toMatchObject({ field: "googleRefreshToken" });
			} finally {
				logs.restore();
				vi.unstubAllEnvs();
			}
		});

		it("outside production, rethrows when no key is configured (loud, not silent)", () => {
			Reflect.deleteProperty(process.env, "TOKEN_ENCRYPTION_KEY");
			vi.stubEnv("NODE_ENV", "test");
			try {
				expect(() =>
					encryptForStorage("plain-value", "githubAccessToken")
				).toThrow(TokenEncryptionUnavailableError);
			} finally {
				vi.unstubAllEnvs();
			}
		});
	});

	describe("encryptIfPlaintext", () => {
		it("encrypts a plaintext value into the envelope shape", () => {
			const result = encryptIfPlaintext("plain-value");
			expect(result).toBeDefined();
			expect(isEncrypted(result as string)).toBe(true);
			expect(decryptToken(result as string)).toBe("plain-value");
		});

		it("leaves an already-encrypted value unchanged (returns undefined — nothing to do)", () => {
			const encrypted = encryptToken("plain-value");
			expect(encryptIfPlaintext(encrypted)).toBeUndefined();
		});

		it("returns undefined for null", () => {
			expect(encryptIfPlaintext(null)).toBeUndefined();
		});

		it("returns undefined for an empty string", () => {
			expect(encryptIfPlaintext("")).toBeUndefined();
		});
	});
});
