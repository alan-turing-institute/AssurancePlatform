/**
 * An older-style PBKDF2 password hash for tests.
 *
 * Made once from the made-up password "test-password", the salt "test-salt",
 * 10 iterations, a 32-byte key and SHA-256, with the key written as base64.
 */
export const LEGACY_PASSWORD = "test-password";
const LEGACY_SALT = "test-salt";
const LEGACY_ITERATIONS = 10;
export const LEGACY_DERIVED_KEY =
	"1MWwuTlxtyw+PnGX8OADFZkp+ENWwLlWljz6vPUpWQo=";
export const LEGACY_HASH = `pbkdf2_sha256$${LEGACY_ITERATIONS}$${LEGACY_SALT}$${LEGACY_DERIVED_KEY}`;
