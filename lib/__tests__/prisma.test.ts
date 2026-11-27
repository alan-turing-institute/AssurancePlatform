import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_DATABASE_URL =
	"postgresql://example_user:example_pw@localhost:5999/example_db";

const made = vi.hoisted(() => ({
	pools: [] as {
		pool: { ending: boolean; end: () => Promise<void> };
		options: unknown;
	}[],
}));

// `pg` is the edge of the program: the stand-in is the real pool, plus a note
// of the options each one was made with. Making a pool never connects.
vi.mock("pg", async (importOriginal) => {
	const actual = await importOriginal<typeof import("pg")>();
	class RecordingPool extends actual.Pool {
		constructor(options?: ConstructorParameters<typeof actual.Pool>[0]) {
			super(options);
			made.pools.push({ pool: this, options });
		}
	}
	return {
		...actual,
		default: { ...actual, Pool: RecordingPool },
		Pool: RecordingPool,
	};
});

interface Shared {
	pgPool?: unknown;
	prisma?: unknown;
}
const MISSING_ADDRESS_PATTERN = /DATABASE_URL/;
const shared = globalThis as unknown as Shared;

type Loaded = typeof import("../prisma");
const loadedClients: { $disconnect: () => Promise<void> }[] = [];

async function freshLoad(): Promise<Loaded> {
	vi.resetModules();
	const mod = await import("../prisma");
	loadedClients.push(
		mod.prisma as unknown as { $disconnect: () => Promise<void> }
	);
	return mod;
}

function clearShared() {
	shared.prisma = undefined;
	shared.pgPool = undefined;
}

async function closeEverything() {
	for (const client of loadedClients.splice(0)) {
		await client.$disconnect();
	}
	for (const { pool } of made.pools.splice(0)) {
		if (!pool.ending) {
			await pool.end();
		}
	}
}

beforeEach(() => {
	clearShared();
	made.pools.length = 0;
	vi.stubEnv("DATABASE_URL", TEST_DATABASE_URL);
	vi.stubEnv("NODE_ENV", "test");
	vi.stubEnv("DB_POOL_TIMEOUT_MS", "");
});

afterEach(async () => {
	await closeEverything();
	clearShared();
	vi.unstubAllEnvs();
	vi.resetModules();
});

describe("database client: required address", () => {
	it.each([
		["empty", ""],
		["unset", undefined],
	])("refuses to load when the database address is %s", async (_label, value) => {
		vi.stubEnv("DATABASE_URL", value);
		vi.resetModules();

		await expect(import("../prisma")).rejects.toThrow(MISSING_ADDRESS_PATTERN);
		expect(made.pools).toHaveLength(0);
		expect(shared.prisma).toBeUndefined();
	});

	it("loads with an address and offers the client as both the named and default export", async () => {
		const mod = await freshLoad();

		expect(mod.prisma).toBeDefined();
		expect(typeof mod.prisma.$disconnect).toBe("function");
		expect(mod.default).toBe(mod.prisma);
	});
});

describe("database client: connection pool options", () => {
	it("makes one pool from the address and the default acquisition timeout", async () => {
		await freshLoad();

		expect(made.pools.map((p) => p.options)).toStrictEqual([
			{ connectionString: TEST_DATABASE_URL, connectionTimeoutMillis: 5000 },
		]);
	});

	it("takes the acquisition timeout from the pool setting", async () => {
		vi.stubEnv("DB_POOL_TIMEOUT_MS", "1234");
		await freshLoad();

		expect(made.pools.map((p) => p.options)).toStrictEqual([
			{ connectionString: TEST_DATABASE_URL, connectionTimeoutMillis: 1234 },
		]);
	});
});

describe("database client: reuse outside production", () => {
	it("keeps the client and the pool on the global object", async () => {
		const mod = await freshLoad();

		expect(shared.prisma).toBe(mod.prisma);
		expect(shared.pgPool).toBe(made.pools[0]?.pool);
	});

	it("gives a second fresh load the same client and makes no second pool", async () => {
		const first = await freshLoad();
		const second = await freshLoad();

		expect(second.prisma).toBe(first.prisma);
		expect(made.pools).toHaveLength(1);
	});

	it("reuses the kept pool when only the client is missing", async () => {
		const first = await freshLoad();
		shared.prisma = undefined;
		const second = await freshLoad();

		expect(second.prisma).not.toBe(first.prisma);
		expect(made.pools).toHaveLength(1);
		expect(shared.pgPool).toBe(made.pools[0]?.pool);
		expect(shared.prisma).toBe(second.prisma);
	});
});

describe("database client: production", () => {
	it("keeps nothing on the global object", async () => {
		vi.stubEnv("NODE_ENV", "production");
		const mod = await freshLoad();

		expect(mod.prisma).toBeDefined();
		expect(made.pools).toHaveLength(1);
		expect(shared.pgPool).toBeUndefined();
		expect(shared.prisma).toBeUndefined();
	});

	it("makes a new pool and client on each fresh load", async () => {
		vi.stubEnv("NODE_ENV", "production");
		const first = await freshLoad();
		const second = await freshLoad();

		expect(second.prisma).not.toBe(first.prisma);
		expect(made.pools).toHaveLength(2);
	});
});
