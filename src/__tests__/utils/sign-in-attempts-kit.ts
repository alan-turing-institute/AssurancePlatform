import { authOptions } from "@/lib/auth/config";
import { hashPassword } from "@/lib/auth/password-service";
import type { LogEntry } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { createTestUser } from "./prisma-factories";

/**
 * Helpers for the sign-in attempt limit tests. Every sign-in goes through the
 * credentials provider's real `authorize`, called the way next-auth calls it:
 * with the posted credentials and a request whose headers are a plain object.
 */

export const PASSWORD = "correct horse battery staple";
export const OTHER_PASSWORD = "another horse battery stapler";
export const WRONG_PASSWORD = "definitely not the password";

const SIGN_IN_ENDPOINT = "sign_in";
const PAUSED = /^SignInRateLimited:(\d+)$/;
const ADDRESS_MESSAGE = /address/i;

export type SignInRequest = { headers: Record<string, string> } | undefined;
export type RequestFor = (index: number) => SignInRequest;
/** What one sign-in attempt came to: signed in, refused as wrong, or paused for N minutes. */
export type Outcome = "ok" | "wrong" | `paused:${number}`;

type Authorize = (
	credentials: Record<string, unknown> | undefined,
	request: unknown
) => Promise<{ id: string } | null>;

function credentialsAuthorize(): Authorize {
	const provider = authOptions.providers.find(
		(candidate) => candidate.id === "credentials"
	) as unknown as { options: { authorize: Authorize } };
	return provider.options.authorize;
}

/** Calls the provider's `authorize` as it stands, whatever it returns or throws. */
export function authorizeWith(
	credentials: Record<string, unknown> | undefined,
	request?: SignInRequest
) {
	return credentialsAuthorize()(credentials, request);
}

function pausedMinutes(error: unknown): string | undefined {
	return PAUSED.exec(error instanceof Error ? error.message : "")?.[1];
}

/** One password sign-in, reduced to what the person would see. */
export async function attempt(
	name: string,
	password: string,
	request?: SignInRequest
): Promise<Outcome> {
	try {
		const user = await authorizeWith({ username: name, password }, request);
		return user ? "ok" : "wrong";
	} catch (error) {
		const minutes = pausedMinutes(error);
		if (minutes === undefined) {
			throw error;
		}
		return `paused:${Number(minutes)}`;
	}
}

// ============================================
// Where a request comes from
// ============================================

/** A request carrying the address Azure's front end writes. */
export const at = (address: string): SignInRequest => ({
	headers: { "x-client-ip": address },
});

/** A different address for every index, so no address limit is reached. */
export const nth: RequestFor = (index) => at(`198.51.100.${(index % 250) + 1}`);

/** Always the same address, so the address limit counts every attempt. */
export const sameAddress =
	(address: string): RequestFor =>
	() =>
		at(address);

// ============================================
// Running attempts
// ============================================

export const times = <T>(count: number, value: T): T[] =>
	Array.from({ length: count }, () => value);

export async function sequentially<T>(
	count: number,
	run: (index: number) => Promise<T>
): Promise<T[]> {
	const results: T[] = [];
	for (let index = 0; index < count; index += 1) {
		results.push(await run(index));
	}
	return results;
}

export function together<T>(
	count: number,
	run: (index: number) => Promise<T>
): Promise<T[]> {
	return Promise.all(Array.from({ length: count }, (_, index) => run(index)));
}

/** Wrong passwords for one name, one after another. */
export function failures(
	name: string,
	count: number,
	requestFor: RequestFor = nth
): Promise<Outcome[]> {
	return sequentially(count, (index) =>
		attempt(name, WRONG_PASSWORD, requestFor(index))
	);
}

/** Wrong passwords for a different made-up name each time. */
export function failuresAcrossNames(
	count: number,
	requestFor: RequestFor = nth
): Promise<Outcome[]> {
	return sequentially(count, (index) =>
		attempt(`nobody-${index}`, WRONG_PASSWORD, requestFor(index))
	);
}

export const countOf = (outcomes: Outcome[], outcome: Outcome): number =>
	outcomes.filter((candidate) => candidate === outcome).length;

export const pausedCount = (outcomes: Outcome[]): number =>
	outcomes.filter((candidate) => candidate.startsWith("paused:")).length;

/** Ten wrong passwords let through as ordinary failures, then a pause of the full fifteen minutes. */
export const tenWrongThenPaused: Outcome[] = [
	...times(10, "wrong" as const),
	"paused:15",
];

// ============================================
// Accounts and stored attempts
// ============================================

const hashes = new Map<string, Promise<string>>();

function hashed(password: string): Promise<string> {
	let hash = hashes.get(password);
	if (!hash) {
		hash = hashPassword(password);
		hashes.set(password, hash);
	}
	return hash;
}

export async function account(
	fields: { email?: string; username?: string },
	password: string = PASSWORD
) {
	return createTestUser({
		...fields,
		passwordHash: await hashed(password),
		passwordAlgorithm: "argon2id",
	});
}

type IdentifierType = "email" | "ip";

/** How many sign-in attempts are stored against names, or against addresses. */
export function attemptRows(identifierType: IdentifierType): Promise<number> {
	return prisma.rateLimitAttempt.count({
		where: { endpoint: SIGN_IN_ENDPOINT, identifierType },
	});
}

/** The stored values for names or addresses, without repeats. */
export async function storedIdentifiers(
	identifierType: IdentifierType
): Promise<string[]> {
	const rows = await prisma.rateLimitAttempt.findMany({
		where: { endpoint: SIGN_IN_ENDPOINT, identifierType },
		select: { identifier: true },
	});
	return [...new Set(rows.map((row) => row.identifier))].sort();
}

/** How many attempts are stored against each distinct name, largest first. */
export async function rowsPerName(): Promise<number[]> {
	const groups = await prisma.rateLimitAttempt.groupBy({
		by: ["identifier"],
		where: { endpoint: SIGN_IN_ENDPOINT, identifierType: "email" },
		_count: { _all: true },
	});
	return groups.map((group) => group._count._all).sort((a, b) => b - a);
}

/**
 * Moves stored attempts into the past, as if they had happened that many
 * seconds ago. Without `oldest`, every sign-in attempt moves; with it, only
 * the earliest that many of the given type.
 */
export async function ageAttempts(options: {
	seconds: number;
	oldest?: number;
	identifierType?: IdentifierType;
}): Promise<void> {
	const rows = await prisma.rateLimitAttempt.findMany({
		where: {
			endpoint: SIGN_IN_ENDPOINT,
			identifierType: options.identifierType,
		},
		orderBy: { attemptedAt: "asc" },
		select: { id: true },
		take: options.oldest,
	});
	await prisma.rateLimitAttempt.updateMany({
		where: { id: { in: rows.map((row) => row.id) } },
		data: { attemptedAt: new Date(Date.now() - options.seconds * 1000) },
	});
}

export function pauseEvents() {
	return prisma.securityAuditLog.findMany({
		where: { eventType: "sign_in_rate_limited" },
	});
}

/** Log entries that say an address could not be read. */
export const addressWarnings = (entries: LogEntry[]): LogEntry[] =>
	entries.filter(
		(entry) => entry.level === "warn" && ADDRESS_MESSAGE.test(entry.msg)
	);
