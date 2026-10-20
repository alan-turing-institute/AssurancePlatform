import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import type { Pool, PoolClient } from "pg";
import prisma from "@/lib/prisma";

/**
 * Makes the app's real Postgres client fail with a real driver error, without
 * replacing any part of it. The app's connection pool (`globalThis.pgPool`,
 * built by `lib/prisma.ts`) is pointed at a place that cannot serve it, and
 * its idle connections are closed so the next query has to open a new one.
 * What the app then catches is what it would catch in a production outage,
 * and the message names the thing that was wrong: a port, a database or a
 * role.
 *
 * Arrange all data first: nothing can be read or written until `end()`.
 */

export type OutageKind = "refused" | "unknown-database" | "unknown-role";

export interface Outage {
	/** Stops the outage; the pool opens its next connection to the real database again. */
	end(): void;
	/** The password in the connection string the pool was pointed at. */
	readonly password: string;
	/** Pieces of the connection that a driver message about this outage names. */
	readonly revealing: string[];
}

function appPool(): Pool {
	const pool = (globalThis as unknown as { pgPool?: Pool }).pgPool;
	if (!pool) {
		throw new Error("The app's connection pool has not been created");
	}
	return pool;
}

/** A port on 127.0.0.1 that nothing is listening on. */
async function closedPort(): Promise<number> {
	const server = createServer();
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	const port = typeof address === "object" && address ? address.port : 0;
	await new Promise<void>((resolve) => server.close(() => resolve()));
	return port;
}

/** Closes every idle connection the pool holds, so that the next query opens one. */
async function closeIdleConnections(pool: Pool): Promise<void> {
	const held: PoolClient[] = [];
	for (let i = pool.idleCount; i > 0; i--) {
		held.push(await pool.connect());
	}
	for (const client of held) {
		client.release(true);
	}
}

export async function startDatabaseOutage(
	kind: OutageKind = "refused"
): Promise<Outage> {
	const pool = appPool();
	const suffix = randomBytes(4).toString("hex");
	const password = `Leak-Pw-${suffix}`;
	const real = new URL(process.env.DATABASE_URL ?? "");
	const target = new URL(real.toString());
	const revealing: string[] = [];
	if (kind === "refused") {
		const port = await closedPort();
		target.hostname = "127.0.0.1";
		target.port = String(port);
		target.username = `leak_role_${suffix}`;
		target.password = password;
		revealing.push(String(port));
	} else if (kind === "unknown-database") {
		target.pathname = `/leak_db_${suffix}`;
		revealing.push(`leak_db_${suffix}`);
	} else {
		target.username = `leak_role_${suffix}`;
		target.password = password;
		revealing.push(`leak_role_${suffix}`);
	}
	const original = pool.options.connectionString;
	await closeIdleConnections(pool);
	pool.options.connectionString = target.toString();
	return {
		password,
		revealing,
		end: () => {
			pool.options.connectionString = original;
		},
	};
}

/**
 * Makes every connection the app's pool is asked for fail with `failure`,
 * thrown as given (an error, a string or anything else). Prisma and the
 * driver adapter above the pool are the real ones, so what the app catches is
 * what they make of the failure. For messages and values a real server does
 * not produce, such as a connection string with a password in it.
 */
export async function startDriverFailure(
	failure: unknown
): Promise<{ end(): void }> {
	const pool = appPool();
	await closeIdleConnections(pool);
	const refuse = () => Promise.reject(failure);
	Object.assign(pool, { connect: refuse, query: refuse });
	return {
		end: () => {
			Reflect.deleteProperty(pool, "connect");
			Reflect.deleteProperty(pool, "query");
		},
	};
}

/** The error the app's real client throws for a query while an outage lasts. */
export async function errorDuringOutage(): Promise<Error> {
	try {
		await prisma.user.count({ take: 1 });
	} catch (error) {
		if (error instanceof Error) {
			return error;
		}
		throw new Error("The client threw something that is not an Error");
	}
	throw new Error("The query succeeded, so there is no outage");
}

/** Runs `work` during an outage of this kind and always ends the outage. */
export async function duringOutage<T>(
	kind: OutageKind,
	work: (outage: Outage) => Promise<T>
): Promise<T> {
	const outage = await startDatabaseOutage(kind);
	try {
		return await work(outage);
	} finally {
		outage.end();
	}
}
