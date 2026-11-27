import { describe, expect, it } from "vitest";
import {
	LEGACY_DERIVED_KEY,
	LEGACY_HASH,
	LEGACY_PASSWORD as PASSWORD,
} from "@/src/__tests__/utils/legacy-password-hash";
import { hashPassword, verifyPassword } from "../password-service";

const ACCEPTED_LEGACY = { valid: true, needsUpgrade: true };
const REFUSED = { valid: false, needsUpgrade: false };

async function makeCheapArgon2Hash(password: string): Promise<string> {
	const argon2 = await import("argon2");
	return argon2.hash(password, {
		type: argon2.argon2id,
		memoryCost: 1024,
		timeCost: 2,
		parallelism: 1,
	});
}

describe("verifyPassword with a legacy PBKDF2 hash", () => {
	it("accepts the right password and asks for the hash to be upgraded", async () => {
		await expect(
			verifyPassword(PASSWORD, LEGACY_HASH, "django_pbkdf2")
		).resolves.toStrictEqual(ACCEPTED_LEGACY);
	});

	it("refuses a wrong password without asking for an upgrade", async () => {
		await expect(
			verifyPassword("wrong-password", LEGACY_HASH, "django_pbkdf2")
		).resolves.toStrictEqual(REFUSED);
	});

	it("uses the salt stored in the hash", async () => {
		const otherSalt = `pbkdf2_sha256$10$other-salt$${LEGACY_DERIVED_KEY}`;
		await expect(
			verifyPassword(PASSWORD, otherSalt, "django_pbkdf2")
		).resolves.toStrictEqual(REFUSED);
	});

	it("uses the iteration count stored in the hash", async () => {
		const otherCount = `pbkdf2_sha256$11$test-salt$${LEGACY_DERIVED_KEY}`;
		await expect(
			verifyPassword(PASSWORD, otherCount, "django_pbkdf2")
		).resolves.toStrictEqual(REFUSED);
	});

	it.each([
		["too few parts", `pbkdf2_sha256$10$${LEGACY_DERIVED_KEY}`],
		["too many parts", `${LEGACY_HASH}$extra`],
		["no separators", "plain-text"],
		["an empty string", ""],
	])("refuses a hash with the wrong shape (%s)", async (_label, hash) => {
		await expect(
			verifyPassword(PASSWORD, hash, "django_pbkdf2")
		).resolves.toStrictEqual(REFUSED);
	});

	it("refuses a hash that names another algorithm, even with matching values", async () => {
		const otherAlgorithm = `pbkdf2_sha1$10$test-salt$${LEGACY_DERIVED_KEY}`;
		await expect(
			verifyPassword(PASSWORD, otherAlgorithm, "django_pbkdf2")
		).resolves.toStrictEqual(REFUSED);
	});

	it("refuses a hash whose iteration count is not a number", async () => {
		const notANumber = `pbkdf2_sha256$many$test-salt$${LEGACY_DERIVED_KEY}`;
		await expect(
			verifyPassword(PASSWORD, notANumber, "django_pbkdf2")
		).resolves.toStrictEqual(REFUSED);
	});

	it("refuses an argon2 hash stored under the legacy algorithm", async () => {
		const argon2Hash = await makeCheapArgon2Hash(PASSWORD);
		await expect(
			verifyPassword(PASSWORD, argon2Hash, "django_pbkdf2")
		).resolves.toStrictEqual(REFUSED);
	});
});

describe("verifyPassword with an argon2id hash", () => {
	it("accepts the right password and asks for no upgrade", async () => {
		const hash = await makeCheapArgon2Hash(PASSWORD);
		await expect(
			verifyPassword(PASSWORD, hash, "argon2id")
		).resolves.toStrictEqual({ valid: true, needsUpgrade: false });
	});

	it("refuses a wrong password and asks for no upgrade", async () => {
		const hash = await makeCheapArgon2Hash(PASSWORD);
		await expect(
			verifyPassword("wrong-password", hash, "argon2id")
		).resolves.toStrictEqual(REFUSED);
	});

	it("does not accept a legacy PBKDF2 hash stored under argon2id", async () => {
		const outcome = await verifyPassword(
			PASSWORD,
			LEGACY_HASH,
			"argon2id"
		).catch(() => REFUSED);
		expect(outcome).toStrictEqual(REFUSED);
	});
});

describe("hashPassword", () => {
	it("makes an argon2id hash that verifies the same password and no other", async () => {
		const hash = await hashPassword(PASSWORD);

		expect(hash.startsWith("$argon2id$")).toBe(true);
		await expect(
			verifyPassword(PASSWORD, hash, "argon2id")
		).resolves.toStrictEqual({ valid: true, needsUpgrade: false });
		await expect(
			verifyPassword("wrong-password", hash, "argon2id")
		).resolves.toStrictEqual(REFUSED);
	});

	it("makes a different hash each time for the same password", async () => {
		const [first, second] = await Promise.all([
			hashPassword(PASSWORD),
			hashPassword(PASSWORD),
		]);
		expect(first).not.toBe(second);
	});
});
