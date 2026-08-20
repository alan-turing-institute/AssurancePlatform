import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
	cleanElementDataForType,
	validateElementData,
} from "@/lib/schemas/element-validation";
import { Prisma, PrismaClient } from "@/src/generated/prisma";

const globalForPrisma = globalThis as unknown as {
	prisma: ExtendedPrismaClient;
	pgPool: Pool;
};

/**
 * Validates and cleans element data for create operations.
 * @returns The cleaned data
 * @throws Error if validation fails
 */
function validateCreateData<T extends Record<string, unknown>>(data: T): T {
	const elementType = data.elementType as string | undefined;
	if (!elementType) {
		return data;
	}

	// Skip validation if disabled via environment variable
	if (process.env.SKIP_ELEMENT_VALIDATION === "true") {
		return data;
	}

	const cleanedData = cleanElementDataForType(elementType, data);
	const result = validateElementData(elementType, cleanedData);

	if (!result.valid) {
		throw new Error(
			`Element validation failed for ${elementType}: ${result.errors.join(", ")}`
		);
	}

	return cleanedData as T;
}

/**
 * Cleans element data for update operations.
 * @returns The cleaned data, or original if no elementType present
 */
function cleanUpdateData<T extends Record<string, unknown>>(data: T): T {
	const elementType = data.elementType as string | undefined;
	if (!elementType) {
		return data;
	}

	// Skip cleaning if disabled via environment variable
	if (process.env.SKIP_ELEMENT_VALIDATION === "true") {
		return data;
	}

	return cleanElementDataForType(elementType, data) as T;
}

/**
 * Creates element validation extension for Prisma Client.
 * Intercepts create/update operations on AssuranceElement to clean
 * and validate type-specific fields.
 */
function createElementValidationExtension() {
	return Prisma.defineExtension({
		name: "element-validation",
		query: {
			assuranceElement: {
				create({ args, query }) {
					if (args.data) {
						args.data = validateCreateData(
							args.data as Record<string, unknown>
						) as typeof args.data;
					}
					return query(args);
				},
				update({ args, query }) {
					if (args.data) {
						args.data = cleanUpdateData(
							args.data as Record<string, unknown>
						) as typeof args.data;
					}
					return query(args);
				},
				upsert({ args, query }) {
					if (args.create) {
						args.create = validateCreateData(
							args.create as Record<string, unknown>
						) as typeof args.create;
					}
					if (args.update) {
						args.update = cleanUpdateData(
							args.update as Record<string, unknown>
						) as typeof args.update;
					}
					return query(args);
				},
			},
		},
	});
}

/** Extended Prisma client type with validation extension */
type ExtendedPrismaClient = ReturnType<typeof createExtendedPrismaClient>;

function createExtendedPrismaClient() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error("DATABASE_URL environment variable is required");
	}

	// Create a PostgreSQL connection pool.
	//
	// `connectionTimeoutMillis` is NOT optional here. `@prisma/adapter-pg`
	// hands connection pooling entirely to this bare `pg.Pool` — Prisma's own
	// engine-level pool (and its `pool_timeout` / P2024 error) never comes
	// into play with a driver adapter. `pg-pool` only pushes a waiting
	// acquisition onto its pending queue with a timeout when
	// `connectionTimeoutMillis` is set (see `pg-pool/index.js`); left
	// `undefined`, a request that arrives while every pool slot is checked
	// out waits *forever* for a connection — no error, no rejection, ever.
	// That is the exact shape of "TEA — Status endpoint can hang
	// indefinitely" (silent hang, no server-side error, only relieved once
	// another connection happens to free up): confirmed by a standalone
	// repro (issue evidence) that saturating this same `pg.Pool` config
	// leaves an extra query unsettled for 8s+ with this option unset, vs.
	// erroring at ~3000ms with it set. Any transient contention for
	// connections — not just this route — was previously invisible until it
	// resolved or the client itself gave up.
	const pool =
		globalForPrisma.pgPool ||
		new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
	if (process.env.NODE_ENV !== "production") {
		globalForPrisma.pgPool = pool;
	}

	// Create Prisma adapter
	// Cast needed: @types/pg version in @prisma/adapter-pg (8.11) differs from project (8.18)
	// biome-ignore lint/suspicious/noExplicitAny: type version mismatch between @types/pg versions
	const adapter = new PrismaPg(pool as any);

	// Create base client and extend with validation
	const client = new PrismaClient({ adapter }).$extends(
		createElementValidationExtension()
	);

	return client;
}

// Keep createPrismaClient for backward compatibility
function createPrismaClient() {
	return createExtendedPrismaClient();
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
}

export default prisma;
