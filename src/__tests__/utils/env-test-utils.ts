/**
 * Utility for managing environment variables in tests
 */

/**
 * Temporarily set environment variables for a test
 * @param envVars - Object containing environment variable key-value pairs
 * @param testFn - Test function to run with the modified environment
 * @returns Result of the test function
 */
export async function withEnvVars<T>(
	envVars: Record<string, string | undefined>,
	testFn: () => T | Promise<T>
): Promise<T> {
	const originalEnv: Record<string, string | undefined> = {};

	// Save original values
	for (const key of Object.keys(envVars)) {
		originalEnv[key] = process.env[key];
	}

	// Set test env vars
	for (const [key, value] of Object.entries(envVars)) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}

	try {
		// Execute test function
		const result = await testFn();
		return result;
	} finally {
		// Restore original env vars
		for (const [key, value] of Object.entries(originalEnv)) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	}
}

/**
 * Setup environment variables for a test suite
 * Returns cleanup function to restore original values
 */
export function setupEnvVars(
	envVars: Record<string, string | undefined>
): () => void {
	const originalEnv: Record<string, string | undefined> = {};

	// Save original values
	for (const key of Object.keys(envVars)) {
		originalEnv[key] = process.env[key];
	}

	// Set test env vars
	for (const [key, value] of Object.entries(envVars)) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}

	// Return cleanup function
	return () => {
		for (const [key, value] of Object.entries(originalEnv)) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	};
}
