import { decryptToken, encryptToken } from "@/lib/auth/token-encryption";
import prisma from "@/lib/prisma";

/**
 * Per-user model-provider key for the assistant plugin. The value is
 * encrypted with the OAuth-token envelope before it reaches the database and
 * is decrypted only here; nothing in this module logs it, and no API route
 * returns it.
 */

/** The user's key in plaintext, or null when none is stored. */
export async function readUserApiKey(userId: string): Promise<string | null> {
	const row = await prisma.pluginAssistantKey.findUnique({
		where: { userId },
		select: { apiKeyEncrypted: true },
	});
	return row ? decryptToken(row.apiKeyEncrypted) : null;
}

/** Stores (or replaces) the user's key, encrypted. */
export async function writeUserApiKey(
	userId: string,
	key: string
): Promise<void> {
	const apiKeyEncrypted = encryptToken(key);
	await prisma.pluginAssistantKey.upsert({
		where: { userId },
		create: { userId, apiKeyEncrypted },
		update: { apiKeyEncrypted },
	});
}

/** Removes the user's key; a no-op when none is stored. */
export async function deleteUserApiKey(userId: string): Promise<void> {
	await prisma.pluginAssistantKey.deleteMany({ where: { userId } });
}

/** Whether a key is stored, without decrypting it. */
export async function hasUserApiKey(userId: string): Promise<boolean> {
	const count = await prisma.pluginAssistantKey.count({ where: { userId } });
	return count > 0;
}
