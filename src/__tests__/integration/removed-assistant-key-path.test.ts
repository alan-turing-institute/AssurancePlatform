/**
 * The assistant's one-key-per-user path is gone: its two routes no longer
 * exist (Next answers 404 for a path with no route file), the table that held
 * the keys is dropped by a migration that runs after the model connections
 * one, and the published API description no longer lists the routes.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";

// src/__tests__/integration/ -> project root is three levels up.
const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../..");
const MIGRATIONS_DIR = path.join(PROJECT_ROOT, "prisma/migrations");
const REMOVAL = "20261012140000_remove_assistant_keys";
const CONNECTIONS = "20261012120000_user_model_connections";

const tableExists = async (): Promise<boolean> => {
	const rows = await prisma.$queryRaw<{ found: boolean }[]>`
		SELECT EXISTS (
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name = 'plugin_assistant_keys'
		) AS found`;
	return rows[0]?.found === true;
};

describe("the removed assistant key path", () => {
	it.each([
		"key",
		"options",
	])("has no route file for /api/user/plugins/assistant/%s, so the path answers 404", (name) => {
		const routeDir = path.join(
			PROJECT_ROOT,
			"app/api/user/plugins/assistant",
			name
		);
		expect(fs.existsSync(path.join(routeDir, "route.ts"))).toBe(false);
	});

	it("is absent from the published API description", () => {
		const description = fs.readFileSync(
			path.join(PROJECT_ROOT, "public/openapi.json"),
			"utf8"
		);
		expect(description).not.toContain("/api/user/plugins/assistant");
	});

	it("is removed by a migration that sorts after the model connections migration", () => {
		const names = fs
			.readdirSync(MIGRATIONS_DIR)
			.filter((name) =>
				fs.statSync(path.join(MIGRATIONS_DIR, name)).isDirectory()
			)
			.sort();
		expect(names.indexOf(REMOVAL)).toBeGreaterThan(names.indexOf(CONNECTIONS));
	});

	it("leaves no plugin_assistant_keys table once every migration is applied, and the removal can run again", async () => {
		expect(await tableExists()).toBe(false);

		const sql = fs.readFileSync(
			path.join(MIGRATIONS_DIR, REMOVAL, "migration.sql"),
			"utf8"
		);
		await prisma.$executeRawUnsafe(sql);

		expect(await tableExists()).toBe(false);
	});
});
