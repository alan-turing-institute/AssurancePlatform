import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";

const REPO = path.resolve(import.meta.dirname, "..", "..", "..");
const EXTERNAL_UNDICI = /serverExternalPackages\s*:\s*\[[^\]]*"undici"/;

describe("the one-key path is gone", () => {
	const removedRoutes = [
		"app/api/user/plugins/assistant/key/route.ts",
		"app/api/user/plugins/assistant/options/route.ts",
	];

	it.each(removedRoutes)("has no route file at %s", (file) => {
		expect(existsSync(path.join(REPO, file))).toBe(false);
	});

	it("cannot load the old key and options routes", async () => {
		await expect(
			import("@/app/api/user/plugins/assistant/key/route" as string)
		).rejects.toThrow();
		await expect(
			import("@/app/api/user/plugins/assistant/options/route" as string)
		).rejects.toThrow();
	});

	it("has no folder left for the old routes to be served from", () => {
		expect(
			existsSync(path.join(REPO, "app/api/user/plugins/assistant/key"))
		).toBe(false);
		expect(
			existsSync(path.join(REPO, "app/api/user/plugins/assistant/options"))
		).toBe(false);
	});

	it("has no source file left that stored or read the old key or its address list", () => {
		for (const file of [
			"lib/plugins/assistant/allowed-base-urls.ts",
			"lib/plugins/assistant/key-store.ts",
			"lib/plugins/assistant/provider-config.ts",
			"lib/plugins/assistant/model.ts",
			"lib/plugins/assistant/settings/assistant-settings.tsx",
		]) {
			expect(existsSync(path.join(REPO, file))).toBe(false);
		}
	});

	it("does not describe the old routes in the API description, and describes the new ones", () => {
		const spec = JSON.parse(
			readFileSync(path.join(REPO, "public/openapi.json"), "utf8")
		) as { paths: Record<string, Record<string, unknown>> };
		const paths = Object.keys(spec.paths);
		expect(paths.filter((entry) => entry.includes("assistant/key"))).toEqual(
			[]
		);
		expect(
			paths.filter((entry) => entry.includes("assistant/options"))
		).toEqual([]);
		expect(paths).toEqual(
			expect.arrayContaining([
				"/user/models",
				"/user/models/connections",
				"/user/models/connections/{id}",
				"/user/models/connections/{id}/test",
				"/user/models/roles",
				"/user/models/quick-setup",
			])
		);
		expect(Object.keys(spec.paths["/user/models/roles"] ?? {})).toContain(
			"put"
		);
		expect(
			Object.keys(spec.paths["/user/models/connections/{id}"] ?? {}).sort()
		).toEqual(["delete", "patch"]);
	});

	it("has no table for the old keys after migrating, and has the new tables", async () => {
		const present = await prisma.$queryRaw<
			{ old: string | null; connections: string | null; roles: string | null }[]
		>`SELECT to_regclass('public.plugin_assistant_keys')::text AS old,
		         to_regclass('public.user_model_connections')::text AS connections,
		         to_regclass('public.user_model_roles')::text AS roles`;
		expect(present[0]).toEqual({
			old: null,
			connections: "user_model_connections",
			roles: "user_model_roles",
		});
		const leftovers = await prisma.$queryRaw<{ name: string }[]>`
			SELECT table_name AS name FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name LIKE '%assistant_key%'`;
		expect(leftovers).toEqual([]);
	});

	it("has no client for the old table", () => {
		expect(
			(prisma as unknown as Record<string, unknown>).pluginAssistantKey
		).toBeUndefined();
	});

	it("applied the removal as a migration of its own, after the table's own", async () => {
		const applied = await prisma.$queryRaw<{ migration_name: string }[]>`
			SELECT migration_name FROM _prisma_migrations
			WHERE migration_name LIKE '%assistant_keys%' ORDER BY migration_name`;
		expect(applied.map((row) => row.migration_name)).toEqual([
			"20261008100000_assistant_keys",
			"20261012140000_remove_assistant_keys",
		]);
	});
});

describe("the network guard is packaged", () => {
	it("lists undici as a direct dependency, and as a package Next leaves unbundled", () => {
		const manifest = JSON.parse(
			readFileSync(path.join(REPO, "package.json"), "utf8")
		) as {
			dependencies?: Record<string, string>;
			devDependencies?: Record<string, string>;
		};
		expect(Object.keys(manifest.dependencies ?? {})).toContain("undici");
		expect(Object.keys(manifest.devDependencies ?? {})).not.toContain("undici");
		const config = readFileSync(path.join(REPO, "next.config.mjs"), "utf8");
		expect(config).toMatch(EXTERNAL_UNDICI);
	});
});
