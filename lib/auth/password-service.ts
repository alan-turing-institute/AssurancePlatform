import { pbkdf2Sync } from "node:crypto";

export type PasswordAlgorithm = "django_pbkdf2" | "argon2id";

type VerifyResult = {
	valid: boolean;
	needsUpgrade: boolean;
};

/**
 * Verifies a password against a stored hash.
 * Supports Django PBKDF2_SHA256 (legacy) and argon2id (new).
 */
export async function verifyPassword(
	password: string,
	hash: string,
	algorithm: PasswordAlgorithm
): Promise<VerifyResult> {
	if (algorithm === "argon2id") {
		// Dynamic import to avoid issues when argon2 native module isn't built
		const argon2 = await import("argon2");
		const valid = await argon2.verify(hash, password);
		return { valid, needsUpgrade: false };
	}

	// Django PBKDF2_SHA256 format: pbkdf2_sha256$iterations$salt$hash
	if (algorithm === "django_pbkdf2") {
		const parts = hash.split("$");
		if (parts.length !== 4) {
			return { valid: false, needsUpgrade: false };
		}

		const [algo, iterationsStr, salt, storedHash] = parts;
		if (algo !== "pbkdf2_sha256") {
			return { valid: false, needsUpgrade: false };
		}

		const iterations = Number.parseInt(iterationsStr, 10);
		if (Number.isNaN(iterations)) {
			return { valid: false, needsUpgrade: false };
		}

		const derivedKey = pbkdf2Sync(password, salt, iterations, 32, "sha256");

		const valid = derivedKey.toString("base64") === storedHash;
		return { valid, needsUpgrade: valid }; // Upgrade if valid
	}

	return { valid: false, needsUpgrade: false };
}

/**
 * Hashes a password using argon2id.
 */
export async function hashPassword(password: string): Promise<string> {
	// Dynamic import to avoid issues when argon2 native module isn't built
	const argon2 = await import("argon2");
	return argon2.hash(password, {
		type: argon2.argon2id,
		memoryCost: 65_536,
		timeCost: 3,
		parallelism: 4,
	});
}
